import vine from '@vinejs/vine'

/**
 * POST /api/v1/roles
 *
 * `roleName` mirrors the `roles.role_name VARCHAR(50) NOT NULL, UNIQUE`
 * column from the README's Auth Model section. Uniqueness itself is
 * enforced by the database's own unique index; RolesService does not
 * duplicate that check at the service layer the way UsersService does for
 * email, since a race there would only ever surface as a clean 500 turned
 * into a DB constraint error, not a business rule this branch was asked to
 * cover explicitly.
 */
export const createRoleSchema = vine.compile(
  vine.object({
    roleName: vine.string().trim().minLength(1).maxLength(50),
  })
)

/**
 * PUT /api/v1/roles/:id
 *
 * Optional since this is a partial update, though in practice `roleName`
 * is the only field a role has to update.
 */
export const updateRoleSchema = vine.compile(
  vine.object({
    roleName: vine.string().trim().minLength(1).maxLength(50).optional(),
  })
)

/**
 * POST /api/v1/roles/:id/permissions
 *
 * NOTE: same reasoning as `assignRoleSchema` in user_validator.ts, the
 * README names `createRoleSchema` and `updateRoleSchema` as this file's
 * schemas but does not name one for the permission-assignment request
 * body. It lives here because the endpoint is declared under the `/roles`
 * resource and owned by RolesController.
 */
export const assignPermissionSchema = vine.compile(
  vine.object({
    permissionId: vine.number().positive(),
  })
)
