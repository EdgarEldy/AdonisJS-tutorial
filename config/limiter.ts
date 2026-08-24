import { defineConfig, stores } from '@adonisjs/limiter'

// NOTE: LIMITER_STORE is typed as 'database' | 'redis' in start/env.ts,
// matching the README's documented env reference, but only the database
// store is wired up below since this project has no Redis instance. The
// default is hardcoded to 'database' rather than read from env, the same
// way config/database.ts hardcodes its pg connection instead of deriving
// it from a variable with no matching configured alternative.
const limiterConfig = defineConfig({
  default: 'database',
  stores: {
    /**
     * Database store to save rate limiting data inside a
     * MYSQL or PostgreSQL database.
     */
    database: stores.database({
      tableName: 'rate_limits',
    }),

    /**
     * Memory store could be used during
     * testing
     */
    memory: stores.memory({}),
  },
})

export default limiterConfig

declare module '@adonisjs/limiter/types' {
  export interface LimitersList extends InferLimiters<typeof limiterConfig> {}
}
