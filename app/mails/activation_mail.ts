import { BaseMail } from '@adonisjs/mail'
import env from '#start/env'
import type User from '#models/user'

/**
 * Sent once, right after AuthService.register creates the account. The
 * activation link carries the raw ActivationToken value that
 * AuthService.activate later looks up by exact match; this class never
 * touches the database itself, it only formats what AuthService already
 * generated and persisted.
 *
 * This project has no Edge/view provider (see config/mail.ts's own note),
 * so the body is built as a plain string right here instead of being
 * rendered from a template file. Both a text and an HTML view are set so
 * the message renders correctly regardless of the mail client's
 * capabilities; Mailhog (this project's only mail sink, in every
 * environment) shows both.
 */
export default class ActivationMail extends BaseMail {
  subject = 'Activate your account'

  constructor(
    private user: User,
    private token: string
  ) {
    super()
  }

  /**
   * NOTE: `/activate?token=...` is not a real route anywhere in this
   * API-only project (there is no frontend to receive the redirect); the
   * README explicitly allows a placeholder link here since the goal is
   * only for the token to be readable in Mailhog, not to be clickable
   * end-to-end.
   */
  prepare() {
    const activationUrl = `${env.get('APP_URL')}/activate?token=${this.token}`

    this.message
      .to(this.user.email)
      .subject(this.subject)
      .text(
        `Hi ${this.user.firstName},\n\n` +
          `Welcome to AdonisJS Tutorial. Activate your account by visiting the link below:\n\n` +
          `${activationUrl}\n\n` +
          `This link expires in 24 hours.`
      )
      .html(
        `<p>Hi ${this.user.firstName},</p>` +
          `<p>Welcome to AdonisJS Tutorial. Activate your account by clicking the link below:</p>` +
          `<p><a href="${activationUrl}">${activationUrl}</a></p>` +
          `<p>This link expires in 24 hours.</p>`
      )
  }
}
