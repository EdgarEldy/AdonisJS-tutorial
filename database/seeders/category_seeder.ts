import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Category from '#models/category'

/**
 * Seeds a small, realistic catalog of categories.
 *
 * `updateOrCreateMany` keys on `categoryName` so this seeder is idempotent:
 * running `node ace db:seed` re-runs every file in database/seeders on
 * every invocation (there is no --files flag in the README's documented
 * workflow), so CategorySeeder must tolerate being executed more than once
 * without producing duplicate rows or throwing on a second run.
 */
export default class CategorySeeder extends BaseSeeder {
  async run() {
    await Category.updateOrCreateMany('categoryName', [
      { categoryName: 'Electronics' },
      { categoryName: 'Books' },
      { categoryName: 'Clothing' },
      { categoryName: 'Home & Kitchen' },
      { categoryName: 'Sports & Outdoors' },
    ])
  }
}
