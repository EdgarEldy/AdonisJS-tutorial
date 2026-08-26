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

import { middleware } from '#start/kernel'
import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'
import AutoSwagger from 'adonis-autoswagger'
import swagger from '#config/swagger'

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
| API documentation
|--------------------------------------------------------------------------
|
| /swagger returns the generated OpenAPI spec in YAML; /docs renders it
| through Swagger UI. Both are public, documentation is not a protected
| resource, and adonis-autoswagger's own default `ignore` list already
| excludes these two paths from appearing in the spec they generate.
|
*/
router.get('/swagger', async () => {
  return AutoSwagger.default.docs(router.toJSON(), swagger)
})

router.get('/docs', async () => {
  return AutoSwagger.default.ui('/swagger', swagger)
})

/*
|--------------------------------------------------------------------------
| API v1 — scaffold routes (replaced in feature/auth)
|--------------------------------------------------------------------------
*/
router
  .group(() => {
    router
      .group(() => {
        router.post('signup', [controllers.NewAccount, 'store'])
        router.post('login', [controllers.AccessTokens, 'store'])
      })
      .prefix('auth')
      .as('auth')

    router
      .group(() => {
        router.get('profile', [controllers.Profile, 'show'])
        router.post('logout', [controllers.AccessTokens, 'destroy'])
      })
      .prefix('account')
      .as('profile')
      .use(middleware.auth())
  })
  .prefix('/api/v1')
