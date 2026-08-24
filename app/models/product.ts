import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Category from '#models/category'

export default class Product extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare categoryId: number

  @column()
  declare productName: string

  @column()
  declare unitPrice: number

  @belongsTo(() => Category)
  declare category: BelongsTo<typeof Category>
}
