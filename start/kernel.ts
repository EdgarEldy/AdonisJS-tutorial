/*
|--------------------------------------------------------------------------
| HTTP kernel
|--------------------------------------------------------------------------
|
| This file registers middleware at two levels:
|
| server.use([])  — "server middleware" runs on every incoming request,
|                   even when no route is matched (e.g. 404 responses).
|                   Useful for cross-cutting concerns like response timing
|                   and CORS headers.
|
| router.use([])  — "router middleware" runs only when a route is matched.
|                   Body parsing, sessions, and auth initialization belong
|                   here because they require a matched route context.
|
| router.named({}) — maps short names to middleware classes so route
|                    declarations stay readable:
|                    .use([middleware.auth(), middleware.role({ roles: ['ADMIN'] })])
|
*/

import router from '@adonisjs/core/services/router'
import server from '@adonisjs/core/services/server'

/**
 * All unhandled exceptions are routed to this handler before a response is
 * sent. Centralising error formatting here ensures every error response
 * uses the ApiResponse envelope with success: false.
 */
server.errorHandler(() => import('#exceptions/handler'))

/**
 * Server-level middleware — runs on every request regardless of routing.
 *
 * Order matters: ResponseTimeMiddleware must be first so the timer starts
 * before any other middleware runs and stops after all of them complete.
 */
server.use([
  () => import('#middleware/response_time_middleware'),
  () => import('#middleware/force_json_response_middleware'),
  () => import('#middleware/container_bindings_middleware'),
  () => import('@adonisjs/cors/cors_middleware'),
])

/**
 * Router-level middleware — runs only when a route is matched.
 *
 * `initialize_auth_middleware` makes `ctx.auth` available on every request
 * without actually verifying the token. The `auth` named middleware does the
 * verification when applied to a specific route.
 */
router.use([
  () => import('@adonisjs/core/bodyparser_middleware'),
  () => import('@adonisjs/session/session_middleware'),
  () => import('@adonisjs/shield/shield_middleware'),
  () => import('@adonisjs/auth/initialize_auth_middleware'),
  () => import('#middleware/silent_auth_middleware'),
  () => import('#middleware/initialize_bouncer_middleware'),
])

/**
 * Named middleware registry.
 *
 * - `auth`  — verifies the JWT and populates ctx.auth.user. Applied to any
 *             route that requires authentication.
 * - `role`  — checks that the authenticated user holds one of the required
 *             roles. Always paired with `auth` since it depends on ctx.auth.user.
 *             Full implementation is in feature/auth; the stub is registered
 *             here so route files can reference it immediately.
 */
export const middleware = router.named({
  auth: () => import('#middleware/auth_middleware'),
  role: () => import('#middleware/role_middleware'),
})
