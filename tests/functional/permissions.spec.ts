/**
 * Functional tests for the permission administration HTTP surface: create,
 * list, update and delete a permission, plus the 409 business rule that a
 * permission still attached to at least one role cannot be deleted.
 *
 * Mirrors roles.spec.ts's reasoning: the unit spec for PermissionsService
 * already proves the guard throws the right error at the service layer,
 * but nothing proved the HTTP layer actually turns it into a 409
 * ApiResponse, or that the create -> list -> update -> delete cycle works
 * end to end. There is deliberately no detail-route assertion here (no
 * `GET /api/v1/permissions/:id` exists per the README), so removal is
 * confirmed by re-listing instead.
 */
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'

import { loginAsSeeded, ensureSeededUser } from '#tests/helpers/auth_helper'

test.group('Permissions admin - CRUD lifecycle', (group) => {
  group.setup(async () => {
    await db.beginGlobalTransaction()
    await ensureSeededUser('admin')
  })

  group.teardown(async () => {
    await db.rollbackGlobalTransaction()
  })

  test('create, list, update, then delete a permission, every response matching ApiResponse', async ({
    client,
    assert,
  }) => {
    const adminToken = await loginAsSeeded(client, 'admin')

    // POST /api/v1/permissions
    const resource = `resource-${crypto.randomUUID()}`
    const createResponse = await client
      .post('/api/v1/permissions')
      .json({ resource, action: 'read' })
      .bearerToken(adminToken)
    createResponse.assertStatus(201)
    assert.properties(createResponse.body(), ['success', 'message', 'data', 'timestamp'])
    const permissionId = createResponse.body().data.id as number
    assert.equal(createResponse.body().data.resource, resource)
    assert.equal(createResponse.body().data.action, 'read')

    // GET /api/v1/permissions
    const listResponse = await client
      .get('/api/v1/permissions')
      .qs({ page: 1, limit: 100 })
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
    assert.isTrue(
      listResponse.body().data.items.some((p: { id: number }) => p.id === permissionId)
    )

    // PUT /api/v1/permissions/:id
    const updateResponse = await client
      .put(`/api/v1/permissions/${permissionId}`)
      .json({ action: 'write' })
      .bearerToken(adminToken)
    updateResponse.assertStatus(200)
    assert.equal(updateResponse.body().data.action, 'write')

    // DELETE /api/v1/permissions/:id
    const deleteResponse = await client
      .delete(`/api/v1/permissions/${permissionId}`)
      .bearerToken(adminToken)
    deleteResponse.assertStatus(200)

    const afterDeleteListResponse = await client
      .get('/api/v1/permissions')
      .qs({ page: 1, limit: 100 })
      .bearerToken(adminToken)
    afterDeleteListResponse.assertStatus(200)
    assert.isFalse(
      afterDeleteListResponse.body().data.items.some((p: { id: number }) => p.id === permissionId)
    )
  }).timeout(20000)

  test('deleting a permission still attached to a role returns 409, and succeeds once revoked', async ({
    client,
    assert,
  }) => {
    const adminToken = await loginAsSeeded(client, 'admin')

    const resource = `resource-${crypto.randomUUID()}`
    const createResponse = await client
      .post('/api/v1/permissions')
      .json({ resource, action: 'delete' })
      .bearerToken(adminToken)
    createResponse.assertStatus(201)
    const permissionId = createResponse.body().data.id as number

    const roleName = `ROLE_${crypto.randomUUID()}`
    const createRoleResponse = await client
      .post('/api/v1/roles')
      .json({ roleName })
      .bearerToken(adminToken)
    createRoleResponse.assertStatus(201)
    const roleId = createRoleResponse.body().data.id as number

    await client
      .post(`/api/v1/roles/${roleId}/permissions`)
      .json({ permissionId })
      .bearerToken(adminToken)

    const blockedResponse = await client
      .delete(`/api/v1/permissions/${permissionId}`)
      .bearerToken(adminToken)
    blockedResponse.assertStatus(409)
    assert.isFalse(blockedResponse.body().success)

    await client
      .delete(`/api/v1/roles/${roleId}/permissions/${permissionId}`)
      .bearerToken(adminToken)

    const deleteResponse = await client
      .delete(`/api/v1/permissions/${permissionId}`)
      .bearerToken(adminToken)
    deleteResponse.assertStatus(200)
  }).timeout(20000)
})
