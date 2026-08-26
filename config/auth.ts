import { defineConfig } from '@adonisjs/auth'
import { jwtGuard } from '#auth/jwt_guard'
import type { InferAuthenticators, InferAuthEvents, Authenticators } from '@adonisjs/auth/types'

const authConfig = defineConfig({
  /**
   * Default guard used when no guard is explicitly specified.
   */
  default: 'jwt',

  guards: {
    /**
     * Stateless guard backed by the custom JwtGuard in app/auth/jwt_guard.ts,
     * the only guard this project authenticates requests with.
     */
    jwt: jwtGuard(),
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
