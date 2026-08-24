import { createError } from '@adonisjs/core/exceptions'
import type { LucidRow, ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import type { Infer } from '@vinejs/vine/types'

import User from '#models/user'
import Role from '#models/role'
import type { PageResponse } from '#helpers/page_response'
import type { updateUserSchema } from '#validators/user_validator'

type UpdateUserPayload = Infer<typeof updateUserSchema>

const E_EMAIL_TAKEN = createError('Email is already in use by another user', 'E_EMAIL_TAKEN', 409)

/**
 * Maps a Lucid ModelPaginatorContract onto this project's stable
 * PageResponse<T> envelope. Duplicated identically in roles_service.ts and
 * permissions_service.ts rather than factored into a shared helper: the
 * README's project structure only lists app/helpers/api_response.ts and
 * app/helpers/page_response.ts, no shared pagination mapper, and
 * page_response.ts's own docstring already shows this exact mapping as the
 * pattern every service is expected to repeat, the same way the later
 * category/product/customer/order services will each repeat it too.
 */
function toPageResponse<T extends LucidRow>(paginator: ModelPaginatorContract<T>): PageResponse<T> {
  return {
    items: paginator.all(),
    total: paginator.total,
    page: paginator.currentPage,
    limit: paginator.perPage,
    totalPages: paginator.lastPage,
    hasNext: paginator.hasMorePages,
    hasPrevious: paginator.currentPage > 1,
  }
}

/**
 * Owns every read and write to the `users` table from the administration
 * endpoints. This is deliberately separate from AuthService: AuthService
 * covers the self-service account lifecycle (register/activate/login/...)
 * a user runs against their own account, while UsersService covers an
 * ADMIN acting on someone else's account (list, edit, delete, change
 * roles). Splitting them keeps AuthService's own scope from growing to
 * cover both "what a user can do to themselves" and "what an ADMIN can do
 * to anyone", which are different authorization stories even though both
 * ultimately touch the same User model.
 *
 * No constructor dependencies, so no @inject() here, the same reasoning
 * AuthService documents for itself: every collaborator is a static Lucid
 * model, and UsersController is the class that actually needs @inject()
 * since it takes this service as a constructor argument.
 */
export default class UsersService {
  async findAll(page: number, limit: number): Promise<PageResponse<User>> {
    const paginator = await User.query().paginate(page, limit)
    return toPageResponse(paginator)
  }

  async findOne(id: number): Promise<User> {
    return User.query().where('id', id).preload('roles').firstOrFail()
  }

  /**
   * Only re-checks email uniqueness when `email` is present in the payload
   * and actually differs from the user's current value; updating a user
   * without touching their email (for example flipping `accountLocked`)
   * should never trip a false conflict against the user's own row.
   */
  async update(id: number, data: UpdateUserPayload): Promise<User> {
    const user = await User.findOrFail(id)

    if (data.email && data.email !== user.email) {
      const existing = await User.query().where('email', data.email).whereNot('id', id).first()
      if (existing) {
        throw new E_EMAIL_TAKEN()
      }
    }

    user.merge(data)
    await user.save()
    return user
  }

  async remove(id: number): Promise<void> {
    const user = await User.findOrFail(id)
    await user.delete()
  }

  /**
   * Idempotent: attaching a role the user already has is a no-op rather
   * than a duplicate pivot row or a thrown error. `findOrFail` on both
   * User and Role naturally produces the "404 if user or role does not
   * exist" behaviour the README asks for, no separate existence check
   * needed.
   */
  async assignRole(id: number, roleId: number): Promise<User> {
    const user = await User.findOrFail(id)
    const role = await Role.findOrFail(roleId)

    await user.load('roles')
    const alreadyAssigned = user.roles.some((r) => r.id === role.id)
    if (!alreadyAssigned) {
      await user.related('roles').attach([role.id])
      await user.load('roles')
    }

    return user
  }

  /**
   * Idempotent in the other direction: detaching a role the user never
   * had, or a roleId that does not even exist as a row, is a no-op.
   * Lucid's `detach` deletes at most one pivot row and never errors when
   * none matches, so there is nothing extra to guard here.
   *
   * NOTE: unlike `assignRole`, this method does not `findOrFail` the role
   * itself. The README only specifies "404 if user or role does not
   * exist" for assign; revoke's own spec is "idempotent, no error if the
   * role was not assigned", which by construction also covers a roleId
   * that never existed at all, so validating the user's own existence is
   * enough here.
   */
  async revokeRole(id: number, roleId: number): Promise<User> {
    const user = await User.findOrFail(id)
    await user.related('roles').detach([roleId])
    await user.load('roles')
    return user
  }
}
