import { errors as authErrors } from '@adonisjs/auth'
import { createError } from '@adonisjs/core/exceptions'
import hash from '@adonisjs/core/services/hash'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import mail from '@adonisjs/mail/services/main'
import { DateTime } from 'luxon'
import type { Infer } from '@vinejs/vine/types'

import User from '#models/user'
import Role from '#models/role'
import ActivationToken from '#models/activation_token'
import BlacklistedToken from '#models/blacklisted_token'
import PasswordResetToken from '#models/password_reset_token'
import { signJwt, type JwtPayload } from '#auth/jwt_guard'
import ActivationMail from '#mails/activation_mail'
import PasswordResetMail from '#mails/password_reset_mail'
import type { registerSchema, loginSchema, resetPasswordSchema } from '#validators/auth_validator'

type RegisterPayload = Infer<typeof registerSchema>
type LoginPayload = Infer<typeof loginSchema>
type ResetPasswordPayload = Infer<typeof resetPasswordSchema>

/**
 * Default role every self-registered account receives. Matches the
 * `roleName` seeded by database/seeders/user_seeder.ts, so registration
 * only works once that seed data exists, the same dependency the seeder
 * itself documents.
 */
const DEFAULT_USER_ROLE = 'USER'

/**
 * NOTE: `password_reset_tokens.type` is not enumerated anywhere in the
 * README beyond "VARCHAR(255) NOT NULL"; the PasswordResetToken model's
 * own NOTE leaves the concrete values up to whichever branch owns the
 * reset flow. A single literal value is used here since this branch has
 * exactly one kind of reset token; `resetPassword` checks it defensively
 * so a token row created for a different purpose in the future cannot be
 * replayed against this endpoint.
 */
const PASSWORD_RESET_TOKEN_TYPE = 'password_reset'

/** Activation tokens are valid for 24 hours from issuance. */
const ACTIVATION_TOKEN_TTL_HOURS = 24

/** Password reset tokens are valid for 1 hour, shorter-lived than activation since they grant account takeover if leaked. */
const PASSWORD_RESET_TOKEN_TTL_HOURS = 1

const E_ACCOUNT_NOT_ACTIVATED = createError(
  'Account is not activated',
  'E_ACCOUNT_NOT_ACTIVATED',
  403
)
const E_ACCOUNT_LOCKED = createError('Account is locked', 'E_ACCOUNT_LOCKED', 403)
const E_EMAIL_TAKEN = createError('Email is already registered', 'E_EMAIL_TAKEN', 409)
const E_TOKEN_ALREADY_USED = createError('Token has already been used', 'E_TOKEN_ALREADY_USED', 400)
const E_TOKEN_EXPIRED = createError('Token has expired', 'E_TOKEN_EXPIRED', 400)
const E_INVALID_RESET_TOKEN = createError(
  'Invalid password reset token',
  'E_INVALID_RESET_TOKEN',
  400
)

/**
 * Encapsulates the full account lifecycle: register -> activate -> login
 * -> logout -> forgot password -> reset password -> me. Controllers never
 * touch User, ActivationToken, BlacklistedToken or PasswordResetToken
 * directly; every read or write to those models goes through this class.
 *
 * This service has no constructor dependencies (every collaborator is
 * either a static Lucid model or a plain imported function), so it is not
 * decorated with `@inject()`. The IoC container instantiates a class with
 * no constructor arguments the same way `new AuthService()` would, and
 * AuthController itself is the one that needs `@inject()` since it takes
 * this service as a constructor argument.
 */
export default class AuthService {
  /**
   * Creates the user (password hashing happens in User's @beforeSave hook,
   * never here), assigns the default USER role, issues an activation
   * token, and emails it via ActivationMail.
   *
   * The raw activation token is no longer returned to the caller. A real
   * mailer is wired up on this branch (SMTP against Mailhog), so echoing
   * the token in the HTTP response would defeat the point of delivering it
   * out of band: anyone who could read the API response could also
   * activate the account, which is exactly the class of leak email
   * delivery exists to close. The token is still persisted on
   * ActivationToken exactly as before; only its delivery channel changed.
   *
   * The mail send happens after the transaction commits, not inside it.
   * Sending mail is not transactional (there is no way to "roll back" an
   * SMTP call), so keeping it outside the `db.transaction` block means a
   * mail delivery failure can never mark an otherwise-successful
   * registration as failed, and a transaction rollback (for example a
   * unique-email race) can never result in an activation email for a user
   * row that was never actually committed.
   *
   * All three writes run inside a single transaction. Without one, a
   * crash or a thrown error between `User.create` and `ActivationToken.create`
   * would leave a user row permanently stuck: disabled, no role attached,
   * no activation token to ever enable it, and unrecoverable through the
   * unique email constraint. A transaction makes the whole registration
   * succeed or fail as one unit instead.
   */
  async register(data: RegisterPayload): Promise<User> {
    const email = data.email.toLowerCase()
    const userRole = await Role.findByOrFail('roleName', DEFAULT_USER_ROLE)

    // Pre-checked here rather than letting the migration's UNIQUE constraint
    // reject the insert: a raw Postgres constraint error has no .status
    // property, so app/exceptions/handler.ts's generic branch would turn a
    // routine duplicate registration into an unhandled 500 instead of a
    // clean 409. This is the same class of race UsersService.update already
    // guards against, just at creation time instead of update time.
    const existing = await User.findBy('email', email)
    if (existing) {
      throw new E_EMAIL_TAKEN()
    }

    const { user, token } = await db.transaction(async (trx) => {
      const newUser = await User.create(
        {
          firstName: data.firstName,
          lastName: data.lastName,
          email,
          password: data.password,
          enabled: false,
          accountLocked: false,
        },
        { client: trx }
      )

      await newUser.related('roles').attach([userRole.id])

      const activationToken = await ActivationToken.create(
        {
          userId: newUser.id,
          token: crypto.randomUUID(),
          expiresAt: DateTime.now().plus({ hours: ACTIVATION_TOKEN_TTL_HOURS }),
        },
        { client: trx }
      )

      return { user: newUser, token: activationToken.token }
    })

    // The user, role attachment and activation token are already committed
    // at this point. A mail delivery failure (SMTP down, Mailhog
    // unreachable) must not turn an otherwise-successful registration into
    // a 500 the client would retry into an E_EMAIL_TAKEN conflict against
    // an account they cannot yet activate. Logged and swallowed instead;
    // the token is still in the database for a future resend flow to use.
    try {
      await mail.send(new ActivationMail(user, token))
    } catch (error) {
      logger.error({ err: error, userId: user.id }, 'failed to send activation email')
    }

    return user
  }

  /**
   * Validates an activation token (must exist, not already validated, not
   * expired) and flips the account to enabled.
   */
  async activate(token: string) {
    const activationToken = await ActivationToken.query().where('token', token).firstOrFail()

    if (activationToken.validatedAt) {
      throw new E_TOKEN_ALREADY_USED()
    }
    if (activationToken.expiresAt && activationToken.expiresAt < DateTime.now()) {
      throw new E_TOKEN_EXPIRED()
    }

    const user = await User.findOrFail(activationToken.userId)
    user.enabled = true
    await user.save()

    activationToken.validatedAt = DateTime.now()
    await activationToken.save()

    return user
  }

  /**
   * Verifies the password with `hash.verify()`, then checks `enabled` and
   * `accountLocked`, in that order, matching the README's task
   * description. A missing user and a wrong password both raise the same
   * `E_INVALID_CREDENTIALS` (400) so the response never confirms whether
   * an email address is registered.
   */
  async login(data: LoginPayload) {
    const user = await User.query().where('email', data.email.toLowerCase()).first()

    if (!user || !user.password || !(await hash.verify(user.password, data.password))) {
      throw new authErrors.E_INVALID_CREDENTIALS('Invalid email or password')
    }

    if (!user.enabled) {
      throw new E_ACCOUNT_NOT_ACTIVATED()
    }
    if (user.accountLocked) {
      throw new E_ACCOUNT_LOCKED()
    }

    const token = await signJwt(user)
    return { user, token }
  }

  /**
   * Blacklists the JWT presented for this request by writing its `jti`
   * (and the raw token, required by the NOT NULL `token` column) into
   * `blacklisted_tokens`. AuthMiddleware rejects any future request
   * bearing this `jti` regardless of the token's own expiry.
   *
   * NOTE: `blacklisted_tokens.validated_at` mirrors ActivationToken's
   * column shape but has no meaning for a blacklist entry (a blacklisted
   * token is never "validated"), so it is left null here.
   */
  async logout(user: User, payload: JwtPayload, rawToken: string) {
    await BlacklistedToken.create({
      userId: user.id,
      token: rawToken,
      jti: payload.jti,
      blacklistedAt: DateTime.now(),
      expiresAt: DateTime.fromSeconds(payload.exp),
    })
  }

  /**
   * Issues a fresh JWT for an already-authenticated user.
   *
   * NOTE: not explicitly listed among AuthService's methods in the
   * README's task checklist, only the `refresh` endpoint's row in the
   * Endpoints table ("Issue new JWT (if not blacklisted)"). The
   * "if not blacklisted" precondition is enforced by AuthMiddleware before
   * this ever runs (the route requires `middleware.auth()`), so this
   * method's own job is just re-checking enabled/accountLocked, the same
   * guard `login` applies, since an account can be locked after its
   * original token was issued. This does not blacklist the token being
   * refreshed; the README does not ask for rotation, only reissuance.
   */
  async refresh(user: User) {
    if (!user.enabled) {
      throw new E_ACCOUNT_NOT_ACTIVATED()
    }
    if (user.accountLocked) {
      throw new E_ACCOUNT_LOCKED()
    }

    return signJwt(user)
  }

  /**
   * Issues a PasswordResetToken and emails it via PasswordResetMail. As
   * with `register`'s activation token, the raw value is no longer
   * returned to the caller now that a real mailer is wired up; the token
   * is still persisted on PasswordResetToken exactly as before, only its
   * delivery channel and this method's return value changed. Returning
   * void rather than the user keeps the controller from having anything
   * meaningful to echo back beyond a confirmation message.
   *
   * NOTE: a production system would return a generic success response
   * regardless of whether the email exists, to avoid leaking which
   * addresses are registered. This tutorial uses `findByOrFail` (404 on
   * an unknown email) instead, favouring explicit, testable behaviour
   * over that hardening, consistent with the rest of this branch's scope.
   */
  async forgotPassword(email: string): Promise<void> {
    const user = await User.findByOrFail('email', email.toLowerCase())

    const resetToken = await PasswordResetToken.create({
      userId: user.id,
      token: crypto.randomUUID(),
      type: PASSWORD_RESET_TOKEN_TYPE,
      expiryDate: DateTime.now().plus({ hours: PASSWORD_RESET_TOKEN_TTL_HOURS }),
    })

    // Same reasoning as register(): the reset token is already committed,
    // so a mail delivery failure here must not surface as a 500 for a
    // request that otherwise succeeded.
    try {
      await mail.send(new PasswordResetMail(user, resetToken.token))
    } catch (error) {
      logger.error({ err: error, userId: user.id }, 'failed to send password reset email')
    }
  }

  /**
   * Validates the token's type and expiry, updates the password (hashed
   * again by User's @beforeSave hook, not here), then deletes the token
   * so it cannot be replayed.
   */
  async resetPassword(data: ResetPasswordPayload) {
    const resetToken = await PasswordResetToken.query().where('token', data.token).firstOrFail()

    if (resetToken.type !== PASSWORD_RESET_TOKEN_TYPE) {
      throw new E_INVALID_RESET_TOKEN()
    }
    if (resetToken.expiryDate < DateTime.now()) {
      throw new E_TOKEN_EXPIRED()
    }

    const user = await User.findOrFail(resetToken.userId)
    user.password = data.password
    await user.save()

    await resetToken.delete()

    return user
  }

  /**
   * Returns the authenticated user with `roles` and, for each role, its
   * `permissions` preloaded, per the README's task description ("preloaded
   * roles and permissions"). `auth.user` never auto-loads relations (the
   * same caveat AuthMiddleware and RoleMiddleware work around), so this
   * explicit preload is required here too.
   */
  async me(user: User) {
    await user.load('roles', (rolesQuery) => {
      rolesQuery.preload('permissions')
    })

    return user
  }
}
