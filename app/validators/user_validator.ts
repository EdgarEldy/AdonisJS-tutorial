import vine from '@vinejs/vine'

/**
 * PUT /api/v1/users/:id
 *
 * Every field is optional since this is a partial update: an ADMIN caller
 * may want to change only `enabled` (to disable an account) or only
 * `accountLocked` (to lock it) without having to resend the rest of the
 * record. `email`, `firstName` and `lastName` reuse the same length limits
 * as `registerSchema` in auth_validator.ts, since they map to the exact
 * same `users` columns. There is no `password` field here on purpose: this
 * is an administration endpoint for editing account metadata, not a way
 * for an ADMIN to set another user's password, that would bypass the
 * reset-password flow's own token verification entirely.
 */
export const updateUserSchema = vine.compile(
  vine.object({
    firstName: vine.string().trim().minLength(1).maxLength(50).optional(),
    lastName: vine.string().trim().minLength(1).maxLength(100).optional(),
    email: vine.string().trim().maxLength(100).email().optional(),
    enabled: vine.boolean().optional(),
    accountLocked: vine.boolean().optional(),
  })
)

/**
 * POST /api/v1/users/:id/roles
 *
 * NOTE: the README enumerates `updateUserSchema` as the only schema owned
 * by this file; it does not name a schema for the role-assignment request
 * body. `POST /users/:id/roles` still needs to read a `roleId` from
 * somewhere, and per this project's hard rule against inline VineJS
 * schemas in controllers, that body needs a compiled schema of its own.
 * It lives here rather than in role_validator.ts because the endpoint is
 * declared under the `/users` resource, mirroring how UsersController (not
 * RolesController) owns the assign/revoke actions.
 */
export const assignRoleSchema = vine.compile(
  vine.object({
    roleId: vine.number().positive(),
  })
)
