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
