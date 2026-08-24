import type { HttpContext } from '@adonisjs/core/http'
import { errors, symbols } from '@adonisjs/auth'
import type { AuthClientResponse, GuardContract } from '@adonisjs/auth/types'
import { SignJWT, jwtVerify } from 'jose'
import env from '#start/env'
import User from '#models/user'

/**
 * The installed @adonisjs/auth version ships session, basic auth and access
 * tokens guards only, no JWT guard. This is a minimal custom guard following
 * the package's own GuardContract, backed by jose for signing and
 * verification, so the rest of the app can call `ctx.auth.use('jwt')` the
 * same way it would call any built in guard.
 *
 * The guard's only job is to prove the token is validly signed, not expired,
 * and resolve to a real User. It deliberately does not check the jti
 * blacklist or the user's enabled/accountLocked flags, those are
 * AuthMiddleware's job, layered on top of authenticate() rather than baked
 * into the guard, so a route that only needs "is this a valid token" without
 * the blacklist round trip can use the guard directly.
 */
export type JwtPayload = {
  sub: string
  jti: string
  iat: number
  exp: number
}

function secretKey() {
  return new TextEncoder().encode(env.get('JWT_SECRET'))
}

/**
 * JWT_EXPIRY is documented as either a bare number of seconds ("3600") or a
 * jose style time span ("7d", "24h"). jose's own string parser requires a
 * unit suffix, so a purely numeric string is converted to a number first.
 */
function expiresIn(): number | string {
  const value = env.get('JWT_EXPIRY')
  return /^\d+$/.test(value) ? Number(value) : value
}

export async function signJwt(user: User): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(user.id))
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime(expiresIn())
    .sign(secretKey())
}

export class JwtGuard implements GuardContract<User> {
  #ctx: HttpContext

  readonly driverName = 'jwt' as const
  user?: User
  payload?: JwtPayload
  isAuthenticated = false
  authenticationAttempted = false;

  [symbols.GUARD_KNOWN_EVENTS]: unknown

  constructor(ctx: HttpContext) {
    this.#ctx = ctx
  }

  getUserOrFail(): User {
    if (!this.user) {
      throw new errors.E_UNAUTHORIZED_ACCESS('Unauthorized access', {
        guardDriverName: this.driverName,
      })
    }
    return this.user
  }

  async authenticate(): Promise<User> {
    if (this.authenticationAttempted) {
      return this.getUserOrFail()
    }
    this.authenticationAttempted = true

    const authHeader = this.#ctx.request.header('authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null
    if (!token) {
      throw new errors.E_UNAUTHORIZED_ACCESS('No JWT token provided', {
        guardDriverName: this.driverName,
      })
    }

    let payload: JwtPayload
    try {
      const result = await jwtVerify<JwtPayload>(token, secretKey())
      payload = result.payload
    } catch {
      throw new errors.E_UNAUTHORIZED_ACCESS('Invalid or expired JWT token', {
        guardDriverName: this.driverName,
      })
    }

    const user = await User.find(Number(payload.sub))
    if (!user) {
      throw new errors.E_UNAUTHORIZED_ACCESS('Unauthorized access', {
        guardDriverName: this.driverName,
      })
    }

    this.payload = payload
    this.user = user
    this.isAuthenticated = true
    return user
  }

  async check(): Promise<boolean> {
    try {
      await this.authenticate()
      return true
    } catch {
      return false
    }
  }

  async authenticateAsClient(user: User): Promise<AuthClientResponse> {
    const token = await signJwt(user)
    return { headers: { authorization: `Bearer ${token}` } }
  }
}

export function jwtGuard() {
  return (ctx: HttpContext) => new JwtGuard(ctx)
}
