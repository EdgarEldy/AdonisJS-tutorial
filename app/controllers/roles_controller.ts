import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import { respond } from '#helpers/api_response'
import RolesService from '#services/roles_service'
import {
  createRoleSchema,
  updateRoleSchema,
  assignPermissionSchema,
} from '#validators/role_validator'

/**
 * Thin HTTP layer over RolesService. Every route this controller serves is
 * declared behind `middleware.auth()` + `middleware.role({ roles: ['ADMIN'] })`
 * in start/routes.ts, same as UsersController.
 */
@inject()
export default class RolesController {
  constructor(private rolesService: RolesService) {}

  async index({ request, response }: HttpContext) {
    const page = Number(request.input('page', 1))
    const limit = Number(request.input('limit', 10))
    const result = await this.rolesService.findAll(page, limit)
    return response.ok(respond(result))
  }

  async show({ params, response }: HttpContext) {
    const role = await this.rolesService.findOne(Number(params.id))
    return response.ok(respond(role, 'Role detail'))
  }

  async store({ request, response }: HttpContext) {
    const data = await request.validateUsing(createRoleSchema)
    const role = await this.rolesService.create(data)
    return response.created(respond(role, 'Role created'))
  }

  async update({ params, request, response }: HttpContext) {
    const data = await request.validateUsing(updateRoleSchema)
    const role = await this.rolesService.update(Number(params.id), data)
    return response.ok(respond(role, 'Role updated'))
  }

  async destroy({ params, response }: HttpContext) {
    await this.rolesService.remove(Number(params.id))
    return response.ok(respond(null, 'Role deleted'))
  }

  async assignPermission({ params, request, response }: HttpContext) {
    const { permissionId } = await request.validateUsing(assignPermissionSchema)
    const role = await this.rolesService.assignPermission(Number(params.id), permissionId)
    return response.created(respond(role, 'Permission assigned'))
  }

  async revokePermission({ params, response }: HttpContext) {
    const role = await this.rolesService.revokePermission(
      Number(params.id),
      Number(params.permissionId)
    )
    return response.ok(respond(role, 'Permission revoked'))
  }
}
