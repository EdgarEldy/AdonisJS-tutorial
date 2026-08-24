/*
|--------------------------------------------------------------------------
| Define HTTP limiters
|--------------------------------------------------------------------------
|
| The "limiter.define" method creates an HTTP middleware to apply rate
| limits on a route or a group of routes. Feel free to define as many
| throttle middleware as needed.
|
*/

import env from '#start/env'
import limiter from '@adonisjs/limiter/services/main'

/**
 * Applied to register, login and forgot-password in start/routes.ts.
 * Limits are read from THROTTLE_AUTH_MAX and THROTTLE_AUTH_WINDOW so an
 * environment can tighten or relax them without a code change.
 */
export const authThrottle = limiter.define('auth', () => {
  return limiter.allowRequests(env.get('THROTTLE_AUTH_MAX')).every(env.get('THROTTLE_AUTH_WINDOW'))
})
