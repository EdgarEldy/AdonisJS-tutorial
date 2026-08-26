/**
 * Small, generic test utilities shared across spec files, split out after
 * `body()` was copy-pasted independently into roles.spec.ts,
 * permissions.spec.ts and categories.spec.ts, and `uniqueName()` was
 * copy-pasted into categories_service.spec.ts and categories.spec.ts.
 */

/**
 * `response.body()` on a literal-path match (POST and GET both resolving to
 * the same collection route, e.g. /api/v1/categories) is typed against the
 * union of every action registered on that route, so TypeScript cannot
 * narrow `.data` to the specific shape a given call actually returns. This
 * casts to `any` at the one place every such access goes through.
 */
export function body(response: { body(): unknown }): any {
  return response.body()
}

/** A unique, human-readable name for test fixtures that need to avoid colliding with seeded or other tests' data. */
export function uniqueName(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`
}
