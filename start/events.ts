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

import emitter from '@adonisjs/core/services/emitter'
import OrderCreated from '#events/order_created'

emitter.on(OrderCreated, () => import('#listeners/send_order_notification'))
