import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Category from '#models/category'
import Order from '#models/order'

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

  // NOTE: the README's Data Model diagram shows products 1 -- N orders, and
  // the Column Details table only defines orders.product_id as the FK
  // side. The inverse hasMany here is not explicitly requested by the
  // feature/products Tasks checklist, but is added the same way and for the
  // same reason the Customer model already added its own `orders` hasMany:
  // ProductsService.remove needs to check "does at least one order still
  // reference this product" for its 409 delete guard, and `related('orders')`
  // is the same query idiom CategoriesService.remove already uses for its
  // own `products` relation, kept consistent rather than querying Order
  // directly with a hand-written where('productId', ...).
  @hasMany(() => Order)
  declare orders: HasMany<typeof Order>
}
