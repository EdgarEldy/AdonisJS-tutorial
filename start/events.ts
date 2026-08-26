/*
|--------------------------------------------------------------------------
| Events file
|--------------------------------------------------------------------------
|
| Event -> listener bindings are registered here, not in start/kernel.ts:
| kernel.ts wires up the HTTP middleware pipeline, while this file wires up
| application-level domain events, a separate concern. Registered as a
| preload in adonisrc.ts so every binding is active before the HTTP server
| starts accepting requests.
|
*/

import logger from '@adonisjs/core/services/logger'
import emitter from '@adonisjs/core/services/emitter'
import OrderCreated from '#events/order_created'

emitter.on(OrderCreated, () => import('#listeners/send_order_notification'))

// OrdersService.create() calls emitter.emit() without awaiting or catching
// it, matching the fire-and-forget style the README's own code sample
// uses. emit() returns a Promise<void> that rejects if a listener throws
// and no error handler is registered, which becomes an unhandled promise
// rejection, and Node terminates the process on those by default. This
// catches any listener failure centrally instead, logging it rather than
// crashing the server over one bad notification.
emitter.onError((event, error) => {
  // `event` is either an event name string or the event class itself; for
  // a class, .name gives the readable class name ("OrderCreated") instead
  // of String()'s full source dump of the class body.
  const eventName = typeof event === 'function' ? event.name : String(event)
  logger.error({ err: error, event: eventName }, 'unhandled error in an event listener')
})
