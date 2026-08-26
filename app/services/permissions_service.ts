import { createError } from '@adonisjs/core/exceptions'
import type { Infer } from '@vinejs/vine/types'

import Permission from '#models/permission'
import { toPageResponse, type PageResponse } from '#helpers/page_response'
import type {
  createPermissionSchema,
  updatePermissionSchema,
} from '#validators/permission_validator'

type CreatePermissionPayload = Infer<typeof createPermissionSchema>
type UpdatePermissionPayload = Infer<typeof updatePermissionSchema>

const E_PERMISSION_IN_USE = createError(
  'Permission is still attached to at least one role',
  'E_PERMISSION_IN_USE',
  409
)

/**
 * Owns every read and write to the `permissions` table from the
 * ADMIN-only administration endpoints. No constructor dependencies, so no
 * @inject(), matching AuthService, UsersService and RolesService's own
 * reasoning for the same omission.
 */
export default class PermissionsService {
  async findAll(page: number, limit: number): Promise<PageResponse<Permission>> {
    const paginator = await Permission.query().paginate(page, limit)
    return toPageResponse(paginator)
  }

  /**
   * Not exposed by any route (the README's Endpoints table has no `GET
   * /api/v1/permissions/:id` row, unlike users and roles), but still
   * needed internally by `update` to fetch the record before mutating it,
   * and listed explicitly in the README's own task checklist for this
   * service.
   */
  async findOne(id: number): Promise<Permission> {
    return Permission.findOrFail(id)
  }

  async create(data: CreatePermissionPayload): Promise<Permission> {
    return Permission.create(data)
  }

  async update(id: number, data: UpdatePermissionPayload): Promise<Permission> {
    const permission = await Permission.findOrFail(id)
    permission.merge(data)
    await permission.save()
    return permission
  }

  /**
   * Business rule from the README: a permission still attached to at
   * least one role cannot be deleted, 409 instead. Same "stop at the
   * first match" reasoning as RolesService.remove's own check against
   * `role_user`.
   */
  async remove(id: number): Promise<void> {
    const permission = await Permission.findOrFail(id)

    const stillAttached = await permission.related('roles').query().first()
    if (stillAttached) {
      throw new E_PERMISSION_IN_USE()
    }

    await permission.delete()
  }
}
