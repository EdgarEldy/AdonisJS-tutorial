/**
 * Unit tests for PermissionsService.remove's business rule: a permission
 * still attached to at least one role cannot be deleted, mirroring
 * RolesService's rule for roles still assigned to a user. Without this
 * guard, deleting a permission a role still grants would either violate
 * the `role_permission` FK constraint as an unhandled 500 or, worse,
 * silently leave that role pointing at a permission row that no longer
 * exists.
 *
 * These tests hit the real test database inside a rolled-back global
 * transaction, the same pattern as roles_service.spec.ts, since the rule
 * only means anything once a real `role_permission` pivot row exists to be
 * checked against.
 */
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'

import PermissionsService from '#services/permissions_service'
import Permission from '#models/permission'
import { ensureRole } from '#tests/helpers/auth_helper'

const permissionsService = new PermissionsService()

async function createPermission() {
  return Permission.create({
    resource: `resource-${crypto.randomUUID()}`,
    action: 'read',
  })
}

test.group('PermissionsService - remove', (group) => {
  group.setup(async () => {
    await db.beginGlobalTransaction()
  })

  group.teardown(async () => {
    await db.rollbackGlobalTransaction()
  })

  test('throws E_PERMISSION_IN_USE (409) when a role still has the permission', async ({
    assert,
  }) => {
    const permission = await createPermission()
    const role = await ensureRole(`ROLE_${crypto.randomUUID()}`)
    await role.related('permissions').attach([permission.id])

    try {
      await permissionsService.remove(permission.id)
      assert.fail('expected remove to throw while a role still has the permission')
    } catch (error: any) {
      assert.equal(error.code, 'E_PERMISSION_IN_USE')
      assert.equal(error.status, 409)
    }

    const stillExists = await Permission.find(permission.id)
    assert.isNotNull(stillExists)
  }).timeout(10000)

  test('deletes the permission once no role has it attached', async ({ assert }) => {
    const permission = await createPermission()

    await permissionsService.remove(permission.id)

    const deleted = await Permission.find(permission.id)
    assert.isNull(deleted)
  }).timeout(10000)
})
