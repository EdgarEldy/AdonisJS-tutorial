/**
 * Functional tests for the orders HTTP surface: POST /orders storing the
 * correct computed total, GET /orders?customerId= filtering, the nested
 * GET /customers/:id/orders route returning only that customer's orders,
 * and the auth matrix for this branch (every route requires
 * authentication, mutation routes additionally require ADMIN).
 *
 * The unit spec for OrdersService already proves the total computation,
 * the 404 existence guards and the OrderCreated emission at the service
 * layer; what this file still proves is that the HTTP layer surfaces all
 * of that correctly through the ApiResponse envelope, and that
 * AuthMiddleware and RoleMiddleware are wired up exactly as the README's
 * Endpoints table describes for this branch, the same split
 * customers.spec.ts and products.spec.ts already prove for their own
 * surfaces.
 */
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'

import Category from '#models/category'
import Product from '#models/product'
import Customer from '#models/customer'
import { loginAsSeeded, ensureSeededUser } from '#tests/helpers/auth_helper'
import { body, uniqueName } from '#tests/helpers/test_utils'

async function createProduct(unitPrice = 9.99) {
  const category = await Category.create({ categoryName: uniqueName('CATEGORY') })
  return Product.create({
    categoryId: category.id,
    productName: uniqueName('PRODUCT'),
    unitPrice,
  })
}

async function createCustomer() {
  return Customer.create({
    firstName: 'Jane',
    lastName: 'Doe',
    telephone: '555-0100',
    email: `${uniqueName('customer')}@example.com`,
    address: '123 Test St',
  })
}

test.group('Orders - CRUD lifecycle', (group) => {
  group.setup(async () => {
    await db.beginGlobalTransaction()
    await ensureSeededUser('admin')
    await ensureSeededUser('user')
  })

  group.teardown(async () => {
    await db.rollbackGlobalTransaction()
  })

  test('POST /api/v1/orders stores the correct computed total', async ({ client, assert }) => {
    const adminToken = await loginAsSeeded(client, 'admin')
    const product = await createProduct(12.5)
    const customer = await createCustomer()

    const createResponse = await client
      .post('/api/v1/orders')
      .json({ customerId: customer.id, productId: product.id, quantity: 4 })
      .bearerToken(adminToken)

    createResponse.assertStatus(201)
    assert.properties(body(createResponse), ['success', 'message', 'data', 'timestamp'])
    assert.equal(body(createResponse).data.total, 50)
    assert.equal(body(createResponse).data.quantity, 4)
    assert.equal(body(createResponse).data.customer.id, customer.id)
    assert.equal(body(createResponse).data.product.id, product.id)
  }).timeout(20000)

  test('GET /api/v1/orders/:id returns the order with customer and product preloaded', async ({
    client,
    assert,
  }) => {
    const adminToken = await loginAsSeeded(client, 'admin')
    const product = await createProduct(5)
    const customer = await createCustomer()

    const createResponse = await client
      .post('/api/v1/orders')
      .json({ customerId: customer.id, productId: product.id, quantity: 2 })
      .bearerToken(adminToken)
    const orderId = body(createResponse).data.id as number

    const showResponse = await client.get(`/api/v1/orders/${orderId}`).bearerToken(adminToken)
    showResponse.assertStatus(200)
    assert.equal(body(showResponse).data.id, orderId)
    assert.equal(body(showResponse).data.customer.id, customer.id)
    assert.equal(body(showResponse).data.product.id, product.id)
  }).timeout(20000)

  test('PUT /api/v1/orders/:id recomputes total only when quantity changes', async ({
    client,
    assert,
  }) => {
    const adminToken = await loginAsSeeded(client, 'admin')
    const product = await createProduct(10)
    const customer = await createCustomer()

    const createResponse = await client
      .post('/api/v1/orders')
      .json({ customerId: customer.id, productId: product.id, quantity: 2 })
      .bearerToken(adminToken)
    const orderId = body(createResponse).data.id as number
    assert.equal(body(createResponse).data.total, 20)

    const unchangedResponse = await client
      .put(`/api/v1/orders/${orderId}`)
      .json({ quantity: 2 })
      .bearerToken(adminToken)
    unchangedResponse.assertStatus(200)
    assert.equal(body(unchangedResponse).data.total, 20)

    const changedResponse = await client
      .put(`/api/v1/orders/${orderId}`)
      .json({ quantity: 5 })
      .bearerToken(adminToken)
    changedResponse.assertStatus(200)
    assert.equal(body(changedResponse).data.total, 50)
  }).timeout(20000)

  test('DELETE /api/v1/orders/:id deletes the order', async ({ client, assert }) => {
    const adminToken = await loginAsSeeded(client, 'admin')
    const product = await createProduct()
    const customer = await createCustomer()

    const createResponse = await client
      .post('/api/v1/orders')
      .json({ customerId: customer.id, productId: product.id, quantity: 1 })
      .bearerToken(adminToken)
    const orderId = body(createResponse).data.id as number

    const deleteResponse = await client.delete(`/api/v1/orders/${orderId}`).bearerToken(adminToken)
    deleteResponse.assertStatus(200)
    assert.isTrue(body(deleteResponse).success)

    const afterDeleteResponse = await client
      .get(`/api/v1/orders/${orderId}`)
      .bearerToken(adminToken)
    afterDeleteResponse.assertStatus(404)
  }).timeout(20000)

  test('GET /api/v1/orders?customerId= filters to that customer only', async ({
    client,
    assert,
  }) => {
    const adminToken = await loginAsSeeded(client, 'admin')
    const product = await createProduct()
    const customerA = await createCustomer()
    const customerB = await createCustomer()

    const orderAResponse = await client
      .post('/api/v1/orders')
      .json({ customerId: customerA.id, productId: product.id, quantity: 1 })
      .bearerToken(adminToken)
    const orderAId = body(orderAResponse).data.id as number

    const orderBResponse = await client
      .post('/api/v1/orders')
      .json({ customerId: customerB.id, productId: product.id, quantity: 1 })
      .bearerToken(adminToken)
    const orderBId = body(orderBResponse).data.id as number

    const filteredResponse = await client
      .get('/api/v1/orders')
      .qs({ page: 1, limit: 100, customerId: customerA.id })
      .bearerToken(adminToken)
    filteredResponse.assertStatus(200)

    const ids = (body(filteredResponse).data.items as Array<{ id: number }>).map((item) => item.id)
    assert.include(ids, orderAId)
    assert.notInclude(ids, orderBId)
  }).timeout(20000)

  test('GET /api/v1/customers/:id/orders returns only that customer orders', async ({
    client,
    assert,
  }) => {
    const adminToken = await loginAsSeeded(client, 'admin')
    const product = await createProduct()
    const customerA = await createCustomer()
    const customerB = await createCustomer()

    const orderAResponse = await client
      .post('/api/v1/orders')
      .json({ customerId: customerA.id, productId: product.id, quantity: 1 })
      .bearerToken(adminToken)
    const orderAId = body(orderAResponse).data.id as number

    const orderBResponse = await client
      .post('/api/v1/orders')
      .json({ customerId: customerB.id, productId: product.id, quantity: 1 })
      .bearerToken(adminToken)
    const orderBId = body(orderBResponse).data.id as number

    const nestedResponse = await client
      .get(`/api/v1/customers/${customerA.id}/orders`)
      .qs({ page: 1, limit: 100 })
      .bearerToken(adminToken)
    nestedResponse.assertStatus(200)

    const ids = (body(nestedResponse).data.items as Array<{ id: number }>).map((item) => item.id)
    assert.include(ids, orderAId)
    assert.notInclude(ids, orderBId)
  }).timeout(20000)

  test('GET /api/v1/customers/:id/orders returns 404 for an unknown customer', async ({
    client,
    assert,
  }) => {
    const adminToken = await loginAsSeeded(client, 'admin')

    const response = await client.get('/api/v1/customers/999999999/orders').bearerToken(adminToken)
    response.assertStatus(404)
    assert.isFalse(body(response).success)
  }).timeout(20000)

  test('POST /api/v1/orders returns 404 for an unknown customer or product', async ({
    client,
    assert,
  }) => {
    const adminToken = await loginAsSeeded(client, 'admin')
    const product = await createProduct()
    const customer = await createCustomer()

    const badCustomerResponse = await client
      .post('/api/v1/orders')
      .json({ customerId: 999999999, productId: product.id, quantity: 1 })
      .bearerToken(adminToken)
    badCustomerResponse.assertStatus(404)
    assert.isFalse(body(badCustomerResponse).success)

    const badProductResponse = await client
      .post('/api/v1/orders')
      .json({ customerId: customer.id, productId: 999999999, quantity: 1 })
      .bearerToken(adminToken)
    badProductResponse.assertStatus(404)
    assert.isFalse(body(badProductResponse).success)
  }).timeout(20000)
})

test.group('Orders - route authorization', (group) => {
  group.setup(async () => {
    await db.beginGlobalTransaction()
    await ensureSeededUser('admin')
    await ensureSeededUser('user')
  })

  group.teardown(async () => {
    await db.rollbackGlobalTransaction()
  })

  test('GET /api/v1/orders without a token returns 401', async ({ client, assert }) => {
    const response = await client.get('/api/v1/orders')
    response.assertStatus(401)
    assert.isFalse(body(response).success)
  }).timeout(10000)

  test('GET /api/v1/orders with a USER token returns 200', async ({ client, assert }) => {
    const userToken = await loginAsSeeded(client, 'user')

    const response = await client.get('/api/v1/orders').bearerToken(userToken)
    response.assertStatus(200)
    assert.isTrue(body(response).success)
  }).timeout(10000)

  test('POST /api/v1/orders without a token returns 401', async ({ client, assert }) => {
    const product = await createProduct()
    const customer = await createCustomer()

    const response = await client
      .post('/api/v1/orders')
      .json({ customerId: customer.id, productId: product.id, quantity: 1 })
    response.assertStatus(401)
    assert.isFalse(body(response).success)
  }).timeout(10000)

  test('POST /api/v1/orders with a USER token returns 403', async ({ client, assert }) => {
    const userToken = await loginAsSeeded(client, 'user')
    const product = await createProduct()
    const customer = await createCustomer()

    const response = await client
      .post('/api/v1/orders')
      .json({ customerId: customer.id, productId: product.id, quantity: 1 })
      .bearerToken(userToken)
    response.assertStatus(403)
    assert.isFalse(body(response).success)
  }).timeout(10000)

  test('POST /api/v1/orders with an ADMIN token returns 201', async ({ client, assert }) => {
    const adminToken = await loginAsSeeded(client, 'admin')
    const product = await createProduct()
    const customer = await createCustomer()

    const response = await client
      .post('/api/v1/orders')
      .json({ customerId: customer.id, productId: product.id, quantity: 1 })
      .bearerToken(adminToken)
    response.assertStatus(201)
    assert.isTrue(body(response).success)
  }).timeout(10000)
})
