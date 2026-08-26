# AdonisJS Tutorial - `adonisjs_tutorial`

A complete, hands-on walkthrough of building a production-ready REST API with **AdonisJS 7.x** (Node.js 24 LTS, TypeScript 5), organized into Git branches that progressively cover the key concepts of the AdonisJS ecosystem.

The data model follows: `categories` -> `products` -> `customers` -> `orders`, secured by a full JWT authentication system based on the EER_AUTH diagram.

This document is the **complete specification** of the project. It is meant to be followed step by step, branch by branch.

---

## Table of Contents

- [AdonisJS vs NestJS - Quick Reference](#adonisjs-vs-nestjs-quick-reference)
- [AdonisJS Glossary](#adonisjs-glossary)
- [Tech Stack](#tech-stack)
- [Data Model](#data-model)
- [Auth Model (EER_AUTH)](#auth-model-eer_auth)
- [Branching Strategy](#branching-strategy)
- [Project Structure](#project-structure)
- [Standard Response Format](#standard-response-format)
- [Environment Variables Reference](#environment-variables-reference)
- [Git Commit Convention](#git-commit-convention)
- [feature/core-architecture](#featurecore-architecture)
- [feature/data-modeling](#featuredata-modeling)
- [feature/auth](#featureauth)
- [feature/categories](#featurecategories)
- [feature/products](#featureproducts)
- [feature/customers](#featurecustomers)
- [feature/orders](#featureorders)
- [Order of Work](#order-of-work)
- [Code Conventions](#code-conventions)
- [Concepts Covered](#concepts-covered)
- [How to Follow This Tutorial](#how-to-follow-this-tutorial)
- [Troubleshooting](#troubleshooting)

---

## AdonisJS vs NestJS - Quick Reference

If you are coming from a NestJS background, this table maps the concepts you already know to their AdonisJS equivalents.

| NestJS concept | AdonisJS equivalent | Notes |
|---|---|---|
| `@Module()` | No module system | AdonisJS uses a flat IoC container; all services are registered globally |
| `@Injectable()` / DI | `@inject()` decorator | Constructor injection via the IoC container |
| TypeORM `@Entity()` | Lucid `BaseModel` | ActiveRecord pattern instead of DataMapper |
| TypeORM `Repository<T>` | Model + QueryBuilder | No repository class needed; query directly on the model |
| `@Column()` | `@column()` | Lucid maps `snake_case` DB columns to `camelCase` properties automatically |
| `synchronize: true` | Never available | Lucid only supports explicit migrations |
| `class-validator` DTO | VineJS validator | Schemas defined in `app/validators/`; no decorator-based classes |
| `ValidationPipe` | Built-in via VineJS | `request.validateUsing(schema)` in the controller |
| `@nestjs/passport` guard | `@adonisjs/auth` guard | JWT guard configured in `config/auth.ts` |
| `@UseGuards(RolesGuard)` | Named middleware `role()` | Applied per-route in `start/routes.ts` |
| `@Roles()` decorator | `middleware.role('ADMIN')` | Passed as a route-level middleware argument |
| `AuthGuard('jwt')` | `middleware.auth()` | Named middleware registered in `start/kernel.ts` |
| `GlobalExceptionFilter` | `app/exceptions/handler.ts` | Same concept, different file location |
| `TransformInterceptor` | `respond()` helper | A plain function wrapping the response object |
| `EventEmitter2` | `@adonisjs/emitter` | Listeners registered in `adonisrc.ts` via `preloads` |
| `@nestjs/cache-manager` | `@adonisjs/cache` | Same cache-aside pattern |
| `jest.config.js` | `tests/bootstrap.ts` | Japa is the built-in test runner |
| Supertest | `@japa/api-client` | Integrated with the app lifecycle |
| `nest-cli.json` | `adonisrc.ts` | Central app config: providers, preloads, aliases |

---

## AdonisJS Glossary

Key terms you will encounter throughout this tutorial.

**`adonisrc.ts`** - The central application manifest. Declares providers, preloads (files loaded at boot), command aliases, and test suite configuration. Equivalent to `app.module.ts` in terms of "what gets loaded at startup", but declarative rather than class-based.

**Ace CLI** - The AdonisJS command-line tool (`node ace`). Used to run migrations (`node ace migration:run`), generate files (`node ace make:controller`), run tests (`node ace test`), and start the server (`node ace serve`).

**Provider** - A class that runs code during the application boot lifecycle (`register`, `boot`, `start`, `ready`, `shutdown`). Used to bind services into the IoC container or set up third-party libraries. Declared in `adonisrc.ts`.

**Preload** - A file that is imported and executed automatically at application startup, before the HTTP server starts. `start/routes.ts`, `start/kernel.ts`, and `start/env.ts` are all preloads. Listener registrations also live in a preload.

**IoC Container** - AdonisJS's built-in dependency injection container. Resolves constructor dependencies automatically when `@inject()` is applied to a class. No need to declare providers in a module - any class decorated with `@inject()` is resolvable.

**`start/env.ts`** - The single source of truth for environment variables. Variables are declared and validated here using VineJS at startup. Always import `env` from this file - never use `process.env` directly.

**`start/kernel.ts`** - Where global and named middleware are registered. Named middleware (e.g. `auth`, `role`) are referenced by name in route definitions. Think of it as the equivalent of `app.use()` and the NestJS `APP_GUARD` pattern combined.

**`start/routes.ts`** - Where all route definitions live. Routes reference controllers, middleware, and route groups. There is one routes file for the whole application (split by convention with `router.group()` or by importing sub-route files).

**Lucid** - The AdonisJS ORM. Uses the ActiveRecord pattern: models have both data properties and query methods (`Category.all()`, `Category.find(id)`, `category.save()`). Relations are declared as decorated methods.

**VineJS** - AdonisJS's validation library. Schemas are plain objects (not decorated classes). `request.validateUsing(schema)` both validates and returns a fully typed object.

**Bouncer** - AdonisJS's authorization library (`@adonisjs/bouncer`). Defines policies as classes with methods named after actions (`view`, `create`, `update`, `delete`). More expressive than role middleware alone.

**Japa** - AdonisJS's built-in test runner. Tests are structured with `test.group()`, lifecycle hooks (`group.setup`, `group.teardown`, `group.each.setup`), and assertions via `@japa/assert`. `@japa/api-client` provides HTTP test helpers against the running app.

---

## Tech Stack

| Component | Choice |
|---|---|
| Framework | AdonisJS 7.x |
| Language | TypeScript 5.x |
| Runtime | Node.js 24 LTS |
| Build | `@adonisjs/core` + `ace` CLI |
| Database | PostgreSQL 16 (via Docker Compose) |
| Migrations | Lucid migrations (never `sync`) |
| ORM | Lucid ORM (built-in AdonisJS) |
| Validation | VineJS (built-in AdonisJS 7) |
| API documentation | `adonis-autoswagger` |
| Config management | AdonisJS `env` + `config/` factories with VineJS validation |
| Security | `@adonisjs/auth` + JWT guard |
| Password hashing | `@adonisjs/core` `hash` service (Argon2 / bcrypt) |
| Rate limiting | `@adonisjs/limiter` (on auth routes) |
| Logging | AdonisJS built-in `logger` (Pino) |
| Caching | `@adonisjs/cache` |
| Tests | Japa + `@japa/api-client` + `@japa/assert` |
| CI/CD | GitHub Actions |
| Containerization | Docker, docker-compose |
| Linting | ESLint + Prettier |
| Hooks | Husky + lint-staged |

---

## Data Model

```
categories (id, category_name)
    | 1
    |
    | N
products (id, category_id, product_name, unit_price)
    | 1
    |
    | N
orders (id, customer_id, product_id, quantity, total)
    | N
    |
    | 1
customers (id, first_name, last_name, telephone, email, address)
```

### Column Details

**categories**
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT | PK, auto-increment |
| category_name | VARCHAR(255) | NOT NULL |

**products**
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT | PK, auto-increment |
| category_id | BIGINT | FK -> categories.id, NOT NULL |
| product_name | VARCHAR(255) | NOT NULL |
| unit_price | FLOAT | NOT NULL, > 0 |

**customers**
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT | PK, auto-increment |
| first_name | VARCHAR(255) | NOT NULL |
| last_name | VARCHAR(255) | NOT NULL |
| telephone | VARCHAR(50) | NOT NULL |
| email | VARCHAR(255) | NOT NULL, UNIQUE |
| address | VARCHAR(255) | NOT NULL |

**orders**
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT | PK, auto-increment |
| customer_id | BIGINT | FK -> customers.id, NOT NULL |
| product_id | BIGINT | FK -> products.id, NOT NULL |
| quantity | INT | NOT NULL, > 0 |
| total | FLOAT | NOT NULL, computed = quantity x unit_price |

---

## Auth Model (EER_AUTH)

Based on the `EER_AUTH` diagram, the authentication and authorization system uses the following tables:

**users**
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT | PK |
| first_name | VARCHAR(50) | NOT NULL |
| last_name | VARCHAR(100) | NOT NULL |
| email | VARCHAR(100) | NOT NULL, UNIQUE |
| password | VARCHAR(255) | |
| enabled | BOOLEAN | NOT NULL |
| account_locked | BOOLEAN | NOT NULL |

**roles**
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT | PK |
| role_name | VARCHAR(50) | NOT NULL, UNIQUE |

**permissions**
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT | PK |
| resource | VARCHAR(50) | NOT NULL |
| action | VARCHAR(50) | NOT NULL |

**role_user** (pivot table)
| Column | Type | Constraints |
|---|---|---|
| user_id | BIGINT | FK -> users.id, NOT NULL |
| role_id | BIGINT | FK -> roles.id, NOT NULL |

**role_permission** (pivot table)
| Column | Type | Constraints |
|---|---|---|
| role_id | BIGINT | FK -> roles.id, NOT NULL |
| permission_id | BIGINT | FK -> permissions.id, NOT NULL |

**activation_tokens**
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT | PK |
| user_id | BIGINT | FK -> users.id |
| token | VARCHAR(255) | |
| created_at | DATETIME | NOT NULL |
| expires_at | DATETIME | |
| validated_at | DATETIME | |

**blacklisted_tokens**
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT | PK |
| user_id | BIGINT | FK |
| token | VARCHAR(768) | NOT NULL |
| jti | VARCHAR(255) | UNIQUE |
| blacklisted_at | DATETIME | |
| created_at | DATETIME | NOT NULL |
| expires_at | DATETIME | |
| validated_at | DATETIME | |

**password_reset_tokens**
| Column | Type | Constraints |
|---|---|---|
| id | BIGINT | PK |
| user_id | BIGINT | FK -> users.id |
| token | VARCHAR(255) | NOT NULL |
| type | VARCHAR(255) | NOT NULL |
| expiry_date | DATETIME | NOT NULL |

### Authorization Rules

| Resource | GET | POST / PUT / DELETE |
|---|---|---|
| `categories`, `products` | Public | `ADMIN` role only |
| `customers`, `orders` | Authenticated | `ADMIN` role only |
| `auth/*` | Public | - |

---

## Branching Strategy

| Branch | Role |
|---|---|
| `master` | Stable, production-ready. No direct commits - only merges from `develop`. |
| `develop` | Integration branch. All `feature/*` branches merge here via PR before going to `master`. |
| `feature/core-architecture` | Project scaffold, global config, Docker, CI/CD pipeline, Husky hooks. |
| `feature/data-modeling` | All Lucid models, migrations, seeds, and database connection. |
| `feature/auth` | Full auth: JWT, roles, permissions, token blacklist, activation, password reset. |
| `feature/categories` | Category CRUD - secured from day one with `AuthMiddleware` + `RoleMiddleware`. |
| `feature/products` | Product CRUD, linked to categories - secured from day one. |
| `feature/customers` | Customer CRUD - secured from day one. |
| `feature/orders` | Order CRUD, business logic (total computation, events) - secured from day one. |

Each feature branch ends with a Pull Request to `develop`. Each PR must include atomic commits (one per file), a completed task list, and passing unit + functional tests.

---

## Project Structure

> **Convention:** test files mirror the `app/` structure under `tests/unit/`. Functional (E2E) tests live in `tests/functional/`.

```
adonisjs_tutorial/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                              # GitHub Actions CI pipeline
│   │   └── pr-checks.yml                       # Lint, test, build on PRs
│   └── PULL_REQUEST_TEMPLATE.md
├── .husky/
│   ├── pre-commit                               # lint-staged
│   ├── commit-msg                               # commitlint
│   └── pre-push                                 # node ace test
├── docker/
│   └── postgres/
│       └── init.sql
├── docker-compose.yml
├── docker-compose.test.yml
├── tests/
│   ├── bootstrap.ts                             # Japa bootstrap (app lifecycle)
│   ├── helpers/
│   │   └── auth_helper.ts                       # Shared login/token helpers for functional tests
│   ├── functional/                              # API-level tests (real DB)
│   │   ├── health.spec.ts
│   │   ├── categories.spec.ts
│   │   ├── products.spec.ts
│   │   ├── customers.spec.ts
│   │   ├── orders.spec.ts
│   │   └── auth.spec.ts
│   └── unit/                                    # Unit tests (mocked dependencies)
│       ├── services/
│       │   ├── categories_service.spec.ts
│       │   ├── products_service.spec.ts
│       │   ├── customers_service.spec.ts
│       │   ├── orders_service.spec.ts
│       │   └── auth_service.spec.ts
│       └── validators/
│           ├── create_category_validator.spec.ts
│           └── create_product_validator.spec.ts
├── .env.example                                 # Documented variable reference (see below)
├── .env.development
├── .env.test
├── commitlint.config.js
├── .eslintrc.js
├── .prettierrc
├── adonisrc.ts                                  # AdonisJS app config: providers, preloads, aliases
├── ace.js                                       # Ace CLI entry point
├── tsconfig.json
├── package.json
└── app/
    ├── controllers/
    │   ├── health_controller.ts
    │   ├── categories_controller.ts
    │   ├── products_controller.ts
    │   ├── customers_controller.ts
    │   ├── orders_controller.ts
    │   └── auth_controller.ts
    ├── models/                                  # Lucid ORM models
    │   ├── category.ts
    │   ├── product.ts
    │   ├── customer.ts
    │   ├── order.ts
    │   ├── user.ts
    │   ├── role.ts
    │   ├── permission.ts
    │   ├── activation_token.ts
    │   ├── blacklisted_token.ts
    │   └── password_reset_token.ts
    ├── services/
    │   ├── categories_service.ts
    │   ├── products_service.ts
    │   ├── customers_service.ts
    │   ├── orders_service.ts
    │   └── auth_service.ts
    ├── validators/                              # VineJS validators (replaces DTOs)
    │   ├── pagination_validator.ts
    │   ├── category_validator.ts
    │   ├── product_validator.ts
    │   ├── customer_validator.ts
    │   ├── order_validator.ts
    │   └── auth_validator.ts
    ├── middleware/
    │   ├── auth_middleware.ts                   # JWT auth check
    │   ├── role_middleware.ts                   # RBAC role enforcement
    │   ├── silent_auth_middleware.ts
    │   └── response_time_middleware.ts
    ├── policies/                                # Bouncer authorization policies
    │   ├── category_policy.ts
    │   ├── product_policy.ts
    │   ├── customer_policy.ts
    │   └── order_policy.ts
    ├── helpers/
    │   ├── api_response.ts                      # ApiResponse<T> interface + respond() helper
    │   └── page_response.ts                     # PageResponse<T> interface
    ├── exceptions/
    │   └── handler.ts                           # Global exception handler
    └── events/
        ├── order_created.ts                     # Event definition
        └── listeners/
            └── send_order_notification.ts       # Event listener
├── config/
│   ├── app.ts
│   ├── auth.ts                                  # JWT guard config
│   ├── database.ts
│   ├── hash.ts
│   ├── limiter.ts                               # Rate limiting config
│   ├── logger.ts
│   └── cache.ts
├── database/
│   ├── migrations/
│   │   ├── 1700000001_create_core_schema.ts
│   │   └── 1700000002_create_auth_schema.ts
│   └── seeders/
│       ├── main_seeder.ts
│       ├── category_seeder.ts
│       ├── product_seeder.ts
│       ├── customer_seeder.ts
│       └── user_seeder.ts
├── start/
│   ├── kernel.ts                                # Global + named middleware registration
│   ├── routes.ts                                # Route definitions
│   ├── events.ts                                # Event -> listener bindings (preload)
│   └── env.ts                                   # Env validation with VineJS
└── providers/
    └── app_provider.ts
```

### Structure rationale

| Convention | Source |
|---|---|
| `app/controllers/` for all controllers | AdonisJS 7 default scaffold |
| `app/models/` for Lucid models | AdonisJS / Lucid documentation |
| `app/validators/` for VineJS schemas | AdonisJS 7 official convention |
| `app/policies/` for Bouncer authorization | `@adonisjs/bouncer` documentation |
| `app/middleware/` for HTTP middleware | AdonisJS 7 official convention |
| `app/events/` + `listeners/` | AdonisJS `emitter` package convention |
| `start/events.ts` as a dedicated preload | AdonisJS emitter documentation (not `kernel.ts`) |
| `config/` for typed config factories | AdonisJS 7 official convention |
| `database/migrations/` and `seeders/` | Lucid ORM documentation |
| `start/routes.ts` for route definitions | AdonisJS 7 official convention |
| `start/env.ts` for env validation | AdonisJS 7 official convention |
| `tests/functional/` for API-level tests | Japa + `@japa/api-client` convention |
| `tests/unit/` for unit tests | Japa convention |
| `tests/helpers/auth_helper.ts` | Shared test utilities to avoid duplication across specs |

### Japa configuration

AdonisJS 7 uses **Japa** as its built-in test runner, configured in `tests/bootstrap.ts`:

```typescript
// tests/bootstrap.ts
import { configure, processCLIArgs, run } from '@japa/runner'
import { assert } from '@japa/assert'
import { apiClient } from '@japa/api-client'

processCLIArgs(process.argv.slice(2))

configure({
  files: ['tests/**/*.spec.ts'],
  plugins: [assert(), apiClient('http://localhost:3333')],
})

run()
```

Typical functional test structure using `group.setup` / `group.teardown`:

```typescript
// tests/functional/categories.spec.ts
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'

test.group('Categories - CRUD', (group) => {
  // Runs once before all tests in this group
  group.setup(async () => {
    await db.beginGlobalTransaction()
  })

  // Runs once after all tests - rolls back to keep DB clean
  group.teardown(async () => {
    await db.rollbackGlobalTransaction()
  })

  test('GET /api/v1/categories returns paginated list', async ({ client }) => {
    const response = await client.get('/api/v1/categories')
    response.assertStatus(200)
    response.assertBodyContains({ success: true })
  })
})
```

Run tests with:
```bash
node ace test                                              # all tests
node ace test --files="tests/functional/categories.spec.ts"
node ace test unit                                         # unit tests only
node ace test functional                                   # functional tests only
```

---

## Standard Response Format

Every endpoint - success or error - returns a consistent `ApiResponse<T>` envelope:

```typescript
// app/helpers/api_response.ts
export interface ApiResponse<T> {
  success: boolean
  message: string
  data?: T
  errors?: string[]
  timestamp: string
  path?: string
}

export function respond<T>(data: T, message = 'OK', statusCode = 200) {
  return {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  }
}
```

Paginated list endpoints wrap their data in `PageResponse<T>`, which maps directly from Lucid's `ModelPaginatorContract`:

```typescript
// app/helpers/page_response.ts
export interface PageResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
  totalPages: number
  hasNext: boolean
  hasPrevious: boolean
}
```

The global exception handler in `app/exceptions/handler.ts` wraps every thrown exception in the same `ApiResponse` shape with `success: false`.

---

## Environment Variables Reference

The `.env.example` file is the documented contract for all environment variables. Every variable must be present and validated in `start/env.ts` before the server starts.

```dotenv
# ── Application ──────────────────────────────────────────
HOST=0.0.0.0              # Server bind address
PORT=3333                 # Server port
APP_KEY=                  # 32-char random key used for encryption (generate with: node ace generate:key)
NODE_ENV=development      # development | production | test

# ── Database ─────────────────────────────────────────────
DB_HOST=127.0.0.1         # PostgreSQL host
DB_PORT=5432              # PostgreSQL port
DB_USER=postgres          # PostgreSQL user
DB_PASSWORD=              # PostgreSQL password
DB_DATABASE=adonisjs_tutorial  # Database name (use adonisjs_tutorial_test for .env.test)

# ── Authentication ────────────────────────────────────────
JWT_SECRET=               # Secret used to sign JWT tokens (min 32 chars)
JWT_EXPIRY=7d             # Token lifespan (e.g. 7d, 24h, 3600)

# ── Hashing ───────────────────────────────────────────────
HASH_DRIVER=argon         # argon | bcrypt

# ── Rate limiting ─────────────────────────────────────────
LIMITER_STORE=database    # database | redis
THROTTLE_AUTH_MAX=10      # Max auth attempts per window
THROTTLE_AUTH_WINDOW=60   # Window in seconds
```

---

## Git Commit Convention

All commits follow **Conventional Commits** enforced by `commitlint` + Husky.

### Format

```
<type>(<scope>): <short summary>

<body - what was done and why, one sentence per file touched>

<footer - refs, breaking changes>
```

### Types

| Type | When to use |
|---|---|
| `feat` | New feature or file |
| `fix` | Bug fix |
| `refactor` | Code change that is neither a bug fix nor a feature |
| `test` | Adding or updating tests |
| `docs` | Documentation only |
| `chore` | Tooling, config, CI, deps |
| `style` | Formatting, linting (no logic change) |
| `perf` | Performance improvement |

### Atomic Commit Rule

> **One commit per file added or modified.** Never group unrelated files in a single commit.

**Good:**
```
feat(categories): add Category Lucid model

- Defines the Category Lucid model with id and category_name columns.
- Declares hasMany relation to Product.
- Uses @column() for snake_case to camelCase mapping.
```

**Bad:**
```
feat: add categories module with model, validator, service and controller
```

---

## feature/core-architecture

Set up the technical foundation - AdonisJS scaffold, config, Docker, CI, hooks. No business logic.

### What you will learn

- How AdonisJS 7 is initialized (`npm init adonisjs@latest`) and what the `--kit=api` scaffold generates
- The role of `adonisrc.ts` as the application manifest (providers, preloads, aliases)
- How `start/env.ts` validates environment variables at startup using VineJS - the app will refuse to boot if a required variable is missing or malformed
- How `start/kernel.ts` registers global middleware (applied to every request) vs named middleware (applied per route)
- How AdonisJS's global exception handler works and how to format all error responses uniformly
- How to structure a `respond()` helper to keep controllers thin

### Key AdonisJS patterns introduced

**Named middleware registration in `start/kernel.ts`:**
```typescript
// start/kernel.ts
import router from '@adonisjs/core/services/router'

export const middleware = router.named({
  auth: () => import('#middleware/auth_middleware'),
  role: () => import('#middleware/role_middleware'),
  guest: () => import('#middleware/guest_middleware'),
})
```

**Env validation in `start/env.ts`:**
```typescript
// start/env.ts
import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  HOST: Env.schema.string({ format: 'host' }),
  PORT: Env.schema.number(),
  APP_KEY: Env.schema.string(),
  JWT_SECRET: Env.schema.string(),
  JWT_EXPIRY: Env.schema.string(),
  DB_HOST: Env.schema.string({ format: 'host' }),
  DB_PORT: Env.schema.number(),
  DB_USER: Env.schema.string(),
  DB_PASSWORD: Env.schema.string.optional(),
  DB_DATABASE: Env.schema.string(),
})
```

### Tasks

- [ ] Initialize AdonisJS project with `npm init adonisjs@latest adonisjs_tutorial -- --kit=api`
- [ ] Configure ESLint + Prettier (strict TypeScript rules)
- [ ] Set up `commitlint.config.js` with Conventional Commits preset
- [ ] Install and configure Husky (`pre-commit`, `commit-msg`, `pre-push`)
- [ ] Configure `lint-staged` in `package.json`
- [ ] Create `docker-compose.yml` with PostgreSQL 16 service and a named volume
- [ ] Create `docker-compose.test.yml` for an isolated test database on a different port
- [ ] Create `.env.example` (fully documented, see [Environment Variables Reference](#environment-variables-reference)), `.env.development`, `.env.test`
- [ ] Define and validate all env variables in `start/env.ts` with VineJS
- [ ] Create typed config factories: `config/app.ts`, `config/database.ts`, `config/auth.ts`
- [ ] Implement `ApiResponse<T>` interface and `respond()` helper in `app/helpers/api_response.ts`
- [ ] Implement `PageResponse<T>` interface in `app/helpers/page_response.ts`
- [ ] Implement global exception handler in `app/exceptions/handler.ts` (wraps all errors in `ApiResponse` shape with `success: false`)
- [ ] Implement `ResponseTimeMiddleware` and register it globally in `start/kernel.ts`
- [ ] Register `auth` and `role` as named middleware in `start/kernel.ts` (stubs - implementation comes in `feature/auth`)
- [ ] Configure `adonis-autoswagger` for API documentation
- [ ] Add `GET /api/v1/health` health-check route
- [ ] Set up GitHub Actions `ci.yml` and `pr-checks.yml`
- [ ] Functional test: `GET /api/v1/health` returns 200 with `ApiResponse` shape
- [ ] Functional test: unknown route returns 404 with `ApiResponse` shape

---

## feature/data-modeling

Define all Lucid models, run migrations, and seed test data - including a ready-to-use `ADMIN` and `USER` account so every subsequent CRUD branch can authenticate in functional tests without depending on `feature/auth` being merged first.

### What you will learn

- The Lucid ActiveRecord pattern: models hold both data and query methods (`Category.find()`, `category.save()`)
- How Lucid maps `snake_case` database columns to `camelCase` TypeScript properties via `@column()`
- How to declare relations (`@hasMany`, `@belongsTo`, `@manyToMany`) and when to use `preload()` vs lazy loading
- How to use `serializeExtras: true` on paginated queries to expose `meta` (total, perPage, currentPage) alongside rows
- How to use a `@beforeSave` hook on the `User` model to hash passwords transparently
- How to write migration files and run them with `node ace migration:run` / `node ace migration:rollback`
- The difference between `MainSeeder` (orchestrator) and domain seeders (data factories)

### Key AdonisJS patterns introduced

**Column mapping and `@beforeSave` hook on the User model:**
```typescript
// app/models/user.ts
import { BaseModel, beforeSave, column, manyToMany } from '@adonisjs/lucid/orm'
import type { ManyToMany } from '@adonisjs/lucid/types/relations'
import hash from '@adonisjs/core/services/hash'
import Role from '#models/role'

export default class User extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare firstName: string   // maps to first_name in DB

  @column()
  declare lastName: string

  @column()
  declare email: string

  @column({ serializeUsing: () => undefined })  // never expose password in responses
  declare password: string

  @column()
  declare enabled: boolean

  @column()
  declare accountLocked: boolean

  @manyToMany(() => Role, { pivotTable: 'role_user' })
  declare roles: ManyToMany<typeof Role>

  @beforeSave()
  static async hashPassword(user: User) {
    if (user.$dirty.password) {
      user.password = await hash.make(user.password)
    }
  }
}
```

**Paginated query with `serializeExtras`:**
```typescript
// app/services/categories_service.ts (preview)
const categories = await Category.query().paginate(page, limit)
categories.baseUrl('/api/v1/categories')
return categories.serialize({ extra: true })
// Produces: { data: [...], meta: { total, perPage, currentPage, lastPage, ... } }
```

### Tasks

- [ ] Install and configure `@adonisjs/lucid` with the `pg` PostgreSQL driver
- [ ] Create `Category` model (`id`, `categoryName`, `@hasMany(() => Product)`)
- [ ] Create `Product` model (`id`, `categoryId`, `productName`, `unitPrice`, `@belongsTo(() => Category)`)
- [ ] Create `Customer` model (`id`, `firstName`, `lastName`, `telephone`, `email`, `address`)
- [ ] Create `Order` model (`id`, `customerId`, `productId`, `quantity`, `total`, `@belongsTo(() => Customer)`, `@belongsTo(() => Product)`)
- [ ] Create `User` model with `@beforeSave` password hashing hook and `@column({ serializeUsing: () => undefined })` on `password`
- [ ] Create `Role` model with `@manyToMany(() => User, { pivotTable: 'role_user' })` and `@manyToMany(() => Permission, { pivotTable: 'role_permission' })`
- [ ] Create `Permission` model (`resource`, `action`)
- [ ] Create `ActivationToken` model
- [ ] Create `BlacklistedToken` model
- [ ] Create `PasswordResetToken` model
- [ ] Generate migration `1700000001_create_core_schema` (categories, products, customers, orders)
- [ ] Generate migration `1700000002_create_auth_schema` (users, roles, permissions, pivot tables, token tables)
- [ ] Create `CategorySeeder`, `ProductSeeder`, `CustomerSeeder` with realistic sample data
- [ ] Create `UserSeeder` that creates two test accounts seeded with known credentials:
  - `admin@example.com` / `Admin1234!` with role `ADMIN`
  - `user@example.com` / `User1234!` with role `USER`
- [ ] Create `MainSeeder` that runs all seeders in order
- [ ] Store seeded credentials in `.env.test` as `TEST_ADMIN_EMAIL`, `TEST_ADMIN_PASSWORD`, `TEST_USER_EMAIL`, `TEST_USER_PASSWORD` so functional tests can read them without hardcoding
- [ ] Verify `synchronize` is never set - only migrations touch the schema
- [ ] Test: `Category` model `hasMany` relation returns associated products
- [ ] Test: `Order` model `total` is correctly stored and retrieved
- [ ] Test: `User.beforeSave` hook hashes the password before insert and on password change only
- [ ] Test: migration runs and rolls back without error

---

## feature/auth

Full authentication and authorization based on the EER_AUTH diagram - JWT, roles, permissions, token blacklisting, account activation, and password reset. **This branch is built before any resource module so that `AuthMiddleware` and `RoleMiddleware` are available from the first CRUD slice.**

### What you will learn

- How `@adonisjs/auth` works: the JWT guard, how tokens are issued, and how `auth.authenticate()` resolves the current user
- How to write a named middleware that reads `auth.user` and checks loaded relations - and why you must `preload('roles')` before the check
- How to blacklist JWTs by storing the `jti` claim and rejecting it on every authenticated request
- How `@adonisjs/bouncer` policies work and the difference between a policy action and a role check
- How `@adonisjs/limiter` applies rate limits per IP on sensitive routes
- The full account lifecycle: register -> activate (email token) -> login -> logout -> forgot password -> reset password

### Key AdonisJS patterns introduced

**Named middleware receiving arguments (`role_middleware.ts`):**
```typescript
// app/middleware/role_middleware.ts
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export default class RoleMiddleware {
  async handle(ctx: HttpContext, next: NextFn, options: { roles: string[] }) {
    await ctx.auth.authenticate()
    const user = ctx.auth.user!
    await user.load('roles')  // preload relation - auth.user does NOT auto-load relations

    const hasRole = user.roles.some((r) => options.roles.includes(r.roleName))
    if (!hasRole) {
      return ctx.response.forbidden({ success: false, message: 'Insufficient role' })
    }
    return next()
  }
}
```

**JWT guard hook to reject blacklisted tokens:**
```typescript
// app/middleware/auth_middleware.ts (relevant excerpt)
import BlacklistedToken from '#models/blacklisted_token'

// After jwt.authenticate(), check if jti is blacklisted
const payload = ctx.auth.use('jwt').payload!
const jti = payload.jti as string
const isBlacklisted = await BlacklistedToken.findBy('jti', jti)
if (isBlacklisted) {
  return ctx.response.unauthorized({ success: false, message: 'Token has been revoked' })
}
```

**Rate limiting on auth routes:**
```typescript
// start/routes.ts (auth group excerpt)
import { throttle } from '@adonisjs/limiter'

router.group(() => {
  router.post('/register', [AuthController, 'register'])
  router.post('/login', [AuthController, 'login'])
  router.post('/forgot-password', [AuthController, 'forgotPassword'])
}).prefix('/api/v1/auth').use(throttle({ maxRequests: 10, windowMs: 60_000 }))
```

### Endpoints

| Method | URL | Description | Access |
|---|---|---|---|
| POST | `/api/v1/auth/register` | Register a new user, sends activation token | Public |
| POST | `/api/v1/auth/activate` | Activate account with token | Public |
| POST | `/api/v1/auth/login` | Sign in, returns JWT | Public |
| POST | `/api/v1/auth/logout` | Blacklist the current JWT | Authenticated |
| POST | `/api/v1/auth/refresh` | Issue new JWT (if not blacklisted) | Authenticated |
| POST | `/api/v1/auth/forgot-password` | Send password reset token | Public |
| POST | `/api/v1/auth/reset-password` | Consume token, set new password | Public |
| GET | `/api/v1/auth/me` | Current user profile | Authenticated |

**User, role and permission administration.** Registration always assigns the default `USER` role and nothing else in the app manages `users`, `roles` or `permissions` afterward, promoting an account to `ADMIN`, creating a new role, or changing what a role can do would otherwise only be possible by hand in the database. These endpoints close that gap, all `ADMIN` only since they operate on other accounts and on the authorization model itself.

| Method | URL | Description | Access |
|---|---|---|---|
| GET | `/api/v1/users` | Paginated list of users | ADMIN |
| GET | `/api/v1/users/:id` | User detail with roles preloaded | ADMIN |
| PUT | `/api/v1/users/:id` | Update `firstName`, `lastName`, `email`, `enabled`, `accountLocked` | ADMIN |
| DELETE | `/api/v1/users/:id` | Delete a user | ADMIN |
| POST | `/api/v1/users/:id/roles` | Assign a role to a user | ADMIN |
| DELETE | `/api/v1/users/:id/roles/:roleId` | Revoke a role from a user | ADMIN |
| GET | `/api/v1/roles` | Paginated list of roles | ADMIN |
| GET | `/api/v1/roles/:id` | Role detail with permissions preloaded | ADMIN |
| POST | `/api/v1/roles` | Create a role | ADMIN |
| PUT | `/api/v1/roles/:id` | Update a role | ADMIN |
| DELETE | `/api/v1/roles/:id` | Delete a role, blocked with 409 while any user still has it | ADMIN |
| POST | `/api/v1/roles/:id/permissions` | Assign a permission to a role | ADMIN |
| DELETE | `/api/v1/roles/:id/permissions/:permissionId` | Revoke a permission from a role | ADMIN |
| GET | `/api/v1/permissions` | Paginated list of permissions | ADMIN |
| POST | `/api/v1/permissions` | Create a permission (`resource`, `action`) | ADMIN |
| PUT | `/api/v1/permissions/:id` | Update a permission | ADMIN |
| DELETE | `/api/v1/permissions/:id` | Delete a permission, blocked with 409 while any role still has it | ADMIN |

### Tasks

- [ ] Install and configure `@adonisjs/auth` with the JWT guard; configure `config/auth.ts`
- [ ] Install and configure `@adonisjs/bouncer`; configure policies
- [ ] Install and configure `@adonisjs/limiter`; configure `config/limiter.ts`
- [ ] Configure `config/hash.ts` with Argon2 via the `hash` service
- [ ] Create `authValidator` (VineJS): `registerSchema` (firstName, lastName, email, password `minLength(8)` + complexity regex), `loginSchema`, `resetPasswordSchema`
- [ ] Implement `AuthMiddleware`: call `auth.authenticate()`, then check `jti` against `blacklisted_tokens`
- [ ] Implement `RoleMiddleware`: call `auth.authenticate()`, preload `roles` relation, check role name against the `options.roles` argument
- [ ] Register both as named middleware in `start/kernel.ts`
- [ ] Implement `AuthService`:
  - `register`: create user (password hashed by `@beforeSave` hook), assign default `USER` role, generate and store activation token
  - `activate`: find and validate token (not expired, not already used), set `enabled = true`, mark token as `validatedAt`
  - `login`: verify password with `hash.verify()`, check `enabled` and `accountLocked`, issue JWT with unique `jti`
  - `logout`: write `jti` to `blacklisted_tokens`
  - `forgotPassword`: generate a `PasswordResetToken`, return the raw token (email delivery is a placeholder)
  - `resetPassword`: validate token (type, expiry), update password (hashed by hook), delete token
  - `me`: return `auth.user` with preloaded `roles` and `permissions`
- [ ] Apply rate limiting on `register`, `login`, `forgot-password` routes
- [ ] Declare all auth routes in `start/routes.ts`
- [ ] Unit test: `register` creates user with `USER` role and activation token; `activate` sets `enabled = true` and marks token used; `login` throws for wrong password, locked account, inactive account; `login` returns token containing `jti`; `logout` inserts `jti` into `blacklisted_tokens`; `AuthMiddleware` rejects a blacklisted `jti`
- [ ] Functional test (full auth flow): register -> activate -> login -> `GET /auth/me` -> logout -> `GET /auth/me` with revoked token returns 401
- [ ] Functional test (middleware smoke): protected stub route returns 401 without token, 200 with valid `USER` token; same route with `role('ADMIN')` returns 403 for `USER`, 200 for `ADMIN`
- [ ] Functional test (rate limiting): 11th login attempt within 60 s returns 429
- [ ] Create `userValidator` (`updateUserSchema`), `roleValidator` (`createRoleSchema`, `updateRoleSchema`), `permissionValidator` (`createPermissionSchema`, `updatePermissionSchema`), all VineJS, all `ADMIN` only
- [ ] Implement `UsersService`: `findAll(page, limit)`, `findOne(id)`, `update(id, data)`, `remove(id)`, `assignRole(id, roleId)`, `revokeRole(id, roleId)`; `assignRole`/`revokeRole` are idempotent, no error re-assigning a role the user already has
- [ ] Implement `RolesService`: `findAll(page, limit)`, `findOne(id)`, `create(data)`, `update(id, data)`, `remove(id)`, `assignPermission(id, permissionId)`, `revokePermission(id, permissionId)`
- [ ] Business rule: a role with at least one user still assigned cannot be deleted, throw HTTP 409
- [ ] Implement `PermissionsService`: `findAll(page, limit)`, `findOne(id)`, `create(data)`, `update(id, data)`, `remove(id)`
- [ ] Business rule: a permission still attached to at least one role cannot be deleted, throw HTTP 409
- [ ] Create `UsersController`, `RolesController`, `PermissionsController`, thin, `@inject()`, calling their services and using `respond()`
- [ ] Declare all administration routes under `middleware.auth()` + `middleware.role({ roles: ['ADMIN'] })`
- [ ] Unit test: `UsersService.assignRole` attaches without duplicating an existing pivot row; `RolesService.remove` throws 409 when users are still assigned; `PermissionsService.remove` throws 409 when a role still has it
- [ ] Functional test: full CRUD lifecycle for users, roles and permissions; assigning and revoking a role on a user changes what that user's JWT is authorized to do on a subsequent request; all responses match `ApiResponse` shape
- [ ] Functional test (auth): every administration route returns 401 without a token and 403 with a non `ADMIN` token

---

## feature/categories

First complete vertical slice - Category CRUD with pagination, Swagger docs, and full tests. Authentication and authorization are applied directly in this branch using `AuthMiddleware` and `RoleMiddleware` from `feature/auth`. Functional tests authenticate using the seeded `ADMIN` and `USER` accounts from `feature/data-modeling`.

### What you will learn

- How to write a VineJS validator and call `request.validateUsing(schema)` in a controller
- How Lucid's `.paginate(page, limit)` works and how to map its output to `PageResponse<T>`
- How to declare route-level middleware using named middleware arguments in `start/routes.ts`
- How to inject and use a service via the AdonisJS IoC container with `@inject()`
- How to structure unit tests with Japa: mocking service dependencies and asserting HTTP status codes

### Key AdonisJS patterns introduced

**VineJS validator:**
```typescript
// app/validators/category_validator.ts
import vine from '@vinejs/vine'

export const createCategorySchema = vine.compile(
  vine.object({
    categoryName: vine.string().trim().maxLength(255),
  })
)

export const updateCategorySchema = vine.compile(
  vine.object({
    categoryName: vine.string().trim().maxLength(255).optional(),
  })
)
```

**Controller using `@inject()` and `request.validateUsing()`:**
```typescript
// app/controllers/categories_controller.ts
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { createCategorySchema } from '#validators/category_validator'
import CategoriesService from '#services/categories_service'
import { respond } from '#helpers/api_response'

@inject()
export default class CategoriesController {
  constructor(private categoriesService: CategoriesService) {}

  async index({ request, response }: HttpContext) {
    const { page, limit } = request.qs()
    const result = await this.categoriesService.findAll(page ?? 1, limit ?? 10)
    return response.ok(respond(result))
  }

  async store({ request, response }: HttpContext) {
    const data = await request.validateUsing(createCategorySchema)
    const category = await this.categoriesService.create(data)
    return response.created(respond(category, 'Category created', 201))
  }
}
```

**Route declaration with middleware:**
```typescript
// start/routes.ts (excerpt)
import { middleware } from '#start/kernel'

router.get('/api/v1/categories', [CategoriesController, 'index'])
router.get('/api/v1/categories/:id', [CategoriesController, 'show'])
router.post('/api/v1/categories', [CategoriesController, 'store'])
  .use([middleware.auth(), middleware.role({ roles: ['ADMIN'] })])
router.put('/api/v1/categories/:id', [CategoriesController, 'update'])
  .use([middleware.auth(), middleware.role({ roles: ['ADMIN'] })])
router.delete('/api/v1/categories/:id', [CategoriesController, 'destroy'])
  .use([middleware.auth(), middleware.role({ roles: ['ADMIN'] })])
```

### Endpoints

| Method | URL | Description | Access |
|---|---|---|---|
| GET | `/api/v1/categories` | Paginated list of categories | Public |
| GET | `/api/v1/categories/:id` | Category detail | Public |
| POST | `/api/v1/categories` | Create a category | ADMIN |
| PUT | `/api/v1/categories/:id` | Update a category | ADMIN |
| DELETE | `/api/v1/categories/:id` | Delete a category | ADMIN |

### Tasks

- [ ] Create `createCategorySchema` and `updateCategorySchema` in `app/validators/category_validator.ts`
- [ ] Create `CategoriesService` with `findAll(page, limit)`, `findOne(id)`, `create(data)`, `update(id, data)`, `remove(id)`
- [ ] Use `Category.query().paginate(page, limit)` and map to `PageResponse<T>`
- [ ] Business rule: a category with associated products cannot be deleted - throw HTTP 409
- [ ] Create `CategoriesController` with `@inject()`, calling the service and using `respond()`
- [ ] Declare routes with access rules applied immediately (see snippet above)
- [ ] Add Swagger JSDoc annotations on the controller
- [ ] Unit test: `findAll` returns paginated results; `findOne` returns category for valid id; `findOne` throws 404 for unknown id; `create` saves and returns new category; `update` modifies existing category; `remove` deletes category with no products; `remove` throws 409 when category has products
- [ ] Functional test: full CRUD lifecycle on real database; 409 on delete with products; all responses match `ApiResponse` shape
- [ ] Functional test (auth): `POST /categories` without token returns 401; with `USER` token returns 403; with `ADMIN` token returns 201

---

## feature/products

Product CRUD linked to categories, with filtering by `categoryId` and sorting. Auth rules are applied directly.

### What you will learn

- How to build a dynamic QueryBuilder query in Lucid: conditional `where`, `orderBy`, and `preload` chaining
- How to validate optional query parameters with VineJS (`vine.string().optional()`)
- How to eager-load a relation (`preload('category')`) and include it in the serialized response
- How to enforce a foreign-key existence check in the service layer before writing to the DB

### Key AdonisJS patterns introduced

**Dynamic QueryBuilder with optional filters:**
```typescript
// app/services/products_service.ts (excerpt)
async findAll(filter: ProductFilter, page: number, limit: number) {
  const query = Product.query().preload('category')

  if (filter.categoryId) {
    query.where('category_id', filter.categoryId)
  }
  if (filter.sortBy) {
    query.orderBy(filter.sortBy, filter.order ?? 'asc')
  }

  return query.paginate(page, limit)
}
```

### Endpoints

| Method | URL | Description | Access |
|---|---|---|---|
| GET | `/api/v1/products` | Paginated list, filter by `categoryId`, sort by `productName`/`unitPrice` | Public |
| GET | `/api/v1/products/:id` | Product detail (includes category) | Public |
| POST | `/api/v1/products` | Create a product | ADMIN |
| PUT | `/api/v1/products/:id` | Update a product | ADMIN |
| DELETE | `/api/v1/products/:id` | Delete a product | ADMIN |

### Tasks

- [ ] Create `createProductSchema`, `updateProductSchema`, `productFilterSchema` (`categoryId?`, `sortBy?`, `order?`) in `app/validators/product_validator.ts`
- [ ] Create `ProductsService` with dynamic QueryBuilder filtering and sorting; check category exists before create/update; eager-load category on response
- [ ] Business rule: a product linked to at least one order cannot be deleted
- [ ] Create `ProductsController` with `@inject()`
- [ ] Declare routes with ADMIN protection on mutations
- [ ] Unit tests: filtering by `categoryId` returns only matching products; `create` throws 404 if category does not exist; `remove` throws 409 if product has orders
- [ ] Functional tests: full CRUD lifecycle; filtering and sorting; nested category in response
- [ ] Functional test (auth): `POST /products` without token 401; `USER` token 403; `ADMIN` token 201

---

## feature/customers

Customer CRUD with email uniqueness enforcement and full-text name/email search. All routes require authentication.

### What you will learn

- How to implement a case-insensitive search with `ILIKE` using Lucid's QueryBuilder
- How to enforce a unique constraint at the service layer (distinct from the DB-level unique index) to produce a clean 409 error with a meaningful message
- How to allow a field to keep its current value on update without triggering a false uniqueness conflict

### Key AdonisJS patterns introduced

**ILIKE search in the service:**
```typescript
// app/services/customers_service.ts (excerpt)
async findAll(search: string | undefined, page: number, limit: number) {
  const query = Customer.query()

  if (search) {
    query.where((q) => {
      q.whereILike('first_name', `%${search}%`)
       .orWhereILike('last_name', `%${search}%`)
       .orWhereILike('email', `%${search}%`)
    })
  }

  return query.paginate(page, limit)
}
```

### Endpoints

| Method | URL | Description | Access |
|---|---|---|---|
| GET | `/api/v1/customers` | Paginated list, search by `?search=` (first/last name or email) | Authenticated |
| GET | `/api/v1/customers/:id` | Customer detail | Authenticated |
| POST | `/api/v1/customers` | Create a customer | ADMIN |
| PUT | `/api/v1/customers/:id` | Update a customer | ADMIN |
| DELETE | `/api/v1/customers/:id` | Delete a customer | ADMIN |

### Tasks

- [ ] Create `createCustomerSchema` and `updateCustomerSchema` in `app/validators/customer_validator.ts` (email: `vine.string().email()`, telephone: `vine.string().regex(...)`)
- [ ] Create `CustomersService`: implement `ILIKE` search; enforce unique email on create; on update, allow same email only for the same record
- [ ] Business rule: a customer with existing orders cannot be deleted
- [ ] Create `CustomersController` with `@inject()`
- [ ] Declare routes: all routes use `middleware.auth()`; mutations additionally use `middleware.role({ roles: ['ADMIN'] })`
- [ ] Unit test: search filters by first name, last name, and email; `create` throws 409 for duplicate email; `update` allows same email for same customer; `update` throws 409 if email belongs to another customer; `remove` throws 409 when customer has orders
- [ ] Functional test: full CRUD; search; email uniqueness
- [ ] Functional test (auth): `GET /customers` without token 401; with `USER` token 200; `POST /customers` with `USER` token 403; with `ADMIN` token 201

---

## feature/orders

Order CRUD with computed `total`, business-rule validations, and application events. All routes require authentication.

### What you will learn

- How to compute a derived field (`total`) in the service layer and persist it to the DB
- How to emit and listen to domain events with `@adonisjs/emitter` and why listeners are registered in a dedicated `start/events.ts` preload (not in `kernel.ts`)
- How to declare a nested resource route (`/customers/:id/orders`) alongside a top-level route
- How to write a Japa unit test that asserts an event was emitted using `emitter.fake()`

### Key AdonisJS patterns introduced

**Event definition and listener registration:**
```typescript
// app/events/order_created.ts
export default class OrderCreated {
  constructor(public orderId: number, public customerId: number) {}
}

// start/events.ts  <-- registered as a preload in adonisrc.ts
import emitter from '@adonisjs/core/services/emitter'
import OrderCreated from '#events/order_created'

emitter.on(OrderCreated, () => import('#listeners/send_order_notification'))

// adonisrc.ts (relevant excerpt)
preloads: [
  () => import('#start/routes'),
  () => import('#start/kernel'),
  () => import('#start/events'),   // event bindings loaded at boot
]
```

**Faking the emitter in tests:**
```typescript
// tests/unit/services/orders_service.spec.ts (excerpt)
import emitter from '@adonisjs/core/services/emitter'
import OrderCreated from '#events/order_created'

test('create emits OrderCreated event', async ({ assert }) => {
  const fakeEmitter = emitter.fake()
  // ... call service.create(...)
  fakeEmitter.assertEmitted(OrderCreated)
  emitter.restore()
})
```

### Endpoints

| Method | URL | Description | Access |
|---|---|---|---|
| GET | `/api/v1/orders` | Paginated list, filter by `customerId`/`productId` | Authenticated |
| GET | `/api/v1/orders/:id` | Order detail | Authenticated |
| POST | `/api/v1/orders` | Create an order (`total` computed automatically) | ADMIN |
| PUT | `/api/v1/orders/:id` | Update an order | ADMIN |
| DELETE | `/api/v1/orders/:id` | Delete an order | ADMIN |
| GET | `/api/v1/customers/:id/orders` | All orders for a given customer | Authenticated |

### Tasks

- [ ] Create `createOrderSchema` (`customerId`, `productId`, `quantity`), `updateOrderSchema`, `orderFilterSchema` (`customerId?`, `productId?`) in `app/validators/order_validator.ts`
- [ ] Create `OrdersService`: verify customer and product exist, compute `total = quantity x product.unitPrice`; eager-load customer and product on response
- [ ] Emit `OrderCreated` event via `emitter.emit()` after successful creation
- [ ] Create `SendOrderNotification` listener (log the event + placeholder for email delivery)
- [ ] Register the event -> listener binding in `start/events.ts` and declare `start/events.ts` as a preload in `adonisrc.ts`
- [ ] Create `OrdersController` with `@inject()`; include the nested `/customers/:id/orders` route
- [ ] Declare all routes with auth and role middleware applied immediately
- [ ] Unit test: `create` computes total correctly; `create` throws 404 for unknown customer or product; `create` emits `OrderCreated` (use `emitter.fake()`); `update` recomputes total when quantity changes; `update` does not recompute total when quantity is unchanged
- [ ] Functional test: `POST /orders` stores correct total; `GET /orders?customerId=1` filters correctly; `GET /customers/1/orders` returns only that customer's orders
- [ ] Functional test (auth): `GET /orders` without token 401; with `USER` token 200; `POST /orders` with `USER` token 403; with `ADMIN` token 201

---

## Order of Work

```
1. feature/core-architecture  -> PR to develop
2. feature/data-modeling      -> PR to develop  (includes seeded ADMIN + USER test accounts)
3. feature/auth               -> PR to develop  (security foundation)
4. feature/categories         -> PR to develop  (first full vertical slice, secured from day one)
5. feature/products           -> PR to develop  (depends on categories)
6. feature/customers          -> PR to develop
7. feature/orders             -> PR to develop  (depends on products + customers)
8. develop                    -> PR to master   (final stable release)
```

Each branch is created from the tip of `develop`:
```bash
git checkout develop
git pull origin develop
git checkout -b feature/<name>
```

---

## Code Conventions

- App code lives in `app/`; configuration in `config/`; routes in `start/routes.ts`
- Each domain has its controller in `app/controllers/`, its Lucid model in `app/models/`, its service in `app/services/`, its VineJS validator in `app/validators/`, and its Bouncer policy in `app/policies/`
- No business logic in controllers - controllers only call `request.validateUsing()`, call the service, and return `respond()`
- Services throw AdonisJS HTTP exceptions via `import { errors } from '@adonisjs/core'` - never raw `Error`
- All list endpoints are paginated via Lucid's `.paginate(page, limit)` - never return an unbounded array
- Response shape is always `ApiResponse<T>` - the `respond()` helper handles wrapping
- Endpoint paths are plural and `snake_case`: `/api/v1/categories`, `/api/v1/orders`
- VineJS validators live in `app/validators/` - no inline schema definitions in controllers
- Environment variables are always accessed via the typed `env` object from `start/env.ts` - never `process.env`
- Event -> listener bindings live in `start/events.ts`, not `start/kernel.ts`
- Migrations only - Lucid `synchronize` is never used

---

## Concepts Covered

**Architecture**
- Layered architecture: Controller -> Service -> Model (Lucid ActiveRecord)
- Dependency injection via AdonisJS IoC container (`@inject()` decorator)
- Service classes as the single source of business logic

**Data Layer**
- Lucid ORM models with relations (`@hasMany`, `@belongsTo`, `@manyToMany`)
- `@column()` snake_case to camelCase mapping
- `@beforeSave` hook for transparent password hashing
- QueryBuilder for dynamic filtering, sorting, and ILIKE search
- `serializeExtras: true` for pagination metadata
- Lucid migrations and seeders

**Validation**
- VineJS compiled schemas in `app/validators/`
- `request.validateUsing(schema)` returning fully typed data
- Optional query parameter validation

**API Design**
- Consistent `ApiResponse<T>` envelope with `respond()` helper
- Pagination with `PageResponse<T>` via Lucid `ModelPaginatorContract`
- Swagger / OpenAPI via `adonis-autoswagger`
- Versioned endpoints (`/api/v1/`)

**Error Handling**
- Global exception handler in `app/exceptions/handler.ts`
- Domain-specific HTTP exceptions from the service layer

**Security**
- `@adonisjs/auth` JWT guard (stateless authentication)
- `jti`-based token blacklisting (explicit logout)
- Role-based access control (`ADMIN`, `USER`) via `RoleMiddleware`
- Fine-grained permissions via Bouncer policies
- Account activation and password reset flows
- `@beforeSave` hook + `hash` service for Argon2 password hashing
- Rate limiting on auth routes via `@adonisjs/limiter`

**Events**
- `@adonisjs/emitter` for decoupled domain events
- `OrderCreated` event + `SendOrderNotification` listener
- Listener registration via `start/events.ts` preload in `adonisrc.ts`
- `emitter.fake()` for asserting events in unit tests

**Caching**
- `@adonisjs/cache` on frequently-read endpoints (categories list)

**Configuration**
- Typed config factories in `config/`
- VineJS env validation in `start/env.ts` - app refuses to boot on invalid config

**Testing**
- Unit tests with mocked dependencies (Japa + `@japa/assert`)
- Functional / API-level tests (`@japa/api-client` + real PostgreSQL via Docker)
- `test.group()`, `group.setup()`, `group.teardown()`, `group.each.setup()`
- `emitter.fake()` for event assertions
- Shared `tests/helpers/auth_helper.ts` for reusable login logic

**Developer Experience**
- Husky hooks (pre-commit lint, commit-msg validation, pre-push test)
- Commitlint (Conventional Commits)
- ESLint + Prettier
- GitHub Actions CI pipeline
- Docker Compose for local development and testing

---

## How to Follow This Tutorial

```bash
# 1. Clone and set up
git clone https://github.com/your-org/adonisjs_tutorial.git
cd adonisjs_tutorial
cp .env.example .env.development
npm install

# 2. Start the database
docker-compose up -d

# 3. Run migrations and seed
node ace migration:run
node ace db:seed

# 4. Start the dev server
node ace serve --hmr
# API:     http://localhost:3333/api/v1
# Swagger: http://localhost:3333/docs

# 5. Follow branches in order
git checkout develop
git checkout -b feature/core-architecture
# Complete every task in the branch's Tasks list
# Open a PR to develop when done

# 6. Run tests
node ace test                  # all tests
node ace test unit             # unit tests only
node ace test functional       # functional tests only
```

Work through branches in the [Order of Work](#order-of-work). At the end of each branch:
1. Complete every item in its Tasks list
2. Ensure all atomic commits are in place (one per file)
3. Confirm tests pass: `node ace test`
4. Open a Pull Request to `develop`

---

## Troubleshooting

Common errors and how to fix them.

**`E_MISSING_APP_KEY: Cannot encrypt value without an application key`**
You have not set `APP_KEY` in your `.env` file. Generate one with:
```bash
node ace generate:key
```
Copy the output into your `.env.development` file.

**`E_INVALID_ENV_VARIABLES` at startup**
A variable declared in `start/env.ts` is missing or has the wrong type in your `.env` file. AdonisJS intentionally crashes at boot rather than running with bad config. Check the error message - it names the offending variable. Compare your `.env` file against `.env.example`.

**Migration fails with `column already exists` or `relation does not exist`**
Your migration history is out of sync. Check the `adonis_schema` table in your database. If you are in development, the fastest fix is:
```bash
node ace migration:rollback --batch=0   # rolls back all migrations
node ace migration:run                  # re-applies from scratch
```
Never do this on a production database.

**`auth.user` is `undefined` even after `auth.authenticate()`**
`auth.authenticate()` resolves the user from the JWT but does NOT preload relations. If your middleware or service needs `user.roles`, call `await user.load('roles')` explicitly after authentication. This is a common source of empty role arrays in `RoleMiddleware`.

**`RoleMiddleware` always returns 403 even with the correct role**
Almost always caused by the missing `preload` mentioned above. Add `await user.load('roles')` before the role check. Also verify that your `UserSeeder` actually created the pivot row in `role_user` - query the table directly in `psql` to confirm.

**Functional tests fail with `connect ECONNREFUSED 127.0.0.1:5432`**
The test database is not running. Start it with:
```bash
docker-compose -f docker-compose.test.yml up -d
node ace migration:run --env=test
```
Make sure your `.env.test` points to the test database port (default: 5433 to avoid conflicts with the dev DB).

**`emitter.fake()` does not capture events in unit tests**
Call `emitter.fake()` before the code that emits the event, and call `emitter.restore()` in the teardown. If you forget `restore()`, subsequent tests in the suite will also use the fake emitter and may produce unexpected results.

**VineJS throws `E_VALIDATION_ERROR` but the error message is not in `ApiResponse` shape**
The global exception handler does not automatically intercept VineJS errors unless you handle the `E_VALIDATION_ERROR` code in `app/exceptions/handler.ts`. Add a check for `error.code === 'E_VALIDATION_ERROR'` and format it using your `ApiResponse` structure with `success: false` and the messages array in `errors`.
