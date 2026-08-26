import path from 'node:path'
import url from 'node:url'

/**
 * adonis-autoswagger generates the OpenAPI spec from start/routes.ts and
 * app/models/* directly, so this file only carries presentation and a few
 * behavioral settings, not the API surface itself. Controllers must be
 * imported lazily in routes.ts for their JSDoc annotations to be picked up,
 * which every controller in this project already does.
 */
export default {
  path: path.dirname(url.fileURLToPath(import.meta.url)) + '/../',
  title: 'AdonisJS Tutorial API',
  version: '1.0.0',
  description:
    'REST API for the AdonisJS Tutorial project: categories, products, customers and orders, secured by JWT authentication and role based access control.',

  // Routes are declared as /api/v1/<resource>, so the third path segment
  // (index 3) is the resource name autoswagger groups endpoints under.
  tagIndex: 3,

  ignore: ['/swagger', '/docs'],
  snakeCase: true,
  preferredPutPatch: 'PUT',
  common: {
    parameters: {},
    headers: {},
  },

  // AuthMiddleware is registered under the name "auth" in start/kernel.ts;
  // any route using middleware.auth() is detected as requiring the bearer
  // token security scheme below.
  authMiddlewares: ['auth'],
  defaultSecurityScheme: 'BearerAuth',
  persistAuthorization: true,
}
