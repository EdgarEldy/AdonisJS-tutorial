import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Customer from '#models/customer'

/**
 * Seeds sample customers. Keyed on `email` via `updateOrCreateMany` for the
 * same idempotency reason as CategorySeeder: `db:seed` re-runs every
 * seeder file on each invocation.
 */
export default class CustomerSeeder extends BaseSeeder {
  async run() {
    await Customer.updateOrCreateMany('email', [
      {
        firstName: 'Alice',
        lastName: 'Johnson',
        telephone: '+1-202-555-0143',
        email: 'alice.johnson@example.com',
        address: '742 Evergreen Terrace, Springfield, IL',
      },
      {
        firstName: 'Marcus',
        lastName: 'Lee',
        telephone: '+1-415-555-0198',
        email: 'marcus.lee@example.com',
        address: '1600 Amphitheatre Pkwy, Mountain View, CA',
      },
      {
        firstName: 'Sofia',
        lastName: 'Garcia',
        telephone: '+34-91-555-0176',
        email: 'sofia.garcia@example.com',
        address: 'Calle Gran Via 28, Madrid, Spain',
      },
      {
        firstName: 'Noah',
        lastName: 'Williams',
        telephone: '+44-20-7946-0958',
        email: 'noah.williams@example.com',
        address: '221B Baker Street, London, UK',
      },
    ])
  }
}
