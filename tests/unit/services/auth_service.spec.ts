/**
 * Unit tests for AuthService, the class that owns the entire account
 * lifecycle (register, activate, login, logout). Before this branch, there
 * was no coverage at all proving that register actually attaches the
 * default USER role and issues a usable activation token, that activate
 * actually flips enabled and marks the token consumed, or that login
 * enforces its three failure modes in a way callers (and the middleware
 * layer built on top of it) can depend on. Getting any one of these wrong
 * would not fail loudly: a missing role attach would silently leave a new
 * account with no permissions, and a login check performed in the wrong
 * order would leak which accounts are activated versus locked to an
 * attacker probing the endpoint.
 *
 * These tests hit the real test database inside a rolled-back global
 * transaction, following the same pattern as the model specs from
 * feature/data-modeling, rather than mocking Lucid models. AuthService's
 * behaviour only means anything once persisted rows (the role pivot, the
 * activation token, the blacklist entry) are read back, so a mock-based
 * test would just restate the implementation instead of verifying it.
 */
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import { decodeJwt } from 'jose'

import AuthService from '#services/auth_service'
import User from '#models/user'
import ActivationToken from '#models/activation_token'
import BlacklistedToken from '#models/blacklisted_token'
import type { JwtPayload } from '#auth/jwt_guard'
import { ensureRole } from '#tests/helpers/auth_helper'

const authService = new AuthService()

async function createUser(
  overrides: Partial<{
    email: string
    password: string
    enabled: boolean
    accountLocked: boolean
  }> = {}
) {
  return User.create({
    firstName: 'Test',
    lastName: 'Account',
    email: overrides.email ?? `user-${crypto.randomUUID()}@example.com`,
    password: overrides.password ?? 'Password1!',
    enabled: overrides.enabled ?? true,
    accountLocked: overrides.accountLocked ?? false,
  })
}

test.group('AuthService - register / activate', (group) => {
  group.setup(async () => {
    await db.beginGlobalTransaction()
    // register() looks up the USER role by name; guaranteeing it exists
    // here keeps this file independent of seed data planted elsewhere.
    await ensureRole('USER')
  })

  group.teardown(async () => {
    await db.rollbackGlobalTransaction()
  })

  test('register creates the user with the default USER role and an activation token', async ({
    assert,
  }) => {
    const email = `register-${crypto.randomUUID()}@example.com`

    const user = await authService.register({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email,
      password: 'Password1!',
    })

    assert.isNumber(user.id)
    assert.equal(user.email, email)
    assert.isFalse(user.enabled)

    await user.load('roles')
    assert.isTrue(user.roles.some((role) => role.roleName === 'USER'))

    // register() no longer returns the activation token directly (it is
    // emailed via ActivationMail instead), so the persisted row is looked
    // up by userId, most recent first, the same way a caller with only the
    // user's id would have to.
    const tokenRow = await ActivationToken.query()
      .where('userId', user.id)
      .orderBy('createdAt', 'desc')
      .firstOrFail()
    assert.isString(tokenRow.token)
    assert.isNotEmpty(tokenRow.token)
    assert.equal(tokenRow.userId, user.id)
    assert.isNull(tokenRow.validatedAt)
  }).timeout(10000)

  test('activate sets enabled to true and marks the activation token as used', async ({
    assert,
  }) => {
    const user = await authService.register({
      firstName: 'Grace',
      lastName: 'Hopper',
      email: `activate-${crypto.randomUUID()}@example.com`,
      password: 'Password1!',
    })

    const tokenRow = await ActivationToken.query()
      .where('userId', user.id)
      .orderBy('createdAt', 'desc')
      .firstOrFail()

    const activatedUser = await authService.activate(tokenRow.token)

    assert.isTrue(activatedUser.enabled)

    const reloadedUser = await User.findOrFail(user.id)
    assert.isTrue(reloadedUser.enabled)

    const reloadedToken = await ActivationToken.query().where('token', tokenRow.token).firstOrFail()
    assert.isNotNull(reloadedToken.validatedAt)
  }).timeout(10000)
})

test.group('AuthService - login', (group) => {
  group.setup(async () => {
    await db.beginGlobalTransaction()
  })

  group.teardown(async () => {
    await db.rollbackGlobalTransaction()
  })

  test('throws E_INVALID_CREDENTIALS for a wrong password', async ({ assert }) => {
    const email = `wrongpass-${crypto.randomUUID()}@example.com`
    await createUser({ email, password: 'CorrectPass1!', enabled: true, accountLocked: false })

    try {
      await authService.login({ email, password: 'WrongPass1!' })
      assert.fail('expected login to throw for a wrong password')
    } catch (error: any) {
      assert.equal(error.code, 'E_INVALID_CREDENTIALS')
      assert.equal(error.status, 400)
    }
  }).timeout(10000)

  test('throws E_ACCOUNT_LOCKED for a locked account', async ({ assert }) => {
    const email = `locked-${crypto.randomUUID()}@example.com`
    await createUser({ email, password: 'CorrectPass1!', enabled: true, accountLocked: true })

    try {
      await authService.login({ email, password: 'CorrectPass1!' })
      assert.fail('expected login to throw for a locked account')
    } catch (error: any) {
      assert.equal(error.code, 'E_ACCOUNT_LOCKED')
      assert.equal(error.status, 403)
    }
  }).timeout(10000)

  test('throws E_ACCOUNT_NOT_ACTIVATED for an inactive account', async ({ assert }) => {
    const email = `inactive-${crypto.randomUUID()}@example.com`
    await createUser({ email, password: 'CorrectPass1!', enabled: false, accountLocked: false })

    try {
      await authService.login({ email, password: 'CorrectPass1!' })
      assert.fail('expected login to throw for an inactive account')
    } catch (error: any) {
      assert.equal(error.code, 'E_ACCOUNT_NOT_ACTIVATED')
      assert.equal(error.status, 403)
    }
  }).timeout(10000)

  test('checks enabled before accountLocked when an account is both inactive and locked', async ({
    assert,
  }) => {
    const email = `both-${crypto.randomUUID()}@example.com`
    await createUser({ email, password: 'CorrectPass1!', enabled: false, accountLocked: true })

    try {
      await authService.login({ email, password: 'CorrectPass1!' })
      assert.fail('expected login to throw')
    } catch (error: any) {
      assert.equal(error.code, 'E_ACCOUNT_NOT_ACTIVATED')
    }
  }).timeout(10000)

  test('returns a JWT whose payload contains a jti claim', async ({ assert }) => {
    const email = `jti-${crypto.randomUUID()}@example.com`
    const user = await createUser({
      email,
      password: 'CorrectPass1!',
      enabled: true,
      accountLocked: false,
    })

    const result = await authService.login({ email, password: 'CorrectPass1!' })

    assert.isString(result.token)

    const payload = decodeJwt(result.token) as JwtPayload
    assert.isString(payload.jti)
    assert.isNotEmpty(payload.jti)
    assert.equal(payload.sub, String(user.id))
  }).timeout(10000)
})

test.group('AuthService - logout', (group) => {
  group.setup(async () => {
    await db.beginGlobalTransaction()
  })

  group.teardown(async () => {
    await db.rollbackGlobalTransaction()
  })

  test('inserts the jti into blacklisted_tokens', async ({ assert }) => {
    const user = await createUser({ email: `logout-${crypto.randomUUID()}@example.com` })

    const payload: JwtPayload = {
      sub: String(user.id),
      jti: crypto.randomUUID(),
      iat: Math.floor(DateTime.now().toSeconds()),
      exp: Math.floor(DateTime.now().plus({ hours: 1 }).toSeconds()),
    }
    const rawToken = 'raw-token-value-for-test'

    await authService.logout(user, payload, rawToken)

    const blacklisted = await BlacklistedToken.findBy('jti', payload.jti)
    assert.isNotNull(blacklisted)
    assert.equal(blacklisted!.userId, user.id)
    assert.equal(blacklisted!.token, rawToken)
  }).timeout(10000)
})
