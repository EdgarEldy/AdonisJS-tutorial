import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import { respond } from '#helpers/api_response'
import PermissionsService from '#services/permissions_service'
import { createPermissionSchema, updatePermissionSchema } from '#validators/permission_validator'

/**
 * Thin HTTP layer over PermissionsService. Every route this controller
 * serves is declared behind `middleware.auth()` + `middleware.role({ roles: ['ADMIN'] })`
 * in start/routes.ts, same as UsersController and RolesController.
 *
 * No `show` action: the README's Endpoints table has no `GET
 * /api/v1/permissions/:id` row, unlike users and roles, so none is added
 * here even though PermissionsService.findOne exists for internal reuse.
 */
@inject()
export default class PermissionsController {
  constructor(private permissionsService: PermissionsService) {}

  async index({ request, response }: HttpContext) {
    const page = Number(request.input('page', 1))
    const limit = Number(request.input('limit', 10))
    const result = await this.permissionsService.findAll(page, limit)
    return response.ok(respond(result))
  }

  async store({ request, response }: HttpContext) {
    const data = await request.validateUsing(createPermissionSchema)
    const permission = await this.permissionsService.create(data)
    return response.created(respond(permission, 'Permission created'))
  }

  async update({ params, request, response }: HttpContext) {
    const data = await request.validateUsing(updatePermissionSchema)
    const permission = await this.permissionsService.update(Number(params.id), data)
    return response.ok(respond(permission, 'Permission updated'))
  }

  async destroy({ params, response }: HttpContext) {
    await this.permissionsService.remove(Number(params.id))
    return response.ok(respond(null, 'Permission deleted'))
  }
}
