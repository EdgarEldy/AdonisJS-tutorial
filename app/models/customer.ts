import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import Order from '#models/order'

export default class Customer extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare firstName: string

  @column()
  declare lastName: string

  @column()
  declare telephone: string

  @column()
  declare email: string

  @column()
  declare address: string

  // NOTE: the README's Data Model diagram shows customers 1 -- N orders,
  // and the Column Details table only defines orders.customer_id as the FK
  // side. The inverse hasMany here is not explicitly requested by the
  // Tasks checklist (which only lists scalar columns for Customer) but is
  // added because the diagram documents the relation and orders.customer_id
  // would otherwise be unreachable from the Customer side.
  @hasMany(() => Order)
  declare orders: HasMany<typeof Order>
}
