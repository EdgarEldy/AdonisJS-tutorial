import vine from '@vinejs/vine'

/**
 * Shared by every paginated list endpoint (users, roles, permissions here,
 * categories/products/customers/orders in later branches). Replaces a bare
 * `Number(request.input('page', 1))` in each controller, which let a
 * non-numeric value flow through as NaN straight into Lucid's `paginate()`
 * and had no upper bound on `limit`, letting a client request an entire
 * table in one response, exactly what the project's "no unbounded queries"
 * rule exists to prevent.
 */
export const paginationSchema = vine.compile(
  vine.object({
    page: vine.number().positive().optional(),
    limit: vine.number().positive().max(100).optional(),
  })
)
