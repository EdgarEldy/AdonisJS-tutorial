/**
 * Unit tests for OrdersService: total computation on create, the 404
 * existence guards for unknown customer/product ids, the OrderCreated
 * event emission (via emitter.fake(), per the README's own code sample
 * for this branch), and update()'s literal quantity-only total-recompute
 * rule.
 *
 * Follows products_service.spec.ts's pattern: real test database inside a
 * rolled back global transaction, so every test's fixtures (categories,
 * products, customers) are real rows that get cleaned up automatically at
 * group teardown.
 */
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import emitter from '@adonisjs/core/services/emitter'

import OrdersService from '#services/orders_service'
import OrderCreated from '#events/order_created'
import Order from '#models/order'
import Category from '#models/category'
import Product from '#models/product'
import Customer from '#models/customer'
import { uniqueName } from '#tests/helpers/test_utils'

const ordersService = new OrdersService()

async function createProduct(unitPrice = 10) {
  const category = await Category.create({ categoryName: uniqueName('CATEGORY') })
  return Product.create({
    categoryId: category.id,
    productName: uniqueName('PRODUCT'),
    unitPrice,
  })
}

async function createCustomer() {
  return Customer.create({
    firstName: 'Test',
    lastName: 'Customer',
    telephone: '555-0100',
    email: `${uniqueName('customer')}@example.com`,
    address: '123 Test St',
  })
}

test.group('OrdersService - CRUD', (group) => {
  group.setup(async () => {
    await db.beginGlobalTransaction()
  })

  group.teardown(async () => {
    await db.rollbackGlobalTransaction()
  })

  test('create computes total as quantity x product.unitPrice', async ({ assert }) => {
    const product = await createProduct(12.5)
    const customer = await createCustomer()

    const order = await ordersService.create({
      customerId: customer.id,
      productId: product.id,
      quantity: 3,
    })

    assert.equal(order.total, 37.5)
    assert.equal(order.customer.id, customer.id)
    assert.equal(order.product.id, product.id)
  }).timeout(10000)

  test('create throws a 404 when the customer does not exist', async ({ assert }) => {
    const product = await createProduct()

    try {
      await ordersService.create({
        customerId: 999999999,
        productId: product.id,
        quantity: 1,
      })
      assert.fail('expected create to throw when the customer does not exist')
    } catch (error: any) {
      assert.equal(error.status, 404)
    }
  }).timeout(10000)

  test('create throws a 404 when the product does not exist', async ({ assert }) => {
    const customer = await createCustomer()

    try {
      await ordersService.create({
        customerId: customer.id,
        productId: 999999999,
        quantity: 1,
      })
      assert.fail('expected create to throw when the product does not exist')
    } catch (error: any) {
      assert.equal(error.status, 404)
    }
  }).timeout(10000)

  test('create emits OrderCreated', async () => {
    const product = await createProduct(5)
    const customer = await createCustomer()

    const fakeEmitter = emitter.fake()

    const order = await ordersService.create({
      customerId: customer.id,
      productId: product.id,
      quantity: 2,
    })

    fakeEmitter.assertEmitted(
      OrderCreated,
      (event) => event.data.orderId === order.id && event.data.customerId === customer.id
    )

    emitter.restore()
  }).timeout(10000)

  test('update recomputes total when quantity changes', async ({ assert }) => {
    const product = await createProduct(10)
    const customer = await createCustomer()
    const created = await ordersService.create({
      customerId: customer.id,
      productId: product.id,
      quantity: 2,
    })
    assert.equal(created.total, 20)

    const updated = await ordersService.update(created.id, { quantity: 5 })

    assert.equal(updated.quantity, 5)
    assert.equal(updated.total, 50)

    const reloaded = await Order.findOrFail(created.id)
    assert.equal(reloaded.total, 50)
  }).timeout(10000)

  test('update does not recompute total when quantity is unchanged', async ({ assert }) => {
    const product = await createProduct(10)
    const customer = await createCustomer()
    const created = await ordersService.create({
      customerId: customer.id,
      productId: product.id,
      quantity: 2,
    })
    assert.equal(created.total, 20)

    // quantity omitted from the payload entirely
    const updatedNoQuantity = await ordersService.update(created.id, {})
    assert.equal(updatedNoQuantity.total, 20)

    // quantity present but equal to the current value
    const updatedSameQuantity = await ordersService.update(created.id, { quantity: 2 })
    assert.equal(updatedSameQuantity.total, 20)
  }).timeout(10000)

  test('update throws a 404 when the new customer does not exist', async ({ assert }) => {
    const product = await createProduct()
    const customer = await createCustomer()
    const created = await ordersService.create({
      customerId: customer.id,
      productId: product.id,
      quantity: 1,
    })

    try {
      await ordersService.update(created.id, { customerId: 999999999 })
      assert.fail('expected update to throw when the new customer does not exist')
    } catch (error: any) {
      assert.equal(error.status, 404)
    }
  }).timeout(10000)

  test('update throws a 404 when the new product does not exist', async ({ assert }) => {
    const product = await createProduct()
    const customer = await createCustomer()
    const created = await ordersService.create({
      customerId: customer.id,
      productId: product.id,
      quantity: 1,
    })

    try {
      await ordersService.update(created.id, { productId: 999999999 })
      assert.fail('expected update to throw when the new product does not exist')
    } catch (error: any) {
      assert.equal(error.status, 404)
    }
  }).timeout(10000)

  test('findAll filters by customerId and productId', async ({ assert }) => {
    const productA = await createProduct()
    const productB = await createProduct()
    const customerA = await createCustomer()
    const customerB = await createCustomer()

    const orderA = await ordersService.create({
      customerId: customerA.id,
      productId: productA.id,
      quantity: 1,
    })
    await ordersService.create({
      customerId: customerB.id,
      productId: productB.id,
      quantity: 1,
    })

    const byCustomer = await ordersService.findAll({ customerId: customerA.id }, 1, 100)
    assert.isTrue(byCustomer.items.every((item) => item.customerId === customerA.id))
    assert.isTrue(byCustomer.items.some((item) => item.id === orderA.id))

    const byProduct = await ordersService.findAll({ productId: productA.id }, 1, 100)
    assert.isTrue(byProduct.items.every((item) => item.productId === productA.id))
    assert.isTrue(byProduct.items.some((item) => item.id === orderA.id))
  }).timeout(10000)

  test('findAllForCustomer returns only that customer orders and throws 404 for an unknown customer', async ({
    assert,
  }) => {
    const product = await createProduct()
    const customerA = await createCustomer()
    const customerB = await createCustomer()

    const orderA = await ordersService.create({
      customerId: customerA.id,
      productId: product.id,
      quantity: 1,
    })
    await ordersService.create({
      customerId: customerB.id,
      productId: product.id,
      quantity: 1,
    })

    const result = await ordersService.findAllForCustomer(customerA.id, 1, 100)
    assert.isTrue(result.items.every((item) => item.customerId === customerA.id))
    assert.isTrue(result.items.some((item) => item.id === orderA.id))

    try {
      await ordersService.findAllForCustomer(999999999, 1, 100)
      assert.fail('expected findAllForCustomer to throw for an unknown customer id')
    } catch (error: any) {
      assert.equal(error.status, 404)
    }
  }).timeout(10000)

  test('remove deletes the order', async ({ assert }) => {
    const product = await createProduct()
    const customer = await createCustomer()
    const created = await ordersService.create({
      customerId: customer.id,
      productId: product.id,
      quantity: 1,
    })

    await ordersService.remove(created.id)

    const deleted = await Order.find(created.id)
    assert.isNull(deleted)
  }).timeout(10000)
})
