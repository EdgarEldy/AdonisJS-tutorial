/**
 * Unit test for AuthMiddleware's blacklist check in isolation from the rest
 * of the HTTP stack. AuthMiddleware's whole purpose beyond authenticating
 * the request is rejecting a JWT whose jti has already been logged out; that
 * behaviour is also exercised end to end by the functional "revoked token
 * returns 401" scenario in tests/functional/auth.spec.ts, but this unit test
 * pins down the middleware's own branching logic directly, without needing
 * a real HTTP round trip or a signed JWT, so a regression in the query
 * against blacklisted_tokens fails here specifically rather than only
 * surfacing as a vague functional test failure.
 *
 * The middleware is exercised against a minimal fake HttpContext exposing
 * just the `auth` and `response` shape it actually reads, since constructing
 * a real HttpContext outside of an HTTP request is not practical. The
 * blacklist row itself is real, written to the test database inside a
 * rolled-back global transaction, since AuthMiddleware queries
 * BlacklistedToken directly rather than through anything mockable at the
 * model layer.
 */
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import type { HttpContext } from '@adonisjs/core/http'

import AuthMiddleware from '#middleware/auth_middleware'
import User from '#models/user'
import BlacklistedToken from '#models/blacklisted_token'

function fakeCtx(jti: string, user: User) {
  const responses: { unauthorized?: unknown } = {}

  const ctx = {
    auth: {
      authenticateUsing: async () => user,
      use: () => ({ payload: { jti } }),
    },
    request: {
      url: () => '/api/v1/_stub/protected',
    },
    response: {
      unauthorized: (body: unknown) => {
        responses.unauthorized = body
        return body
      },
    },
  } as unknown as HttpContext

  return { ctx, responses }
}

test.group('AuthMiddleware - blacklisted jti rejection', (group) => {
  group.setup(async () => {
    await db.beginGlobalTransaction()
  })

  group.teardown(async () => {
    await db.rollbackGlobalTransaction()
  })

  test('rejects a request whose jti is in blacklisted_tokens', async ({ assert }) => {
    const user = await User.create({
      firstName: 'Blacklisted',
      lastName: 'Token',
      email: `blacklist-${crypto.randomUUID()}@example.com`,
      password: 'Password1!',
      enabled: true,
      accountLocked: false,
    })

    const jti = crypto.randomUUID()
    await BlacklistedToken.create({
      userId: user.id,
      token: 'revoked-raw-token',
      jti,
      blacklistedAt: DateTime.now(),
      expiresAt: DateTime.now().plus({ hours: 1 }),
    })

    const middleware = new AuthMiddleware()
    let nextCalled = false
    const { ctx, responses } = fakeCtx(jti, user)

    await middleware.handle(ctx, async () => {
      nextCalled = true
    })

    assert.isFalse(nextCalled)
    assert.isDefined(responses.unauthorized)
    assert.deepInclude(responses.unauthorized, { success: false })
  }).timeout(10000)

  test('calls next() when the jti is not blacklisted', async ({ assert }) => {
    const user = await User.create({
      firstName: 'Active',
      lastName: 'User',
      email: `active-${crypto.randomUUID()}@example.com`,
      password: 'Password1!',
      enabled: true,
      accountLocked: false,
    })

    const middleware = new AuthMiddleware()
    let nextCalled = false
    const { ctx, responses } = fakeCtx(crypto.randomUUID(), user)

    await middleware.handle(ctx, async () => {
      nextCalled = true
    })

    assert.isTrue(nextCalled)
    assert.isUndefined(responses.unauthorized)
  }).timeout(10000)

  test('rejects a request for a user who is disabled or locked, even with a valid non-blacklisted jti', async ({
    assert,
  }) => {
    const user = await User.create({
      firstName: 'Locked',
      lastName: 'Out',
      email: `locked-${crypto.randomUUID()}@example.com`,
      password: 'Password1!',
      enabled: true,
      accountLocked: true,
    })

    const middleware = new AuthMiddleware()
    let nextCalled = false
    const { ctx, responses } = fakeCtx(crypto.randomUUID(), user)

    await middleware.handle(ctx, async () => {
      nextCalled = true
    })

    assert.isFalse(nextCalled)
    assert.isDefined(responses.unauthorized)
    assert.deepInclude(responses.unauthorized, { success: false })
  }).timeout(10000)
})
