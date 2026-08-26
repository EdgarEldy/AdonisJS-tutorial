/**
 * Functional tests for the user administration HTTP surface: the full CRUD
 * lifecycle (list, detail, update, delete) and, most importantly, the
 * behavioural proof that assigning or revoking a role through
 * `POST /users/:id/roles` and `DELETE /users/:id/roles/:roleId` actually
 * changes what that user's own JWT is authorized to do on a subsequent
 * request, not just what the `users` table says.
 *
 * Before this branch there was no coverage proving RoleMiddleware really
 * re-checks roles fresh on every request rather than caching whatever was
 * true when the JWT was issued. Getting that wrong in either direction
 * would be dangerous: a stale cache that keeps trusting a revoked ADMIN
 * role would let a demoted account keep acting as an admin until their
 * token expires, and one that never picks up a newly granted role would
 * force every promoted user to log out and back in before the promotion
 * takes effect, silently breaking the endpoint this branch exists to add.
 */
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'

import Role from '#models/role'
import ActivationToken from '#models/activation_token'
import { loginAsSeeded, ensureRole, ensureSeededUser } from '#tests/helpers/auth_helper'

test.group('Users admin - CRUD lifecycle', (group) => {
  group.setup(async () => {
    await db.beginGlobalTransaction()
    await ensureSeededUser('admin')
    await ensureRole('USER')
  })

  group.teardown(async () => {
    await db.rollbackGlobalTransaction()
  })

  test('list, read, update, assign/revoke a role, then delete a user, every response matching ApiResponse', async ({
    client,
    assert,
  }) => {
    const adminToken = await loginAsSeeded(client, 'admin')

    // seed the account this test exercises
    const targetEmail = `admin-crud-${crypto.randomUUID()}@example.com`
    const registerResponse = await client.post('/api/v1/auth/register').json({
      firstName: 'Target',
      lastName: 'User',
      email: targetEmail,
      password: 'Password1!',
    })
    registerResponse.assertStatus(201)
    const userId = registerResponse.body().data.id as number

    // GET /api/v1/users - paginated list
    const listResponse = await client
      .get('/api/v1/users')
      .qs({ page: 1, limit: 10 })
      .bearerToken(adminToken)
    listResponse.assertStatus(200)
    assert.properties(listResponse.body(), ['success', 'message', 'data', 'timestamp'])
    assert.isTrue(listResponse.body().success)
    assert.properties(listResponse.body().data, [
      'items',
      'total',
      'page',
      'limit',
      'totalPages',
      'hasNext',
      'hasPrevious',
    ])
    assert.isArray(listResponse.body().data.items)

    // GET /api/v1/users/:id - detail with roles preloaded
    const showResponse = await client.get(`/api/v1/users/${userId}`).bearerToken(adminToken)
    showResponse.assertStatus(200)
    assert.properties(showResponse.body(), ['success', 'message', 'data', 'timestamp'])
    assert.equal(showResponse.body().data.id, userId)
    assert.isArray(showResponse.body().data.roles)
    assert.isTrue(
      showResponse.body().data.roles.some((r: { roleName: string }) => r.roleName === 'USER')
    )

    // PUT /api/v1/users/:id - partial update
    const updateResponse = await client
      .put(`/api/v1/users/${userId}`)
      .json({ firstName: 'Updated', accountLocked: true })
      .bearerToken(adminToken)
    updateResponse.assertStatus(200)
    assert.properties(updateResponse.body(), ['success', 'message', 'data', 'timestamp'])
    assert.equal(updateResponse.body().data.firstName, 'Updated')
    assert.isTrue(updateResponse.body().data.accountLocked)

    // POST /api/v1/users/:id/roles - assign a second role
    const extraRole = await Role.firstOrCreate(
      { roleName: `EXTRA_${crypto.randomUUID()}` },
      { roleName: `EXTRA_${crypto.randomUUID()}` }
    )
    const assignResponse = await client
      .post(`/api/v1/users/${userId}/roles`)
      .json({ roleId: extraRole.id })
      .bearerToken(adminToken)
    assignResponse.assertStatus(201)
    assert.properties(assignResponse.body(), ['success', 'message', 'data', 'timestamp'])
    assert.isTrue(
      assignResponse.body().data.roles.some((r: { id: number }) => r.id === extraRole.id)
    )

    // DELETE /api/v1/users/:id/roles/:roleId - revoke it back off
    const revokeResponse = await client
      .delete(`/api/v1/users/${userId}/roles/${extraRole.id}`)
      .bearerToken(adminToken)
    revokeResponse.assertStatus(200)
    assert.properties(revokeResponse.body(), ['success', 'message', 'data', 'timestamp'])
    assert.isFalse(
      revokeResponse.body().data.roles.some((r: { id: number }) => r.id === extraRole.id)
    )

    // DELETE /api/v1/users/:id
    const deleteResponse = await client.delete(`/api/v1/users/${userId}`).bearerToken(adminToken)
    deleteResponse.assertStatus(200)
    assert.properties(deleteResponse.body(), ['success', 'message', 'data', 'timestamp'])

    const afterDeleteResponse = await client.get(`/api/v1/users/${userId}`).bearerToken(adminToken)
    afterDeleteResponse.assertStatus(404)
  }).timeout(20000)
})

test.group('Users admin - assigning/revoking a role changes JWT authorization', (group) => {
  group.setup(async () => {
    await db.beginGlobalTransaction()
    await ensureSeededUser('admin')
    await ensureRole('USER')
    await ensureRole('ADMIN')
  })

  group.teardown(async () => {
    await db.rollbackGlobalTransaction()
  })

  test('promoting then demoting a user changes what their own JWT can do, without re-login', async ({
    client,
    assert,
  }) => {
    const adminToken = await loginAsSeeded(client, 'admin')
    const adminRole = await ensureRole('ADMIN')

    // Register and activate a fresh, ordinary USER account, then log in as
    // them to get the JWT under test. This token is never re-issued for the
    // rest of the test: RoleMiddleware re-checks roles fresh on every
    // request via user.load('roles'), so the same token must flip between
    // 403 and 200 purely because of what the admin API does to the user's
    // roles in between.
    const email = `promote-${crypto.randomUUID()}@example.com`
    const password = 'Password1!'
    const registerResponse = await client.post('/api/v1/auth/register').json({
      firstName: 'Promote',
      lastName: 'Me',
      email,
      password,
    })
    registerResponse.assertStatus(201)
    const userId = registerResponse.body().data.id as number

    const tokenRow = await ActivationToken.query()
      .where('userId', userId)
      .orderBy('createdAt', 'desc')
      .firstOrFail()
    await client.post('/api/v1/auth/activate').json({ token: tokenRow.token })

    const loginResponse = await client.post('/api/v1/auth/login').json({ email, password })
    loginResponse.assertStatus(200)
    const userToken = loginResponse.body().data.token as string

    // Not yet an ADMIN: an ADMIN-only route must reject this user's own JWT
    const beforeResponse = await client.get('/api/v1/users').bearerToken(userToken)
    beforeResponse.assertStatus(403)

    // Promote via the admin API, logged in as the seeded ADMIN
    const assignResponse = await client
      .post(`/api/v1/users/${userId}/roles`)
      .json({ roleId: adminRole.id })
      .bearerToken(adminToken)
    assignResponse.assertStatus(201)

    // Same original JWT, never re-issued, now succeeds
    const afterAssignResponse = await client.get('/api/v1/users').bearerToken(userToken)
    afterAssignResponse.assertStatus(200)

    // Revoke the ADMIN role
    const revokeResponse = await client
      .delete(`/api/v1/users/${userId}/roles/${adminRole.id}`)
      .bearerToken(adminToken)
    revokeResponse.assertStatus(200)

    // Same original JWT, back to 403
    const afterRevokeResponse = await client.get('/api/v1/users').bearerToken(userToken)
    afterRevokeResponse.assertStatus(403)

    assert.isNumber(userId)
  }).timeout(20000)
})
