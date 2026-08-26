import vine from '@vinejs/vine'

/**
 * POST /api/v1/products
 *
 * Mirrors the `products` table from the README's Data Model section:
 * `category_id BIGINT FK -> categories.id, NOT NULL`, `product_name
 * VARCHAR(255) NOT NULL`, `unit_price FLOAT NOT NULL, > 0`. `positive()`
 * on unitPrice enforces the same "> 0" constraint the migration already
 * enforces at the database level (`products_unit_price_positive` check),
 * so a bad value is rejected with a clean 422 before ever reaching the DB.
 * `categoryId` is only checked for shape/type here; whether that id
 * actually refers to an existing category is a FK existence check that
 * belongs in ProductsService.create/update, not in this schema.
 */
export const createProductSchema = vine.compile(
  vine.object({
    categoryId: vine.number().positive(),
    productName: vine.string().trim().minLength(1).maxLength(255),
    unitPrice: vine.number().positive(),
  })
)

/**
 * PUT /api/v1/products/:id
 *
 * Same fields as createProductSchema, all optional for partial update.
 */
export const updateProductSchema = vine.compile(
  vine.object({
    categoryId: vine.number().positive().optional(),
    productName: vine.string().trim().minLength(1).maxLength(255).optional(),
    unitPrice: vine.number().positive().optional(),
  })
)

/**
 * GET /api/v1/products query params.
 *
 * NOTE: sortBy allowlist. The README's Endpoints table says "sort by
 * productName/unitPrice" and the Key AdonisJS patterns code sample passes
 * `filter.sortBy` straight into `query.orderBy(filter.sortBy, ...)`
 * without specifying how that value is restricted. A bare
 * `vine.string().optional()` would let a client pass any string through
 * to `.orderBy()`, including a column that does not exist (an unhandled
 * DB error) or one that does but was never meant to be sortable. vine.enum
 * closes that off at the validation layer, the same allowlist role
 * router.matchers.number() plays for the :id param convention documented
 * in start/routes.ts. 'productName' and 'unitPrice' (not 'product_name' /
 * 'unit_price') are used deliberately: they are the camelCase model
 * attribute names, and Lucid's ModelQueryBuilder resolves a known
 * attribute name to its snake_case column automatically wherever a raw
 * where()/orderBy() key is a directly a Lucid model attribute name,
 * exactly the same way RolesService already relies on for
 * `.where('roleName', ...)`. Keeping the query param camelCase also keeps
 * the whole public API surface (request and response bodies alike)
 * consistently camelCase.
 */
export const productFilterSchema = vine.compile(
  vine.object({
    categoryId: vine.number().positive().optional(),
    sortBy: vine.enum(['productName', 'unitPrice'] as const).optional(),
    order: vine.enum(['asc', 'desc'] as const).optional(),
  })
)
