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
  test('GET /api/v1/health returns 200 with full ApiResponse shape', async ({ client, assert }) => {
    const response = await client.get('/api/v1/health')

    response.assertStatus(200)
    response.assertBodyContains({
      success: true,
      message: 'Service is healthy',
      // The data payload must carry the status flag set by HealthController
      data: { status: 'ok' },
    })
    // timestamp must be a non-empty ISO-8601 string — verifies the field is
    // present and formatted correctly, not just that the body echoes itself
    assert.isString(response.body().timestamp)
    assert.match(response.body().timestamp, /^\d{4}-\d{2}-\d{2}T/)
  })

  test('unknown route returns 404 with ApiResponse shape from custom handler', async ({ client, assert }) => {
    const response = await client.get('/api/v1/route-that-does-not-exist')

    // The exception handler must intercept the framework-level 404 and wrap
    // it in ApiResponse rather than returning AdonisJS's default error page.
    response.assertStatus(404)
    response.assertBodyContains({ success: false })

    // timestamp presence proves the response went through HttpExceptionHandler
    // and not the default renderer, which does not add this field
    assert.isString(response.body().timestamp)
    assert.match(response.body().timestamp, /^\d{4}-\d{2}-\d{2}T/)

    // path field links the error back to the request URL — also injected
    // only by our custom handler
    assert.equal(response.body().path, '/api/v1/route-that-does-not-exist')
  })
})
