import vine from '@vinejs/vine'

/**
 * Telephone format rule shared by create and update.
 *
 * The README's Tasks checklist asks for `telephone: vine.string().regex(...)`
 * without naming the exact pattern, so this project settles on a permissive
 * international-friendly shape: an optional leading `+`, then digits,
 * spaces, hyphens, dots or parentheses, 7 to 20 characters long. This
 * accepts common formats like `+1 (555) 010-0100` or `555-0100` without
 * trying to fully validate a specific country's numbering plan, which is a
 * much larger problem than this branch needs to solve.
 *
 * NOTE: this decision (the exact telephone pattern) is not spelled out in
 * the README and is left to this validator's own judgment, the same way
 * auth_validator.ts documents its own choice of password complexity rule.
 */
const telephonePattern = /^\+?[0-9()\-.\s]{7,20}$/

/**
 * POST /api/v1/customers
 *
 * Field lengths mirror the `customers` table constraints from the README's
 * Column Details table: first_name VARCHAR(255), last_name VARCHAR(255),
 * telephone VARCHAR(50), email VARCHAR(255), address VARCHAR(255). Email
 * uniqueness itself is enforced in CustomersService, not here, since a
 * schema has no way to query the database.
 */
export const createCustomerSchema = vine.compile(
  vine.object({
    firstName: vine.string().trim().minLength(1).maxLength(255),
    lastName: vine.string().trim().minLength(1).maxLength(255),
    telephone: vine.string().trim().regex(telephonePattern).maxLength(50),
    email: vine.string().trim().maxLength(255).email(),
    address: vine.string().trim().minLength(1).maxLength(255),
  })
)

/**
 * PUT /api/v1/customers/:id
 *
 * Same fields as createCustomerSchema, all optional for partial update.
 */
export const updateCustomerSchema = vine.compile(
  vine.object({
    firstName: vine.string().trim().minLength(1).maxLength(255).optional(),
    lastName: vine.string().trim().minLength(1).maxLength(255).optional(),
    telephone: vine.string().trim().regex(telephonePattern).maxLength(50).optional(),
    email: vine.string().trim().maxLength(255).email().optional(),
    address: vine.string().trim().minLength(1).maxLength(255).optional(),
  })
)

/**
 * GET /api/v1/customers query params.
 *
 * NOTE: the README's own "ILIKE search in the service" code sample takes
 * `search: string | undefined` straight into CustomersService.findAll, but
 * does not say whether the controller reads it with its own compiled schema
 * or a bare `request.input('search')`. Per this project's hard rule against
 * inline VineJS schemas in controllers, `search` still gets a schema of its
 * own here rather than being read directly, kept optional and unbounded in
 * content (a search term is not a stored column, there is no natural max
 * length to mirror), the same way paginationSchema is a small dedicated
 * schema shared by the list endpoint.
 */
export const customerSearchSchema = vine.compile(
  vine.object({
    search: vine.string().trim().optional(),
  })
)
