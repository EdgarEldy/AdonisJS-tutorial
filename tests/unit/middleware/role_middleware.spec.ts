/**
 * Unit test for RoleMiddleware's role check in isolation from any real
 * HTTP route. The migrated middleware smoke test in
 * tests/functional/auth.spec.ts now proves the ADMIN-only gate works
 * against POST /api/v1/categories specifically, which means that test's
 * success case is also implicitly asserting createCategorySchema and
 * CategoriesService.create behave correctly, not just the middleware. This
 * file pins down RoleMiddleware's own branching logic directly, so a
 * regression in the role check itself fails here regardless of which
 * business route happens to be ADMIN protected at the time.
 *
 * The middleware is exercised against a minimal fake HttpContext exposing
 * just the `auth` and `response` shape it actually reads, the same pattern
 * auth_middleware.spec.ts already uses. The role pivot is real, written to
 * the test database inside a rolled back global transaction, since
 * RoleMiddleware loads `user.roles` through the real Lucid relation rather
 * than anything mockable at the model layer.
 */
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'

import RoleMiddleware from '#middleware/role_middleware'
import User from '#models/user'
import Role from '#models/role'

function fakeCtx(user: User) {
  const responses: { forbidden?: unknown } = {}

  const ctx = {
    auth: {
      authenticate: async () => user,
      user,
    },
    request: {
      url: () => '/api/v1/categories',
    },
    response: {
      forbidden: (body: unknown) => {
        responses.forbidden = body
        return body
      },
    },
  } as any

  return { ctx, responses }
}

test.group('RoleMiddleware - role check', (group) => {
  group.setup(async () => {
    await db.beginGlobalTransaction()
  })

  group.teardown(async () => {
    await db.rollbackGlobalTransaction()
  })

  test('calls next() when the user has one of the required roles', async ({ assert }) => {
    const roleName = `ADMIN_${crypto.randomUUID()}`
    const role = await Role.create({ roleName })
    const user = await User.create({
      firstName: 'Has',
      lastName: 'Role',
      email: `hasrole-${crypto.randomUUID()}@example.com`,
      password: 'Password1!',
      enabled: true,
      accountLocked: false,
    })
    await user.related('roles').attach([role.id])

    const middleware = new RoleMiddleware()
    let nextCalled = false
    const { ctx, responses } = fakeCtx(user)

    await middleware.handle(
      ctx,
      async () => {
        nextCalled = true
      },
      { roles: [roleName] }
    )

    assert.isTrue(nextCalled)
    assert.isUndefined(responses.forbidden)
  }).timeout(10000)

  test('rejects with 403 when the user has none of the required roles', async ({ assert }) => {
    const roleName = `USER_${crypto.randomUUID()}`
    const role = await Role.create({ roleName })
    const user = await User.create({
      firstName: 'No',
      lastName: 'Role',
      email: `norole-${crypto.randomUUID()}@example.com`,
      password: 'Password1!',
      enabled: true,
      accountLocked: false,
    })
    await user.related('roles').attach([role.id])

    const middleware = new RoleMiddleware()
    let nextCalled = false
    const { ctx, responses } = fakeCtx(user)

    await middleware.handle(
      ctx,
      async () => {
        nextCalled = true
      },
      { roles: [`ADMIN_${crypto.randomUUID()}`] }
    )

    assert.isFalse(nextCalled)
    assert.isDefined(responses.forbidden)
    assert.deepInclude(responses.forbidden, { success: false })
  }).timeout(10000)

  test('rejects with 403 when the user has no roles at all', async ({ assert }) => {
    const user = await User.create({
      firstName: 'Zero',
      lastName: 'Roles',
      email: `zeroroles-${crypto.randomUUID()}@example.com`,
      password: 'Password1!',
      enabled: true,
      accountLocked: false,
    })

    const middleware = new RoleMiddleware()
    let nextCalled = false
    const { ctx, responses } = fakeCtx(user)

    await middleware.handle(
      ctx,
      async () => {
        nextCalled = true
      },
      { roles: ['ADMIN'] }
    )

    assert.isFalse(nextCalled)
    assert.isDefined(responses.forbidden)
  }).timeout(10000)
})
