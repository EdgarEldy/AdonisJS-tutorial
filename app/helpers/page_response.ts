import type { LucidRow, ModelPaginatorContract } from '@adonisjs/lucid/types/model'

/**
 * Typed pagination envelope for all list endpoints.
 *
 * Lucid's `paginate()` method returns a ModelPaginatorContract whose
 * serialized shape is an internal framework detail. Exposing it directly
 * would couple consumers to implementation specifics that can change across
 * ORM versions.
 *
 * Services map the paginator output to this stable interface, via
 * `toPageResponse()` below, before returning it, so controllers and API
 * clients depend only on this contract.
 *
 * @template T - The type of each item in the paginated collection.
 */
export interface PageResponse<T> {
  /** The records on the current page. */
  items: T[]
  /** Total number of records across all pages. */
  total: number
  /** Current page number (1-based). */
  page: number
  /** Maximum number of items per page. */
  limit: number
  /** Total number of pages: Math.ceil(total / limit). */
  totalPages: number
  /** True when there is a page after the current one. */
  hasNext: boolean
  /** True when the current page is greater than 1. */
  hasPrevious: boolean
}

/**
 * Maps a Lucid ModelPaginatorContract onto PageResponse<T>. This was
 * originally copy-pasted identically into UsersService, RolesService and
 * PermissionsService; factored into the one place PageResponse itself is
 * defined so every list endpoint, including the categories/products/
 * customers/orders services added by later branches, shares a single
 * implementation instead of a growing set of hand-synced copies.
 *
 * @example
 * // In a service method
 * const paginator = await Category.query().paginate(page, limit)
 * return toPageResponse(paginator)
 */
export function toPageResponse<T extends LucidRow>(
  paginator: ModelPaginatorContract<T>
): PageResponse<T> {
  return {
    items: paginator.all(),
    total: paginator.total,
    page: paginator.currentPage,
    limit: paginator.perPage,
    totalPages: paginator.lastPage,
    hasNext: paginator.hasMorePages,
    hasPrevious: paginator.currentPage > 1,
  }
}
