/**
 * Unit tests for UsersService.assignRole's idempotency guarantee.
 *
 * The service's own docstring promises that attaching a role a user already
 * has is a no-op rather than a duplicate pivot row or a thrown error, and
 * the `role_user` pivot table backs that promise with a composite primary
 * key on (user_id, role_id): a naive `attach()` called twice without the
 * existence check RolesService performs would raise a unique-constraint
 * violation on the second call. Nothing in this branch proved that the
 * check actually runs before the attach, only that the migration and the
 * relation declaration exist.
 *
 * These tests hit the real test database inside a rolled-back global
 * transaction, the same pattern as auth_service.spec.ts, since the only way
 * to prove "no duplicate pivot row" is to read the pivot table back after
 * calling the service twice.
 */
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'

import UsersService from '#services/users_service'
import User from '#models/user'
import { ensureRole } from '#tests/helpers/auth_helper'

const usersService = new UsersService()

async function createUser() {
  return User.create({
    firstName: 'Test',
    lastName: 'User',
    email: `user-${crypto.randomUUID()}@example.com`,
    password: 'Password1!',
    enabled: true,
    accountLocked: false,
  })
}

test.group('UsersService - assignRole idempotency', (group) => {
  group.setup(async () => {
    await db.beginGlobalTransaction()
  })

  group.teardown(async () => {
    await db.rollbackGlobalTransaction()
  })

  test('attaches a role the user does not have yet', async ({ assert }) => {
    const user = await createUser()
    const role = await ensureRole(`ROLE_${crypto.randomUUID()}`)

    const updated = await usersService.assignRole(user.id, role.id)

    assert.isTrue(updated.roles.some((r) => r.id === role.id))

    const pivotRows = await db
      .from('role_user')
      .where('user_id', user.id)
      .where('role_id', role.id)
    assert.lengthOf(pivotRows, 1)
  }).timeout(10000)

  test('assigning the same role twice does not duplicate the pivot row', async ({ assert }) => {
    const user = await createUser()
    const role = await ensureRole(`ROLE_${crypto.randomUUID()}`)

    await usersService.assignRole(user.id, role.id)
    const updated = await usersService.assignRole(user.id, role.id)

    assert.lengthOf(
      updated.roles.filter((r) => r.id === role.id),
      1
    )

    const pivotRows = await db
      .from('role_user')
      .where('user_id', user.id)
      .where('role_id', role.id)
    assert.lengthOf(pivotRows, 1)
  }).timeout(10000)
})
