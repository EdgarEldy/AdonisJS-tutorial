import { createError } from '@adonisjs/core/exceptions'
import type { Infer } from '@vinejs/vine/types'

import cache from '@adonisjs/cache/services/main'
import Category from '#models/category'
import { toPageResponse, type PageResponse } from '#helpers/page_response'
import type { createCategorySchema, updateCategorySchema } from '#validators/category_validator'

type CreateCategoryPayload = Infer<typeof createCategorySchema>
type UpdateCategoryPayload = Infer<typeof updateCategorySchema>

const E_CATEGORY_IN_USE = createError(
  'Category still has products associated with it',
  'E_CATEGORY_IN_USE',
  409
)

// NOTE: cache key/invalidation strategy. The README asks specifically for
// the categories list to be cached but leaves the exact key shape and
// invalidation approach to this branch's own judgment. Every findAll(page,
// limit) call is cached under its own key inside a dedicated 'categories'
// namespace (via cache.namespace()), the pattern bentocache's own README
// documents for "invalidate everything at once later". Keying by page and
// limit keeps different pages/page-sizes from colliding with (or serving)
// each other's results, and create/update/remove all clear the whole
// namespace rather than trying to compute which page(s) a given write
// affects, since a create or delete shifts every later page's contents
// anyway. A short 5 minute TTL is kept as a backstop in case a write path
// is ever added that forgets to clear the namespace.
const CATEGORIES_LIST_NAMESPACE = 'categories'
const CATEGORIES_LIST_TTL = '5m'

function categoriesListCache() {
  return cache.namespace(CATEGORIES_LIST_NAMESPACE)
}

/**
 * Owns every read and write to the `categories` table. No constructor
 * dependencies, so no @inject(), matching RolesService and
 * PermissionsService's own reasoning for the same omission.
 */
export default class CategoriesService {
  async findAll(page: number, limit: number): Promise<PageResponse<Category>> {
    return categoriesListCache().getOrSet({
      key: `list:page:${page}:limit:${limit}`,
      ttl: CATEGORIES_LIST_TTL,
      factory: async () => {
        const paginator = await Category.query().paginate(page, limit)
        return toPageResponse(paginator)
      },
    })
  }

  async findOne(id: number): Promise<Category> {
    return Category.findOrFail(id)
  }

  async create(data: CreateCategoryPayload): Promise<Category> {
    const category = await Category.create(data)
    await categoriesListCache().clear()
    return category
  }

  async update(id: number, data: UpdateCategoryPayload): Promise<Category> {
    const category = await Category.findOrFail(id)
    category.merge(data)
    await category.save()
    await categoriesListCache().clear()
    return category
  }

  /**
   * Business rule from the README: a category with at least one product
   * still associated with it cannot be deleted, 409 instead. Checked by
   * querying the `products` relation for a single match rather than
   * counting every row, the same `related(...).query().first()` idiom
   * RolesService.remove uses for its own "still assigned" guard, since the
   * only thing that matters here is "does at least one exist". This also
   * doubles as the guard that keeps the products table's own
   * `category_id` FK (declared ON DELETE CASCADE in the migration) from
   * ever actually cascading through this service: the delete below is
   * only reached once no product references the category anymore.
   */
  async remove(id: number): Promise<void> {
    const category = await Category.findOrFail(id)

    const stillInUse = await category.related('products').query().first()
    if (stillInUse) {
      throw new E_CATEGORY_IN_USE()
    }

    await category.delete()
    await categoriesListCache().clear()
  }
}
