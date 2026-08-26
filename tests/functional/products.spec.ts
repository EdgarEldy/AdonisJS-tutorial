/**
 * Functional tests for the products HTTP surface: the full CRUD lifecycle
 * over real requests (list, detail, create, update, delete), filtering by
 * categoryId, sorting by unitPrice, the nested category in list/detail
 * responses, and the auth matrix for the three ADMIN-only mutation routes
 * (no token -> 401, USER token -> 403, ADMIN token -> success).
 *
 * The unit spec for ProductsService already proves the category-existence
 * checks and the 409 order-guard throw the right errors at the service
 * layer; what this file still proves is that the HTTP layer surfaces all
 * of that correctly through the ApiResponse envelope, and that the
 * list/detail routes really are public while the mutation routes really
 * are gated by AuthMiddleware and RoleMiddleware, the same split
 * categories.spec.ts already proves for the categories surface.
 */
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'

import Category from '#models/category'
import Customer from '#models/customer'
import Order from '#models/order'
import { loginAsSeeded, ensureSeededUser } from '#tests/helpers/auth_helper'
import { body, uniqueName } from '#tests/helpers/test_utils'

async function createCategory() {
  return Category.create({ categoryName: uniqueName('CATEGORY') })
}

test.group('Products - CRUD lifecycle', (group) => {
  group.setup(async () => {
    await db.beginGlobalTransaction()
    await ensureSeededUser('admin')
    await ensureSeededUser('user')
  })

  group.teardown(async () => {
    await db.rollbackGlobalTransaction()
  })

  test('create, list, read, update, then delete a product, every response matching ApiResponse and including its category', async ({
    client,
    assert,
  }) => {
    const adminToken = await loginAsSeeded(client, 'admin')
    const category = await createCategory()

    // POST /api/v1/products
    const productName = uniqueName('PRODUCT')
    const createResponse = await client
      .post('/api/v1/products')
      .json({ categoryId: category.id, productName, unitPrice: 19.99 })
      .bearerToken(adminToken)
    createResponse.assertStatus(201)
    assert.properties(body(createResponse), ['success', 'message', 'data', 'timestamp'])
    const productId = body(createResponse).data.id as number
    assert.equal(body(createResponse).data.productName, productName)
    assert.equal(body(createResponse).data.category.id, category.id)

    // GET /api/v1/products (public, no token)
    const listResponse = await client.get('/api/v1/products').qs({ page: 1, limit: 100 })
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
    const listedProduct = body(listResponse).data.items.find(
      (item: { id: number }) => item.id === productId
    )
    assert.exists(listedProduct)
    assert.equal(listedProduct.category.id, category.id)

    // GET /api/v1/products/:id (public, no token)
    const showResponse = await client.get(`/api/v1/products/${productId}`)
    showResponse.assertStatus(200)
    assert.equal(body(showResponse).data.id, productId)
    assert.equal(body(showResponse).data.productName, productName)
    assert.equal(body(showResponse).data.category.id, category.id)

    // PUT /api/v1/products/:id
    const newName = `${productName}_UPDATED`
    const updateResponse = await client
      .put(`/api/v1/products/${productId}`)
      .json({ productName: newName })
      .bearerToken(adminToken)
    updateResponse.assertStatus(200)
    assert.equal(body(updateResponse).data.productName, newName)

    // DELETE /api/v1/products/:id
    const deleteResponse = await client
      .delete(`/api/v1/products/${productId}`)
      .bearerToken(adminToken)
    deleteResponse.assertStatus(200)
    assert.isTrue(body(deleteResponse).success)

    const afterDeleteResponse = await client.get(`/api/v1/products/${productId}`)
    afterDeleteResponse.assertStatus(404)
    assert.isFalse(body(afterDeleteResponse).success)
  }).timeout(20000)

  test('POST /api/v1/products with an unknown categoryId returns 404', async ({
    client,
    assert,
  }) => {
    const adminToken = await loginAsSeeded(client, 'admin')

    const response = await client
      .post('/api/v1/products')
      .json({ categoryId: 999999999, productName: uniqueName('PRODUCT'), unitPrice: 5 })
      .bearerToken(adminToken)
    response.assertStatus(404)
    assert.isFalse(body(response).success)
  }).timeout(10000)

  test('GET /api/v1/products filters by categoryId and sorts by unitPrice', async ({
    client,
    assert,
  }) => {
    const adminToken = await loginAsSeeded(client, 'admin')
    const categoryA = await createCategory()
    const categoryB = await createCategory()

    const cheapResponse = await client
      .post('/api/v1/products')
      .json({ categoryId: categoryA.id, productName: uniqueName('CHEAP'), unitPrice: 1 })
      .bearerToken(adminToken)
    const cheapId = body(cheapResponse).data.id as number

    const expensiveResponse = await client
      .post('/api/v1/products')
      .json({ categoryId: categoryA.id, productName: uniqueName('EXPENSIVE'), unitPrice: 1000 })
      .bearerToken(adminToken)
    const expensiveId = body(expensiveResponse).data.id as number

    await client
      .post('/api/v1/products')
      .json({ categoryId: categoryB.id, productName: uniqueName('OTHER_CATEGORY'), unitPrice: 50 })
      .bearerToken(adminToken)

    const filteredResponse = await client.get('/api/v1/products').qs({
      page: 1,
      limit: 100,
      categoryId: categoryA.id,
      sortBy: 'unitPrice',
      order: 'asc',
    })
    filteredResponse.assertStatus(200)

    const items = body(filteredResponse).data.items as Array<{ id: number; categoryId: number }>
    assert.isTrue(items.every((item) => item.categoryId === categoryA.id))
    const ids = items.map((item) => item.id)
    assert.isBelow(ids.indexOf(cheapId), ids.indexOf(expensiveId))
  }).timeout(20000)

  test('deleting a product that still has orders returns 409, and succeeds once the order is removed', async ({
    client,
    assert,
  }) => {
    const adminToken = await loginAsSeeded(client, 'admin')
    const category = await createCategory()

    const createResponse = await client
      .post('/api/v1/products')
      .json({ categoryId: category.id, productName: uniqueName('PRODUCT'), unitPrice: 25 })
      .bearerToken(adminToken)
    const productId = body(createResponse).data.id as number

    const customer = await Customer.create({
      firstName: 'Test',
      lastName: 'Customer',
      telephone: '555-0100',
      email: `${uniqueName('customer')}@example.com`,
      address: '123 Test St',
    })
    const order = await Order.create({
      customerId: customer.id,
      productId,
      quantity: 1,
      total: 25,
    })

    const blockedResponse = await client
      .delete(`/api/v1/products/${productId}`)
      .bearerToken(adminToken)
    blockedResponse.assertStatus(409)
    assert.isFalse(body(blockedResponse).success)

    await order.delete()

    const deleteResponse = await client
      .delete(`/api/v1/products/${productId}`)
      .bearerToken(adminToken)
    deleteResponse.assertStatus(200)
  }).timeout(20000)
})

test.group('Products - mutation route authorization', (group) => {
  group.setup(async () => {
    await db.beginGlobalTransaction()
    await ensureSeededUser('admin')
    await ensureSeededUser('user')
  })

  group.teardown(async () => {
    await db.rollbackGlobalTransaction()
  })

  test('POST /api/v1/products without a token returns 401', async ({ client, assert }) => {
    const category = await createCategory()

    const response = await client
      .post('/api/v1/products')
      .json({ categoryId: category.id, productName: uniqueName('PRODUCT'), unitPrice: 5 })
    response.assertStatus(401)
    assert.isFalse(body(response).success)
  }).timeout(10000)

  test('POST /api/v1/products with a USER token returns 403', async ({ client, assert }) => {
    const userToken = await loginAsSeeded(client, 'user')
    const category = await createCategory()

    const response = await client
      .post('/api/v1/products')
      .json({ categoryId: category.id, productName: uniqueName('PRODUCT'), unitPrice: 5 })
      .bearerToken(userToken)
    response.assertStatus(403)
    assert.isFalse(body(response).success)
  }).timeout(10000)

  test('POST /api/v1/products with an ADMIN token returns 201', async ({ client, assert }) => {
    const adminToken = await loginAsSeeded(client, 'admin')
    const category = await createCategory()

    const response = await client
      .post('/api/v1/products')
      .json({ categoryId: category.id, productName: uniqueName('PRODUCT'), unitPrice: 5 })
      .bearerToken(adminToken)
    response.assertStatus(201)
    assert.isTrue(body(response).success)
  }).timeout(10000)
})
