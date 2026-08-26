import { BaseSeeder } from '@adonisjs/lucid/seeders'
import env from '#start/env'
import User from '#models/user'
import Role from '#models/role'

/**
 * Seeds the two accounts every subsequent CRUD branch's functional tests
 * authenticate as: an ADMIN and a plain USER. Credentials come from the
 * typed env service (TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD / TEST_USER_EMAIL
 * / TEST_USER_PASSWORD) rather than being hardcoded here, so tests/functional
 * specs and this seeder share a single source of truth in .env.test.
 *
 * Those four variables are declared optional in start/env.ts because
 * .env.development does not define them. When they are absent (i.e. this
 * seeder is run against the development database) the literal fallbacks
 * below are used, and they are intentionally identical to the values
 * already committed in .env.test, so behaviour does not change across
 * environments.
 *
 * NOTE: the README's seeder file list (main_seeder, category_seeder,
 * product_seeder, customer_seeder, user_seeder) has no dedicated
 * RoleSeeder file. Since role_user assignment requires the ADMIN and USER
 * roles to exist first, this seeder creates them inline with
 * `updateOrCreateMany` before creating the two accounts, rather than adding
 * a sixth seeder file the README does not list.
 */
export default class UserSeeder extends BaseSeeder {
  async run() {
    const [adminRole, userRole] = await Role.updateOrCreateMany('roleName', [
      { roleName: 'ADMIN' },
      { roleName: 'USER' },
    ])

    const adminEmail = env.get('TEST_ADMIN_EMAIL') ?? 'admin@example.com'
    const adminPassword = env.get('TEST_ADMIN_PASSWORD') ?? 'Admin1234!'
    const userEmail = env.get('TEST_USER_EMAIL') ?? 'user@example.com'
    const userPassword = env.get('TEST_USER_PASSWORD') ?? 'User1234!'

    const admin = await User.updateOrCreate(
      { email: adminEmail },
      {
        firstName: 'Admin',
        lastName: 'User',
        email: adminEmail,
        password: adminPassword,
        enabled: true,
        accountLocked: false,
      }
    )

    const user = await User.updateOrCreate(
      { email: userEmail },
      {
        firstName: 'Regular',
        lastName: 'User',
        email: userEmail,
        password: userPassword,
        enabled: true,
        accountLocked: false,
      }
    )

    // `sync(ids, false)` attaches the role without detaching any existing
    // pivot rows, which keeps this call idempotent across repeated
    // `node ace db:seed` runs.
    await admin.related('roles').sync([adminRole.id], false)
    await user.related('roles').sync([userRole.id], false)
  }
}
