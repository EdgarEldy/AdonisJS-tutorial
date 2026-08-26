import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import { respond } from '#helpers/api_response'
import CategoriesService from '#services/categories_service'
import { createCategorySchema, updateCategorySchema } from '#validators/category_validator'
import { paginationSchema } from '#validators/pagination_validator'

/**
 * Thin HTTP layer over CategoriesService. GET routes are public; the
 * mutation routes (store, update, destroy) are declared behind
 * `middleware.auth()` + `middleware.role({ roles: ['ADMIN'] })` in
 * start/routes.ts, the same pattern RolesController and
 * PermissionsController already use for their own mutation routes.
 */
@inject()
export default class CategoriesController {
  constructor(private categoriesService: CategoriesService) {}

  /**
   * @index
   * @summary List categories
   * @description Returns a paginated list of categories. Public endpoint, cached by page and limit.
   * @paramQuery page - Page number - @type(number)
   * @paramQuery limit - Items per page, capped at 100 - @type(number)
   * @responseBody 200 - <Category[]>.paginated()
   */
  async index({ request, response }: HttpContext) {
    const { page, limit } = await request.validateUsing(paginationSchema)
    const result = await this.categoriesService.findAll(page ?? 1, limit ?? 10)
    return response.ok(respond(result))
  }

  /**
   * @show
   * @summary Get a category
   * @description Returns a single category by id. Public endpoint.
   * @paramPath id - The category id - @type(number) @required
   * @responseBody 200 - <Category>
   * @responseBody 404 - Category not found
   */
  async show({ params, response }: HttpContext) {
    const category = await this.categoriesService.findOne(Number(params.id))
    return response.ok(respond(category, 'Category detail'))
  }

  /**
   * @store
   * @summary Create a category
   * @description Creates a new category. ADMIN only.
   * @requestBody <createCategorySchema>
   * @responseBody 201 - <Category>
   * @responseBody 401 - Missing or invalid token
   * @responseBody 403 - Caller is not an ADMIN
   */
  async store({ request, response }: HttpContext) {
    const data = await request.validateUsing(createCategorySchema)
    const category = await this.categoriesService.create(data)
    return response.created(respond(category, 'Category created'))
  }

  /**
   * @update
   * @summary Update a category
   * @description Partially updates an existing category. ADMIN only.
   * @paramPath id - The category id - @type(number) @required
   * @requestBody <updateCategorySchema>
   * @responseBody 200 - <Category>
   * @responseBody 401 - Missing or invalid token
   * @responseBody 403 - Caller is not an ADMIN
   * @responseBody 404 - Category not found
   */
  async update({ params, request, response }: HttpContext) {
    const data = await request.validateUsing(updateCategorySchema)
    const category = await this.categoriesService.update(Number(params.id), data)
    return response.ok(respond(category, 'Category updated'))
  }

  /**
   * @destroy
   * @summary Delete a category
   * @description Deletes a category. ADMIN only. Fails with 409 when the category still has products associated with it.
   * @paramPath id - The category id - @type(number) @required
   * @responseBody 200 - Category deleted
   * @responseBody 401 - Missing or invalid token
   * @responseBody 403 - Caller is not an ADMIN
   * @responseBody 404 - Category not found
   * @responseBody 409 - Category still has products associated with it
   */
  async destroy({ params, response }: HttpContext) {
    await this.categoriesService.remove(Number(params.id))
    return response.ok(respond(null, 'Category deleted'))
  }
}
