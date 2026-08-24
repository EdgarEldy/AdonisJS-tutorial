import { createError } from '@adonisjs/core/exceptions'
import type { LucidRow, ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import type { Infer } from '@vinejs/vine/types'

import Role from '#models/role'
import Permission from '#models/permission'
import type { PageResponse } from '#helpers/page_response'
import type { createRoleSchema, updateRoleSchema } from '#validators/role_validator'

type CreateRolePayload = Infer<typeof createRoleSchema>
type UpdateRolePayload = Infer<typeof updateRoleSchema>

const E_ROLE_IN_USE = createError(
  'Role is still assigned to at least one user',
  'E_ROLE_IN_USE',
  409
)

// Same pagination mapping as users_service.ts; see that file's own comment
// on why this is duplicated per-service rather than shared.
function toPageResponse<T extends LucidRow>(paginator: ModelPaginatorContract<T>): PageResponse<T> {
  return {
    items: paginator.all(),
    total: paginator.total,
    page: paginator.currentPage,
    limit: paginator.perPage,
    totalPages: paginator.lastPage,
    hasNext: paginator.hasMorePages,
    hasPrevious: paginator.currentPage > 1,
  }
}

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

  async create(data: CreateRolePayload): Promise<Role> {
    return Role.create(data)
  }

  async update(id: number, data: UpdateRolePayload): Promise<Role> {
    const role = await Role.findOrFail(id)
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
      await role.load('permissions')
    }

    return role
  }

  /** Idempotent, same reasoning as UsersService.revokeRole. */
  async revokePermission(id: number, permissionId: number): Promise<Role> {
    const role = await Role.findOrFail(id)
    await role.related('permissions').detach([permissionId])
    await role.load('permissions')
    return role
  }
}
