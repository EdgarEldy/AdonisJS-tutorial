import env from '#start/env'
import { defineConfig, transports } from '@adonisjs/mail'

/**
 * Mail bodies in this project are built as plain strings inside the mailer
 * classes themselves (see app/mails/), not rendered from Edge templates.
 * This project has no view provider configured anywhere, it is an API only
 * service per the README's own architecture, so there is no globals block
 * here for template variables the way the package's own scaffold suggests.
 */
const mailConfig = defineConfig({
  default: env.get('MAIL_MAILER'),

  from: {
    address: env.get('MAIL_FROM_ADDRESS'),
    name: env.get('MAIL_FROM_NAME'),
  },

  /**
   * SMTP pointed at Mailhog in every environment, development and test
   * alike, so registration and password reset emails are always visible in
   * Mailhog's web UI instead of attempting real delivery.
   */
  mailers: {
    smtp: transports.smtp({
      host: env.get('SMTP_HOST'),
      port: env.get('SMTP_PORT'),
    }),
  },
})

export default mailConfig

declare module '@adonisjs/mail/types' {
  export interface MailersList extends InferMailers<typeof mailConfig> {}
}
