import { BaseSeeder } from '@adonisjs/lucid/seeders'
import cache from '@adonisjs/cache/services/main'
import Category from '#models/category'

/**
 * Seeds a small, realistic catalog of categories.
 *
 * `updateOrCreateMany` keys on `categoryName` so this seeder is idempotent:
 * running `node ace db:seed` re-runs every file in database/seeders on
 * every invocation (there is no --files flag in the README's documented
 * workflow), so CategorySeeder must tolerate being executed more than once
 * without producing duplicate rows or throwing on a second run.
 *
 * This writes directly through the Category model rather than
 * CategoriesService, so it never goes through the cache invalidation
 * CategoriesService.create/update/remove trigger on every write. Without
 * the explicit clear below, reseeding an environment where the categories
 * list endpoint has already been hit once would serve a stale cached page
 * for up to CategoriesService's five minute TTL, even though the database
 * itself is already correct.
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

    await cache.namespace('categories').clear()
  }
}
