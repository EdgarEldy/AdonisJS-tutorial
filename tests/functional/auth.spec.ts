/**
 * Functional tests for the auth HTTP surface: the full account lifecycle
 * through real requests, the AuthMiddleware / RoleMiddleware smoke test
 * against the temporary stub routes, and rate limiting on the login route.
 *
 * Before this branch there was no coverage proving the pieces documented in
 * app/services/auth_service.ts and app/middleware/*.ts actually compose
 * correctly behind real HTTP requests: that register's activation token
 * really unlocks activate, that a logged-out token is really rejected by
 * the next request rather than only by a direct unit call, and that the
 * role middleware really distinguishes ADMIN from USER using the seeded
 * accounts rather than some hand-rolled fixture.
 */
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'
import ActivationToken from '#models/activation_token'
import { loginAsSeeded, ensureRole, ensureSeededUser } from '#tests/helpers/auth_helper'

test.group('Auth - full lifecycle (register -> activate -> login -> me -> logout)', (group) => {
  group.setup(async () => {
    await db.beginGlobalTransaction()
    // register() requires the USER role to exist; make this group
    // self-sufficient regardless of what ran earlier in the process.
    await ensureRole('USER')
  })

  group.teardown(async () => {
    await db.rollbackGlobalTransaction()
  })

  test('register, activate, login, fetch profile, logout, then reject the revoked token', async ({
    client,
    assert,
  }) => {
    const email = `lifecycle-${crypto.randomUUID()}@example.com`
    const password = 'Password1!'

    // 1. register
    const registerResponse = await client.post('/api/v1/auth/register').json({
      firstName: 'Full',
      lastName: 'Flow',
      email,
      password,
    })
    registerResponse.assertStatus(201)
    registerResponse.assertBodyContains({ success: true })
    const userId = registerResponse.body().data.id as number
    assert.isNumber(userId)

    // The activation token is no longer echoed in the response: it is
    // emailed via ActivationMail against Mailhog now that a real mailer is
    // wired up on this branch. The row is still persisted exactly as
    // before, so it is looked up directly by the new user's id, most
    // recent first, the same way any other out-of-band consumer of the
    // token would have to.
    const tokenRow = await ActivationToken.query()
      .where('userId', userId)
      .orderBy('createdAt', 'desc')
      .firstOrFail()
    const activationToken = tokenRow.token
    assert.isString(activationToken)

    // 2. activate
    const activateResponse = await client
      .post('/api/v1/auth/activate')
      .json({ token: activationToken })
    activateResponse.assertStatus(200)
    assert.isTrue(activateResponse.body().data.enabled)

    // 3. login
    const loginResponse = await client.post('/api/v1/auth/login').json({ email, password })
    loginResponse.assertStatus(200)
    const token = loginResponse.body().data.token as string
    assert.isString(token)

    // 4. GET /auth/me
    const meResponse = await client.get('/api/v1/auth/me').bearerToken(token)
    meResponse.assertStatus(200)
    assert.equal(meResponse.body().data.email, email)

    // 5. logout
    const logoutResponse = await client.post('/api/v1/auth/logout').bearerToken(token)
    logoutResponse.assertStatus(200)

    // 6. GET /auth/me with the now-revoked token
    const revokedMeResponse = await client.get('/api/v1/auth/me').bearerToken(token)
    revokedMeResponse.assertStatus(401)
  }).timeout(15000)
})

test.group('Auth - middleware smoke test (AuthMiddleware + RoleMiddleware)', (group) => {
  group.setup(async () => {
    await db.beginGlobalTransaction()
    // Logging in as the seeded ADMIN/USER accounts requires those rows to
    // exist; ensure them here so this group does not depend on seed data
    // planted by an unrelated file earlier in the run.
    await ensureSeededUser('admin')
    await ensureSeededUser('user')
  })

  group.teardown(async () => {
    await db.rollbackGlobalTransaction()
  })

  // feature/categories added the first real ADMIN-protected route, so this
  // group now exercises GET /auth/me (auth only, no role) and
  // POST /categories (auth + ADMIN) instead of the temporary
  // /api/v1/_stub/* routes, which are removed from start/routes.ts.

  test('auth-only route returns 401 without a token', async ({ client }) => {
    const response = await client.get('/api/v1/auth/me')
    response.assertStatus(401)
  })

  test('auth-only route returns 200 with a valid USER token', async ({ client }) => {
    const token = await loginAsSeeded(client, 'user')

    const response = await client.get('/api/v1/auth/me').bearerToken(token)
    response.assertStatus(200)
  }).timeout(10000)

  test('admin-protected route returns 403 for a USER token', async ({ client }) => {
    const token = await loginAsSeeded(client, 'user')

    const response = await client
      .post('/api/v1/categories')
      .json({ categoryName: `Smoke ${crypto.randomUUID()}` })
      .bearerToken(token)
    response.assertStatus(403)
  }).timeout(10000)

  test('admin-protected route returns 201 for an ADMIN token', async ({ client }) => {
    const token = await loginAsSeeded(client, 'admin')

    const response = await client
      .post('/api/v1/categories')
      .json({ categoryName: `Smoke ${crypto.randomUUID()}` })
      .bearerToken(token)
    response.assertStatus(201)
  }).timeout(10000)
})

test.group('Auth - rate limiting on login', (group) => {
  group.setup(async () => {
    await db.beginGlobalTransaction()
    await ensureSeededUser('user')
  })

  group.teardown(async () => {
    await db.rollbackGlobalTransaction()
  })

  test('the request past THROTTLE_AUTH_MAX within the window returns 429', async ({
    client,
    assert,
  }) => {
    // register, login and forgot-password all share a single named limiter
    // ("auth"), keyed by client IP, so any of them running earlier in this
    // process (the full lifecycle test above included) consumes from the
    // same bucket. Clearing rows for that limiter's key prefix immediately
    // before the burst guarantees a clean window regardless of what ran
    // before this test or in what order, instead of relying on nothing else
    // in the suite having touched the auth limiter yet.
    await db.rawQuery("delete from rate_limits where key like 'auth_%'")

    const email = env.get('TEST_USER_EMAIL')!
    const password = env.get('TEST_USER_PASSWORD')!
    const maxRequests = env.get('THROTTLE_AUTH_MAX')

    for (let attempt = 0; attempt < maxRequests; attempt++) {
      const response = await client.post('/api/v1/auth/login').json({ email, password })
      response.assertStatus(200)
    }

    const blockedResponse = await client.post('/api/v1/auth/login').json({ email, password })
    blockedResponse.assertStatus(429)
    assert.equal(blockedResponse.body().success, false)
  }).timeout(20000)
})
