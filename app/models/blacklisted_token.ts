import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import User from '#models/user'

/**
 * Backs the JWT revocation list. `jti` is the JWT ID claim of the token
 * being blacklisted and is unique so the same token cannot be blacklisted
 * twice; feature/auth's AuthMiddleware queries this table by `jti` on
 * every authenticated request to reject revoked tokens before the guard
 * even looks at the signature's expiry.
 */
export default class BlacklistedToken extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare token: string

  @column()
  declare jti: string

  @column.dateTime()
  declare blacklistedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime()
  declare expiresAt: DateTime | null

  @column.dateTime()
  declare validatedAt: DateTime | null

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
