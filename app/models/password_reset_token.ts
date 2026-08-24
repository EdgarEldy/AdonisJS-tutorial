import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import User from '#models/user'

export default class PasswordResetToken extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare token: string

  // NOTE: the README does not enumerate the values for `type`. feature/auth
  // owns the actual reset flow and will decide the concrete values (for
  // example 'password_reset' vs 'account_activation'); this model keeps
  // the column as a plain string to stay unopinionated about that choice.
  @column()
  declare type: string

  @column.dateTime()
  declare expiryDate: DateTime

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
