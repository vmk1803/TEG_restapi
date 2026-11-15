# Financial Growth Support API

Phase 1 backend scaffold for the Financial Growth Support Application.

## Implemented in this slice

- user signup and login
- password hashing with `bcryptjs`
- short-lived JWT access tokens (JSON) with opaque refresh tokens delivered as HttpOnly cookies
- single-session-per-user model — a new login evicts the prior device's session
- threshold-based refresh rotation: refresh tokens rotate at most once per `REFRESH_ROTATION_THRESHOLD_SECONDS` interval
- logout that invalidates the refresh session
- role-based authorization middleware
- protected profile route
- admin-only example route for future privileged workflows
- income CRUD with predefined categories and JSON allocations
- expense CRUD with shared predefined categories
- raw SQL with MySQL

## Quick start

1. Copy `.env.example` to `.env`
2. Create a MySQL database named `track_expenses_grow`
3. Install dependencies with `npm install`
4. Start the API with `npm run dev`

## Phase 1 route surface

- `POST /api/auth/signup`
- `POST /api/auth/login` with `email + password`
- `POST /api/auth/refresh` reads the `refreshToken` cookie and returns a fresh access token; the cookie is rotated when it crosses the rotation threshold
- `POST /api/auth/logout` clears the `refreshToken` cookie and ends the active session
- `GET /api/auth/me`
- `POST /api/auth/change-password`
- `GET /api/income/categories`
- `POST /api/income`
- `GET /api/income`
- `PUT /api/income/:incomeId`
- `DELETE /api/income/:incomeId`
- `GET /api/expenses/categories`
- `POST /api/expenses`
- `GET /api/expenses`
- `PUT /api/expenses/:expenseId`
- `DELETE /api/expenses/:expenseId`
- `GET /api/overview`
- `GET /api/admin/users`
- `GET /api/health`

## Notes

This repo is intentionally scoped to the authentication and authorization foundation first. Expense, income, overview, and AI advice routes can be added as separate modules next.

The API uses a small raw-SQL MySQL repository and auto-creates the `users` table at startup.

The test suite uses an in-memory repository so you can learn and iterate on the API flow without needing a live MySQL server for every test run.
