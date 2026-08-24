/**
 * Unit tests for the Order model's `total` column.
 *
 * The migration stores `total` as a plain `float` written by the orders
 * service (not a generated column), specifically so it can freeze the
 * product's unit_price at the moment of purchase. That design choice only
 * holds up if the value that gets written is the exact value that comes back
 * out, with no silent coercion or precision loss between the `@column()`
 * mapping and PostgreSQL's numeric type. These tests write an Order with a
 * decimal total and read it back both from the in-memory model instance and
 * from a fresh query, so a regression in the column type or the model's
 * property mapping would be caught here rather than surfacing as a
 * mispriced order in feature/orders.
 */
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import Category from '#models/category'
import Product from '#models/product'
import Customer from '#models/customer'
import Order from '#models/order'

test.group('Order model - total column', (group) => {
  group.setup(async () => {
    await db.beginGlobalTransaction()
  })

  group.teardown(async () => {
    await db.rollbackGlobalTransaction()
  })

  test('total is stored and retrieved as the same numeric value', async ({ assert }) => {
    const category = await Category.create({ categoryName: 'Books' })
    const product = await Product.create({
      categoryId: category.id,
      productName: 'Novel',
      unitPrice: 15.5,
    })
    const customer = await Customer.create({
      firstName: 'Ada',
      lastName: 'Lovelace',
      telephone: '555-0100',
      email: 'ada@example.com',
      address: '1 Analytical Engine Way',
    })

    const quantity = 3
    const total = quantity * product.unitPrice

    const order = await Order.create({
      customerId: customer.id,
      productId: product.id,
      quantity,
      total,
    })

    assert.isNumber(order.total)
    assert.equal(order.total, total)
  }).timeout(10000)

  test('total survives a round trip through a fresh query, independent of the created instance', async ({
    assert,
  }) => {
    const category = await Category.create({ categoryName: 'Furniture' })
    const product = await Product.create({
      categoryId: category.id,
      productName: 'Desk',
      unitPrice: 149.75,
    })
    const customer = await Customer.create({
      firstName: 'Grace',
      lastName: 'Hopper',
      telephone: '555-0101',
      email: 'grace@example.com',
      address: '2 Compiler Street',
    })

    const total = 2 * product.unitPrice

    const created = await Order.create({
      customerId: customer.id,
      productId: product.id,
      quantity: 2,
      total,
    })

    const found = await Order.query().where('id', created.id).firstOrFail()

    assert.equal(found.total, total)
    assert.equal(found.quantity, 2)
    assert.equal(found.customerId, customer.id)
    assert.equal(found.productId, product.id)
  }).timeout(10000)
})
