/* eslint-disable prettier/prettier */
import type { routes } from './index.ts'

export interface ApiDefinition {
  health: {
    index: typeof routes['health.index']
  }
  auth: {
    register: typeof routes['auth.register']
    activate: typeof routes['auth.activate']
    login: typeof routes['auth.login']
    logout: typeof routes['auth.logout']
    refresh: typeof routes['auth.refresh']
    forgotPassword: typeof routes['auth.forgot_password']
    resetPassword: typeof routes['auth.reset_password']
    me: typeof routes['auth.me']
  }
}
