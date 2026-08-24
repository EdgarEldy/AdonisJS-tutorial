import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Creates the EER_AUTH schema: users, roles, permissions, the two pivot
 * tables that back the many-to-many relations declared on the User and
 * Role models, and the three token tables (activation, blacklist,
 * password reset) that feature/auth writes to.
 *
 * Table order mirrors the FK dependency graph: users/roles/permissions
 * have no dependencies and are created first, the pivot tables depend on
 * two of those three, and the token tables depend only on users. `down()`
 * reverses that order so no drop ever runs while a table still references
 * it.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('users', (table) => {
      table.bigIncrements('id')
      table.string('first_name', 50).notNullable()
      table.string('last_name', 100).notNullable()
      table.string('email', 100).notNullable().unique()
      // NOTE: the README's column table does not mark `password` NOT NULL,
      // unlike every other column here. Left nullable so an account created
      // ahead of activation (invited but not yet set a password) is
      // representable; the @beforeSave hook on User only hashes when a
      // password is actually set.
      table.string('password', 255).nullable()
      table.boolean('enabled').notNullable()
      table.boolean('account_locked').notNullable()
    })

    this.schema.createTable('roles', (table) => {
      table.bigIncrements('id')
      table.string('role_name', 50).notNullable().unique()
    })

    this.schema.createTable('permissions', (table) => {
      table.bigIncrements('id')
      table.string('resource', 50).notNullable()
      table.string('action', 50).notNullable()
    })

    this.schema.createTable('role_user', (table) => {
      table
        .bigInteger('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table
        .bigInteger('role_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('roles')
        .onDelete('CASCADE')
      // NOTE: the README lists only user_id and role_id for this pivot,
      // no surrogate id. A composite primary key is added here (Lucid's
      // manyToMany does not require a dedicated id column on the pivot)
      // so the same user cannot be assigned the same role twice.
      table.primary(['user_id', 'role_id'])
    })

    this.schema.createTable('role_permission', (table) => {
      table
        .bigInteger('role_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('roles')
        .onDelete('CASCADE')
      table
        .bigInteger('permission_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('permissions')
        .onDelete('CASCADE')
      table.primary(['role_id', 'permission_id'])
    })

    this.schema.createTable('activation_tokens', (table) => {
      table.bigIncrements('id')
      // NOTE: the README does not mark activation_tokens.user_id NOT NULL,
      // so the FK is nullable here. CASCADE still applies to rows that do
      // have a user_id: an activation token has no purpose once its owning
      // account is gone.
      table
        .bigInteger('user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.string('token', 255).nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('expires_at').nullable()
      table.timestamp('validated_at').nullable()
    })

    this.schema.createTable('blacklisted_tokens', (table) => {
      table.bigIncrements('id')
      table
        .bigInteger('user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.string('token', 768).notNullable()
      // jti is unique so the same JWT cannot be blacklisted twice; the
      // AuthMiddleware built in feature/auth looks up incoming tokens by
      // jti on every authenticated request.
      table.string('jti', 255).unique()
      table.timestamp('blacklisted_at').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('expires_at').nullable()
      table.timestamp('validated_at').nullable()
    })

    this.schema.createTable('password_reset_tokens', (table) => {
      table.bigIncrements('id')
      table
        .bigInteger('user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.string('token', 255).notNullable()
      table.string('type', 255).notNullable()
      table.timestamp('expiry_date').notNullable()
    })
  }

  async down() {
    this.schema.dropTable('password_reset_tokens')
    this.schema.dropTable('blacklisted_tokens')
    this.schema.dropTable('activation_tokens')
    this.schema.dropTable('role_permission')
    this.schema.dropTable('role_user')
    this.schema.dropTable('permissions')
    this.schema.dropTable('roles')
    this.schema.dropTable('users')
  }
}
