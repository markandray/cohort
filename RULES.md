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
  `'NOT_CLASS_OWNER'`, `'INVALID_INVITE'`, etc.) — controllers
  `if (err.message === '...')` to pick the status code. This keeps services
  callable from anywhere (a route, a CLI/seed script, a test) without
  re-deriving HTTP semantics.

## Auth
- `teacher_id` / `student_id` / any identity field on a write always comes
  from `req.user` (the verified JWT payload), **never** from `req.body`.
  Confirmed with the client which fields it may send; identity fields aren't
  among them.
- A user's **role is never read from the request body**. Public signup takes
  no role and always creates a `STUDENT`. `TEACHER`/`ADMIN` accounts come only
  from a valid invite, and the role is read from the invite row
  (architecture #13, #23 to #26).
- Secrets that grant access (invite codes) are generated with
  `crypto.randomBytes`, stored only as a hash, and shown to the creator once.
  Unknown, expired and already-used codes return one identical error so the
  endpoint can't be used to probe which codes exist.
- Role checks that matter for security exist in the **service layer**, even
  if a route-level `requireRole` also covers the common path (defense in
  depth — see ARCHITECTURE.md #13).
- Ownership checks (e.g. "does this teacher own this class") live in the
  service, not the controller — role-gating is routing logic, ownership is
  business logic (ARCHITECTURE.md #14).
- Protected routes: `requireAuth` first, `requireRole(...)` after, in that
  order, as separate composable middleware.

## Database
- Uniqueness is enforced at the DB level (`@@unique`), and the app layer
  **catches the resulting error** (Prisma `P2002`) rather than doing a
  check-then-create — check-then-create has a race condition, catching the
  constraint doesn't (ARCHITECTURE.md #15).
- "Claim a resource exactly once" operations (redeeming an invite) use a
  conditional `updateMany` inside a transaction and check the affected row
  count. Never read-then-update (ARCHITECTURE.md #25).
- Never hand-edit an already-applied migration. New SQL Prisma can't express
  → new migration via `prisma migrate dev --create-only`.
- A new model needs three things beyond the schema: the migration, the table
  added to `TABLES` in `src/tests/db.ts`, and the migration applied to the
  test database (ARCHITECTURE.md T6).

## Environment variables
- Never read `process.env.X!` directly in application code. All env access
  goes through `src/config/env.ts`, which fails fast at boot with a clear
  error if something required is missing.
- Exception: standalone scripts (`src/scripts/*`) and `config/database.ts`
  may read the specific variables they need directly, so they don't require
  the full app configuration (Redis, JWT secrets). They must still fail loudly
  if a variable is missing.

## API response shape
- Success: `{ <resourceName>: ... }` or `{ <resourceNamePlural>: [...] }` —
  e.g. `{ class: {...} }`, `{ classes: [...] }`, `{ enrollment: {...} }`.
- Error: always `{ error: "<human-readable message>" }`, never a bare string
  or a differently-shaped object.
- Responses that carry a one-time secret set `Cache-Control: no-store`.

## Frontend
- Always use the existing `apiFetch` (`src/lib/api-client.ts`) and `useAuth`/
  `useRequireAuth` (`src/lib/auth-context.tsx`, `src/lib/use-require-auth.ts`).
  Never introduce a second token/auth mechanism, even for a single page.
- Access token lives in memory only. Never write it to `localStorage`,
  `sessionStorage`, or a JS-readable cookie (ARCHITECTURE.md #16).
- Pages: `'use client'`, explicit `isLoading` / `error` states as separate
  early returns before the main render.
- **Styling goes through the shared components** in `src/components/ui`
  (`Button`, `Card`, `Badge`, `Field` / `Input` / `Select` / `Textarea`,
  `ListCard` / `ListRow`, `PageContainer` / `PageHeader` / `Section` / `Empty`)
  and the semantic tokens in `globals.css` (`bg-surface`, `text-muted`,
  `border-line`, `text-danger`, ...). Do not hand-write `border rounded px-3
  py-2` or raw `text-red-600` / `text-gray-500` on a page. If a pattern is
  missing, add it to the shared components instead.
- **Data loading**: define the async loader *inside* the `useEffect` that
  calls it, and never call setState synchronously in an effect body (the
  `react-hooks/set-state-in-effect` lint rule enforces this). Loading flags
  start `true` and only ever flip to `false`. To refetch after a mutation,
  bump a `reloadKey` state that the effect depends on; don't call a loader
  from a handler.
- **No `any`.** Type API payloads, or use `unknown` and narrow. `gqlFetch`
  takes an explicit type argument.
- Forms are real `<form onSubmit>` elements with labelled fields (`Field`),
  so Enter submits and screen readers get labels. Error messages use
  `role="alert"`.
- Client-side role gating (redirects, hidden nav links) is UX only. The API
  must enforce the same rule (ARCHITECTURE.md #28).
- Before committing frontend work: `npm run lint && npm run build`.

## Testing workflow
- New backend endpoint → curl-test every role/permission boundary explicitly
  (allowed role succeeds, disallowed role gets 403, ownership violations get
  403, not-found gets 404, conflicts get 409) **before** wiring the frontend.
- Every new endpoint also gets Jest + Supertest coverage of the same
  boundaries, run with `npm test` in `server/`. Concurrency-sensitive paths
  (e.g. invite redemption) get an explicit concurrent test.
- Frontend page → browser-test both the happy path and each distinct backend
  response the page has to handle (e.g. 201 vs 409 on enroll), once per role
  that can reach it.