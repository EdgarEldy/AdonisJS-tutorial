/**
 * Functional tests for the health and error-shape contracts.
 *
 * These tests verify two cross-cutting concerns that apply to every endpoint:
 * - the liveness probe returns the ApiResponse envelope with success: true
 * - unmatched routes are handled by the exception handler and return the
 *   ApiResponse envelope with success: false, never a raw framework error
 *
 * In Japa, `client` is provided by the @japa/api-client plugin and makes
 * real HTTP requests against the running AdonisJS server started by
 * testUtils.httpServer().start() in tests/bootstrap.ts.
 */
import { test } from '@japa/runner'

test.group('Health — liveness and error shape', () => {
  test('GET /api/v1/health returns 200 with ApiResponse shape', async ({ client }) => {
    const response = await client.get('/api/v1/health')

    response.assertStatus(200)
    response.assertBodyContains({
      success: true,
      message: 'Service is healthy',
    })
    // Verify the envelope fields are present
    response.assertBodyContains({ timestamp: response.body().timestamp })
  })

  test('unknown route returns 404 with ApiResponse shape', async ({ client }) => {
    const response = await client.get('/api/v1/route-that-does-not-exist')

    // The exception handler must intercept the framework-level 404 and wrap
    // it in ApiResponse rather than returning AdonisJS's default error page.
    response.assertStatus(404)
    response.assertBodyContains({
      success: false,
    })
    // The response must carry a timestamp and path, proving it went through
    // our custom exception handler and not the default renderer.
    response.assertBodyContains({ timestamp: response.body().timestamp })
    response.assertBodyContains({ path: '/api/v1/route-that-does-not-exist' })
  })
})
