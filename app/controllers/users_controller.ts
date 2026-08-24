import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import { respond } from '#helpers/api_response'
import UsersService from '#services/users_service'
import { updateUserSchema, assignRoleSchema } from '#validators/user_validator'

/**
 * Thin HTTP layer over UsersService: every action validates its input (or
 * reads a route param), delegates to the service, and wraps the result
 * with `respond()`. Every route this controller serves is declared behind
 * `middleware.auth()` + `middleware.role({ roles: ['ADMIN'] })` in
 * start/routes.ts, so no per-action authorization check is repeated here.
 */
@inject()
export default class UsersController {
  constructor(private usersService: UsersService) {}

  async index({ request, response }: HttpContext) {
    const page = Number(request.input('page', 1))
    const limit = Number(request.input('limit', 10))
    const result = await this.usersService.findAll(page, limit)
    return response.ok(respond(result))
  }

  async show({ params, response }: HttpContext) {
    const user = await this.usersService.findOne(Number(params.id))
    return response.ok(respond(user, 'User detail'))
  }

  async update({ params, request, response }: HttpContext) {
    const data = await request.validateUsing(updateUserSchema)
    const user = await this.usersService.update(Number(params.id), data)
    return response.ok(respond(user, 'User updated'))
  }

  async destroy({ params, response }: HttpContext) {
    await this.usersService.remove(Number(params.id))
    return response.ok(respond(null, 'User deleted'))
  }

  async assignRole({ params, request, response }: HttpContext) {
    const { roleId } = await request.validateUsing(assignRoleSchema)
    const user = await this.usersService.assignRole(Number(params.id), roleId)
    return response.created(respond(user, 'Role assigned'))
  }

  async revokeRole({ params, response }: HttpContext) {
    const user = await this.usersService.revokeRole(Number(params.id), Number(params.roleId))
    return response.ok(respond(user, 'Role revoked'))
  }
}
