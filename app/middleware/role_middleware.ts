import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { fail } from '#helpers/api_response'

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
 * This middleware always runs after `middleware.auth()` on a route (never
 * standalone, per the constraint that auth and role middleware are wired
 * at route declaration time), so the jti blacklist check has already
 * happened by the time `handle()` runs here. Calling `auth.authenticate()`
 * again below is cheap: JwtGuard's `authenticationAttempted` flag makes a
 * second call within the same request return the already-resolved user
 * instead of re-verifying the token.
 */
export default class RoleMiddleware {
  async handle(ctx: HttpContext, next: NextFn, options: { roles: string[] }) {
    await ctx.auth.authenticate()
    const user = ctx.auth.user!

    // `auth.authenticate()` resolves the user but never preloads relations.
    // Reading `user.roles` without this call would silently see an empty
    // array and reject every request, the exact bug called out in the
    // README's troubleshooting section for this middleware.
    await user.load('roles')

    const hasRole = user.roles.some((role) => options.roles.includes(role.roleName))
    if (!hasRole) {
      return ctx.response.forbidden(fail('Insufficient role', ctx.request.url()))
    }

    return next()
  }
}
