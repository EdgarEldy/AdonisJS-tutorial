import { BaseModel, beforeSave, column, manyToMany } from '@adonisjs/lucid/orm'
import type { ManyToMany } from '@adonisjs/lucid/types/relations'
import hash from '@adonisjs/core/services/hash'
import Role from '#models/role'

/**
 * The EER_AUTH `users` table. This model deliberately does not compose
 * `withAuthFinder` from `@adonisjs/auth/mixins/lucid` the way the default
 * `--kit=api` scaffold did: that mixin pairs with the access-tokens guard,
 * which config/auth.ts no longer configures on this branch (the real JWT
 * guard belongs to feature/auth). Keeping User a plain BaseModel here
 * avoids coupling the schema branch to an auth strategy it does not own.
 *
 * Password hashing happens once, in the @beforeSave hook below, and nowhere
 * else in the codebase. The hook only re-hashes when `password` is dirty,
 * so re-saving a user for an unrelated field change (for example toggling
 * `accountLocked`) never re-hashes an already-hashed value.
 */
export default class User extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare firstName: string

  @column()
  declare lastName: string

  @column()
  declare email: string

  // Never serialized back to the client, in responses or JSON.stringify.
  @column({ serializeAs: null })
  declare password: string

  @column()
  declare enabled: boolean

  @column()
  declare accountLocked: boolean

  @manyToMany(() => Role, { pivotTable: 'role_user' })
  declare roles: ManyToMany<typeof Role>

  @beforeSave()
  static async hashPassword(user: User) {
    if (user.$dirty.password) {
      user.password = await hash.make(user.password)
    }
  }
}
