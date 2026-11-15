# AGENTS.md

## Purpose

This repository is the backend API for the "Financial Growth Support Application".

Current scope is intentionally small:

- authentication
- authorization
- user persistence
- income management
- expense management
- overview metrics
- a minimal admin route
- test scaffolding that does not require a live MySQL server

The next likely modules are expenses, income, overview, and AI advice.

## Stack

- Node.js + TypeScript
- Express 5
- raw MySQL queries via `mysql2/promise`
- MySQL
- JWT for authentication
- bcryptjs for password hashing
- Zod for request validation
- Vitest + Supertest for tests

## Entry Points

- [src/server.ts](/Users/vasanthamuralikrishna/Documents/Personal/repos/Track Expenses & Grow/src/server.ts)
  - loads validated env config
  - creates the app
  - starts the HTTP server

- [src/app.ts](/Users/vasanthamuralikrishna/Documents/Personal/repos/Track Expenses & Grow/src/app.ts)
  - composes the application
  - creates or accepts dependencies
  - mounts routes
  - installs middleware

## Environment

Validated in [src/config/env.ts](/Users/vasanthamuralikrishna/Documents/Personal/repos/Track Expenses & Grow/src/config/env.ts).

Required values:

- `PORT`
- `JWT_SECRET`
- `JWT_EXPIRES_IN` — access token TTL (default `15m`)
- `REFRESH_TOKEN_TTL_SECONDS` — refresh token TTL (default 30 days)
- `REFRESH_ROTATION_THRESHOLD_SECONDS` — minimum age of the refresh-token row before `/refresh` will rotate it again. Inside this window `/refresh` only re-issues the access token (default 1 day)
- `DATABASE_URL`

Use [.env.example](/Users/vasanthamuralikrishna/Documents/Personal/repos/Track Expenses & Grow/.env.example) as the template.

## Directory Map

### `src/modules/auth/`

- [auth.routes.ts](/Users/vasanthamuralikrishna/Documents/Personal/repos/Track Expenses & Grow/src/modules/auth/auth.routes.ts)
  - HTTP handlers for signup, login, refresh, logout, current user, and password change
  - route layer should stay thin

- [auth.service.ts](/Users/vasanthamuralikrishna/Documents/Personal/repos/Track Expenses & Grow/src/modules/auth/auth.service.ts)
  - business logic for signup, login, refresh, logout, password change, and token verification
  - owns password hashing, JWT signing, and refresh-token rotation/grace/theft logic

- [auth.schemas.ts](/Users/vasanthamuralikrishna/Documents/Personal/repos/Track Expenses & Grow/src/modules/auth/auth.schemas.ts)
  - Zod request schemas for signup, login, refresh, logout, change-password
  - password rules live here

- `auth.error-codes.ts`
  - canonical list of stable error codes returned to the frontend (`LOGGED_IN_ELSEWHERE`, `UNKNOWN_REFRESH_TOKEN`, `INVALID_CREDENTIALS`, etc.)
  - clients should switch on `code` rather than matching message text

- `refresh-token.types.ts`
  - shared refresh token record + DTOs

- `refresh-token.store.ts`
  - storage interface used by `AuthService`

- `refresh-token.repository.ts`
  - raw-SQL MySQL implementation of `RefreshTokenStore`

- `in-memory-refresh-token.repository.ts`
  - test double for `RefreshTokenStore`

### `src/modules/income/`

- `income.types.ts`
  - shared income, allocation, category, and response types

- `income.store.ts`
  - storage interface for incomes

- `income.repository.ts`
  - raw-SQL MySQL implementation storing allocations in a JSON column

- `in-memory-income.repository.ts`
  - test double for income storage

- `income.schemas.ts`
  - Zod validation for create and update payloads

- `income.service.ts`
  - validation rules, owner checks, totals, and category shaping

- `income.routes.ts`
  - authenticated categories/create/list/update/delete endpoints

### `src/modules/expense/`

- `expense.types.ts`
  - shared expense and response types

- `expense.store.ts`
  - storage interface for expenses

- `expense.repository.ts`
  - raw-SQL MySQL implementation storing one row per expense

- `in-memory-expense.repository.ts`
  - test double for expense storage

- `expense.schemas.ts`
  - Zod validation for create and update payloads

- `expense.service.ts`
  - validation rules, owner checks, and category display shaping

- `expense.routes.ts`
  - authenticated categories/create/list/update/delete endpoints

### `src/modules/overview/`

- `overview.types.ts`
  - summary and category metric response types

- `overview.service.ts`
  - combines latest income data with all user expenses to build dashboard metrics

- `overview.routes.ts`
  - authenticated overview endpoint

### `src/modules/users/`

- [user.types.ts](/Users/vasanthamuralikrishna/Documents/Personal/repos/Track Expenses & Grow/src/modules/users/user.types.ts)
  - shared user types
  - `Role`, `UserRecord`, `SafeUser`, `CreateUserInput`

- [user.store.ts](/Users/vasanthamuralikrishna/Documents/Personal/repos/Track Expenses & Grow/src/modules/users/user.store.ts)
  - storage interface used by the service layer
  - important seam: services depend on this abstraction, not MySQL directly

- [user.repository.ts](/Users/vasanthamuralikrishna/Documents/Personal/repos/Track Expenses & Grow/src/modules/users/user.repository.ts)
  - raw-SQL MySQL implementation of `UserStore`
  - maps database rows into service-facing `UserRecord`

- [in-memory-user.repository.ts](/Users/vasanthamuralikrishna/Documents/Personal/repos/Track Expenses & Grow/src/modules/users/in-memory-user.repository.ts)
  - test double for `UserStore`
  - lets tests run without MySQL

### `src/modules/admin/`

- [admin.routes.ts](/Users/vasanthamuralikrishna/Documents/Personal/repos/Track Expenses & Grow/src/modules/admin/admin.routes.ts)
  - currently contains only `GET /api/admin/users`
  - all routes here require auth plus `ADMIN` role

### `src/middleware/`

- [authenticate.ts](/Users/vasanthamuralikrishna/Documents/Personal/repos/Track Expenses & Grow/src/middleware/authenticate.ts)
  - reads `Authorization: Bearer <token>`
  - verifies JWT
  - populates `request.auth`

- [require-role.ts](/Users/vasanthamuralikrishna/Documents/Personal/repos/Track Expenses & Grow/src/middleware/require-role.ts)
  - enforces role-based access

- [error-handler.ts](/Users/vasanthamuralikrishna/Documents/Personal/repos/Track Expenses & Grow/src/middleware/error-handler.ts)
  - converts `ZodError` and `HttpError` into JSON responses with shape `{ code?, message, ... }`
  - `ZodError` → 400 with `code: "VALIDATION_FAILED"` and an `issues` array
  - `HttpError` → its `statusCode` with the optional `code` (auth throws use [src/modules/auth/auth.error-codes.ts](/Users/vasanthamuralikrishna/Documents/Personal/repos/Track Expenses & Grow/src/modules/auth/auth.error-codes.ts))
  - anything else → 500 with `code: "INTERNAL_ERROR"`

### `src/db/`

- [mysql.ts](/Users/vasanthamuralikrishna/Documents/Personal/repos/Track Expenses & Grow/src/db/mysql.ts)
  - creates the MySQL pool from a passed database URL
  - auto-creates the `users`, `refresh_tokens`, `incomes`, and `expenses` tables at startup

### `src/lib/`

- [http-error.ts](/Users/vasanthamuralikrishna/Documents/Personal/repos/Track Expenses & Grow/src/lib/http-error.ts)
  - shared application error type with status code

- [crypto.ts](/Users/vasanthamuralikrishna/Documents/Personal/repos/Track Expenses & Grow/src/lib/crypto.ts)
  - `createId()` wraps `crypto.randomUUID()`
  - `createOpaqueToken()` returns a 32-byte url-safe random string (used for refresh tokens)
  - `hashToken()` returns the SHA-256 hex of a token (storage and lookup form)

### `src/types/`

- [express.d.ts](/Users/vasanthamuralikrishna/Documents/Personal/repos/Track Expenses & Grow/src/types/express.d.ts)
  - augments `Express.Request` with `request.auth`

### Tests

- [src/auth.integration.test.ts](/Users/vasanthamuralikrishna/Documents/Personal/repos/Track Expenses & Grow/src/auth.integration.test.ts)
  - covers signup, login, current user, duplicate signup, and admin denial
  - uses the in-memory repository through dependency injection

## Current Request Flow

1. `src/server.ts` loads env and calls `createApp`.
2. `createApp` in `src/app.ts` builds dependencies.
3. In normal runtime:
   - a MySQL pool is created
   - `MySqlUserRepository` is used
4. In tests:
   - a custom `userRepository` can be injected
   - the in-memory repository is used instead of MySQL
5. Routes call `AuthService`.
6. Income routes call `IncomeService`.
7. Services read and write through repository interfaces.

This separation is important. Keep route handlers, business logic, and persistence logic in different layers.

## Authentication Flow

### Signup

Route: `POST /api/auth/signup`

1. `auth.routes.ts` validates request body with `signupSchema`.
2. `AuthService.signup()` checks whether the email already exists.
3. Password is hashed with bcrypt.
4. A new user record is created with default role `USER`.
5. A JWT is returned along with a safe user object.

### Login

Route: `POST /api/auth/login`

Body: `{ email, password }`

1. Request body is validated.
2. User is looked up by email.
3. Password is compared against the stored hash.
4. On success the refresh-token row is **rotated in place** (or created if none existed). The old `token_hash` is demoted to `previous_token_hash`. Response: `{ accessToken, user }` plus an HttpOnly `refreshToken` cookie.

There is at most **one** refresh-token row per user. Logging in from a new device evicts the previous device's session by overwriting `token_hash`.

### Refresh

Route: `POST /api/auth/refresh`

The refresh token is read from the `refreshToken` cookie. Branch on hash match:

1. Matches `token_hash` (current session): if `now - updated_at >= REFRESH_ROTATION_THRESHOLD_SECONDS` the row is rotated and the cookie is reset; otherwise only a new access token is returned and the cookie/row are left untouched.
2. Matches `previous_token_hash`: 401 with message about being logged in on another device. The row is not modified — it represents the active session of whoever logged in last.
3. No match: 401 "unknown refresh token".

Access tokens remain stateless JWTs verified locally — they are **not** checked against the refresh table on every request.

### Logout

Route: `POST /api/auth/logout`

Reads the `refreshToken` cookie:

1. If the hash matches `token_hash` the row is deleted (the active session ends).
2. If it only matches `previous_token_hash`, the row is left intact (an evicted device must not be able to terminate the active session).
3. The route clears the cookie and returns 204 unconditionally (no enumeration leak).

### Current User

Route: `GET /api/auth/me`

1. `authenticate()` verifies the bearer token.
2. JWT payload is copied into `request.auth`.
3. `AuthService.getSafeUser()` loads the user and strips the password hash.

### Change Password

Route: `POST /api/auth/change-password`

1. Route requires authentication.
2. Current password is verified.
3. New password is hashed and saved.
4. All refresh-token rows for the user are deleted, forcing every device to log in again.

## Authorization Flow

- Authentication establishes identity.
- Authorization checks role membership.

Current roles are defined in [src/modules/users/user.types.ts](/Users/vasanthamuralikrishna/Documents/Personal/repos/Track Expenses & Grow/src/modules/users/user.types.ts):

- `USER`
- `ADMIN`

`admin.routes.ts` applies both:

1. `authenticate(authService)`
2. `requireRole("ADMIN")`

For future user-owned resources such as expenses and income, prefer owner checks in the service layer plus authentication middleware at the route layer.

## Data Model

Current `users` table columns:

- `id`
- `full_name`
- `email` unique
- `password_hash`
- `role`
- `created_at`
- `updated_at`

This means application code uses camelCase while the database keeps snake_case.

Current `incomes` table columns:

- `id`
- `user_id`
- `total_income`
- `allocations_json`
- `created_at`
- `updated_at`

Current `refresh_tokens` table columns:

- `id`
- `user_id` (FK → `users.id` ON DELETE CASCADE)
- `token_hash` — SHA-256 hex of the active refresh token (raw token never stored)
- `previous_token_hash` — hash of the token that was active before the most recent rotation (or login eviction), or NULL
- `previous_rotated_at` — when the previous hash was demoted
- `expires_at`
- `created_at`
- `updated_at` — last rotation time; the rotation-threshold check compares against this

One row per **user** (single-session model). Rotation updates the row in place; logout deletes it.

Current `expenses` table columns:

- `id`
- `user_id`
- `category_code`
- `description`
- `amount`
- `created_at`
- `updated_at`

## Commands

From [package.json](/Users/vasanthamuralikrishna/Documents/Personal/repos/Track Expenses & Grow/package.json):

- `npm run dev`
- `npm run build`
- `npm start`
- `npm test`

Typical setup:

1. create `.env`
2. `npm install`
3. ensure the MySQL database already exists
4. `npm run dev`

## Conventions For Future Changes

### 1. Keep routes thin

Routes should:

- parse and validate input
- call a service or repository abstraction
- shape the HTTP response
- delegate errors to `next(error)`

Do not put database logic directly in route files.

### 2. Keep business rules in services

Rules like:

- duplicate email prevention
- password verification
- role decisions
- ownership checks

belong in service code, not in raw SQL helpers.

### 3. Keep persistence behind interfaces

If you add new resource modules like expenses or income, mirror the current pattern:

- types
- store interface
- MySQL repository
- optional in-memory repository for tests
- service
- routes

This keeps tests fast and lets runtime stay database-backed.

### 4. Add validation early

Every write route should get a Zod schema before business logic runs.

### 5. Reuse `request.auth`

After `authenticate()` runs, use:

- `request.auth.userId`
- `request.auth.email`
- `request.auth.role`

Do not re-decode JWTs inside route handlers.

### 6. Keep safe user responses safe

Do not return `passwordHash` in API responses.
Use the existing `toSafeUser()` helper pattern.

### 7. Update SQL schema and repositories together

When changing schema:

1. update the table creation SQL in `src/db/mysql.ts`
2. update the MySQL repository implementation
3. update tests and any in-memory repository used by tests

## Suggested Next Module Shape

For `expenses`, a good initial structure would be:

- `src/modules/expenses/expense.types.ts`
- `src/modules/expenses/expense.store.ts`
- `src/modules/expenses/expense.repository.ts`
- `src/modules/expenses/in-memory-expense.repository.ts`
- `src/modules/expenses/expense.schemas.ts`
- `src/modules/expenses/expense.service.ts`
- `src/modules/expenses/expense.routes.ts`

Then wire it into `src/app.ts`.

## Known Scope Boundaries

As of now, the repo does not yet include:

- expense CRUD
- income CRUD
- category management
- budget calculations
- overview analytics
- AI advice integration
- password reset flow

Keep docs and implementation language aligned with that current scope.

## Testing Notes

The current tests validate the auth flow without touching MySQL.

This is by design:

- unit/integration-style API checks use `InMemoryUserRepository`
- runtime uses raw SQL + MySQL

If you add database-specific behavior that the in-memory store cannot represent, add targeted tests for that behavior rather than forcing every auth test to hit MySQL.
