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
  users: {
    index: typeof routes['users.index']
    show: typeof routes['users.show']
    update: typeof routes['users.update']
    destroy: typeof routes['users.destroy']
    assignRole: typeof routes['users.assign_role']
    revokeRole: typeof routes['users.revoke_role']
  }
  roles: {
    index: typeof routes['roles.index']
    show: typeof routes['roles.show']
    store: typeof routes['roles.store']
    update: typeof routes['roles.update']
    destroy: typeof routes['roles.destroy']
    assignPermission: typeof routes['roles.assign_permission']
    revokePermission: typeof routes['roles.revoke_permission']
  }
  permissions: {
    index: typeof routes['permissions.index']
    store: typeof routes['permissions.store']
    update: typeof routes['permissions.update']
    destroy: typeof routes['permissions.destroy']
  }
  categories: {
    index: typeof routes['categories.index']
    show: typeof routes['categories.show']
    store: typeof routes['categories.store']
    update: typeof routes['categories.update']
    destroy: typeof routes['categories.destroy']
  }
}
