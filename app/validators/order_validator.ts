import vine from '@vinejs/vine'

/**
 * POST /api/v1/orders
 *
 * Mirrors the `orders` table from the README's Data Model section:
 * `customer_id BIGINT FK -> customers.id, NOT NULL`, `product_id BIGINT FK
 * -> products.id, NOT NULL`, `quantity INT NOT NULL, > 0`. `positive()` on
 * quantity enforces the "> 0" constraint at the validation layer, the same
 * role `unitPrice: vine.number().positive()` plays in
 * createProductSchema. `customerId` and `productId` are only checked for
 * shape/type here; whether those ids actually refer to existing rows is a
 * FK existence check that belongs in OrdersService.create/update, matching
 * ProductsService.create's own categoryId existence check. `total` is not
 * part of this schema at all: it is a computed field, never accepted from
 * the client, the same way it is never a column a request body is allowed
 * to set directly.
 */
export const createOrderSchema = vine.compile(
  vine.object({
    customerId: vine.number().positive(),
    productId: vine.number().positive(),
    quantity: vine.number().positive(),
  })
)

/**
 * PUT /api/v1/orders/:id
 *
 * Same fields as createOrderSchema, all optional for partial update.
 */
export const updateOrderSchema = vine.compile(
  vine.object({
    customerId: vine.number().positive().optional(),
    productId: vine.number().positive().optional(),
    quantity: vine.number().positive().optional(),
  })
)

/**
 * GET /api/v1/orders query params.
 *
 * The README's Endpoints table asks for "filter by customerId/productId"
 * on the list endpoint. Both are optional and independently combinable in
 * OrdersService.findAll, the same conditional `.where(...)` chaining
 * ProductsService.findAll already does for its own categoryId filter.
 */
export const orderFilterSchema = vine.compile(
  vine.object({
    customerId: vine.number().positive().optional(),
    productId: vine.number().positive().optional(),
  })
)
