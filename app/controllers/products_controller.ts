import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import { respond } from '#helpers/api_response'
import ProductsService from '#services/products_service'
import {
  createProductSchema,
  updateProductSchema,
  productFilterSchema,
} from '#validators/product_validator'
import { paginationSchema } from '#validators/pagination_validator'

/**
 * Thin HTTP layer over ProductsService. GET routes are public; the
 * mutation routes (store, update, destroy) are declared behind
 * `middleware.auth()` + `middleware.role({ roles: ['ADMIN'] })` in
 * start/routes.ts, the same pattern CategoriesController already uses for
 * its own mutation routes.
 */
@inject()
export default class ProductsController {
  constructor(private productsService: ProductsService) {}

  /**
   * @index
   * @summary List products
   * @description Returns a paginated list of products, optionally filtered by categoryId and sorted by productName or unitPrice. Public endpoint.
   * @paramQuery page - Page number - @type(number)
   * @paramQuery limit - Items per page, capped at 100 - @type(number)
   * @paramQuery categoryId - Filter results to this category id - @type(number)
   * @paramQuery sortBy - Field to sort by (productName or unitPrice) - @type(string)
   * @paramQuery order - Sort order (asc or desc) - @type(string)
   * @responseBody 200 - <Product[]>.paginated()
   */
  async index({ request, response }: HttpContext) {
    // NOTE: pagination and filtering are two independently reusable
    // concerns (paginationSchema is already shared by every other list
    // endpoint), so they are validated with two separate
    // request.validateUsing() calls rather than one schema that merges
    // page/limit/categoryId/sortBy/order together. Both run against the
    // same request query string, VineJS does not care that they overlap,
    // and this keeps paginationSchema reusable as-is instead of forking it.
    const { page, limit } = await request.validateUsing(paginationSchema)
    const filter = await request.validateUsing(productFilterSchema)
    const result = await this.productsService.findAll(filter, page ?? 1, limit ?? 10)
    return response.ok(respond(result))
  }

  /**
   * @show
   * @summary Get a product
   * @description Returns a single product by id, including its category. Public endpoint.
   * @paramPath id - The product id - @type(number) @required
   * @responseBody 200 - <Product>
   * @responseBody 404 - Product not found
   */
  async show({ params, response }: HttpContext) {
    const product = await this.productsService.findOne(Number(params.id))
    return response.ok(respond(product, 'Product detail'))
  }

  /**
   * @store
   * @summary Create a product
   * @description Creates a new product under an existing category. ADMIN only.
   * @requestBody <createProductSchema>
   * @responseBody 201 - <Product>
   * @responseBody 401 - Missing or invalid token
   * @responseBody 403 - Caller is not an ADMIN
   * @responseBody 404 - Category not found
   */
  async store({ request, response }: HttpContext) {
    const data = await request.validateUsing(createProductSchema)
    const product = await this.productsService.create(data)
    return response.created(respond(product, 'Product created'))
  }

  /**
   * @update
   * @summary Update a product
   * @description Partially updates an existing product. ADMIN only.
   * @paramPath id - The product id - @type(number) @required
   * @requestBody <updateProductSchema>
   * @responseBody 200 - <Product>
   * @responseBody 401 - Missing or invalid token
   * @responseBody 403 - Caller is not an ADMIN
   * @responseBody 404 - Product or category not found
   */
  async update({ params, request, response }: HttpContext) {
    const data = await request.validateUsing(updateProductSchema)
    const product = await this.productsService.update(Number(params.id), data)
    return response.ok(respond(product, 'Product updated'))
  }

  /**
   * @destroy
   * @summary Delete a product
   * @description Deletes a product. ADMIN only. Fails with 409 when the product still has orders associated with it.
   * @paramPath id - The product id - @type(number) @required
   * @responseBody 200 - Product deleted
   * @responseBody 401 - Missing or invalid token
   * @responseBody 403 - Caller is not an ADMIN
   * @responseBody 404 - Product not found
   * @responseBody 409 - Product still has orders associated with it
   */
  async destroy({ params, response }: HttpContext) {
    await this.productsService.remove(Number(params.id))
    return response.ok(respond(null, 'Product deleted'))
  }
}
