/**
 * Verifies that the branch's migrations run and roll back without error
 * against the real test database.
 *
 * This deliberately does not use `db.beginGlobalTransaction()` /
 * `rollbackGlobalTransaction()` the way the model specs in this branch do.
 * Schema changes (`CREATE TABLE`, `DROP TABLE`) are DDL, and migrations run
 * their own transaction handling internally through the Lucid migrator, so
 * wrapping them in an outer global transaction would either hide real
 * failures or fight with the migrator's own commits. Instead this test
 * drives the `MigrationRunner` class directly, the same class the
 * `migration:run` / `migration:rollback` ace commands use internally, and
 * asserts against actual PostgreSQL catalog state (`to_regclass`) before and
 * after each direction so a broken `up()` or `down()` in either migration
 * file fails the test instead of silently leaving the schema half-applied.
 *
 * Because rollback drops every table from both core and auth migrations,
 * the test always re-runs migrations afterward, including from inside a
 * catch block, so the database is left in the same migrated, runnable state
 * it was found in even if an assertion in the middle of the test fails.
 *
 * Note this test deliberately never calls `MigrationRunner#close()`.  That
 * method calls `db.manager.closeAll(true)`, which releases every connection
 * from the shared `db` service, not a private one scoped to the migrator.
 * Since this file runs inside the same process as every other unit test
 * file, closing the manager here would tear down the connection pool the
 * rest of the suite depends on.
 */
import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import { MigrationRunner } from '@adonisjs/lucid/migration'

async function tableExists(tableName: string): Promise<boolean> {
  const result = await db.rawQuery(`select to_regclass('public.${tableName}') as reg`)
  return result.rows[0].reg !== null
}

test.group('Database migrations - run and rollback', () => {
  test('rolling back and re-running the migrations leaves the schema intact', async ({
    assert,
  }) => {
    const coreTables = ['categories', 'products', 'customers', 'orders']
    const authTables = [
      'users',
      'roles',
      'permissions',
      'role_user',
      'role_permission',
      'activation_tokens',
      'blacklisted_tokens',
      'password_reset_tokens',
    ]
    const allTables = [...coreTables, ...authTables]

    // Sanity check: the tables should exist before this test does anything,
    // since the migrations were already applied ahead of the test run.
    for (const tableName of allTables) {
      assert.isTrue(await tableExists(tableName), `expected "${tableName}" to exist before rollback`)
    }

    try {
      const rollback = new MigrationRunner(db, app, {
        direction: 'down',
        connectionName: 'pg',
      })
      await rollback.run()

      assert.isNull(rollback.error, rollback.error?.message)
      assert.equal(rollback.status, 'completed')

      for (const tableName of allTables) {
        assert.isFalse(await tableExists(tableName), `expected "${tableName}" to be dropped by rollback`)
      }

      const rerun = new MigrationRunner(db, app, {
        direction: 'up',
        connectionName: 'pg',
      })
      await rerun.run()

      assert.isNull(rerun.error, rerun.error?.message)
      assert.equal(rerun.status, 'completed')

      for (const tableName of allTables) {
        assert.isTrue(await tableExists(tableName), `expected "${tableName}" to exist again after re-running`)
      }
    } catch (error) {
      // Best-effort recovery: make sure the schema is back in place even if
      // an assertion above threw mid-way, so later tests and any local
      // developer database are not left without tables.
      const recovery = new MigrationRunner(db, app, {
        direction: 'up',
        connectionName: 'pg',
      })
      await recovery.run().catch(() => {})
      throw error
    }
  }).timeout(30000)
})
