/**
 * Unit tests for CategoriesService: the full CRUD surface plus the 409
 * business rule that a category with at least one product still
 * associated with it cannot be deleted.
 *
 * findAll is cached (see the NOTE in categories_service.ts for the exact
 * namespace/invalidation strategy), so every test that reads the list
 * through the service does so immediately after a call to create/update/
 * remove, all of which clear the 'categories' cache namespace before
 * returning. That ordering is what guarantees findAll observes the write
 * that just happened rather than a stale cached page from an earlier test
 * or from CategorySeeder's own seed data, without this test file having to
 * reach into the cache service itself.
 *
 * These tests hit the real test database inside a rolled-back global
 * transaction, the same pattern as roles_service.spec.ts, since the 409
 * rule only means anything once a real product row references the
 * category being deleted.
 */
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'

import CategoriesService from '#services/categories_service'
import Category from '#models/category'
import Product from '#models/product'

const categoriesService = new CategoriesService()

function uniqueName(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`
}

test.group('CategoriesService - CRUD', (group) => {
  group.setup(async () => {
    await db.beginGlobalTransaction()
  })

  group.teardown(async () => {
    await db.rollbackGlobalTransaction()
  })

  test('findAll returns paginated results including a newly created category', async ({
    assert,
  }) => {
    const categoryName = uniqueName('CATEGORY')
    const created = await categoriesService.create({ categoryName })

    const result = await categoriesService.findAll(1, 100)

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

  test('findOne returns the category for a valid id', async ({ assert }) => {
    const categoryName = uniqueName('CATEGORY')
    const created = await categoriesService.create({ categoryName })

    const found = await categoriesService.findOne(created.id)

    assert.equal(found.id, created.id)
    assert.equal(found.categoryName, categoryName)
  }).timeout(10000)

  test('findOne throws a 404 for an unknown id', async ({ assert }) => {
    try {
      await categoriesService.findOne(999999999)
      assert.fail('expected findOne to throw for an unknown id')
    } catch (error: any) {
      assert.equal(error.status, 404)
    }
  }).timeout(10000)

  test('create saves and returns the new category', async ({ assert }) => {
    const categoryName = uniqueName('CATEGORY')

    const created = await categoriesService.create({ categoryName })

    assert.isNumber(created.id)
    assert.equal(created.categoryName, categoryName)

    const reloaded = await Category.findOrFail(created.id)
    assert.equal(reloaded.categoryName, categoryName)
  }).timeout(10000)

  test('update modifies an existing category', async ({ assert }) => {
    const created = await categoriesService.create({ categoryName: uniqueName('CATEGORY') })
    const newName = uniqueName('CATEGORY_UPDATED')

    const updated = await categoriesService.update(created.id, { categoryName: newName })

    assert.equal(updated.id, created.id)
    assert.equal(updated.categoryName, newName)

    const reloaded = await Category.findOrFail(created.id)
    assert.equal(reloaded.categoryName, newName)
  }).timeout(10000)

  test('remove deletes a category with no products', async ({ assert }) => {
    const created = await categoriesService.create({ categoryName: uniqueName('CATEGORY') })

    await categoriesService.remove(created.id)

    const deleted = await Category.find(created.id)
    assert.isNull(deleted)
  }).timeout(10000)

  test('remove throws E_CATEGORY_IN_USE (409) when the category has products', async ({
    assert,
  }) => {
    const created = await categoriesService.create({ categoryName: uniqueName('CATEGORY') })
    await Product.create({
      categoryId: created.id,
      productName: uniqueName('PRODUCT'),
      unitPrice: 9.99,
    })

    try {
      await categoriesService.remove(created.id)
      assert.fail('expected remove to throw while a product still references the category')
    } catch (error: any) {
      assert.equal(error.code, 'E_CATEGORY_IN_USE')
      assert.equal(error.status, 409)
    }

    const stillExists = await Category.find(created.id)
    assert.isNotNull(stillExists)
  }).timeout(10000)
})
