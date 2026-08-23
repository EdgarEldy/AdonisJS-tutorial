/**
 * Standard API response envelope used by every endpoint in this project.
 *
 * AdonisJS does not ship with a global response interceptor like NestJS's
 * TransformInterceptor. Instead, controllers call the `respond()` helper
 * directly and return the envelope to the client. This keeps the shaping
 * logic in one place and the contract explicit at every call site.
 *
 * @template T - The type of the payload carried in the `data` field.
 */
export interface ApiResponse<T> {
  /** Whether the request succeeded. Always true from respond(); false in the exception handler. */
  success: boolean
  /** Human-readable status message. */
  message: string
  /** Response payload. Absent on error responses. */
  data?: T
  /** Validation or business-rule error messages. Populated by the exception handler. */
  errors?: string[]
  /** ISO-8601 server timestamp, set at response construction time. */
  timestamp: string
  /** Request path, injected by the exception handler for error tracing. */
  path?: string
}

/**
 * Constructs a successful ApiResponse envelope.
 *
 * Controllers return the result of this function rather than building the
 * object themselves, which guarantees shape consistency across the entire
 * API surface.
 *
 * @param data - The payload to include in the response.
 * @param message - A short human-readable description. Defaults to 'OK'.
 * @returns A plain object matching ApiResponse<T> with success set to true.
 *
 * @example
 * // In a controller action
 * return response.ok(respond(category, 'Category retrieved'))
 */
export function respond<T>(data: T, message = 'OK') {
  return {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  }
}
