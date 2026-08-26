import { BaseSeeder } from '@adonisjs/lucid/seeders'
import CategorySeeder from '#database/seeders/category_seeder'
import ProductSeeder from '#database/seeders/product_seeder'
import CustomerSeeder from '#database/seeders/customer_seeder'
import UserSeeder from '#database/seeders/user_seeder'

/**
 * Orchestrates every domain seeder in dependency order: categories before
 * products (products reference a category), then customers, then users
 * (which also creates the ADMIN/USER roles it needs before assigning them).
 *
 * NOTE: `node ace db:seed`, the command this README's setup instructions
 * use, runs every seeder file under database/seeders on its own, not just
 * this one, so CategorySeeder/ProductSeeder/CustomerSeeder/UserSeeder also
 * execute independently of this orchestration. Each of them is written to
 * be idempotent (updateOrCreate / updateOrCreateMany keyed on a natural
 * unique column) specifically so that running them a second time here, or
 * out of this explicit order, never produces duplicate rows or a unique
 * constraint violation. This class still exists because it documents the
 * intended dependency order and because `node ace db:seed --files` can
 * target it alone to seed everything in one deterministic pass.
 */
export default class MainSeeder extends BaseSeeder {
  async run() {
    await new CategorySeeder(this.client).run()
    await new ProductSeeder(this.client).run()
    await new CustomerSeeder(this.client).run()
    await new UserSeeder(this.client).run()
  }
}
