/**
 * Shared login helper for functional tests that need a JWT for one of the
 * seeded accounts (feature/data-modeling's UserSeeder). Credentials are read
 * from the typed env service, never hardcoded, so this helper stays correct
 * if the seeded passwords ever change in .env.test.
 *
 * The token is obtained through the real POST /api/v1/auth/login endpoint
 * rather than by signing a JWT directly, so callers exercise the same
 * credential-check and JWT-issuance path a real client would go through.
 *
 * This file also exports `ensureRole` and `ensureSeededUser`. They exist
 * because tests/unit/database/migrations.spec.ts (from feature/data-modeling,
 * not touched by this branch) rolls every migration down and back up as part
 * of its own coverage, which drops all seed data as a real side effect since
 * that test intentionally does not wrap the migrator in a rollback-able
 * transaction. When the unit and functional suites run in the same process
 * (the default for `node ace test`), any auth test that runs after that
 * migration test would otherwise find the roles table and the seeded
 * ADMIN/USER accounts empty. These helpers make each test group
 * self-sufficient by ensuring the reference data it needs exists, inside
 * that group's own rolled-back global transaction, instead of depending on
 * seed data planted by an unrelated file earlier in the run.
 */
import type { ApiClient } from '@japa/api-client'
import env from '#start/env'
import Role from '#models/role'
import User from '#models/user'

export type SeededRole = 'admin' | 'user'

function credentialsFor(role: SeededRole): { email: string; password: string } {
  if (role === 'admin') {
    return {
      email: env.get('TEST_ADMIN_EMAIL')!,
      password: env.get('TEST_ADMIN_PASSWORD')!,
    }
  }

  return {
    email: env.get('TEST_USER_EMAIL')!,
    password: env.get('TEST_USER_PASSWORD')!,
  }
}

/**
 * Ensures a role with the given name exists, creating it when it is
 * missing. Idempotent: safe to call from every test group that depends on
 * the role being present.
 */
export async function ensureRole(roleName: string): Promise<Role> {
  return Role.firstOrCreate({ roleName }, { roleName })
}

/**
 * Ensures the seeded ADMIN or USER account (matching the TEST_*_EMAIL /
 * TEST_*_PASSWORD env vars) exists, is enabled, and has its role attached.
 */
export async function ensureSeededUser(role: SeededRole): Promise<User> {
  const { email, password } = credentialsFor(role)
  const roleName = role === 'admin' ? 'ADMIN' : 'USER'
  const roleRow = await ensureRole(roleName)

  let user = await User.findBy('email', email)
  if (!user) {
    user = await User.create({
      firstName: 'Seeded',
      lastName: role === 'admin' ? 'Admin' : 'User',
      email,
      password,
      enabled: true,
      accountLocked: false,
    })
  }

  await user.related('roles').sync([roleRow.id], false)

  return user
}

/**
 * Logs in as the seeded ADMIN or USER account through the real login
 * endpoint and returns the issued JWT string.
 *
 * NOTE on rate limiting: register, login and forgot-password all share one
 * named limiter ("auth") keyed by client IP, and this helper is called from
 * dozens of places across the suite, every functional test file that needs
 * a token calls it at least once. Two SQL-based approaches to resetting the
 * limiter's state before each call were tried and both were unsafe here.
 * A raw `delete from rate_limits` runs through Lucid's `db` service, which
 * routes it through whichever group's beginGlobalTransaction() is active,
 * so it is invisible to the limiter and rolled back at teardown regardless.
 * limiter.clear() (LimiterManager) reaches the real store, but it issues a
 * TRUNCATE, which needs an exclusive table lock; the limiter's own internal
 * cleanup query for a stale key runs through that same transaction-wrapped
 * `db` service and is left "idle in transaction" for the rest of the group,
 * so a later TRUNCATE in the same group deadlocks against it, confirmed by
 * a full suite run hanging on exactly this once every loginAsSeeded call
 * started calling clear(). The actual fix is THROTTLE_AUTH_MAX for the
 * test and CI environments (see .env.test and both CI workflows): it is
 * set high enough that the whole suite's accumulated login/register
 * traffic never approaches it, while tests/functional/auth.spec.ts's
 * dedicated rate-limiting test still exercises the real 429 behavior, by
 * reading that same value dynamically and looping past it, and can safely
 * call limiter.clear() itself once, as the first query of its own fresh
 * transaction, before anything else has touched the rate limiter in it.
 */
export async function loginAsSeeded(client: ApiClient, role: SeededRole): Promise<string> {
  const { email, password } = credentialsFor(role)

  const response = await client.post('/api/v1/auth/login').json({ email, password })
  response.assertStatus(200)

  return response.body().data.token as string
}
