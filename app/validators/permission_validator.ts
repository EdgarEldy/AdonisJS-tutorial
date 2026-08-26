import vine from '@vinejs/vine'

/**
 * POST /api/v1/permissions
 *
 * `resource` and `action` mirror the `permissions` table's own columns
 * (`VARCHAR(50) NOT NULL` each) from the README's Auth Model section. A
 * permission is the pair of the two, for example `resource: 'categories'`,
 * `action: 'delete'`, so both are required on create.
 */
export const createPermissionSchema = vine.compile(
  vine.object({
    resource: vine.string().trim().minLength(1).maxLength(50),
    action: vine.string().trim().minLength(1).maxLength(50),
  })
)

/**
 * PUT /api/v1/permissions/:id
 *
 * Both fields optional since this is a partial update.
 */
export const updatePermissionSchema = vine.compile(
  vine.object({
    resource: vine.string().trim().minLength(1).maxLength(50).optional(),
    action: vine.string().trim().minLength(1).maxLength(50).optional(),
  })
)
