import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import { respond } from '#helpers/api_response'
import OrdersService from '#services/orders_service'
import {
  createOrderSchema,
  updateOrderSchema,
  orderFilterSchema,
} from '#validators/order_validator'
import { paginationSchema } from '#validators/pagination_validator'

/**
 * Thin HTTP layer over OrdersService. Like CustomersController, every
 * route here requires authentication: index, show and forCustomer are
 * declared behind `middleware.auth()` alone in start/routes.ts, while
 * store, update and destroy additionally require
 * `middleware.role({ roles: ['ADMIN'] })`, matching the README's
 * Endpoints table for this branch.
 */
@inject()
export default class OrdersController {
  constructor(private ordersService: OrdersService) {}

  /**
   * @index
   * @summary List orders
   * @description Returns a paginated list of orders, optionally filtered by customerId and/or productId. Requires authentication.
   * @paramQuery page - Page number - @type(number)
   * @paramQuery limit - Items per page, capped at 100 - @type(number)
   * @paramQuery customerId - Filter results to this customer id - @type(number)
   * @paramQuery productId - Filter results to this product id - @type(number)
   * @responseBody 200 - <Order[]>.paginated()
   * @responseBody 401 - Missing or invalid token
   */
  async index({ request, response }: HttpContext) {
    // NOTE: same reasoning as ProductsController.index and
    // CustomersController.index, pagination and filtering are two
    // independently reusable concerns validated with two separate
    // request.validateUsing() calls against the same query string.
    const { page, limit } = await request.validateUsing(paginationSchema)
    const filter = await request.validateUsing(orderFilterSchema)
    const result = await this.ordersService.findAll(filter, page ?? 1, limit ?? 10)
    return response.ok(respond(result))
  }

  /**
   * @show
   * @summary Get an order
   * @description Returns a single order by id, including its customer and product. Requires authentication.
   * @paramPath id - The order id - @type(number) @required
   * @responseBody 200 - <Order>
   * @responseBody 401 - Missing or invalid token
   * @responseBody 404 - Order not found
   */
  async show({ params, response }: HttpContext) {
    const order = await this.ordersService.findOne(Number(params.id))
    return response.ok(respond(order, 'Order detail'))
  }

  /**
   * @forCustomer
   * @summary List a customer's orders
   * @description Returns a paginated list of every order placed by the given customer. Requires authentication.
   * @paramPath id - The customer id - @type(number) @required
   * @paramQuery page - Page number - @type(number)
   * @paramQuery limit - Items per page, capped at 100 - @type(number)
   * @responseBody 200 - <Order[]>.paginated()
   * @responseBody 401 - Missing or invalid token
   * @responseBody 404 - Customer not found
   */
  async forCustomer({ params, request, response }: HttpContext) {
    const { page, limit } = await request.validateUsing(paginationSchema)
    const result = await this.ordersService.findAllForCustomer(
      Number(params.id),
      page ?? 1,
      limit ?? 10
    )
    return response.ok(respond(result))
  }

  /**
   * @store
   * @summary Create an order
   * @description Creates a new order for an existing customer and product. total is computed automatically as quantity x product.unitPrice. ADMIN only.
   * @requestBody <createOrderSchema>
   * @responseBody 201 - <Order>
   * @responseBody 401 - Missing or invalid token
   * @responseBody 403 - Caller is not an ADMIN
   * @responseBody 404 - Customer or product not found
   */
  async store({ request, response }: HttpContext) {
    const data = await request.validateUsing(createOrderSchema)
    const order = await this.ordersService.create(data)
    return response.created(respond(order, 'Order created'))
  }

  /**
   * @update
   * @summary Update an order
   * @description Partially updates an existing order. total is recomputed when quantity changes. ADMIN only.
   * @paramPath id - The order id - @type(number) @required
   * @requestBody <updateOrderSchema>
   * @responseBody 200 - <Order>
   * @responseBody 401 - Missing or invalid token
   * @responseBody 403 - Caller is not an ADMIN
   * @responseBody 404 - Order, customer or product not found
   */
  async update({ params, request, response }: HttpContext) {
    const data = await request.validateUsing(updateOrderSchema)
    const order = await this.ordersService.update(Number(params.id), data)
    return response.ok(respond(order, 'Order updated'))
  }

  /**
   * @destroy
   * @summary Delete an order
   * @description Deletes an order. ADMIN only.
   * @paramPath id - The order id - @type(number) @required
   * @responseBody 200 - Order deleted
   * @responseBody 401 - Missing or invalid token
   * @responseBody 403 - Caller is not an ADMIN
   * @responseBody 404 - Order not found
   */
  async destroy({ params, response }: HttpContext) {
    await this.ordersService.remove(Number(params.id))
    return response.ok(respond(null, 'Order deleted'))
  }
}
