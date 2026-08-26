import logger from '@adonisjs/core/services/logger'
import type OrderCreated from '#events/order_created'

/**
 * Reacts to OrderCreated by logging that an order was placed.
 *
 * NOTE: the README's Tasks checklist for this listener only asks to "log
 * the event + placeholder for email delivery", and explicitly calls out
 * that a log-only implementation with a clear placeholder is acceptable
 * and simpler than actually wiring up a confirmation email. This project
 * does have `@adonisjs/mail` configured with Mailhog available, but
 * standing up a real mailable (template, `Mail.send()`, a functional test
 * asserting on the Mailhog inbox) is meaningfully more surface area than
 * this task asks for, so it is left as the placeholder below rather than
 * built out here.
 */
export default class SendOrderNotification {
  async handle(event: OrderCreated) {
    logger.info(
      { orderId: event.orderId, customerId: event.customerId },
      'order created, notification pending'
    )

    // NOTE: placeholder for real email delivery. A real implementation
    // would load the Order (with its customer and product preloaded) and
    // send a confirmation mailable via @adonisjs/mail, e.g.
    // await mail.send((message) => message.to(order.customer.email).subject(...))
  }
}
