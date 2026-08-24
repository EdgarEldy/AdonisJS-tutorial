import { BaseModel, column, manyToMany } from '@adonisjs/lucid/orm'
import type { ManyToMany } from '@adonisjs/lucid/types/relations'
import Role from '#models/role'

export default class Permission extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare resource: string

  @column()
  declare action: string

  // NOTE: the README only specifies the Role -> Permission direction
  // (`@manyToMany(() => Permission, { pivotTable: 'role_permission' })` on
  // Role). The inverse is declared here so a Permission can be traced back
  // to the roles that grant it, which the `role_permission` FK pair
  // supports without any extra schema.
  @manyToMany(() => Role, { pivotTable: 'role_permission' })
  declare roles: ManyToMany<typeof Role>
}
