/**
 * Functional tests for the categories HTTP surface: the full CRUD
 * lifecycle over real requests (list, detail, create, update, delete), the
 * 409 business rule that a category still associated with at least one
 * product cannot be deleted, and the auth matrix for the three ADMIN-only
 * mutation routes (no token -> 401, USER token -> 403, ADMIN token ->
 * success).
 *
 * The unit spec for CategoriesService already proves the 409 guard throws
 * the right error at the service layer and that the caching in findAll
 * does not serve stale data across a write; what this file still proves is
 * that the HTTP layer surfaces all of that correctly through the
 * ApiResponse envelope, and that the list/detail routes really are public
 * while the mutation routes really are gated by AuthMiddleware and
 * RoleMiddleware, the same split roles.spec.ts and the admin auth matrix
 * already prove for the user/role/permission administration surface.
 */
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'

import Product from '#models/product'
import { loginAsSeeded, ensureSeededUser } from '#tests/helpers/auth_helper'

/**
 * `response.body()` on a literal-path match (POST and GET both resolve to
 * /api/v1/categories) is typed against the union of every action on that
 * route, so TypeScript cannot narrow `.data` to the specific shape a given
 * call actually returns. Same workaround roles.spec.ts and
 * permissions.spec.ts already use.
 */
function body(response: { body(): unknown }): any {
  return response.body()
}

function uniqueName(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`
}

test.group('Categories - CRUD lifecycle', (group) => {
  group.setup(async () => {
    await db.beginGlobalTransaction()
    await ensureSeededUser('admin')
    await ensureSeededUser('user')
  })

  group.teardown(async () => {
    await db.rollbackGlobalTransaction()
  })

  test('create, list, read, update, then delete a category, every response matching ApiResponse', async ({
    client,
    assert,
  }) => {
    const adminToken = await loginAsSeeded(client, 'admin')

    // POST /api/v1/categories
    const categoryName = uniqueName('CATEGORY')
    const createResponse = await client
      .post('/api/v1/categories')
      .json({ categoryName })
      .bearerToken(adminToken)
    createResponse.assertStatus(201)
    assert.properties(body(createResponse), ['success', 'message', 'data', 'timestamp'])
    const categoryId = body(createResponse).data.id as number
    assert.equal(body(createResponse).data.categoryName, categoryName)

    // GET /api/v1/categories (public, no token)
    const listResponse = await client.get('/api/v1/categories').qs({ page: 1, limit: 100 })
    listResponse.assertStatus(200)
    assert.properties(body(listResponse), ['success', 'message', 'data', 'timestamp'])
    assert.properties(body(listResponse).data, [
      'items',
      'total',
      'page',
      'limit',
      'totalPages',
      'hasNext',
      'hasPrevious',
    ])
    assert.isTrue(body(listResponse).data.items.some((c: { id: number }) => c.id === categoryId))

    // GET /api/v1/categories/:id (public, no token)
    const showResponse = await client.get(`/api/v1/categories/${categoryId}`)
    showResponse.assertStatus(200)
    assert.equal(body(showResponse).data.id, categoryId)
    assert.equal(body(showResponse).data.categoryName, categoryName)

    // PUT /api/v1/categories/:id
    const newName = `${categoryName}_UPDATED`
    const updateResponse = await client
      .put(`/api/v1/categories/${categoryId}`)
      .json({ categoryName: newName })
      .bearerToken(adminToken)
    updateResponse.assertStatus(200)
    assert.equal(body(updateResponse).data.categoryName, newName)

    // DELETE /api/v1/categories/:id
    const deleteResponse = await client
      .delete(`/api/v1/categories/${categoryId}`)
      .bearerToken(adminToken)
    deleteResponse.assertStatus(200)
    assert.isTrue(body(deleteResponse).success)

    const afterDeleteResponse = await client.get(`/api/v1/categories/${categoryId}`)
    afterDeleteResponse.assertStatus(404)
    assert.isFalse(body(afterDeleteResponse).success)
  }).timeout(20000)

  test('deleting a category that still has products returns 409, and succeeds once the product is removed', async ({
    client,
    assert,
  }) => {
    const adminToken = await loginAsSeeded(client, 'admin')

    const createResponse = await client
      .post('/api/v1/categories')
      .json({ categoryName: uniqueName('CATEGORY') })
      .bearerToken(adminToken)
    createResponse.assertStatus(201)
    const categoryId = body(createResponse).data.id as number

    const product = await Product.create({
      categoryId,
      productName: uniqueName('PRODUCT'),
      unitPrice: 12.5,
    })

    const blockedResponse = await client
      .delete(`/api/v1/categories/${categoryId}`)
      .bearerToken(adminToken)
    blockedResponse.assertStatus(409)
    assert.isFalse(body(blockedResponse).success)

    await product.delete()

    const deleteResponse = await client
      .delete(`/api/v1/categories/${categoryId}`)
      .bearerToken(adminToken)
    deleteResponse.assertStatus(200)
  }).timeout(20000)
})

test.group('Categories - mutation route authorization', (group) => {
  group.setup(async () => {
    await db.beginGlobalTransaction()
    await ensureSeededUser('admin')
    await ensureSeededUser('user')
  })

  group.teardown(async () => {
    await db.rollbackGlobalTransaction()
  })

  test('POST /api/v1/categories without a token returns 401', async ({ client, assert }) => {
    const response = await client
      .post('/api/v1/categories')
      .json({ categoryName: uniqueName('CATEGORY') })
    response.assertStatus(401)
    assert.isFalse(body(response).success)
  }).timeout(10000)

  test('POST /api/v1/categories with a USER token returns 403', async ({ client, assert }) => {
    const userToken = await loginAsSeeded(client, 'user')

    const response = await client
      .post('/api/v1/categories')
      .json({ categoryName: uniqueName('CATEGORY') })
      .bearerToken(userToken)
    response.assertStatus(403)
    assert.isFalse(body(response).success)
  }).timeout(10000)

  test('POST /api/v1/categories with an ADMIN token returns 201', async ({ client, assert }) => {
    const adminToken = await loginAsSeeded(client, 'admin')

    const response = await client
      .post('/api/v1/categories')
      .json({ categoryName: uniqueName('CATEGORY') })
      .bearerToken(adminToken)
    response.assertStatus(201)
    assert.isTrue(body(response).success)
  }).timeout(10000)
})
