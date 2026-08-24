import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Category from '#models/category'
import Product from '#models/product'

/**
 * Seeds sample products linked to the categories CategorySeeder creates.
 *
 * Products are looked up by category name rather than assuming fixed IDs,
 * because seeder execution order is not guaranteed to assign the same
 * primary keys across environments (a fresh database vs. one that already
 * has rows from a previous seed run). `updateOrCreateMany` on `productName`
 * makes this idempotent for the same reason CategorySeeder is: `db:seed`
 * runs every seeder file in the directory on each invocation.
 */
export default class ProductSeeder extends BaseSeeder {
  async run() {
    const categories = await Category.query().exec()
    const categoryIdByName = new Map(categories.map((category) => [category.categoryName, category.id]))

    const requireCategory = (name: string) => {
      const id = categoryIdByName.get(name)
      if (!id) {
        // NOTE: this seeder depends on CategorySeeder having run first. In
        // the documented `node ace db:seed` workflow the alphabetical file
        // order (category_seeder before product_seeder) and MainSeeder's
        // explicit ordering both guarantee that, so this is a defensive
        // guard rather than the primary ordering mechanism.
        throw new Error(`ProductSeeder requires the "${name}" category to exist. Run CategorySeeder first.`)
      }
      return id
    }

    await Product.updateOrCreateMany('productName', [
      { productName: 'Wireless Mouse', unitPrice: 19.99, categoryId: requireCategory('Electronics') },
      { productName: 'Mechanical Keyboard', unitPrice: 79.99, categoryId: requireCategory('Electronics') },
      { productName: 'The Pragmatic Programmer', unitPrice: 34.99, categoryId: requireCategory('Books') },
      { productName: 'Clean Code', unitPrice: 29.99, categoryId: requireCategory('Books') },
      { productName: "Men's Denim Jacket", unitPrice: 59.99, categoryId: requireCategory('Clothing') },
      { productName: 'Cotton T-Shirt', unitPrice: 14.99, categoryId: requireCategory('Clothing') },
      { productName: 'Stainless Steel Cookware Set', unitPrice: 129.99, categoryId: requireCategory('Home & Kitchen') },
      { productName: 'Yoga Mat', unitPrice: 24.99, categoryId: requireCategory('Sports & Outdoors') },
    ])
  }
}
