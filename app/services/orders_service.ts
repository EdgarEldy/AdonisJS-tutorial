import emitter from '@adonisjs/core/services/emitter'
import type { Infer } from '@vinejs/vine/types'

import Order from '#models/order'
import Customer from '#models/customer'
import Product from '#models/product'
import OrderCreated from '#events/order_created'
import { toPageResponse, type PageResponse } from '#helpers/page_response'
import type {
  createOrderSchema,
  updateOrderSchema,
  orderFilterSchema,
} from '#validators/order_validator'

type CreateOrderPayload = Infer<typeof createOrderSchema>
type UpdateOrderPayload = Infer<typeof updateOrderSchema>
type OrderFilter = Infer<typeof orderFilterSchema>

/**
 * Owns every read and write to the `orders` table. No constructor
 * dependencies, so no @inject(), matching CategoriesService,
 * ProductsService and CustomersService's own reasoning for the same
 * omission. Orders are the "leaf" of this branch's data model: nothing
 * else references an order row, so unlike ProductsService.remove and
 * CustomersService.remove there is no "still in use" delete guard here,
 * the README does not describe one for this branch and none is invented.
 */
export default class OrdersService {
  /**
   * Builds a dynamic query with optional customerId/productId filters, the
   * same conditional `.where(...)` chaining ProductsService.findAll
   * already uses for its own categoryId filter. Both `customer` and
   * `product` are always preloaded so the list response matches the
   * detail response's shape, per this branch's own task checklist.
   */
  async findAll(filter: OrderFilter, page: number, limit: number): Promise<PageResponse<Order>> {
    const query = Order.query().preload('customer').preload('product')

    if (filter.customerId) {
      query.where('customer_id', filter.customerId)
    }

    if (filter.productId) {
      query.where('product_id', filter.productId)
    }

    const paginator = await query.paginate(page, limit)
    return toPageResponse(paginator)
  }

  /**
   * Backs GET /api/v1/customers/:id/orders. Verifies the customer exists
   * first (404 otherwise) rather than silently returning an empty page for
   * a customer id that was never valid, the same existence-check reasoning
   * ProductsService.create/update apply to categoryId. Kept as its own
   * method rather than folded into findAll's optional customerId filter,
   * since this nested route's contract is "this customer's orders or a
   * 404", not "orders optionally filtered by customer".
   */
  async findAllForCustomer(
    customerId: number,
    page: number,
    limit: number
  ): Promise<PageResponse<Order>> {
    await Customer.findOrFail(customerId)

    const paginator = await Order.query()
      .where('customer_id', customerId)
      .preload('customer')
      .preload('product')
      .paginate(page, limit)

    return toPageResponse(paginator)
  }

  async findOne(id: number): Promise<Order> {
    const order = await Order.findOrFail(id)
    await order.load('customer')
    await order.load('product')
    return order
  }

  /**
   * Verifies both the referenced customer and product exist before writing
   * the order row, matching ProductsService.create's own
   * Category.findOrFail(data.categoryId) guard against a raw FK violation.
   * `total` is computed here, never accepted from the client: quantity x
   * the product's current unitPrice, per the README's Data Model column
   * constraint and this branch's own task checklist. OrderCreated is
   * emitted only after the row is actually persisted, so a listener never
   * observes an order that does not yet exist in the database.
   */
  async create(data: CreateOrderPayload): Promise<Order> {
    await Customer.findOrFail(data.customerId)
    const product = await Product.findOrFail(data.productId)

    const total = data.quantity * product.unitPrice

    const order = await Order.create({ ...data, total })

    emitter.emit(OrderCreated, new OrderCreated(order.id, order.customerId))

    await order.load('customer')
    await order.load('product')
    return order
  }

  /**
   * Re-verifies customer/product existence when those ids are actually
   * present in the payload, the same guard create() applies, so a bad id
   * on update fails with a clean 404 instead of a raw FK violation.
   *
   * `total` is only recomputed when `quantity` is present in the payload
   * AND differs from the order's current value: this is deliberately
   * literal, matching the task checklist's own wording ("recomputing total
   * only when quantity actually changes in the payload ... NOT recomputing
   * total when quantity is absent or unchanged"). A consequence is that
   * changing productId alone (to a product with a different unitPrice)
   * without also changing quantity does NOT recompute total. That may look
   * like it leaves total stale relative to the new product's price, but it
   * is exactly the behavior the checklist specifies, so it is implemented
   * literally rather than the arguably more "correct" alternative of
   * recomputing whenever either quantity or productId changes.
   *
   * NOTE: this literal quantity-only trigger is a real product decision
   * this file is not the place to silently reinterpret. If a future branch
   * wants "total recomputed whenever quantity OR productId changes", that
   * is a one-line change to the condition below, made deliberately rather
   * than assumed here.
   */
  async update(id: number, data: UpdateOrderPayload): Promise<Order> {
    const order = await Order.findOrFail(id)

    if (data.customerId !== undefined) {
      await Customer.findOrFail(data.customerId)
    }

    let product: Product | undefined
    if (data.productId !== undefined) {
      product = await Product.findOrFail(data.productId)
    }

    const quantityChanged = data.quantity !== undefined && data.quantity !== order.quantity

    order.merge(data)

    if (quantityChanged) {
      if (!product) {
        product = await Product.findOrFail(order.productId)
      }
      order.total = order.quantity * product.unitPrice
    }

    await order.save()
    await order.load('customer')
    await order.load('product')
    return order
  }

  async remove(id: number): Promise<void> {
    const order = await Order.findOrFail(id)
    await order.delete()
  }
}
