/**
 * Unit tests for the Category model's `@hasMany(() => Product)` relation.
 *
 * The Tasks checklist for feature/data-modeling asks specifically for proof
 * that `hasMany` returns the associated products, not just that the decorator
 * compiles. These tests exercise `category.load('products')` against the real
 * test database so a mismatched `category_id` foreign key or a misconfigured
 * `localKey` / `foreignKey` on the relation would fail loudly instead of only
 * showing up once the categories service starts using `preload()` in a later
 * branch.
 */
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import Category from '#models/category'
import Product from '#models/product'

test.group('Category model - hasMany products', (group) => {
  group.setup(async () => {
    await db.beginGlobalTransaction()
  })

  group.teardown(async () => {
    await db.rollbackGlobalTransaction()
  })

  test('loading products returns every product scoped to that category', async ({ assert }) => {
    const category = await Category.create({ categoryName: 'Electronics' })
    const otherCategory = await Category.create({ categoryName: 'Groceries' })

    const laptop = await Product.create({
      categoryId: category.id,
      productName: 'Laptop',
      unitPrice: 999.99,
    })
    const mouse = await Product.create({
      categoryId: category.id,
      productName: 'Mouse',
      unitPrice: 19.99,
    })
    await Product.create({
      categoryId: otherCategory.id,
      productName: 'Bread',
      unitPrice: 2.5,
    })

    await category.load('products')

    assert.lengthOf(category.products, 2)
    assert.sameMembers(
      category.products.map((product) => product.productName),
      [laptop.productName, mouse.productName]
    )
    category.products.forEach((product) => {
      assert.equal(product.categoryId, category.id)
    })
  }).timeout(10000)

  test('a category with no products loads an empty relation instead of throwing', async ({
    assert,
  }) => {
    const category = await Category.create({ categoryName: 'Empty Category' })

    await category.load('products')

    assert.isArray(category.products)
    assert.lengthOf(category.products, 0)
  }).timeout(10000)
})
