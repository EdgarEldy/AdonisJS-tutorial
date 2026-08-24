import { errors as authErrors } from '@adonisjs/auth'
import { createError } from '@adonisjs/core/exceptions'
import hash from '@adonisjs/core/services/hash'
import { DateTime } from 'luxon'
import type { Infer } from '@vinejs/vine/types'

import User from '#models/user'
import Role from '#models/role'
import ActivationToken from '#models/activation_token'
import BlacklistedToken from '#models/blacklisted_token'
import PasswordResetToken from '#models/password_reset_token'
import { signJwt, type JwtPayload } from '#auth/jwt_guard'
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
   * never here), assigns the default USER role, and issues an activation
   * token.
   *
   * The raw activation token is returned to the caller rather than only
   * being persisted. There is no mail provider wired up on this branch,
   * so returning the token is the documented placeholder for delivering
   * it by email, the same pattern `forgotPassword` uses below. Without
   * this, the register -> activate -> login functional test flow the
   * README's own task list requires would have no way to obtain the token.
   */
  async register(data: RegisterPayload) {
    const userRole = await Role.findByOrFail('roleName', DEFAULT_USER_ROLE)

    const user = await User.create({
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      password: data.password,
      enabled: false,
      accountLocked: false,
    })

    await user.related('roles').attach([userRole.id])

    const activationToken = await ActivationToken.create({
      userId: user.id,
      token: crypto.randomUUID(),
      expiresAt: DateTime.now().plus({ hours: ACTIVATION_TOKEN_TTL_HOURS }),
    })

    return { user, activationToken: activationToken.token }
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
    const user = await User.query().where('email', data.email).first()

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
   * Issues a PasswordResetToken and returns the raw token. As with
   * `register`'s activation token, there is no mail provider on this
   * branch, so returning the raw value is the documented placeholder for
   * email delivery.
   *
   * NOTE: a production system would return a generic success response
   * regardless of whether the email exists, to avoid leaking which
   * addresses are registered. This tutorial uses `findByOrFail` (404 on
   * an unknown email) instead, favouring explicit, testable behaviour
   * over that hardening, consistent with the rest of this branch's scope.
   */
  async forgotPassword(email: string) {
    const user = await User.findByOrFail('email', email)

    const resetToken = await PasswordResetToken.create({
      userId: user.id,
      token: crypto.randomUUID(),
      type: PASSWORD_RESET_TOKEN_TYPE,
      expiryDate: DateTime.now().plus({ hours: PASSWORD_RESET_TOKEN_TTL_HOURS }),
    })

    return resetToken.token
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
