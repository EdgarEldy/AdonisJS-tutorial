/**
 * Unit tests for ProductsService: the full CRUD surface, the dynamic
 * categoryId filter, and the 409 business rule that a product with at
 * least one order still associated with it cannot be deleted.
 *
 * Unlike CategoriesService, findAll here is not cached (the README does
 * not ask for caching on products), so every test reads straight through
 * to the database with no cache-invalidation ordering to worry about.
 *
 * These tests hit the real test database inside a rolled-back global
 * transaction, the same pattern as categories_service.spec.ts, since both
 * the categoryId filter and the 409 order-guard rule only mean anything
 * once real category/order rows exist to filter against or reference.
 */
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'

import ProductsService from '#services/products_service'
import Product from '#models/product'
import Category from '#models/category'
import Customer from '#models/customer'
import Order from '#models/order'
import { uniqueName } from '#tests/helpers/test_utils'

const productsService = new ProductsService()

async function createCategory() {
  return Category.create({ categoryName: uniqueName('CATEGORY') })
}

test.group('ProductsService - CRUD', (group) => {
  group.setup(async () => {
    await db.beginGlobalTransaction()
  })

  group.teardown(async () => {
    await db.rollbackGlobalTransaction()
  })

  test('findAll returns paginated results including a newly created product', async ({
    assert,
  }) => {
    const category = await createCategory()
    const created = await productsService.create({
      categoryId: category.id,
      productName: uniqueName('PRODUCT'),
      unitPrice: 9.99,
    })

    const result = await productsService.findAll({}, 1, 100)

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

  test('findAll filters by categoryId, returning only matching products', async ({ assert }) => {
    const categoryA = await createCategory()
    const categoryB = await createCategory()

    const productA = await productsService.create({
      categoryId: categoryA.id,
      productName: uniqueName('PRODUCT_A'),
      unitPrice: 5,
    })
    await productsService.create({
      categoryId: categoryB.id,
      productName: uniqueName('PRODUCT_B'),
      unitPrice: 7,
    })

    const result = await productsService.findAll({ categoryId: categoryA.id }, 1, 100)

    assert.isTrue(result.items.every((item) => item.categoryId === categoryA.id))
    assert.isTrue(result.items.some((item) => item.id === productA.id))
  }).timeout(10000)

  test('findAll sorts by unitPrice', async ({ assert }) => {
    const category = await createCategory()
    const cheap = await productsService.create({
      categoryId: category.id,
      productName: uniqueName('PRODUCT_CHEAP'),
      unitPrice: 1,
    })
    const expensive = await productsService.create({
      categoryId: category.id,
      productName: uniqueName('PRODUCT_EXPENSIVE'),
      unitPrice: 1000,
    })

    const result = await productsService.findAll(
      { categoryId: category.id, sortBy: 'unitPrice', order: 'asc' },
      1,
      100
    )

    const ids = result.items.map((item) => item.id)
    assert.isBelow(ids.indexOf(cheap.id), ids.indexOf(expensive.id))
  }).timeout(10000)

  test('findOne returns the product with its category preloaded', async ({ assert }) => {
    const category = await createCategory()
    const created = await productsService.create({
      categoryId: category.id,
      productName: uniqueName('PRODUCT'),
      unitPrice: 12.5,
    })

    const found = await productsService.findOne(created.id)

    assert.equal(found.id, created.id)
    assert.equal(found.category.id, category.id)
  }).timeout(10000)

  test('findOne throws a 404 for an unknown id', async ({ assert }) => {
    try {
      await productsService.findOne(999999999)
      assert.fail('expected findOne to throw for an unknown id')
    } catch (error: any) {
      assert.equal(error.status, 404)
    }
  }).timeout(10000)

  test('create saves and returns the new product with its category preloaded', async ({
    assert,
  }) => {
    const category = await createCategory()
    const productName = uniqueName('PRODUCT')

    const created = await productsService.create({
      categoryId: category.id,
      productName,
      unitPrice: 3.5,
    })

    assert.isNumber(created.id)
    assert.equal(created.productName, productName)
    assert.equal(created.category.id, category.id)

    const reloaded = await Product.findOrFail(created.id)
    assert.equal(reloaded.productName, productName)
  }).timeout(10000)

  test('create throws a 404 when the category does not exist', async ({ assert }) => {
    try {
      await productsService.create({
        categoryId: 999999999,
        productName: uniqueName('PRODUCT'),
        unitPrice: 3.5,
      })
      assert.fail('expected create to throw when the category does not exist')
    } catch (error: any) {
      assert.equal(error.status, 404)
    }
  }).timeout(10000)

  test('update modifies an existing product', async ({ assert }) => {
    const category = await createCategory()
    const created = await productsService.create({
      categoryId: category.id,
      productName: uniqueName('PRODUCT'),
      unitPrice: 3.5,
    })
    const newName = uniqueName('PRODUCT_UPDATED')

    const updated = await productsService.update(created.id, { productName: newName })

    assert.equal(updated.id, created.id)
    assert.equal(updated.productName, newName)

    const reloaded = await Product.findOrFail(created.id)
    assert.equal(reloaded.productName, newName)
  }).timeout(10000)

  test('update throws a 404 when the new category does not exist', async ({ assert }) => {
    const category = await createCategory()
    const created = await productsService.create({
      categoryId: category.id,
      productName: uniqueName('PRODUCT'),
      unitPrice: 3.5,
    })

    try {
      await productsService.update(created.id, { categoryId: 999999999 })
      assert.fail('expected update to throw when the new category does not exist')
    } catch (error: any) {
      assert.equal(error.status, 404)
    }
  }).timeout(10000)

  test('remove deletes a product with no orders', async ({ assert }) => {
    const category = await createCategory()
    const created = await productsService.create({
      categoryId: category.id,
      productName: uniqueName('PRODUCT'),
      unitPrice: 3.5,
    })

    await productsService.remove(created.id)

    const deleted = await Product.find(created.id)
    assert.isNull(deleted)
  }).timeout(10000)

  test('remove throws E_PRODUCT_IN_USE (409) when the product has orders', async ({ assert }) => {
    const category = await createCategory()
    const product = await productsService.create({
      categoryId: category.id,
      productName: uniqueName('PRODUCT'),
      unitPrice: 3.5,
    })
    const customer = await Customer.create({
      firstName: 'Test',
      lastName: 'Customer',
      telephone: '555-0100',
      email: `${uniqueName('customer')}@example.com`,
      address: '123 Test St',
    })
    await Order.create({
      customerId: customer.id,
      productId: product.id,
      quantity: 2,
      total: product.unitPrice * 2,
    })

    try {
      await productsService.remove(product.id)
      assert.fail('expected remove to throw while an order still references the product')
    } catch (error: any) {
      assert.equal(error.code, 'E_PRODUCT_IN_USE')
      assert.equal(error.status, 409)
    }

    const stillExists = await Product.find(product.id)
    assert.isNotNull(stillExists)
  }).timeout(10000)
})
