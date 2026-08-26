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

/**
 * `response.body()` is typed against the union of every action registered
 * on a matching literal route (for example both PermissionsController.index
 * and .store resolve to /api/v1/permissions), so TypeScript cannot narrow
 * `.data` to the specific shape a given call actually returns. This helper
 * casts to `any` at the single point every access in this file goes
 * through, rather than repeating the same cast at every property read.
 */
function body(response: { body(): unknown }): any {
  return response.body()
}

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
    assert.properties(body(createResponse), ['success', 'message', 'data', 'timestamp'])
    const permissionId = body(createResponse).data.id as number
    assert.equal(body(createResponse).data.resource, resource)
    assert.equal(body(createResponse).data.action, 'read')

    // GET /api/v1/permissions
    const listResponse = await client
      .get('/api/v1/permissions')
      .qs({ page: 1, limit: 100 })
      .bearerToken(adminToken)
    listResponse.assertStatus(200)
    assert.properties(body(listResponse).data, [
      'items',
      'total',
      'page',
      'limit',
      'totalPages',
      'hasNext',
      'hasPrevious',
    ])
    assert.isTrue(body(listResponse).data.items.some((p: { id: number }) => p.id === permissionId))

    // PUT /api/v1/permissions/:id
    const updateResponse = await client
      .put(`/api/v1/permissions/${permissionId}`)
      .json({ action: 'write' })
      .bearerToken(adminToken)
    updateResponse.assertStatus(200)
    assert.equal(body(updateResponse).data.action, 'write')

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
      body(afterDeleteListResponse).data.items.some((p: { id: number }) => p.id === permissionId)
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
    const permissionId = body(createResponse).data.id as number

    const roleName = `ROLE_${crypto.randomUUID()}`
    const createRoleResponse = await client
      .post('/api/v1/roles')
      .json({ roleName })
      .bearerToken(adminToken)
    createRoleResponse.assertStatus(201)
    const roleId = body(createRoleResponse).data.id as number

    await client
      .post(`/api/v1/roles/${roleId}/permissions`)
      .json({ permissionId })
      .bearerToken(adminToken)

    const blockedResponse = await client
      .delete(`/api/v1/permissions/${permissionId}`)
      .bearerToken(adminToken)
    blockedResponse.assertStatus(409)
    assert.isFalse(body(blockedResponse).success)

    await client
      .delete(`/api/v1/roles/${roleId}/permissions/${permissionId}`)
      .bearerToken(adminToken)

    const deleteResponse = await client
      .delete(`/api/v1/permissions/${permissionId}`)
      .bearerToken(adminToken)
    deleteResponse.assertStatus(200)
  }).timeout(20000)
})
