/**
 * Unit tests for RolesService.remove's business rule: a role still assigned
 * to at least one user cannot be deleted, and must fail with 409 rather
 * than either silently succeeding (leaving that user's `role_user` row
 * pointing at a deleted role) or letting the database's own FK constraint
 * surface as an unhandled 500. Nothing in this branch proved the guard
 * actually runs before the delete, or that a role really is removable once
 * it is no longer assigned to anyone.
 *
 * These tests hit the real test database inside a rolled-back global
 * transaction, the same pattern as auth_service.spec.ts, since the rule
 * only means anything once a real pivot row exists to be checked against.
 */
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'

import RolesService from '#services/roles_service'
import Role from '#models/role'
import User from '#models/user'
import { ensureRole } from '#tests/helpers/auth_helper'

const rolesService = new RolesService()

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

test.group('RolesService - remove', (group) => {
  group.setup(async () => {
    await db.beginGlobalTransaction()
  })

  group.teardown(async () => {
    await db.rollbackGlobalTransaction()
  })

  test('throws E_ROLE_IN_USE (409) when a user is still assigned to the role', async ({
    assert,
  }) => {
    const role = await ensureRole(`ROLE_${crypto.randomUUID()}`)
    const user = await createUser()
    await user.related('roles').attach([role.id])

    try {
      await rolesService.remove(role.id)
      assert.fail('expected remove to throw while a user still has the role')
    } catch (error: any) {
      assert.equal(error.code, 'E_ROLE_IN_USE')
      assert.equal(error.status, 409)
    }

    const stillExists = await Role.find(role.id)
    assert.isNotNull(stillExists)
  }).timeout(10000)

  test('deletes the role once no user has it assigned', async ({ assert }) => {
    const role = await ensureRole(`ROLE_${crypto.randomUUID()}`)

    await rolesService.remove(role.id)

    const deleted = await Role.find(role.id)
    assert.isNull(deleted)
  }).timeout(10000)
})
