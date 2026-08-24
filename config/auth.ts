import { defineConfig } from '@adonisjs/auth'
import { sessionGuard, sessionUserProvider } from '@adonisjs/auth/session'
import type { InferAuthenticators, InferAuthEvents, Authenticators } from '@adonisjs/auth/types'

// NOTE: the stateless JWT guard described in the README belongs to
// feature/auth. This branch only needs the User model to resolve through
// an auth guard well enough for the app to boot and typecheck; the
// tokens guard from the default --kit=api scaffold required an
// accessTokens provider on User that the EER_AUTH design does not use,
// so it is dropped here rather than kept alongside a model that no
// longer supports it. feature/auth replaces this guard with the JWT one.
const authConfig = defineConfig({
  /**
   * Default guard used when no guard is explicitly specified.
   */
  default: 'web',

  guards: {
    /**
     * Session-based guard for browser authentication.
     */
    web: sessionGuard({
      /**
       * Enable persistent login using remember-me tokens.
       */
      useRememberMeTokens: false,

      provider: sessionUserProvider({
        model: () => import('#models/user'),
      }),
    }),
  },
})

export default authConfig

/**
 * Inferring types from the configured auth
 * guards.
 */
declare module '@adonisjs/auth/types' {
  export interface Authenticators extends InferAuthenticators<typeof authConfig> {}
}
declare module '@adonisjs/core/types' {
  interface EventsList extends InferAuthEvents<Authenticators> {}
}
