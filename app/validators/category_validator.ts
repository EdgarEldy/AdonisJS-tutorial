import vine from '@vinejs/vine'

/**
 * POST /api/v1/categories
 *
 * `categoryName` mirrors the `categories.category_name VARCHAR(255) NOT
 * NULL` column from the README's Data Model section (see the migration in
 * database/migrations/1700000001_create_core_schema.ts). `minLength(1)`
 * matches the same reasonable-lower-bound reasoning already applied to
 * `roleName` in role_validator.ts, since the column itself has no minimum
 * beyond NOT NULL and a blank name is not a useful category.
 */
export const createCategorySchema = vine.compile(
  vine.object({
    categoryName: vine.string().trim().minLength(1).maxLength(255),
  })
)

/**
 * PUT /api/v1/categories/:id
 *
 * Optional since this is a partial update, though `categoryName` is the
 * only field a category has to update.
 */
export const updateCategorySchema = vine.compile(
  vine.object({
    categoryName: vine.string().trim().minLength(1).maxLength(255).optional(),
  })
)
