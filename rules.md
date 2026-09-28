# Cohort — Coding Rules

Conventions this codebase follows. Written down so any future session (human
or AI) stays consistent with existing code instead of guessing from context.

## Naming
- Database/Prisma fields: `snake_case` (`password_hash`, `teacher_id`,
  `student_id`, `class_id`, `created_at`, `updated_at`).
- TypeScript variables/functions: `camelCase`, even when they wrap a
  snake_case field (e.g. `const passwordHash = await bcrypt.hash(...)`
  assigned into `password_hash: passwordHash`).
- Enum values: `UPPER_CASE` (`STUDENT`, `TEACHER`, `ADMIN`).

## Layering — who does what
- **Routes** (`src/routes/*.routes.ts`): wiring only. Middleware chain +
  controller function. No logic, no validation, no DB access.
- **Controllers** (`src/controllers/*.controller.ts`): HTTP concerns only —
  parse `req`, call one service function, translate the service's thrown
  errors into the right status code, shape the JSON response. No business
  logic, no direct Prisma calls.
- **Services** (`src/services/*.service.ts`): all business logic. Validation,
  ownership checks, role checks, DB access via the shared `prisma` client.
  Services throw plain `Error`s with a specific `message` string
  (`'EMAIL_TAKEN'`, `'CLASS_NOT_FOUND'`, `'ALREADY_ENROLLED'`,
  `'NOT_CLASS_OWNER'`, etc.) — controllers `if (err.message === '...')` to
  pick the status code. This keeps services callable from anywhere (a route,
  a future CLI/seed script, a test) without re-deriving HTTP semantics.

## Auth
- `teacher_id` / `student_id` / any identity field on a write always comes
  from `req.user` (the verified JWT payload), **never** from `req.body`.
  Confirmed with the client which fields it may send; identity fields aren't
  among them.
- Role checks that matter for security exist in the **service layer**, even
  if a route-level `requireRole` also covers the common path (defense in
  depth — see architecture.md #13).
- Ownership checks (e.g. "does this teacher own this class") live in the
  service, not the controller — role-gating is routing logic, ownership is
  business logic (architecture.md #14).
- Protected routes: `requireAuth` first, `requireRole(...)` after, in that
  order, as separate composable middleware.

## Database
- Uniqueness is enforced at the DB level (`@@unique`), and the app layer
  **catches the resulting error** (Prisma `P2002`) rather than doing a
  check-then-create — check-then-create has a race condition, catching the
  constraint doesn't (architecture.md #15).
- Never hand-edit an already-applied migration. New SQL Prisma can't express
  → new migration via `prisma migrate dev --create-only`.

## Environment variables
- Never read `process.env.X!` directly in application code. All env access
  goes through `src/config/env.ts`, which fails fast at boot with a clear
  error if something required is missing.

## API response shape
- Success: `{ <resourceName>: ... }` or `{ <resourceNamePlural>: [...] }` —
  e.g. `{ class: {...} }`, `{ classes: [...] }`, `{ enrollment: {...} }`.
- Error: always `{ error: "<human-readable message>" }`, never a bare string
  or a differently-shaped object.

## Frontend
- Always use the existing `apiFetch` (`src/lib/api-client.ts`) and `useAuth`/
  `useRequireAuth` (`src/lib/auth-context.tsx`, `src/lib/use-require-auth.ts`).
  Never introduce a second token/auth mechanism, even for a single page.
- Access token lives in memory only. Never write it to `localStorage`,
  `sessionStorage`, or a JS-readable cookie (architecture.md #16).
- Pages: `'use client'`, explicit `isLoading` / `error` states as separate
  early returns before the main render, Tailwind utility classes only (no
  component library introduced yet), styling consistent with existing pages
  (`max-w-*`, `border rounded`, `bg-black text-white` for primary buttons).

## Testing workflow
- New backend endpoint → curl-test every role/permission boundary explicitly
  (allowed role succeeds, disallowed role gets 403, ownership violations get
  403, not-found gets 404, conflicts get 409) **before** wiring the frontend.
- Frontend page → browser-test both the happy path and each distinct backend
  response the page has to handle (e.g. 201 vs 409 on enroll).