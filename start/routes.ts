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

// Lazy import — AdonisJS resolves the module on the first matching request
const HealthController = () => import('#controllers/health_controller')

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
