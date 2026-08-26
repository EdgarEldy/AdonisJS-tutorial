/**
 * Unit tests for CustomersService: the ILIKE search across first name, last
 * name and email, the email-uniqueness guard on create, the "same email on
 * the same record is fine" exception on update, and the 409 business rule
 * that a customer with at least one order still associated with it cannot
 * be deleted.
 *
 * Like ProductsService, findAll here is not cached (the README does not ask
 * for caching on customers), so every test reads straight through to the
 * database with no cache-invalidation ordering to worry about.
 *
 * These tests hit the real test database inside a rolled-back global
 * transaction, the same pattern as products_service.spec.ts, since the
 * ILIKE search and the 409 order-guard rule only mean anything once real
 * customer/order rows exist to search or reference.
 */
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'

import CustomersService from '#services/customers_service'
import Customer from '#models/customer'
import Product from '#models/product'
import Category from '#models/category'
import Order from '#models/order'
import { uniqueName } from '#tests/helpers/test_utils'

const customersService = new CustomersService()

function customerPayload(overrides: Partial<Record<string, string>> = {}) {
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

test.group('CustomersService - CRUD', (group) => {
  group.setup(async () => {
    await db.beginGlobalTransaction()
  })

  group.teardown(async () => {
    await db.rollbackGlobalTransaction()
  })

  test('findAll returns paginated results including a newly created customer', async ({
    assert,
  }) => {
    const created = await customersService.create(customerPayload())

    const result = await customersService.findAll(undefined, 1, 100)

    assert.properties(result, [
      'items',
      'total',
      'page',
      'limit',
      'totalPages',
      'hasNext',
      'hasPrevious',
    ])
    assert.equal(result.page, 1)
    assert.equal(result.limit, 100)
    assert.isTrue(result.items.some((item) => item.id === created.id))
  }).timeout(10000)

  test('findAll search filters by first name', async ({ assert }) => {
    const marker = uniqueName('FIRSTNAME')
    const target = await customersService.create(customerPayload({ firstName: marker }))
    await customersService.create(customerPayload())

    const result = await customersService.findAll(marker, 1, 100)

    assert.isTrue(result.items.every((item) => item.id === target.id))
    assert.isTrue(result.items.some((item) => item.id === target.id))
  }).timeout(10000)

  test('findAll search filters by last name', async ({ assert }) => {
    const marker = uniqueName('LASTNAME')
    const target = await customersService.create(customerPayload({ lastName: marker }))
    await customersService.create(customerPayload())

    const result = await customersService.findAll(marker, 1, 100)

    assert.isTrue(result.items.every((item) => item.id === target.id))
    assert.isTrue(result.items.some((item) => item.id === target.id))
  }).timeout(10000)

  test('findAll search filters by email', async ({ assert }) => {
    const marker = uniqueName('emailmarker')
    const target = await customersService.create(
      customerPayload({ email: `${marker}@example.com` })
    )
    await customersService.create(customerPayload())

    const result = await customersService.findAll(marker, 1, 100)

    assert.isTrue(result.items.every((item) => item.id === target.id))
    assert.isTrue(result.items.some((item) => item.id === target.id))
  }).timeout(10000)

  test('findOne returns the customer', async ({ assert }) => {
    const created = await customersService.create(customerPayload())

    const found = await customersService.findOne(created.id)

    assert.equal(found.id, created.id)
    assert.equal(found.email, created.email)
  }).timeout(10000)

  test('findOne throws a 404 for an unknown id', async ({ assert }) => {
    try {
      await customersService.findOne(999999999)
      assert.fail('expected findOne to throw for an unknown id')
    } catch (error: any) {
      assert.equal(error.status, 404)
    }
  }).timeout(10000)

  test('create saves and returns the new customer', async ({ assert }) => {
    const payload = customerPayload()

    const created = await customersService.create(payload)

    assert.isNumber(created.id)
    assert.equal(created.email, payload.email)

    const reloaded = await Customer.findOrFail(created.id)
    assert.equal(reloaded.email, payload.email)
  }).timeout(10000)

  test('create throws a 409 for a duplicate email', async ({ assert }) => {
    const payload = customerPayload()
    await customersService.create(payload)

    try {
      await customersService.create(customerPayload({ email: payload.email }))
      assert.fail('expected create to throw for a duplicate email')
    } catch (error: any) {
      assert.equal(error.code, 'E_EMAIL_TAKEN')
      assert.equal(error.status, 409)
    }
  }).timeout(10000)

  test('update allows keeping the same email on the same customer', async ({ assert }) => {
    const created = await customersService.create(customerPayload())

    const updated = await customersService.update(created.id, {
      email: created.email,
      address: '456 Updated Ave',
    })

    assert.equal(updated.email, created.email)
    assert.equal(updated.address, '456 Updated Ave')
  }).timeout(10000)

  test('update throws a 409 when the email belongs to another customer', async ({ assert }) => {
    const first = await customersService.create(customerPayload())
    const second = await customersService.create(customerPayload())

    try {
      await customersService.update(second.id, { email: first.email })
      assert.fail('expected update to throw when the email belongs to another customer')
    } catch (error: any) {
      assert.equal(error.code, 'E_EMAIL_TAKEN')
      assert.equal(error.status, 409)
    }
  }).timeout(10000)

  test('update modifies an existing customer', async ({ assert }) => {
    const created = await customersService.create(customerPayload())

    const updated = await customersService.update(created.id, { lastName: 'UpdatedLastName' })

    assert.equal(updated.id, created.id)
    assert.equal(updated.lastName, 'UpdatedLastName')

    const reloaded = await Customer.findOrFail(created.id)
    assert.equal(reloaded.lastName, 'UpdatedLastName')
  }).timeout(10000)

  test('remove deletes a customer with no orders', async ({ assert }) => {
    const created = await customersService.create(customerPayload())

    await customersService.remove(created.id)

    const deleted = await Customer.find(created.id)
    assert.isNull(deleted)
  }).timeout(10000)

  test('remove throws E_CUSTOMER_HAS_ORDERS (409) when the customer has orders', async ({
    assert,
  }) => {
    const customer = await customersService.create(customerPayload())
    const product = await createProduct()
    await Order.create({
      customerId: customer.id,
      productId: product.id,
      quantity: 2,
      total: product.unitPrice * 2,
    })

    try {
      await customersService.remove(customer.id)
      assert.fail('expected remove to throw while an order still references the customer')
    } catch (error: any) {
      assert.equal(error.code, 'E_CUSTOMER_HAS_ORDERS')
      assert.equal(error.status, 409)
    }

    const stillExists = await Customer.find(customer.id)
    assert.isNotNull(stillExists)
  }).timeout(10000)
})
