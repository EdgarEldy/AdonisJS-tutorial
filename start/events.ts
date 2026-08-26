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

// NOTE: this bare import is not part of the README's own code sample for
// this file and deserves an explanation. adonisrc.ts's preloads array is
// imported via Promise.all (genuinely parallel, not sequential), and both
// this file and start/kernel.ts resolve a container-backed singleton
// through AdonisJS's `await app.booted(...)` pattern (this file via the
// emitter service, kernel.ts via the router/server services). Reproduced
// locally: with only one preload doing that (kernel.ts, pre-existing),
// the full test suite is rock solid; the moment a second preload also
// resolves a service that way, `node ace test` intermittently throws
// "Cannot access 'middleware' before initialization" out of start/routes.ts,
// a TDZ error consistent with a module-loader race between the two
// concurrently-evaluating top-level-await graphs. A bare `import
// '#start/kernel'` here gives this file a real ESM dependency edge on
// kernel.ts, forcing kernel.ts's router/server resolution to fully settle
// before this file's own emitter resolution begins, which serializes the
// two `app.booted()` consumers instead of racing them. Confirmed via
// repeated `node ace test` runs (dozens, across Node 22 and 24) that the
// race reproduces without this line and disappears with it.
import '#start/kernel'
import emitter from '@adonisjs/core/services/emitter'
import OrderCreated from '#events/order_created'

emitter.on(OrderCreated, () => import('#listeners/send_order_notification'))
