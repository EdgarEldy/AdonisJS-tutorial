import vine from '@vinejs/vine'

/**
 * Password complexity rule shared by registration and password reset.
 *
 * The README only specifies `minLength(8)` plus "a complexity regex"
 * without naming the exact rule, so this project settles on the common
 * baseline of at least one lowercase letter, one uppercase letter and one
 * digit. `minLength(8)` is still applied separately below since this
 * regex alone would also accept a 3-character password.
 *
 * NOTE: this decision (the exact complexity rule) is not spelled out in
 * the README and is left to this validator's judgment.
 */
const passwordComplexity = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/

/**
 * POST /api/v1/auth/register
 *
 * Field lengths mirror the `users` table constraints from the README's
 * Auth Model section (first_name VARCHAR(50), last_name VARCHAR(100),
 * email VARCHAR(100)) so a payload that would violate the DB column length
 * is rejected as a 422 validation error instead of a raw DB error.
 */
export const registerSchema = vine.compile(
  vine.object({
    firstName: vine.string().trim().minLength(1).maxLength(50),
    lastName: vine.string().trim().minLength(1).maxLength(100),
    email: vine.string().trim().maxLength(100).email(),
    password: vine.string().minLength(8).regex(passwordComplexity),
  })
)

/**
 * POST /api/v1/auth/login
 *
 * The password field intentionally has no minLength/complexity check here:
 * login validates a credential against whatever is already stored, so
 * rejecting a short password before it even reaches AuthService.login
 * would turn a "wrong password" case into a confusing 422 instead of the
 * expected 400 E_INVALID_CREDENTIALS.
 */
export const loginSchema = vine.compile(
  vine.object({
    email: vine.string().trim().email(),
    password: vine.string(),
  })
)

/**
 * POST /api/v1/auth/activate
 *
 * NOTE: the README does not spell out this schema's shape; it only lists
 * `registerSchema`, `loginSchema` and `resetPasswordSchema` explicitly and
 * leaves the rest to "whatever additional schemas the other AuthController
 * actions genuinely need". Activation is a single opaque token round trip,
 * so a bare token string is all that is required.
 */
export const activateSchema = vine.compile(
  vine.object({
    token: vine.string().trim().minLength(1),
  })
)

/**
 * POST /api/v1/auth/forgot-password
 *
 * NOTE: same as above, not enumerated in the README. Only an email is
 * needed to look up the account and issue a PasswordResetToken.
 */
export const forgotPasswordSchema = vine.compile(
  vine.object({
    email: vine.string().trim().email(),
  })
)

/**
 * POST /api/v1/auth/reset-password
 *
 * Reuses the same complexity rule as registration since both operations
 * end with the same @beforeSave hashing hook on User and should not allow
 * a weaker password through the back door of the reset flow.
 */
export const resetPasswordSchema = vine.compile(
  vine.object({
    token: vine.string().trim().minLength(1),
    password: vine.string().minLength(8).regex(passwordComplexity),
  })
)
