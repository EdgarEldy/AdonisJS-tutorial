import { createError } from '@adonisjs/core/exceptions'
import type { Infer } from '@vinejs/vine/types'

import Role from '#models/role'
import Permission from '#models/permission'
import { toPageResponse, type PageResponse } from '#helpers/page_response'
import type { createRoleSchema, updateRoleSchema } from '#validators/role_validator'

type CreateRolePayload = Infer<typeof createRoleSchema>
type UpdateRolePayload = Infer<typeof updateRoleSchema>

const E_ROLE_IN_USE = createError(
  'Role is still assigned to at least one user',
  'E_ROLE_IN_USE',
  409
)
const E_ROLE_NAME_TAKEN = createError('Role name is already in use', 'E_ROLE_NAME_TAKEN', 409)

/**
 * Owns every read and write to the `roles` table and the `role_user` /
 * `role_permission` pivots from the ADMIN-only administration endpoints.
 * No constructor dependencies, so no @inject(), matching AuthService and
 * UsersService's own reasoning for the same omission.
 */
export default class RolesService {
  async findAll(page: number, limit: number): Promise<PageResponse<Role>> {
    const paginator = await Role.query().paginate(page, limit)
    return toPageResponse(paginator)
  }

  async findOne(id: number): Promise<Role> {
    return Role.query().where('id', id).preload('permissions').firstOrFail()
  }

  /**
   * Pre-checks roleName uniqueness rather than letting the migration's
   * UNIQUE constraint reject the insert: a raw Postgres constraint error has
   * no .status property, so app/exceptions/handler.ts's generic branch
   * would turn a routine duplicate-name conflict into an unhandled 500
   * instead of a clean 409, the same class of gap UsersService.update
   * already guards against for email.
   */
  async create(data: CreateRolePayload): Promise<Role> {
    const existing = await Role.findBy('roleName', data.roleName)
    if (existing) {
      throw new E_ROLE_NAME_TAKEN()
    }
    return Role.create(data)
  }

  async update(id: number, data: UpdateRolePayload): Promise<Role> {
    const role = await Role.findOrFail(id)

    if (data.roleName && data.roleName !== role.roleName) {
      const existing = await Role.query()
        .where('roleName', data.roleName)
        .whereNot('id', id)
        .first()
      if (existing) {
        throw new E_ROLE_NAME_TAKEN()
      }
    }

    role.merge(data)
    await role.save()
    return role
  }

  /**
   * Business rule from the README: a role with at least one user still
   * assigned cannot be deleted, 409 instead. Checked by querying the
   * `role_user` pivot through the relation rather than counting every row
   * (`related('users').query().first()` stops at the first match), since
   * the only thing that matters here is "does at least one exist", not
   * how many.
   */
  async remove(id: number): Promise<void> {
    const role = await Role.findOrFail(id)

    const stillAssigned = await role.related('users').query().first()
    if (stillAssigned) {
      throw new E_ROLE_IN_USE()
    }

    await role.delete()
  }

  /** Idempotent, same reasoning as UsersService.assignRole. */
  async assignPermission(id: number, permissionId: number): Promise<Role> {
    const role = await Role.findOrFail(id)
    const permission = await Permission.findOrFail(permissionId)

    await role.load('permissions')
    const alreadyAssigned = role.permissions.some((p) => p.id === permission.id)
    if (!alreadyAssigned) {
      await role.related('permissions').attach([permission.id])
      role.permissions.push(permission)
    }

    return role
  }

  /** Idempotent, same reasoning as UsersService.revokeRole. */
  async revokePermission(id: number, permissionId: number): Promise<Role> {
    const role = await Role.findOrFail(id)
    await role.load('permissions')
    await role.related('permissions').detach([permissionId])

    // role.permissions is Lucid's opaque ManyToMany<typeof Permission> at
    // the type level, array-like at runtime but not reassignable, so the
    // detached permission is spliced out in place rather than filtered
    // into a new array.
    const index = role.permissions.findIndex((permission) => permission.id === permissionId)
    if (index !== -1) {
      role.permissions.splice(index, 1)
    }

    return role
  }
}
