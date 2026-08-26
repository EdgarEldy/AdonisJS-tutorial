/* eslint-disable prettier/prettier */
import type { AdonisEndpoint } from '@tuyau/core/types'
import type { Registry } from './schema.d.ts'
import type { ApiDefinition } from './tree.d.ts'

const placeholder: any = {}

const routes = {
  'health.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/health',
    tokens: [{"old":"/api/v1/health","type":0,"val":"api","end":""},{"old":"/api/v1/health","type":0,"val":"v1","end":""},{"old":"/api/v1/health","type":0,"val":"health","end":""}],
    types: placeholder as Registry['health.index']['types'],
  },
  'auth.register': {
    methods: ["POST"],
    pattern: '/api/v1/auth/register',
    tokens: [{"old":"/api/v1/auth/register","type":0,"val":"api","end":""},{"old":"/api/v1/auth/register","type":0,"val":"v1","end":""},{"old":"/api/v1/auth/register","type":0,"val":"auth","end":""},{"old":"/api/v1/auth/register","type":0,"val":"register","end":""}],
    types: placeholder as Registry['auth.register']['types'],
  },
  'auth.activate': {
    methods: ["POST"],
    pattern: '/api/v1/auth/activate',
    tokens: [{"old":"/api/v1/auth/activate","type":0,"val":"api","end":""},{"old":"/api/v1/auth/activate","type":0,"val":"v1","end":""},{"old":"/api/v1/auth/activate","type":0,"val":"auth","end":""},{"old":"/api/v1/auth/activate","type":0,"val":"activate","end":""}],
    types: placeholder as Registry['auth.activate']['types'],
  },
  'auth.login': {
    methods: ["POST"],
    pattern: '/api/v1/auth/login',
    tokens: [{"old":"/api/v1/auth/login","type":0,"val":"api","end":""},{"old":"/api/v1/auth/login","type":0,"val":"v1","end":""},{"old":"/api/v1/auth/login","type":0,"val":"auth","end":""},{"old":"/api/v1/auth/login","type":0,"val":"login","end":""}],
    types: placeholder as Registry['auth.login']['types'],
  },
  'auth.logout': {
    methods: ["POST"],
    pattern: '/api/v1/auth/logout',
    tokens: [{"old":"/api/v1/auth/logout","type":0,"val":"api","end":""},{"old":"/api/v1/auth/logout","type":0,"val":"v1","end":""},{"old":"/api/v1/auth/logout","type":0,"val":"auth","end":""},{"old":"/api/v1/auth/logout","type":0,"val":"logout","end":""}],
    types: placeholder as Registry['auth.logout']['types'],
  },
  'auth.refresh': {
    methods: ["POST"],
    pattern: '/api/v1/auth/refresh',
    tokens: [{"old":"/api/v1/auth/refresh","type":0,"val":"api","end":""},{"old":"/api/v1/auth/refresh","type":0,"val":"v1","end":""},{"old":"/api/v1/auth/refresh","type":0,"val":"auth","end":""},{"old":"/api/v1/auth/refresh","type":0,"val":"refresh","end":""}],
    types: placeholder as Registry['auth.refresh']['types'],
  },
  'auth.forgot_password': {
    methods: ["POST"],
    pattern: '/api/v1/auth/forgot-password',
    tokens: [{"old":"/api/v1/auth/forgot-password","type":0,"val":"api","end":""},{"old":"/api/v1/auth/forgot-password","type":0,"val":"v1","end":""},{"old":"/api/v1/auth/forgot-password","type":0,"val":"auth","end":""},{"old":"/api/v1/auth/forgot-password","type":0,"val":"forgot-password","end":""}],
    types: placeholder as Registry['auth.forgot_password']['types'],
  },
  'auth.reset_password': {
    methods: ["POST"],
    pattern: '/api/v1/auth/reset-password',
    tokens: [{"old":"/api/v1/auth/reset-password","type":0,"val":"api","end":""},{"old":"/api/v1/auth/reset-password","type":0,"val":"v1","end":""},{"old":"/api/v1/auth/reset-password","type":0,"val":"auth","end":""},{"old":"/api/v1/auth/reset-password","type":0,"val":"reset-password","end":""}],
    types: placeholder as Registry['auth.reset_password']['types'],
  },
  'auth.me': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/auth/me',
    tokens: [{"old":"/api/v1/auth/me","type":0,"val":"api","end":""},{"old":"/api/v1/auth/me","type":0,"val":"v1","end":""},{"old":"/api/v1/auth/me","type":0,"val":"auth","end":""},{"old":"/api/v1/auth/me","type":0,"val":"me","end":""}],
    types: placeholder as Registry['auth.me']['types'],
  },
  'users.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/users',
    tokens: [{"old":"/api/v1/users","type":0,"val":"api","end":""},{"old":"/api/v1/users","type":0,"val":"v1","end":""},{"old":"/api/v1/users","type":0,"val":"users","end":""}],
    types: placeholder as Registry['users.index']['types'],
  },
  'users.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/users/:id',
    tokens: [{"old":"/api/v1/users/:id","type":0,"val":"api","end":""},{"old":"/api/v1/users/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/users/:id","type":0,"val":"users","end":""},{"old":"/api/v1/users/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['users.show']['types'],
  },
  'users.update': {
    methods: ["PUT"],
    pattern: '/api/v1/users/:id',
    tokens: [{"old":"/api/v1/users/:id","type":0,"val":"api","end":""},{"old":"/api/v1/users/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/users/:id","type":0,"val":"users","end":""},{"old":"/api/v1/users/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['users.update']['types'],
  },
  'users.destroy': {
    methods: ["DELETE"],
    pattern: '/api/v1/users/:id',
    tokens: [{"old":"/api/v1/users/:id","type":0,"val":"api","end":""},{"old":"/api/v1/users/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/users/:id","type":0,"val":"users","end":""},{"old":"/api/v1/users/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['users.destroy']['types'],
  },
  'users.assign_role': {
    methods: ["POST"],
    pattern: '/api/v1/users/:id/roles',
    tokens: [{"old":"/api/v1/users/:id/roles","type":0,"val":"api","end":""},{"old":"/api/v1/users/:id/roles","type":0,"val":"v1","end":""},{"old":"/api/v1/users/:id/roles","type":0,"val":"users","end":""},{"old":"/api/v1/users/:id/roles","type":1,"val":"id","end":""},{"old":"/api/v1/users/:id/roles","type":0,"val":"roles","end":""}],
    types: placeholder as Registry['users.assign_role']['types'],
  },
  'users.revoke_role': {
    methods: ["DELETE"],
    pattern: '/api/v1/users/:id/roles/:roleId',
    tokens: [{"old":"/api/v1/users/:id/roles/:roleId","type":0,"val":"api","end":""},{"old":"/api/v1/users/:id/roles/:roleId","type":0,"val":"v1","end":""},{"old":"/api/v1/users/:id/roles/:roleId","type":0,"val":"users","end":""},{"old":"/api/v1/users/:id/roles/:roleId","type":1,"val":"id","end":""},{"old":"/api/v1/users/:id/roles/:roleId","type":0,"val":"roles","end":""},{"old":"/api/v1/users/:id/roles/:roleId","type":1,"val":"roleId","end":""}],
    types: placeholder as Registry['users.revoke_role']['types'],
  },
  'roles.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/roles',
    tokens: [{"old":"/api/v1/roles","type":0,"val":"api","end":""},{"old":"/api/v1/roles","type":0,"val":"v1","end":""},{"old":"/api/v1/roles","type":0,"val":"roles","end":""}],
    types: placeholder as Registry['roles.index']['types'],
  },
  'roles.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/roles/:id',
    tokens: [{"old":"/api/v1/roles/:id","type":0,"val":"api","end":""},{"old":"/api/v1/roles/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/roles/:id","type":0,"val":"roles","end":""},{"old":"/api/v1/roles/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['roles.show']['types'],
  },
  'roles.store': {
    methods: ["POST"],
    pattern: '/api/v1/roles',
    tokens: [{"old":"/api/v1/roles","type":0,"val":"api","end":""},{"old":"/api/v1/roles","type":0,"val":"v1","end":""},{"old":"/api/v1/roles","type":0,"val":"roles","end":""}],
    types: placeholder as Registry['roles.store']['types'],
  },
  'roles.update': {
    methods: ["PUT"],
    pattern: '/api/v1/roles/:id',
    tokens: [{"old":"/api/v1/roles/:id","type":0,"val":"api","end":""},{"old":"/api/v1/roles/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/roles/:id","type":0,"val":"roles","end":""},{"old":"/api/v1/roles/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['roles.update']['types'],
  },
  'roles.destroy': {
    methods: ["DELETE"],
    pattern: '/api/v1/roles/:id',
    tokens: [{"old":"/api/v1/roles/:id","type":0,"val":"api","end":""},{"old":"/api/v1/roles/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/roles/:id","type":0,"val":"roles","end":""},{"old":"/api/v1/roles/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['roles.destroy']['types'],
  },
  'roles.assign_permission': {
    methods: ["POST"],
    pattern: '/api/v1/roles/:id/permissions',
    tokens: [{"old":"/api/v1/roles/:id/permissions","type":0,"val":"api","end":""},{"old":"/api/v1/roles/:id/permissions","type":0,"val":"v1","end":""},{"old":"/api/v1/roles/:id/permissions","type":0,"val":"roles","end":""},{"old":"/api/v1/roles/:id/permissions","type":1,"val":"id","end":""},{"old":"/api/v1/roles/:id/permissions","type":0,"val":"permissions","end":""}],
    types: placeholder as Registry['roles.assign_permission']['types'],
  },
  'roles.revoke_permission': {
    methods: ["DELETE"],
    pattern: '/api/v1/roles/:id/permissions/:permissionId',
    tokens: [{"old":"/api/v1/roles/:id/permissions/:permissionId","type":0,"val":"api","end":""},{"old":"/api/v1/roles/:id/permissions/:permissionId","type":0,"val":"v1","end":""},{"old":"/api/v1/roles/:id/permissions/:permissionId","type":0,"val":"roles","end":""},{"old":"/api/v1/roles/:id/permissions/:permissionId","type":1,"val":"id","end":""},{"old":"/api/v1/roles/:id/permissions/:permissionId","type":0,"val":"permissions","end":""},{"old":"/api/v1/roles/:id/permissions/:permissionId","type":1,"val":"permissionId","end":""}],
    types: placeholder as Registry['roles.revoke_permission']['types'],
  },
  'permissions.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/permissions',
    tokens: [{"old":"/api/v1/permissions","type":0,"val":"api","end":""},{"old":"/api/v1/permissions","type":0,"val":"v1","end":""},{"old":"/api/v1/permissions","type":0,"val":"permissions","end":""}],
    types: placeholder as Registry['permissions.index']['types'],
  },
  'permissions.store': {
    methods: ["POST"],
    pattern: '/api/v1/permissions',
    tokens: [{"old":"/api/v1/permissions","type":0,"val":"api","end":""},{"old":"/api/v1/permissions","type":0,"val":"v1","end":""},{"old":"/api/v1/permissions","type":0,"val":"permissions","end":""}],
    types: placeholder as Registry['permissions.store']['types'],
  },
  'permissions.update': {
    methods: ["PUT"],
    pattern: '/api/v1/permissions/:id',
    tokens: [{"old":"/api/v1/permissions/:id","type":0,"val":"api","end":""},{"old":"/api/v1/permissions/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/permissions/:id","type":0,"val":"permissions","end":""},{"old":"/api/v1/permissions/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['permissions.update']['types'],
  },
  'permissions.destroy': {
    methods: ["DELETE"],
    pattern: '/api/v1/permissions/:id',
    tokens: [{"old":"/api/v1/permissions/:id","type":0,"val":"api","end":""},{"old":"/api/v1/permissions/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/permissions/:id","type":0,"val":"permissions","end":""},{"old":"/api/v1/permissions/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['permissions.destroy']['types'],
  },
} as const satisfies Record<string, AdonisEndpoint>

export { routes }

export const registry = {
  routes,
  $tree: {} as ApiDefinition,
}

declare module '@tuyau/core/types' {
  export interface UserRegistry {
    routes: typeof routes
    $tree: ApiDefinition
  }
}
