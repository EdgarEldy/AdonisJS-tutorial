import { defineConfig, store, drivers } from '@adonisjs/cache'

/**
 * The database driver reuses the existing pg connection from
 * config/database.ts, the same reasoning as config/limiter.ts's own choice
 * of a database store over Redis: this project already runs one shared
 * PostgreSQL instance in every environment via docker-compose, and adding
 * Redis as a second piece of infrastructure just for caching a handful of
 * frequently read list endpoints (the README names the categories list
 * specifically) is not worth the extra moving part.
 *
 * The in-memory L1 layer sits in front of it regardless, so most reads
 * never touch the database at all; L2 only matters for cache entries that
 * need to survive a process restart or be shared across instances.
 */
const cacheConfig = defineConfig({
  default: 'default',

  stores: {
    memoryOnly: store().useL1Layer(drivers.memory()),

    default: store().useL1Layer(drivers.memory()).useL2Layer(drivers.database({})),
  },
})

export default cacheConfig

declare module '@adonisjs/cache/types' {
  interface CacheStores extends InferStores<typeof cacheConfig> {}
}
