import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Creates the catalog and sales tables: categories, products, customers,
 * orders. Table creation order follows the FK dependency chain from the
 * README's Data Model diagram (categories -> products, customers and
 * products -> orders), so every `references().inTable()` call points at a
 * table that already exists by the time it runs.
 *
 * `down()` drops the same tables in the reverse order, child tables first,
 * so PostgreSQL never rejects a drop because a foreign key still points at
 * the table being removed.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('categories', (table) => {
      table.bigIncrements('id')
      table.string('category_name', 255).notNullable()
    })

    this.schema.createTable('products', (table) => {
      table.bigIncrements('id')
      table
        .bigInteger('category_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('categories')
        .onDelete('CASCADE')
      table.string('product_name', 255).notNullable()
      table.float('unit_price').notNullable()
      table.check('unit_price > 0', [], 'products_unit_price_positive')
    })

    this.schema.createTable('customers', (table) => {
      table.bigIncrements('id')
      table.string('first_name', 255).notNullable()
      table.string('last_name', 255).notNullable()
      table.string('telephone', 50).notNullable()
      table.string('email', 255).notNullable().unique()
      table.string('address', 255).notNullable()
    })

    this.schema.createTable('orders', (table) => {
      table.bigIncrements('id')
      table
        .bigInteger('customer_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('customers')
        .onDelete('CASCADE')
      table
        .bigInteger('product_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('products')
        .onDelete('CASCADE')
      table.integer('quantity').notNullable()
      table.check('quantity > 0', [], 'orders_quantity_positive')
      // NOTE: the README documents `total` as "computed = quantity x
      // unit_price". That computation happens in the orders service
      // (feature/orders), not as a generated/stored column here, because
      // the price used at order time must be the product's unit_price at
      // that moment, not a value PostgreSQL would recompute if unit_price
      // changes later. The column simply stores whatever the service wrote.
      table.float('total').notNullable()
    })
  }

  async down() {
    this.schema.dropTable('orders')
    this.schema.dropTable('customers')
    this.schema.dropTable('products')
    this.schema.dropTable('categories')
  }
}
