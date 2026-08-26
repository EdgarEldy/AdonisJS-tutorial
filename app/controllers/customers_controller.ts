import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import { respond } from '#helpers/api_response'
import CustomersService from '#services/customers_service'
import {
  createCustomerSchema,
  updateCustomerSchema,
  customerSearchSchema,
} from '#validators/customer_validator'
import { paginationSchema } from '#validators/pagination_validator'

/**
 * Thin HTTP layer over CustomersService. Unlike CategoriesController and
 * ProductsController, every route here requires authentication: index and
 * show are declared behind `middleware.auth()` alone in start/routes.ts,
 * while store, update and destroy additionally require
 * `middleware.role({ roles: ['ADMIN'] })`, matching the README's Endpoints
 * table for this branch.
 */
@inject()
export default class CustomersController {
  constructor(private customersService: CustomersService) {}

  /**
   * @index
   * @summary List customers
   * @description Returns a paginated list of customers, optionally filtered by ?search= matching first name, last name or email. Requires authentication.
   * @paramQuery page - Page number - @type(number)
   * @paramQuery limit - Items per page, capped at 100 - @type(number)
   * @paramQuery search - Case-insensitive match against first name, last name or email - @type(string)
   * @responseBody 200 - <Customer[]>.paginated()
   * @responseBody 401 - Missing or invalid token
   */
  async index({ request, response }: HttpContext) {
    // NOTE: same reasoning as ProductsController.index, pagination and
    // search are independently reusable concerns validated with two
    // separate request.validateUsing() calls against the same query string.
    const { page, limit } = await request.validateUsing(paginationSchema)
    const { search } = await request.validateUsing(customerSearchSchema)
    const result = await this.customersService.findAll(search, page ?? 1, limit ?? 10)
    return response.ok(respond(result))
  }

  /**
   * @show
   * @summary Get a customer
   * @description Returns a single customer by id. Requires authentication.
   * @paramPath id - The customer id - @type(number) @required
   * @responseBody 200 - <Customer>
   * @responseBody 401 - Missing or invalid token
   * @responseBody 404 - Customer not found
   */
  async show({ params, response }: HttpContext) {
    const customer = await this.customersService.findOne(Number(params.id))
    return response.ok(respond(customer, 'Customer detail'))
  }

  /**
   * @store
   * @summary Create a customer
   * @description Creates a new customer. ADMIN only. Fails with 409 when the email is already registered to another customer.
   * @requestBody <createCustomerSchema>
   * @responseBody 201 - <Customer>
   * @responseBody 401 - Missing or invalid token
   * @responseBody 403 - Caller is not an ADMIN
   * @responseBody 409 - Email is already registered to another customer
   */
  async store({ request, response }: HttpContext) {
    const data = await request.validateUsing(createCustomerSchema)
    const customer = await this.customersService.create(data)
    return response.created(respond(customer, 'Customer created'))
  }

  /**
   * @update
   * @summary Update a customer
   * @description Partially updates an existing customer. ADMIN only. Fails with 409 when the new email is already registered to another customer.
   * @paramPath id - The customer id - @type(number) @required
   * @requestBody <updateCustomerSchema>
   * @responseBody 200 - <Customer>
   * @responseBody 401 - Missing or invalid token
   * @responseBody 403 - Caller is not an ADMIN
   * @responseBody 404 - Customer not found
   * @responseBody 409 - Email is already registered to another customer
   */
  async update({ params, request, response }: HttpContext) {
    const data = await request.validateUsing(updateCustomerSchema)
    const customer = await this.customersService.update(Number(params.id), data)
    return response.ok(respond(customer, 'Customer updated'))
  }

  /**
   * @destroy
   * @summary Delete a customer
   * @description Deletes a customer. ADMIN only. Fails with 409 when the customer still has orders associated with it.
   * @paramPath id - The customer id - @type(number) @required
   * @responseBody 200 - Customer deleted
   * @responseBody 401 - Missing or invalid token
   * @responseBody 403 - Caller is not an ADMIN
   * @responseBody 404 - Customer not found
   * @responseBody 409 - Customer still has orders associated with it
   */
  async destroy({ params, response }: HttpContext) {
    await this.customersService.remove(Number(params.id))
    return response.ok(respond(null, 'Customer deleted'))
  }
}
