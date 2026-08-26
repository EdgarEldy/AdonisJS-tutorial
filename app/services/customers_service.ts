import { createError } from '@adonisjs/core/exceptions'
import type { Infer } from '@vinejs/vine/types'

import Customer from '#models/customer'
import { toPageResponse, type PageResponse } from '#helpers/page_response'
import type { createCustomerSchema, updateCustomerSchema } from '#validators/customer_validator'

type CreateCustomerPayload = Infer<typeof createCustomerSchema>
type UpdateCustomerPayload = Infer<typeof updateCustomerSchema>

const E_EMAIL_TAKEN = createError(
  'Email is already registered to another customer',
  'E_EMAIL_TAKEN',
  409
)

const E_CUSTOMER_HAS_ORDERS = createError(
  'Customer still has orders associated with it',
  'E_CUSTOMER_HAS_ORDERS',
  409
)

/**
 * Owns every read and write to the `customers` table. No constructor
 * dependencies, so no @inject(), matching CategoriesService and
 * ProductsService's own reasoning for the same omission. Like
 * ProductsService, the README does not ask for caching on the customers
 * list, so findAll below queries straight through to the database on every
 * call.
 */
export default class CustomersService {
  /**
   * Builds the search query per the README's own "ILIKE search in the
   * service" code sample: when `search` is present, it is matched
   * case-insensitively against firstName, lastName and email with a single
   * `where((q) => ...)` group so the ORs stay scoped to that one condition
   * and do not leak into any filter added later.
   */
  async findAll(
    search: string | undefined,
    page: number,
    limit: number
  ): Promise<PageResponse<Customer>> {
    const query = Customer.query()

    if (search) {
      query.where((q) => {
        q.whereILike('first_name', `%${search}%`)
          .orWhereILike('last_name', `%${search}%`)
          .orWhereILike('email', `%${search}%`)
      })
    }

    const paginator = await query.paginate(page, limit)
    return toPageResponse(paginator)
  }

  async findOne(id: number): Promise<Customer> {
    return Customer.findOrFail(id)
  }

  /**
   * Enforces email uniqueness at the service layer before writing the row,
   * the same reasoning UsersService.update documents for its own
   * E_EMAIL_TAKEN check: the database's own unique index on
   * customers.email would already reject a duplicate, but only as a raw
   * constraint violation with no clean .status a controller could act on.
   */
  async create(data: CreateCustomerPayload): Promise<Customer> {
    const existing = await Customer.query().where('email', data.email).first()
    if (existing) {
      throw new E_EMAIL_TAKEN()
    }

    return Customer.create(data)
  }

  /**
   * Only re-checks email uniqueness when `email` is present in the payload
   * and actually differs from the customer's current value, the exact
   * `if (data.email && data.email !== existing.email) { ... }` idiom
   * UsersService.update uses for the same problem: updating a customer
   * without touching their email (for example just their address) should
   * never trip a false conflict against the customer's own row.
   */
  async update(id: number, data: UpdateCustomerPayload): Promise<Customer> {
    const customer = await Customer.findOrFail(id)

    if (data.email && data.email !== customer.email) {
      const existing = await Customer.query().where('email', data.email).whereNot('id', id).first()
      if (existing) {
        throw new E_EMAIL_TAKEN()
      }
    }

    customer.merge(data)
    await customer.save()
    return customer
  }

  /**
   * Business rule from the README: a customer with at least one order
   * still associated with it cannot be deleted, 409 instead. Checked with
   * the same `related('orders').query().select('id').first()` idiom
   * ProductsService.remove uses for its own "still in use" guard, made
   * possible by the `orders` hasMany already declared on the Customer
   * model. This also doubles as the guard that keeps the orders table's
   * own `customer_id` FK from ever actually cascading away order history
   * through this service.
   */
  async remove(id: number): Promise<void> {
    const customer = await Customer.findOrFail(id)

    const stillHasOrders = await customer.related('orders').query().select('id').first()
    if (stillHasOrders) {
      throw new E_CUSTOMER_HAS_ORDERS()
    }

    await customer.delete()
  }
}
