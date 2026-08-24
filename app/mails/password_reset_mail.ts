import { BaseMail } from '@adonisjs/mail'
import env from '#start/env'
import type User from '#models/user'

/**
 * Sent by AuthService.forgotPassword after a PasswordResetToken row is
 * persisted. The token is only ever readable by whoever receives this
 * email (or, in this tutorial, whoever opens Mailhog); it is never echoed
 * back in the HTTP response, since a response body is a far more likely
 * leak vector than an email sent to the account's own address.
 *
 * Shorter-lived than ActivationMail's link (1 hour vs 24), matching
 * PASSWORD_RESET_TOKEN_TTL_HOURS in auth_service.ts, so the copy below
 * states that explicitly rather than repeating a generic expiry claim.
 */
export default class PasswordResetMail extends BaseMail {
  subject = 'Reset your password'

  constructor(
    private user: User,
    private token: string
  ) {
    super()
  }

  /**
   * NOTE: same placeholder-link reasoning as ActivationMail — this is an
   * API-only project, `/reset-password?token=...` does not resolve to a
   * real frontend route, it only needs to be readable in Mailhog.
   */
  prepare() {
    const resetUrl = `${env.get('APP_URL')}/reset-password?token=${this.token}`

    this.message
      .to(this.user.email)
      .subject(this.subject)
      .text(
        `Hi ${this.user.firstName},\n\n` +
          `We received a request to reset your password. Visit the link below to choose a new one:\n\n` +
          `${resetUrl}\n\n` +
          `This link expires in 1 hour. If you did not request this, you can ignore this email.`
      )
      .html(
        `<p>Hi ${this.user.firstName},</p>` +
          `<p>We received a request to reset your password. Click the link below to choose a new one:</p>` +
          `<p><a href="${resetUrl}">${resetUrl}</a></p>` +
          `<p>This link expires in 1 hour. If you did not request this, you can ignore this email.</p>`
      )
  }
}
