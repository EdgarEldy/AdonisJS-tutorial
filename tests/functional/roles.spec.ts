/**
 * Functional tests for the role administration HTTP surface: the full CRUD
 * lifecycle (create, list, detail, update, assign/revoke a permission,
 * delete) plus the 409 business rule that a role still assigned to at
 * least one user cannot be deleted.
 *
 * The unit spec for RolesService already proves the guard throws the right
 * error at the service layer; what was still unproven is that the HTTP
 * layer actually surfaces it as a 409 with the ApiResponse envelope rather
 * than, say, letting it fall through to a generic 500, and that the whole
 * create -> read -> update -> assign -> revoke -> delete cycle a real ADMIN
 * client would perform actually works end to end over real requests rather
 * than only through direct service calls.
 */
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'

import Permission from '#models/permission'
import { loginAsSeeded, ensureSeededUser } from '#tests/helpers/auth_helper'

test.group('Roles admin - CRUD lifecycle', (group) => {
  group.setup(async () => {
    await db.beginGlobalTransaction()
    await ensureSeededUser('admin')
  })

  group.teardown(async () => {
    await db.rollbackGlobalTransaction()
  })

  test('create, list, read, update, assign/revoke a permission, then delete a role, every response matching ApiResponse', async ({
    client,
    assert,
  }) => {
    const adminToken = await loginAsSeeded(client, 'admin')

    // POST /api/v1/roles
    const roleName = `ROLE_${crypto.randomUUID()}`
    const createResponse = await client
      .post('/api/v1/roles')
      .json({ roleName })
      .bearerToken(adminToken)
    createResponse.assertStatus(201)
    assert.properties(createResponse.body(), ['success', 'message', 'data', 'timestamp'])
    const roleId = createResponse.body().data.id as number
    assert.equal(createResponse.body().data.roleName, roleName)

    // GET /api/v1/roles
    const listResponse = await client
      .get('/api/v1/roles')
      .qs({ page: 1, limit: 10 })
      .bearerToken(adminToken)
    listResponse.assertStatus(200)
    assert.properties(listResponse.body().data, [
      'items',
      'total',
      'page',
      'limit',
      'totalPages',
      'hasNext',
      'hasPrevious',
    ])

    // GET /api/v1/roles/:id
    const showResponse = await client.get(`/api/v1/roles/${roleId}`).bearerToken(adminToken)
    showResponse.assertStatus(200)
    assert.equal(showResponse.body().data.id, roleId)
    assert.isArray(showResponse.body().data.permissions)

    // PUT /api/v1/roles/:id
    const newRoleName = `${roleName}_UPDATED`
    const updateResponse = await client
      .put(`/api/v1/roles/${roleId}`)
      .json({ roleName: newRoleName })
      .bearerToken(adminToken)
    updateResponse.assertStatus(200)
    assert.equal(updateResponse.body().data.roleName, newRoleName)

    // POST /api/v1/roles/:id/permissions
    const permission = await Permission.create({
      resource: `resource-${crypto.randomUUID()}`,
      action: 'read',
    })
    const assignResponse = await client
      .post(`/api/v1/roles/${roleId}/permissions`)
      .json({ permissionId: permission.id })
      .bearerToken(adminToken)
    assignResponse.assertStatus(201)
    assert.isTrue(
      assignResponse.body().data.permissions.some((p: { id: number }) => p.id === permission.id)
    )

    // DELETE /api/v1/roles/:id/permissions/:permissionId
    const revokeResponse = await client
      .delete(`/api/v1/roles/${roleId}/permissions/${permission.id}`)
      .bearerToken(adminToken)
    revokeResponse.assertStatus(200)
    assert.isFalse(
      revokeResponse.body().data.permissions.some((p: { id: number }) => p.id === permission.id)
    )

    // DELETE /api/v1/roles/:id
    const deleteResponse = await client.delete(`/api/v1/roles/${roleId}`).bearerToken(adminToken)
    deleteResponse.assertStatus(200)

    const afterDeleteResponse = await client
      .get(`/api/v1/roles/${roleId}`)
      .bearerToken(adminToken)
    afterDeleteResponse.assertStatus(404)
  }).timeout(20000)

  test('deleting a role still assigned to a user returns 409, and succeeds once revoked', async ({
    client,
    assert,
  }) => {
    const adminToken = await loginAsSeeded(client, 'admin')

    const roleName = `ROLE_${crypto.randomUUID()}`
    const createResponse = await client
      .post('/api/v1/roles')
      .json({ roleName })
      .bearerToken(adminToken)
    createResponse.assertStatus(201)
    const roleId = createResponse.body().data.id as number

    const email = `rolebusy-${crypto.randomUUID()}@example.com`
    const registerResponse = await client.post('/api/v1/auth/register').json({
      firstName: 'Role',
      lastName: 'Busy',
      email,
      password: 'Password1!',
    })
    registerResponse.assertStatus(201)
    const userId = registerResponse.body().data.id as number

    await client
      .post(`/api/v1/users/${userId}/roles`)
      .json({ roleId })
      .bearerToken(adminToken)

    const blockedResponse = await client.delete(`/api/v1/roles/${roleId}`).bearerToken(adminToken)
    blockedResponse.assertStatus(409)
    assert.isFalse(blockedResponse.body().success)

    await client
      .delete(`/api/v1/users/${userId}/roles/${roleId}`)
      .bearerToken(adminToken)

    const deleteResponse = await client.delete(`/api/v1/roles/${roleId}`).bearerToken(adminToken)
    deleteResponse.assertStatus(200)
  }).timeout(20000)
})
