import env from '#start/env'
import { defineConfig, drivers } from '@adonisjs/core/hash'

/**
 * Hashing configuration.
 *
 * The default hasher is read from HASH_DRIVER so an environment can switch
 * between argon and bcrypt without a code change, matching the enum already
 * declared in start/env.ts. Argon2 is the recommended choice and what every
 * documented env file in this project sets HASH_DRIVER to; bcrypt is kept
 * configured as a documented fallback rather than removed outright.
 */
const hashConfig = defineConfig({
  default: env.get('HASH_DRIVER'),

  list: {
    /**
     * Argon2id, the variant OWASP recommends when side channel attacks are
     * a concern alongside GPU cracking, which fits a JWT backed API that
     * only ever hashes on register, activation and password reset.
     */
    argon: drivers.argon2({
      variant: 'id',
      memory: 65536,
      iterations: 3,
      parallelism: 4,
    }),

    /**
     * Bcrypt, kept as a documented alternative.
     */
    bcrypt: drivers.bcrypt({
      rounds: 10,
    }),
  },
})

export default hashConfig

/**
 * Inferring types for the list of hashers you have configured
 * in your application.
 */
declare module '@adonisjs/core/types' {
  export interface HashersList extends InferHashers<typeof hashConfig> {}
}
