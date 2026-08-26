/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| All HTTP routes are declared here. AdonisJS resolves controllers lazily
| using dynamic imports so that only the controllers needed for a request
| are loaded. Named middleware exported from start/kernel.ts are applied
| per-route or per-group with .use([middleware.auth(), ...]).
|
| Route path convention: /api/v1/<resource> (plural, snake_case).
|
*/

import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { authThrottle } from '#start/limiter'
import { respond } from '#helpers/api_response'

// Lazy import — AdonisJS resolves the module on the first matching request
const HealthController = () => import('#controllers/health_controller')
const AuthController = () => import('#controllers/auth_controller')
const UsersController = () => import('#controllers/users_controller')
const RolesController = () => import('#controllers/roles_controller')
const PermissionsController = () => import('#controllers/permissions_controller')

/*
|--------------------------------------------------------------------------
| Health check
|--------------------------------------------------------------------------
|
| Public route, no authentication required. Used by load balancers and
| container orchestrators to determine whether the instance is alive.
|
*/
router.get('/api/v1/health', [HealthController, 'index'])

/*
|--------------------------------------------------------------------------
| API v1 — resource routes
|--------------------------------------------------------------------------
|
| Auth, categories, products, customers and orders routes are added by
| their respective feature branches, starting with feature/auth.
|
*/

/*
|--------------------------------------------------------------------------
| Auth
|--------------------------------------------------------------------------
|
| register, login and forgot-password are rate limited with authThrottle
| (THROTTLE_AUTH_MAX per THROTTLE_AUTH_WINDOW seconds, per the README) since
| they are the endpoints an attacker would script against — credential
| stuffing on login, mass account creation on register, and reset-token
| flooding on forgot-password. activate and reset-password are excluded:
| both already require an unguessable token as the actual defense, and
| logout/refresh/me are excluded because middleware.auth() already limits
| them to requests bearing a valid, non-blacklisted JWT.
|
*/
router
  .group(() => {
    router.post('register', [AuthController, 'register']).use(authThrottle)
    router.post('activate', [AuthController, 'activate'])
    router.post('login', [AuthController, 'login']).use(authThrottle)
    router.post('logout', [AuthController, 'logout']).use(middleware.auth())
    router.post('refresh', [AuthController, 'refresh']).use(middleware.auth())
    router.post('forgot-password', [AuthController, 'forgotPassword']).use(authThrottle)
    router.post('reset-password', [AuthController, 'resetPassword'])
    router.get('me', [AuthController, 'me']).use(middleware.auth())
  })
  .prefix('/api/v1/auth')

/*
|--------------------------------------------------------------------------
| User, role and permission administration
|--------------------------------------------------------------------------
|
| Registration always assigns the default USER role and nothing else in
| the app manages `users`, `roles` or `permissions` afterward — these
| endpoints are the only way to promote an account to ADMIN, create a new
| role, or change what a role can do. Every single route below operates on
| other accounts or on the authorization model itself, so all of them are
| ADMIN only, applied at route declaration time via the group-level
| .use([middleware.auth(), middleware.role({ roles: ['ADMIN'] })]) rather
| than added retroactively per-route.
|
| Note there is deliberately no GET /api/v1/permissions/:id route: the
| README's Endpoints table for this subsection lists a detail route for
| users and roles but not for permissions.
|
*/
router
  .group(() => {
    router.get('users', [UsersController, 'index'])
    router.get('users/:id', [UsersController, 'show'])
    router.put('users/:id', [UsersController, 'update'])
    router.delete('users/:id', [UsersController, 'destroy'])
    router.post('users/:id/roles', [UsersController, 'assignRole'])
    router.delete('users/:id/roles/:roleId', [UsersController, 'revokeRole'])

    router.get('roles', [RolesController, 'index'])
    router.get('roles/:id', [RolesController, 'show'])
    router.post('roles', [RolesController, 'store'])
    router.put('roles/:id', [RolesController, 'update'])
    router.delete('roles/:id', [RolesController, 'destroy'])
    router.post('roles/:id/permissions', [RolesController, 'assignPermission'])
    router.delete('roles/:id/permissions/:permissionId', [RolesController, 'revokePermission'])

    router.get('permissions', [PermissionsController, 'index'])
    router.post('permissions', [PermissionsController, 'store'])
    router.put('permissions/:id', [PermissionsController, 'update'])
    router.delete('permissions/:id', [PermissionsController, 'destroy'])
  })
  .prefix('/api/v1')
  .use([middleware.auth(), middleware.role({ roles: ['ADMIN'] })])

/*
|--------------------------------------------------------------------------
| Temporary middleware smoke-test stubs (feature/auth only)
|--------------------------------------------------------------------------
|
| feature/auth's task list requires a functional test proving AuthMiddleware
| and RoleMiddleware actually reject/allow requests (401 with no token, 200
| with a valid USER token, 403 for USER / 200 for ADMIN behind role('ADMIN')).
| No real protected resource route exists yet - categories, products,
| customers and orders are all later branches - so these two routes exist
| solely to give that test something to hit.
|
| DELETE both routes once feature/categories adds its first ADMIN-protected
| route; they carry no business meaning of their own.
|
*/
router
  .get('/api/v1/_stub/protected', ({ response }) => {
    return response.ok(respond({ ok: true }, 'Protected stub reached'))
  })
  .use(middleware.auth())

router
  .get('/api/v1/_stub/protected-admin', ({ response }) => {
    return response.ok(respond({ ok: true }, 'Protected admin stub reached'))
  })
  .use([middleware.auth(), middleware.role({ roles: ['ADMIN'] })])
