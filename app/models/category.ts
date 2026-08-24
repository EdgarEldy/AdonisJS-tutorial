import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import Product from '#models/product'

// NOTE: the README's Data Model "Column Details" table for `categories`
// lists only `id` and `category_name`, with no `created_at` / `updated_at`
// columns, unlike the generic Lucid model example in the patterns skill.
// This model and its migration follow the README's explicit column list
// rather than the generic pattern, since the README is the authoritative
// spec for this branch.
export default class Category extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare categoryName: string

  @hasMany(() => Product)
  declare products: HasMany<typeof Product>
}
