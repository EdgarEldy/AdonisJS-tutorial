import { respond } from '#helpers/api_response'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * Exposes a liveness probe at GET /api/v1/health.
 *
 * Controllers in AdonisJS are thin orchestrators: they validate input,
 * call a service, and return a response. They contain no business logic.
 * This controller is intentionally trivial — it has no service dependency
 * because a health check should succeed as long as the process is running,
 * regardless of database or external service availability.
 */
export default class HealthController {
  /**
   * Returns a 200 response with an ApiResponse envelope indicating the
   * service is up. Used by load balancers and container orchestrators to
   * decide whether to route traffic to this instance.
   */
  async index({ response }: HttpContext) {
    return response.ok(respond({ status: 'ok' }, 'Service is healthy'))
  }
}
