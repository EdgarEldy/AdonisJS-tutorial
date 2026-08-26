/**
 * Functional tests for the customers HTTP surface: the full CRUD lifecycle
 * over real requests (list, detail, create, update, delete), search by
 * first name/last name/email, email uniqueness enforced over HTTP, and the
 * auth matrix for this branch. Unlike categories.spec.ts and
 * products.spec.ts, every customers route requires authentication, not
 * just the mutation routes, so the list and detail routes are exercised
 * with a bearer token here instead of anonymously.
 *
 * The unit spec for CustomersService already proves the email-uniqueness
 * and 409 order-guard checks throw the right errors at the service layer;
 * what this file still proves is that the HTTP layer surfaces all of that
 * correctly through the ApiResponse envelope, and that AuthMiddleware and
 * RoleMiddleware are wired up exactly as the README's Endpoints table
 * describes for this branch.
 */
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'

import Category from '#models/category'
import Product from '#models/product'
import Order from '#models/order'
import { loginAsSeeded, ensureSeededUser } from '#tests/helpers/auth_helper'
import { body, uniqueName } from '#tests/helpers/test_utils'

function customerPayload(overrides: Record<string, string> = {}) {
  return {
    firstName: 'Jane',
    lastName: 'Doe',
    telephone: '555-0100',
    email: `${uniqueName('customer')}@example.com`,
    address: '123 Test St',
    ...overrides,
  }
}

async function createProduct() {
  const category = await Category.create({ categoryName: uniqueName('CATEGORY') })
  return Product.create({
    categoryId: category.id,
    productName: uniqueName('PRODUCT'),
    unitPrice: 9.99,
  })
}

test.group('Customers - CRUD lifecycle', (group) => {
  group.setup(async () => {
    await db.beginGlobalTransaction()
    await ensureSeededUser('admin')
    await ensureSeededUser('user')
  })

  group.teardown(async () => {
    await db.rollbackGlobalTransaction()
  })

  test('create, list, read, update, then delete a customer, every response matching ApiResponse', async ({
    client,
    assert,
  }) => {
    const adminToken = await loginAsSeeded(client, 'admin')
    const payload = customerPayload()

    // POST /api/v1/customers
    const createResponse = await client
      .post('/api/v1/customers')
      .json(payload)
      .bearerToken(adminToken)
    createResponse.assertStatus(201)
    assert.properties(body(createResponse), ['success', 'message', 'data', 'timestamp'])
    const customerId = body(createResponse).data.id as number
    assert.equal(body(createResponse).data.email, payload.email)

    // GET /api/v1/customers (authenticated)
    const listResponse = await client
      .get('/api/v1/customers')
      .qs({ page: 1, limit: 100 })
      .bearerToken(adminToken)
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
    const listedCustomer = body(listResponse).data.items.find(
      (item: { id: number }) => item.id === customerId
    )
    assert.exists(listedCustomer)

    // GET /api/v1/customers/:id (authenticated)
    const showResponse = await client.get(`/api/v1/customers/${customerId}`).bearerToken(adminToken)
    showResponse.assertStatus(200)
    assert.equal(body(showResponse).data.id, customerId)
    assert.equal(body(showResponse).data.email, payload.email)

    // PUT /api/v1/customers/:id
    const updateResponse = await client
      .put(`/api/v1/customers/${customerId}`)
      .json({ address: '456 Updated Ave' })
      .bearerToken(adminToken)
    updateResponse.assertStatus(200)
    assert.equal(body(updateResponse).data.address, '456 Updated Ave')

    // DELETE /api/v1/customers/:id
    const deleteResponse = await client
      .delete(`/api/v1/customers/${customerId}`)
      .bearerToken(adminToken)
    deleteResponse.assertStatus(200)
    assert.isTrue(body(deleteResponse).success)

    const afterDeleteResponse = await client
      .get(`/api/v1/customers/${customerId}`)
      .bearerToken(adminToken)
    afterDeleteResponse.assertStatus(404)
    assert.isFalse(body(afterDeleteResponse).success)
  }).timeout(20000)

  test('POST /api/v1/customers with a duplicate email returns 409', async ({ client, assert }) => {
    const adminToken = await loginAsSeeded(client, 'admin')
    const payload = customerPayload()

    const firstResponse = await client
      .post('/api/v1/customers')
      .json(payload)
      .bearerToken(adminToken)
    firstResponse.assertStatus(201)

    const secondResponse = await client
      .post('/api/v1/customers')
      .json(customerPayload({ email: payload.email }))
      .bearerToken(adminToken)
    secondResponse.assertStatus(409)
    assert.isFalse(body(secondResponse).success)
  }).timeout(20000)

  test('PUT /api/v1/customers/:id with an email belonging to another customer returns 409', async ({
    client,
    assert,
  }) => {
    const adminToken = await loginAsSeeded(client, 'admin')

    const firstResponse = await client
      .post('/api/v1/customers')
      .json(customerPayload())
      .bearerToken(adminToken)
    const firstEmail = body(firstResponse).data.email as string

    const secondResponse = await client
      .post('/api/v1/customers')
      .json(customerPayload())
      .bearerToken(adminToken)
    const secondId = body(secondResponse).data.id as number

    const updateResponse = await client
      .put(`/api/v1/customers/${secondId}`)
      .json({ email: firstEmail })
      .bearerToken(adminToken)
    updateResponse.assertStatus(409)
    assert.isFalse(body(updateResponse).success)
  }).timeout(20000)

  test('GET /api/v1/customers?search= filters by first name, last name and email', async ({
    client,
    assert,
  }) => {
    const adminToken = await loginAsSeeded(client, 'admin')

    const firstNameMarker = uniqueName('FIRSTNAME')
    const lastNameMarker = uniqueName('LASTNAME')
    const emailMarker = uniqueName('emailmarker')

    const byFirstName = await client
      .post('/api/v1/customers')
      .json(customerPayload({ firstName: firstNameMarker }))
      .bearerToken(adminToken)
    const byFirstNameId = body(byFirstName).data.id as number

    const byLastName = await client
      .post('/api/v1/customers')
      .json(customerPayload({ lastName: lastNameMarker }))
      .bearerToken(adminToken)
    const byLastNameId = body(byLastName).data.id as number

    const byEmail = await client
      .post('/api/v1/customers')
      .json(customerPayload({ email: `${emailMarker}@example.com` }))
      .bearerToken(adminToken)
    const byEmailId = body(byEmail).data.id as number

    const firstNameResult = await client
      .get('/api/v1/customers')
      .qs({ page: 1, limit: 100, search: firstNameMarker })
      .bearerToken(adminToken)
    firstNameResult.assertStatus(200)
    const firstNameIds = (body(firstNameResult).data.items as Array<{ id: number }>).map(
      (item) => item.id
    )
    assert.includeMembers(firstNameIds, [byFirstNameId])
    assert.notInclude(firstNameIds, byLastNameId)

    const lastNameResult = await client
      .get('/api/v1/customers')
      .qs({ page: 1, limit: 100, search: lastNameMarker })
      .bearerToken(adminToken)
    lastNameResult.assertStatus(200)
    const lastNameIds = (body(lastNameResult).data.items as Array<{ id: number }>).map(
      (item) => item.id
    )
    assert.includeMembers(lastNameIds, [byLastNameId])
    assert.notInclude(lastNameIds, byFirstNameId)

    const emailResult = await client
      .get('/api/v1/customers')
      .qs({ page: 1, limit: 100, search: emailMarker })
      .bearerToken(adminToken)
    emailResult.assertStatus(200)
    const emailIds = (body(emailResult).data.items as Array<{ id: number }>).map((item) => item.id)
    assert.includeMembers(emailIds, [byEmailId])
    assert.notInclude(emailIds, byFirstNameId)
  }).timeout(20000)

  test('deleting a customer that still has orders returns 409, and succeeds once the order is removed', async ({
    client,
    assert,
  }) => {
    const adminToken = await loginAsSeeded(client, 'admin')

    const createResponse = await client
      .post('/api/v1/customers')
      .json(customerPayload())
      .bearerToken(adminToken)
    const customerId = body(createResponse).data.id as number

    const product = await createProduct()
    const order = await Order.create({
      customerId,
      productId: product.id,
      quantity: 1,
      total: product.unitPrice,
    })

    const blockedResponse = await client
      .delete(`/api/v1/customers/${customerId}`)
      .bearerToken(adminToken)
    blockedResponse.assertStatus(409)
    assert.isFalse(body(blockedResponse).success)

    await order.delete()

    const deleteResponse = await client
      .delete(`/api/v1/customers/${customerId}`)
      .bearerToken(adminToken)
    deleteResponse.assertStatus(200)
  }).timeout(20000)
})

test.group('Customers - route authorization', (group) => {
  group.setup(async () => {
    await db.beginGlobalTransaction()
    await ensureSeededUser('admin')
    await ensureSeededUser('user')
  })

  group.teardown(async () => {
    await db.rollbackGlobalTransaction()
  })

  test('GET /api/v1/customers without a token returns 401', async ({ client, assert }) => {
    const response = await client.get('/api/v1/customers')
    response.assertStatus(401)
    assert.isFalse(body(response).success)
  }).timeout(10000)

  test('GET /api/v1/customers with a USER token returns 200', async ({ client, assert }) => {
    const userToken = await loginAsSeeded(client, 'user')

    const response = await client.get('/api/v1/customers').bearerToken(userToken)
    response.assertStatus(200)
    assert.isTrue(body(response).success)
  }).timeout(10000)

  test('POST /api/v1/customers without a token returns 401', async ({ client, assert }) => {
    const response = await client.post('/api/v1/customers').json(customerPayload())
    response.assertStatus(401)
    assert.isFalse(body(response).success)
  }).timeout(10000)

  test('POST /api/v1/customers with a USER token returns 403', async ({ client, assert }) => {
    const userToken = await loginAsSeeded(client, 'user')

    const response = await client
      .post('/api/v1/customers')
      .json(customerPayload())
      .bearerToken(userToken)
    response.assertStatus(403)
    assert.isFalse(body(response).success)
  }).timeout(10000)

  test('POST /api/v1/customers with an ADMIN token returns 201', async ({ client, assert }) => {
    const adminToken = await loginAsSeeded(client, 'admin')

    const response = await client
      .post('/api/v1/customers')
      .json(customerPayload())
      .bearerToken(adminToken)
    response.assertStatus(201)
    assert.isTrue(body(response).success)
  }).timeout(10000)
})
