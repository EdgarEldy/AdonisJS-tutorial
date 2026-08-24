import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import { respond } from '#helpers/api_response'
import AuthService from '#services/auth_service'
import {
  registerSchema,
  activateSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '#validators/auth_validator'

/**
 * Thin HTTP layer over AuthService: every action validates its input with
 * a compiled VineJS schema, delegates to the service, and wraps the
 * result with `respond()`. No business logic and no direct model access
 * live here, per the project's hard rules; AuthService owns all of that.
 */
@inject()
export default class AuthController {
  constructor(private authService: AuthService) {}

  async register({ request, response }: HttpContext) {
    const data = await request.validateUsing(registerSchema)
    const result = await this.authService.register(data)
    return response.created(respond(result, 'User registered, activation token issued'))
  }

  async activate({ request, response }: HttpContext) {
    const { token } = await request.validateUsing(activateSchema)
    const user = await this.authService.activate(token)
    return response.ok(respond(user, 'Account activated'))
  }

  async login({ request, response }: HttpContext) {
    const data = await request.validateUsing(loginSchema)
    const result = await this.authService.login(data)
    return response.ok(respond(result, 'Login successful'))
  }

  /**
   * `middleware.auth()` on this route has already authenticated the
   * request and rejected a blacklisted jti before this action ever runs,
   * so the guard's cached user, payload and token are read directly rather
   * than re-authenticating or re-parsing the Authorization header. Reading
   * `guard.token` instead of parsing the header a second time keeps token
   * extraction defined in exactly one place, JwtGuard.authenticate(), so
   * this controller cannot drift out of sync with what the guard itself
   * considers a valid bearer token.
   */
  async logout({ auth, response }: HttpContext) {
    const guard = auth.use('jwt')
    const user = guard.getUserOrFail()
    const payload = guard.payload!
    const rawToken = guard.token!

    await this.authService.logout(user, payload, rawToken)
    return response.ok(respond(null, 'Logged out successfully'))
  }

  async refresh({ auth, response }: HttpContext) {
    const user = auth.use('jwt').getUserOrFail()
    const token = await this.authService.refresh(user)
    return response.ok(respond({ token }, 'Token refreshed'))
  }

  async forgotPassword({ request, response }: HttpContext) {
    const { email } = await request.validateUsing(forgotPasswordSchema)
    const token = await this.authService.forgotPassword(email)
    return response.ok(respond({ token }, 'Password reset token issued'))
  }

  async resetPassword({ request, response }: HttpContext) {
    const data = await request.validateUsing(resetPasswordSchema)
    const user = await this.authService.resetPassword(data)
    return response.ok(respond(user, 'Password reset successful'))
  }

  async me({ auth, response }: HttpContext) {
    const user = auth.use('jwt').getUserOrFail()
    const result = await this.authService.me(user)
    return response.ok(respond(result, 'Current user profile'))
  }
}
