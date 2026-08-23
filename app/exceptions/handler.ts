/**
 * Global HTTP exception handler.
 *
 * In AdonisJS, every unhandled exception bubbles up to this class before a
 * response is sent. Overriding `handle()` lets us guarantee that every error
 * response — regardless of where it originated — uses the same ApiResponse
 * envelope shape with `success: false`.
 *
 * This is equivalent to NestJS's GlobalExceptionFilter applied via
 * `app.useGlobalFilters()`, but it is registered automatically via
 * `server.errorHandler(() => import('#exceptions/handler'))` in
 * `start/kernel.ts`.
 */
import app from '@adonisjs/core/services/app'
import { type HttpContext, ExceptionHandler, errors } from '@adonisjs/core/http'

export default class HttpExceptionHandler extends ExceptionHandler {
  /**
   * Enables full stack traces in error responses during development.
   * In production, only the message is exposed.
   */
  protected debug = !app.inProduction

  /**
   * Converts any thrown exception into a structured ApiResponse error payload.
   *
   * Three cases are handled in priority order:
   *
   * 1. `E_VALIDATION_ERROR` — thrown by `request.validateUsing()` when a
   *    VineJS schema fails. Returns 422 with an `errors` array containing
   *    each field-level message. Without this check, VineJS errors would
   *    fall through to the generic handler and lose their structured messages.
   *
   * 2. HTTP exceptions — AdonisJS built-in exceptions (E_ROUTE_NOT_FOUND,
   *    E_UNAUTHORIZED, etc.) carry a numeric `status` property. We reuse
   *    that status code directly so callers receive the semantically correct
   *    HTTP status.
   *
   * 3. Unknown errors — anything that reaches this branch is an unexpected
   *    server fault. The message is hidden in production to avoid leaking
   *    internal details.
   */
  async handle(error: unknown, ctx: HttpContext) {
    const { response, request } = ctx

    // VineJS validation errors — preserve structured field messages
    if (error instanceof errors.E_VALIDATION_ERROR) {
      return response.status(422).json({
        success: false,
        message: 'Validation failed',
        errors: error.messages,
        timestamp: new Date().toISOString(),
        path: request.url(),
      })
    }

    // AdonisJS HTTP exceptions carry a numeric status code
    const httpError = error as { status?: number; message?: string }
    if (httpError?.status && typeof httpError.status === 'number') {
      return response.status(httpError.status).json({
        success: false,
        message: httpError.message ?? 'An error occurred',
        timestamp: new Date().toISOString(),
        path: request.url(),
      })
    }

    // Unexpected server errors — mask details in production
    return response.status(500).json({
      success: false,
      message: app.inProduction ? 'Internal server error' : String(error),
      timestamp: new Date().toISOString(),
      path: request.url(),
    })
  }

  /**
   * Delegates to the parent reporter which logs the error via Pino.
   * Extend this method to forward errors to an external monitoring service.
   */
  async report(error: unknown, ctx: HttpContext) {
    return super.report(error, ctx)
  }
}
