import { createError } from '@adonisjs/core/exceptions'
import type { Infer } from '@vinejs/vine/types'

import Product from '#models/product'
import Category from '#models/category'
import { toPageResponse, type PageResponse } from '#helpers/page_response'
import type {
  createProductSchema,
  updateProductSchema,
  productFilterSchema,
} from '#validators/product_validator'

type CreateProductPayload = Infer<typeof createProductSchema>
type UpdateProductPayload = Infer<typeof updateProductSchema>
type ProductFilter = Infer<typeof productFilterSchema>

const E_PRODUCT_IN_USE = createError(
  'Product still has orders associated with it',
  'E_PRODUCT_IN_USE',
  409
)

/**
 * Owns every read and write to the `products` table. No constructor
 * dependencies, so no @inject(), matching CategoriesService's own
 * reasoning for the same omission. Unlike CategoriesService.findAll, this
 * branch's README does not ask for caching on the products list, so
 * findAll below queries straight through to the database on every call.
 */
export default class ProductsService {
  /**
   * Builds a dynamic query per the README's own "Dynamic QueryBuilder with
   * optional filters" code sample: `where('category_id', ...)` and
   * `orderBy(filter.sortBy, ...)` are only chained on when the
   * corresponding filter field is present, and `category` is always
   * preloaded so the list response matches the detail response's shape.
   */
  async findAll(
    filter: ProductFilter,
    page: number,
    limit: number
  ): Promise<PageResponse<Product>> {
    const query = Product.query().preload('category')

    if (filter.categoryId) {
      query.where('category_id', filter.categoryId)
    }

    if (filter.sortBy) {
      query.orderBy(filter.sortBy, filter.order ?? 'asc')
    }

    const paginator = await query.paginate(page, limit)
    return toPageResponse(paginator)
  }

  async findOne(id: number): Promise<Product> {
    const product = await Product.findOrFail(id)
    await product.load('category')
    return product
  }

  /**
   * Checks the referenced category exists before writing the product row.
   * Without this, a bad categoryId would only surface as a raw Postgres FK
   * violation with no clean .status, the same class of bug the code review
   * on the previous branch caught for a different case, instead of the
   * clean 404 a client can actually act on.
   */
  async create(data: CreateProductPayload): Promise<Product> {
    await Category.findOrFail(data.categoryId)

    const product = await Product.create(data)
    await product.load('category')
    return product
  }

  async update(id: number, data: UpdateProductPayload): Promise<Product> {
    const product = await Product.findOrFail(id)

    if (data.categoryId !== undefined) {
      await Category.findOrFail(data.categoryId)
    }

    product.merge(data)
    await product.save()
    await product.load('category')
    return product
  }

  /**
   * Business rule from the README: a product linked to at least one order
   * cannot be deleted, 409 instead. Checked by querying the `orders`
   * relation for a single match, the same `related(...).query().first()`
   * idiom CategoriesService.remove uses for its own "still in use" guard
   * against `products`, made possible by the `orders` hasMany added to the
   * Product model for exactly this check. This also doubles as the guard
   * that keeps the orders table's own `product_id` FK (ON DELETE CASCADE)
   * from ever actually cascading away order history through this service.
   */
  async remove(id: number): Promise<void> {
    const product = await Product.findOrFail(id)

    const stillInUse = await product.related('orders').query().select('id').first()
    if (stillInUse) {
      throw new E_PRODUCT_IN_USE()
    }

    await product.delete()
  }
}
