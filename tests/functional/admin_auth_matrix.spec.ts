/**
 * Functional tests proving every user/role/permission administration route
 * is actually gated by both `middleware.auth()` and
 * `middleware.role({ roles: ['ADMIN'] })`, not just the routes someone
 * happened to write a CRUD test against. Each of the seventeen admin
 * routes is exercised twice: once with no token at all, which must be
 * rejected by AuthMiddleware before RoleMiddleware or the controller ever
 * runs, and once with a valid but non-ADMIN (seeded USER) token, which must
 * pass authentication but be rejected by RoleMiddleware.
 *
 * Route params in the URLs below (`1`) are placeholders rather than real
 * ids: both checks happen in middleware, before any controller action
 * touches the database, so a route returning 401 or 403 never depends on
 * whether a user, role or permission with that id actually exists. Missing
 * this coverage on even one route would leave a silent hole in the
 * authorization model this whole administration surface exists to protect.
 */
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import type { ApiClient } from '@japa/api-client'

import { loginAsSeeded, ensureSeededUser } from '#tests/helpers/auth_helper'

type AdminRoute = { method: 'get' | 'post' | 'put' | 'delete'; url: string }

const adminRoutes: AdminRoute[] = [
  { method: 'get', url: '/api/v1/users' },
  { method: 'get', url: '/api/v1/users/1' },
  { method: 'put', url: '/api/v1/users/1' },
  { method: 'delete', url: '/api/v1/users/1' },
  { method: 'post', url: '/api/v1/users/1/roles' },
  { method: 'delete', url: '/api/v1/users/1/roles/1' },
  { method: 'get', url: '/api/v1/roles' },
  { method: 'get', url: '/api/v1/roles/1' },
  { method: 'post', url: '/api/v1/roles' },
  { method: 'put', url: '/api/v1/roles/1' },
  { method: 'delete', url: '/api/v1/roles/1' },
  { method: 'post', url: '/api/v1/roles/1/permissions' },
  { method: 'delete', url: '/api/v1/roles/1/permissions/1' },
  { method: 'get', url: '/api/v1/permissions' },
  { method: 'post', url: '/api/v1/permissions' },
  { method: 'put', url: '/api/v1/permissions/1' },
  { method: 'delete', url: '/api/v1/permissions/1' },
]

function requestFor(client: ApiClient, route: AdminRoute, token?: string) {
  const base =
    route.method === 'get'
      ? client.get(route.url)
      : route.method === 'delete'
        ? client.delete(route.url)
        : route.method === 'post'
          ? client.post(route.url).json({})
          : client.put(route.url).json({})

  return token ? base.bearerToken(token) : base
}

test.group('Admin routes - authorization matrix', (group) => {
  group.setup(async () => {
    await db.beginGlobalTransaction()
    await ensureSeededUser('user')
  })

  group.teardown(async () => {
    await db.rollbackGlobalTransaction()
  })

  test('every admin route returns 401 without a token', async ({ client }) => {
    for (const route of adminRoutes) {
      const response = await requestFor(client, route)
      response.assertStatus(401)
    }
  }).timeout(30000)

  test('every admin route returns 403 with a non-ADMIN (USER) token', async ({ client }) => {
    const token = await loginAsSeeded(client, 'user')

    for (const route of adminRoutes) {
      const response = await requestFor(client, route, token)
      response.assertStatus(403)
    }
  }).timeout(30000)
})
