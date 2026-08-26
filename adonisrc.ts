import { indexEntities } from '@adonisjs/core'
import { defineConfig } from '@adonisjs/core/app'
import { generateRegistry } from '@tuyau/core/hooks'
import { indexPolicies } from '@adonisjs/bouncer'

export default defineConfig({
  /*
  |--------------------------------------------------------------------------
  | Experimental flags
  |--------------------------------------------------------------------------
  |
  | The following features will be enabled by default in the next major release
  | of AdonisJS. You can opt into them today to avoid any breaking changes
  | during upgrade.
  |
  */
  experimental: {},

  /*
  |--------------------------------------------------------------------------
  | Commands
  |--------------------------------------------------------------------------
  |
  | List of ace commands to register from packages. The application commands
  | will be scanned automatically from the "./commands" directory.
  |
  */
  commands: [
    () => import('@adonisjs/core/commands'),
    () => import('@adonisjs/lucid/commands'),
    () => import('@adonisjs/session/commands'),
    () => import('@adonisjs/bouncer/commands'),
    () => import('@adonisjs/mail/commands'),
    () => import('@adonisjs/cache/commands'),
  ],

  /*
  |--------------------------------------------------------------------------
  | Service providers
  |--------------------------------------------------------------------------
  |
  | List of service providers to import and register when booting the
  | application
  |
  */
  providers: [
    () => import('@adonisjs/core/providers/app_provider'),
    () => import('@adonisjs/core/providers/hash_provider'),
    {
      file: () => import('@adonisjs/core/providers/repl_provider'),
      environment: ['repl', 'test'],
    },
    () => import('@adonisjs/core/providers/vinejs_provider'),
    () => import('@adonisjs/session/session_provider'),
    () => import('@adonisjs/shield/shield_provider'),
    () => import('@adonisjs/lucid/database_provider'),
    () => import('@adonisjs/cors/cors_provider'),
    () => import('@adonisjs/auth/auth_provider'),
    () => import('#providers/api_provider'),
    () => import('@adonisjs/bouncer/bouncer_provider'),
    () => import('@adonisjs/limiter/limiter_provider'),
    () => import('@adonisjs/mail/mail_provider'),
    () => import('@adonisjs/cache/cache_provider'),
  ],

  /*
  |--------------------------------------------------------------------------
  | Preloads
  |--------------------------------------------------------------------------
  |
  | List of modules to import before starting the application.
  |
  */
  preloads: [
    // No separate entry for start/kernel.ts: routes.ts is the only file
    // that imports it (`import { middleware } from '#start/kernel'`), so
    // its own static import already guarantees kernel.ts is fully
    // evaluated before routes.ts's body runs, per normal ES module
    // dependency ordering. A prior version of this array preloaded kernel
    // and routes as two independent entries; since every entry here is
    // started concurrently (Promise.all over the whole array, not run in
    // sequence), that gave kernel.ts two competing load paths and produced
    // an intermittent "Cannot access 'middleware' before initialization"
    // TDZ error whenever the loader's two concurrent requests for the same
    // module raced. Removing the redundant entry removes the race, since
    // there is now exactly one load path for kernel.ts left.
    () => import('#start/routes'),
    () => import('#start/validator'),
    // Event -> listener bindings (OrderCreated -> SendOrderNotification).
    // Loaded last: listener registration has no dependency on kernel,
    // routes or the validator preload either way, so appending it here is
    // the least disruptive place to add it to the array that is already
    // here.
    () => import('#start/events'),
  ],

  /*
  |--------------------------------------------------------------------------
  | Tests
  |--------------------------------------------------------------------------
  |
  | List of test suites to organize tests by their type. Feel free to remove
  | and add additional suites.
  |
  */
  tests: {
    suites: [
      {
        files: ['tests/unit/**/*.spec.{ts,js}'],
        name: 'unit',
        timeout: 2000,
      },
      {
        files: ['tests/functional/**/*.spec.{ts,js}'],
        name: 'functional',
        timeout: 30000,
      },
    ],
    forceExit: false,
  },

  /*
  |--------------------------------------------------------------------------
  | Metafiles
  |--------------------------------------------------------------------------
  |
  | A collection of files you want to copy to the build folder when creating
  | the production build.
  |
  */
  metaFiles: [],

  hooks: {
    init: [
      indexEntities({
        transformers: { enabled: true },
      }),
      generateRegistry(),
      indexPolicies(),
    ],
  },
})
