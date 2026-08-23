import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Measures how long each request takes and exposes the result as an HTTP
 * response header.
 *
 * In AdonisJS, middleware is registered in two stacks:
 * - `server.use([])` — runs on every request, even for unmatched routes.
 * - `router.use([])` — runs only when a route is matched.
 *
 * ResponseTimeMiddleware belongs to `server.use()` so that health-check
 * requests and 404 responses are also timed.
 */
export default class ResponseTimeMiddleware {
  /**
   * Records the wall-clock time before calling the next handler, then writes
   * the elapsed milliseconds into the `X-Response-Time` header once the
   * response is ready. The header is visible in browser DevTools and API
   * clients, making performance regressions easy to spot without a tracing
   * backend.
   */
  async handle(ctx: HttpContext, next: NextFn) {
    const start = Date.now()
    await next()
    ctx.response.header('X-Response-Time', `${Date.now() - start}ms`)
  }
}
