# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start the API with `tsx watch src/server.ts`
- `npm run build` — `tsc -p tsconfig.json` (output in `dist/`)
- `npm start` — run the compiled build (`node dist/server.js`)
- `npm test` — run the full Vitest suite (`vitest run`)
- `npx vitest run src/auth.integration.test.ts` — run a single test file
- `npx vitest run -t "logs in with credentials"` — run tests matching a name

There is no lint script. Type-check by running `npm run build` (or `npx tsc --noEmit`).

## Environment

Required in `.env` (validated by [src/config/env.ts](src/config/env.ts)): `PORT`, `JWT_SECRET` (≥16 chars), `JWT_EXPIRES_IN` (access TTL, default `15m`), `REFRESH_TOKEN_TTL_SECONDS` (default 30d), `REFRESH_ROTATION_THRESHOLD_SECONDS` (minimum interval between refresh-token rotations, default 1d), `DATABASE_URL`. `NODE_ENV` defaults to `development`.

Runtime expects an existing MySQL database — the app auto-creates tables on startup but does not create the database itself.

## Architecture

The codebase is a small Express 5 + TypeScript API following a strict three-layer separation per resource module. Understanding the layering is the key to being productive:

**Routes → Service → Store (interface) → Repository (impl)**

- **Routes** ([src/modules/*/`*.routes.ts`](src/modules)) — thin handlers. Parse with Zod, call a service, shape the response, `next(error)` on failure. No DB calls here.
- **Service** ([src/modules/*/`*.service.ts`](src/modules)) — business rules: ownership checks, duplicate prevention, totals, password hashing, JWT signing. Depends on a `*Store` interface, **not** on MySQL directly.
- **Store interface** ([src/modules/*/`*.store.ts`](src/modules)) — the seam that lets tests swap MySQL for an in-memory implementation.
- **Repository** — two implementations per store: a `MySql*Repository` (raw `mysql2/promise` queries, snake_case columns ↔ camelCase fields) and an `InMemory*Repository` used by tests.

Composition happens once in [src/app.ts](src/app.ts). `createApp(config, dependencies)` accepts optional repository overrides — tests pass in-memory repos via `dependencies`, runtime falls back to MySQL repos built from the pool. This DI seam is why the test suite runs without a live MySQL.

DB schema is auto-created at startup by `ensureDatabaseSchema` in [src/db/mysql.ts](src/db/mysql.ts) — when changing schema you must update three places together: the `CREATE TABLE` SQL there, the MySQL repository implementation, and the in-memory repository.

## Auth model

JWTs are signed with **HS256** (symmetric, single `JWT_SECRET`). [authenticate.ts](src/middleware/authenticate.ts) middleware parses `Authorization: Bearer <token>`, calls `authService.verifyToken`, and populates `request.auth` (`{ userId, email, role }`) — declared in [src/types/express.d.ts](src/types/express.d.ts). Route handlers should read `request.auth.*`, never re-decode the JWT.

**Token model**: short-lived JWT access token (in JSON response) + long-lived opaque refresh token (HttpOnly cookie at `Path=/api/auth`, `SameSite=Strict`, `Secure` in production). The refresh token is a 32-byte url-safe random string; only its SHA-256 hash is stored. **Single session per user** — the `refresh_tokens` table holds one row per user (no multi-device concurrent sessions).

**Login** (signup or `POST /api/auth/login`) — if a row already exists for the user, it is rotated **in place**: the existing `token_hash` is demoted to `previous_token_hash`, the freshly issued hash becomes the new `token_hash`. The other device's cookie is now invalid but its hash is still discoverable via `previous_token_hash`.

**Refresh** (`POST /api/auth/refresh`, reads cookie) has three branches:
1. Hash matches `token_hash` → if `now - updated_at >= REFRESH_ROTATION_THRESHOLD_SECONDS` rotate and set a new cookie; otherwise just issue a new access token and **do not** rotate the row or set a new cookie.
2. Hash matches `previous_token_hash` → 401 "logged in on another device". The row is **not** deleted — it represents the active session of whoever logged in last.
3. No match → 401 "unknown refresh token".

The race-recovery and theft-detection branches that older designs use are intentionally absent — the single-session-per-user invariant collapses those cases into branch 2.

Access tokens are **not** checked against the refresh table on every request — that's the whole point of the split. The DB is hit only at `/refresh` and `/logout`. `POST /api/auth/logout` deletes the row only when the cookie hash matches `token_hash` (an evicted device's cookie won't delete the live session); the route always clears the cookie. `change-password` revokes the row and clears the cookie.

Roles (`USER`, `ADMIN`) live in [user.types.ts](src/modules/users/user.types.ts). Admin routes stack `authenticate(authService)` then `requireRole("ADMIN")`. For user-owned resources (income, expense), authentication runs at the route layer and **ownership is enforced inside the service** — follow that pattern when adding new owned resources.

## Conventions

- **Never return `passwordHash`** — use the `toSafeUser()` helper.
- **Validate writes with Zod** before any business logic; password rules live in `auth.schemas.ts`.
- **Mirror the module shape** when adding a new resource: `*.types.ts`, `*.store.ts`, `*.repository.ts`, `in-memory-*.repository.ts`, `*.schemas.ts`, `*.service.ts`, `*.routes.ts`, then wire into `src/app.ts`.
- **App code is camelCase, DB columns are snake_case** — the mapping happens in the MySQL repository.
- Errors thrown as `HttpError(status, message, code?)` ([src/lib/http-error.ts](src/lib/http-error.ts)); `ZodError` and `HttpError` are converted to JSON by [error-handler.ts](src/middleware/error-handler.ts), everything else becomes 500.
- **Error response shape**: `{ code?, message, ... }`. Auth errors carry a stable `code` from [src/modules/auth/auth.error-codes.ts](src/modules/auth/auth.error-codes.ts) (`LOGGED_IN_ELSEWHERE`, `UNKNOWN_REFRESH_TOKEN`, `INVALID_CREDENTIALS`, etc.) — frontend should switch on `code`, not message text. Zod failures emit `code: "VALIDATION_FAILED"` plus an `issues[]` array. Unhandled errors emit `code: "INTERNAL_ERROR"`. Non-auth `HttpError`s currently omit `code` (frontend disambiguates via HTTP status).

## Tests

Vitest + Supertest. Integration tests live next to `src/` (e.g. [src/auth.integration.test.ts](src/auth.integration.test.ts)) and exercise the real Express app with in-memory repositories injected through `createApp`. Tests must not require MySQL — if a behavior can only be tested against the real DB, write a targeted test for it rather than forcing the whole suite to need MySQL.

## Deeper reference

[AGENTS.md](AGENTS.md) has the full directory map, per-route flow diagrams, and the current data model. Read it when you need details beyond the architecture sketch above.
