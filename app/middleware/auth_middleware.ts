import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import type { Authenticators } from '@adonisjs/auth/types'
import BlacklistedToken from '#models/blacklisted_token'

/**
 * Auth middleware authenticates HTTP requests and denies access to
 * unauthenticated users. It also rejects requests carrying a JWT that has
 * been explicitly revoked (logout writes the token's `jti` into
 * `blacklisted_tokens`).
 *
 * The `jti` check lives here rather than inside JwtGuard itself. JwtGuard
 * (app/auth/jwt_guard.ts) is deliberately scoped to proving a token is
 * validly signed, not expired, and resolves to a real user, nothing more.
 * Blacklisting is an application-level policy, not a property of the
 * token's cryptographic validity, so it is layered on top of
 * `authenticateUsing()` here instead of being baked into the guard. Every
 * route that applies this middleware gets the check; nothing bypasses it
 * by calling the guard directly, since the guard is never used outside
 * this middleware and RoleMiddleware (which always runs after this one).
 */
export default class AuthMiddleware {
  async handle(
    ctx: HttpContext,
    next: NextFn,
    options: {
      guards?: (keyof Authenticators)[]
    } = {}
  ) {
    await ctx.auth.authenticateUsing(options.guards)

    const payload = ctx.auth.use('jwt').payload
    const jti = payload?.jti

    // NOTE: `jti` is only present when the request actually authenticated
    // via the jwt guard. If a future guard is added to `options.guards`
    // and wins the authentication race, there is no jti to check against
    // the blacklist and this step is a no-op rather than a hard failure.
    if (jti) {
      const blacklisted = await BlacklistedToken.findBy('jti', jti)
      if (blacklisted) {
        return ctx.response.unauthorized({
          success: false,
          message: 'Token has been revoked',
          timestamp: new Date().toISOString(),
          path: ctx.request.url(),
        })
      }
    }

    return next()
  }
}
