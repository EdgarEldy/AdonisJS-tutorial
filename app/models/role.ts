import { BaseModel, column, manyToMany } from '@adonisjs/lucid/orm'
import type { ManyToMany } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Permission from '#models/permission'

export default class Role extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare roleName: string

  @manyToMany(() => User, { pivotTable: 'role_user' })
  declare users: ManyToMany<typeof User>

  @manyToMany(() => Permission, { pivotTable: 'role_permission' })
  declare permissions: ManyToMany<typeof Permission>
}
