import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Role-based access control middleware.
 *
 * Named middleware in AdonisJS can receive arguments at the route level:
 *
 *   router.post('/categories', [CategoriesController, 'store'])
 *     .use([middleware.auth(), middleware.role({ roles: ['ADMIN'] })])
 *
 * The third parameter of `handle()` carries those arguments. This lets a
 * single middleware class enforce different role requirements on different
 * routes without duplicating logic.
 *
 * Full implementation (JWT lookup, role preloading, forbidden response) is
 * added in feature/auth once the User model and auth guard are in place.
 * Registering the stub here lets route declarations reference `middleware.role()`
 * from day one without causing import errors.
 */
export default class RoleMiddleware {
  /** Passes the request through unconditionally until feature/auth wires the real check. */
  async handle(_ctx: HttpContext, next: NextFn, _options: { roles: string[] }) {
    return next()
  }
}
