/**
 * Unit tests for the `@beforeSave` password hashing hook on the User model.
 *
 * The hook's whole reason for existing is the "no manual password hashing"
 * hard rule: every write path (registration, password reset, an admin
 * editing a profile) must end up with a hashed password without the caller
 * remembering to call `hash.make()` itself. That only works safely if the
 * hook hashes on insert, hashes again when an existing user's password is
 * reassigned, and, just as importantly, leaves an already-hashed password
 * alone when some unrelated column changes. Without that last guarantee, a
 * save triggered by toggling `accountLocked` would hash an already-hashed
 * value, corrupting the password for the next login.
 *
 * These tests check `user.$dirty.password` behaviour indirectly, by
 * asserting on the actual hash produced against the real hash service and
 * database, since the hook is only meaningful once the full round trip
 * insert -> read -> save works end to end.
 */
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import hash from '@adonisjs/core/services/hash'
import User from '#models/user'

test.group('User model - beforeSave password hashing hook', (group) => {
  group.setup(async () => {
    await db.beginGlobalTransaction()
  })

  group.teardown(async () => {
    await db.rollbackGlobalTransaction()
  })

  test('hashes the plain text password before insert', async ({ assert }) => {
    const plainPassword = 'Sup3rSecret!'

    const user = await User.create({
      firstName: 'Katherine',
      lastName: 'Johnson',
      email: 'katherine@example.com',
      password: plainPassword,
      enabled: true,
      accountLocked: false,
    })

    assert.notEqual(user.password, plainPassword)
    assert.isTrue(await hash.verify(user.password, plainPassword))
  }).timeout(10000)

  test('re-hashes the password when it is reassigned on an existing user', async ({ assert }) => {
    const user = await User.create({
      firstName: 'Alan',
      lastName: 'Turing',
      email: 'alan@example.com',
      password: 'FirstPassword1!',
      enabled: true,
      accountLocked: false,
    })

    const firstHash = user.password

    user.password = 'SecondPassword2!'
    await user.save()

    assert.notEqual(user.password, firstHash)
    assert.isTrue(await hash.verify(user.password, 'SecondPassword2!'))
  }).timeout(10000)

  test('does not re-hash the password when an unrelated column changes', async ({ assert }) => {
    const user = await User.create({
      firstName: 'Grace',
      lastName: 'Hopper',
      email: 'grace.hopper@example.com',
      password: 'OriginalPass1!',
      enabled: true,
      accountLocked: false,
    })

    const originalHash = user.password

    user.accountLocked = true
    await user.save()

    assert.equal(user.password, originalHash)

    const reloaded = await User.findOrFail(user.id)
    assert.equal(reloaded.password, originalHash)
    assert.isTrue(reloaded.accountLocked)
  }).timeout(10000)
})
