# Cohort — Architecture Decisions

A running log of the "why" behind each major decision. Updated as the project evolves.

See also: [Tooling & CI Decisions](#tooling--ci-decisions) below, for
build/test/deploy-process decisions as opposed to application architecture.

## 1. Repo Structure — Monorepo
**Decision:** Single repo with `/client` and `/server` folders, not separate repos.
**Why:** Solo developer, no independent deploy cadence or team boundary that would
justify the overhead of separate repos. One `docker-compose.yml`, one CI pipeline,
frontend and backend versioned together. Separate repos earn their cost when
different teams ship on different schedules — doesn't apply here.

## 2. API Style — REST + GraphQL split
**Decision:** GraphQL for the dashboard endpoint only. REST for everything else
(auth, CRUD on assignments/classes/notes/groups).
**Why:** The dashboard aggregates heterogeneous data (assignments, deadlines,
notes, group activity) in one view — the textbook case for GraphQL's client-
specified queries, avoiding over/under-fetching. Everything else is plain
resource CRUD where REST's simplicity wins and GraphQL's schema/resolver
overhead isn't justified.

## 3. Caching — Redis for query caching, not sessions
**Decision:** Redis caches expensive/frequent reads (dashboard aggregation).
Auth stays stateless via JWT — no server-side session store.
**Why:** JWTs are stateless by design; a session store would fight that pattern.
The dashboard query is the clear Week 1 caching target. A refresh-token
blacklist (for logout/revocation) is a likely future addition.

## 4. Database Layer — Prisma, not raw SQL
**Decision:** Prisma ORM over PostgreSQL, unlike IMS (which deliberately uses
raw SQL for DBMS learning).
**Why:** IMS already demonstrates raw SQL competency. Cohort's role in the
portfolio plan is breadth — new tools, not repetition. Prisma pairs naturally
with the TypeScript stack (generated types from schema) and generated SQL can
still be inspected when deeper explanation is needed.

## 5. Roles — Student, Teacher, Admin (enum)
**Decision:** `User.role` as an enum: `STUDENT | TEACHER | ADMIN`. Admin now has
an invite-management UI (see #23); the rest of the admin surface is still the
dashboard stats.
**Why:** "Class management" requires someone creating classes/assignments —
a single-role model doesn't fit the domain. Admin is cheap to include now,
expensive to retrofit later if platform-level management is ever needed.

## 6. Schema constraints — enforced deliberately, not everywhere
**Decision:** Uniqueness constraints on `Enrollment(student_id, class_id)`,
`GroupMember(group_id, student_id)`, `Submission(assignment_id, student_id)`.
Indexes placed on foreign keys and frequent filter/sort columns only
(e.g. `Assignment.due_date`, `Deadline(user_id, due_date)`), not blanket-indexed.
**Why:** Prevents duplicate enrollment/membership/submission at the DB level
rather than trusting application logic alone. Indexing was scoped to actual
query patterns — a decision worth being able to explain, not a default.

## 7. Deadline source invariant — app layer + DB CHECK
**Decision:** `Deadline.source` (`ASSIGNMENT | CUSTOM`) determines whether
`related_assignment_id` is required or must be null. Enforced both in
application validation and via a hand-added PostgreSQL `CHECK` constraint
in the Prisma migration (Prisma's schema language can't express conditional
requiredness declaratively).
**Why:** DB constraint is the real source of truth (correctness even if the
app layer has a bug); app-layer check gives a cleaner error message to the
client. Documents a real Prisma limitation and how it was worked around.

## 8. Scope discipline — no speculative tables
**Decision:** Locked MVP schema: `User, Class, Enrollment, Assignment,
Submission, StudyGroup, GroupMember, Note, Deadline`. Deliberately excluded
for now: Notifications, Messages, Attendance, Calendar, Quizzes,
CourseMaterials, Grades (separate from Submission.grade), Comments, AI tables.
`Invite` was added later, when the privileged-account-creation feature was
actually built (see #23).
**Why:** Add tables when features are actually being built, not speculatively.
Avoids an over-engineered schema for a product that doesn't exist yet.

## 9. Prisma 7 — driver adapter required (breaking change from docs/tutorials)
**Decision:** Removed `url` from `schema.prisma`'s `datasource` block; connection
string now lives in `prisma.config.ts` (for the CLI) and is passed explicitly
to `PrismaClient` via `@prisma/adapter-pg` in `src/config/database.ts` (for
runtime). All app code imports the shared `prisma` instance from there.
**Why:** Prisma 7 removed inline datasource URLs in favor of explicit driver
adapters — `prisma validate` failed with `P1012` until this was restructured.
Most tutorials/AI-generated examples still assume the pre-7 pattern (`url`
directly in schema.prisma), so this required reading current Prisma docs
rather than trusting existing knowledge. A real example of a breaking change
in a fast-moving tool, and how to work through one via the official docs
when cached knowledge is stale.

## 10. Deadline source invariant — follow-up migration, not a schema edit
**Decision:** The `CHECK` constraint enforcing `source = ASSIGNMENT →
related_assignment_id required` / `source = CUSTOM → related_assignment_id
null` was added as a **separate migration** (`add_deadline_source_check`)
generated with `prisma migrate dev --create-only`, not by hand-editing the
already-applied `init` migration.
**Why:** Prisma tracks applied migrations by content — editing a migration
file after it's been applied desyncs the migration history from what's
actually in the database. The correct pattern for "add SQL Prisma can't
express" is a new `--create-only` migration with hand-written SQL, applied
normally afterward. Verified by attempting an inserting row that violates
the constraint and confirming Postgres rejects it.

## 11. Auth tokens — short-lived access JWT + long-lived refresh JWT
**Decision:** Access token (15 min expiry) sent as a `Bearer` header, verified
statelessly by middleware on every protected request. Refresh token (7 day
expiry) stored only in an `httpOnly`, `SameSite=Lax` cookie scoped to
`/api/auth`, used solely to mint new access tokens via `POST /api/auth/refresh`.
Two separate JWT secrets (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`).
**Why:** Matches the Redis-blacklist future-addition flagged in decision #3 —
access tokens stay fully stateless (no Redis check on every request), while
the refresh token is the one artifact actually revoked at logout. Two secrets
mean a leak of one token type doesn't compromise the other. `httpOnly` keeps
the refresh token unreadable to JS, mitigating XSS token theft.

## 12. Logout — Redis blacklist keyed by refresh-token `jti`, TTL-matched
**Decision:** Logout decodes the refresh token's `jti` (unique ID) and `exp`,
and writes `blacklist:<jti>` to Redis with a TTL equal to the token's
remaining lifetime. `refreshAccessToken` checks this blacklist before issuing
a new access token; `requireAuth` (access-token verification) does not.
**Why:** Fulfills the Redis-for-revocation plan from decision #3. TTL-matching
means Redis auto-expires blacklist entries exactly when the token itself
would've expired anyway — no manual cleanup job needed. Blacklisting only
refresh tokens (not access tokens) is a deliberate tradeoff: revocation takes
effect within at most 15 minutes (the access token's remaining life), not
instantly — acceptable for this app, and worth being able to explain as a
real security/performance tradeoff rather than an oversight.

## 13. Role enforcement — defense in depth, not just at the route
**Decision:** Public signup can only ever create `STUDENT` accounts, and the
client never chooses a role: any `role` field in the request body is ignored.
`TEACHER`/`ADMIN` accounts come only from a valid invite (see #23), and the
role is read from the invite row, not from the caller. `authService.signup()`
no longer accepts a role parameter at all, so no caller (a script, a CLI,
another route) can request a privileged role by skipping the HTTP layer.
**Why:** A privilege-escalation-at-signup bug is cheap to prevent now and
expensive to discover later. The original version of this decision enforced an
allow-list of roles at two layers (controller and service). Invites made a
stronger version possible: remove the role input entirely, so there is nothing
to validate or bypass. The defense-in-depth principle stays (see #26 for the
layers on privileged roles); the mechanism got simpler. Supersedes the earlier
"manual DB promotion in the meantime" plan.

## 14. Ownership checks live in the service layer, not the controller
**Decision:** `requireRole('TEACHER', 'ADMIN')` middleware proves *a* teacher
is calling the class-roster endpoint; it can't prove *that* teacher owns
*that* class. The actual ownership check (`class.teacher_id === req.user.userId`,
bypassed for `ADMIN`) lives inside `class.service.ts`, not
`class.controller.ts`.
**Why:** Role-gating is routing logic (who's allowed to hit this URL at all);
ownership is business logic (what this specific request is allowed to touch).
Keeping ownership in the service means the rule is enforced identically no
matter what calls the service — consistent with decision #13's defense-in-depth
reasoning.

## 15. Duplicate enrollment — DB constraint is the source of truth, not a pre-check
**Decision:** `enrollStudent()` doesn't `findFirst` to check for an existing
enrollment before creating one. It attempts the `create` directly and catches
Prisma error code `P2002` (unique constraint violation on
`Enrollment(student_id, class_id)`, per decision #6), translating it into a
`409 Already enrolled` response.
**Why:** A check-then-create has a race condition — two near-simultaneous
requests can both pass the check before either writes. Letting the DB
constraint be the actual enforcement point, and catching its failure, is
race-free by construction. The app layer's job is to translate the DB's
answer into a good HTTP response, not to duplicate the DB's guarantee.

## 16. Access token storage — in-memory only, not localStorage or a readable cookie
**Decision:** The frontend keeps the access token in a module-level JS
variable (`src/lib/api-client.ts`), exposed through React Context
(`AuthProvider`/`useAuth`). Nothing auth-related is written to `localStorage`
or `sessionStorage`. On page load/reload, the token is gone by design — it's
silently reconstructed by calling `/api/auth/refresh` (which relies on the
`httpOnly` cookie from decision #11) before the app renders anything
auth-dependent.
**Why:** `localStorage` is readable by any JS running on the page, making it
the classic XSS token-theft vector. In-memory storage means a token can only
be exfiltrated by code running *in that exact render*, not by any injected
script reading storage later. The cost — losing the token on refresh — is
paid back by the silent-refresh flow, which is why the refresh-token cookie
exists in the first place.

## 17. Protected-page auth — client-side redirect hook, not Next.js middleware
**Decision:** Unauthenticated visits to `/classes` and `/classes/:id` are
handled by a `useRequireAuth()` hook (wraps `useAuth()`, redirects to
`/login` via `router.push` once loading finishes with no user) — not by
`src/middleware.ts`.
**Why:** Next.js middleware runs before the page renders and can only inspect
things available at that point — cookies, headers. The access token
deliberately isn't in a cookie (decision #16), so middleware has no reliable
signal to check; it could only approximate "probably logged in" via the
refresh cookie's mere presence, which isn't a real auth check. A client-side
hook, running after `AuthProvider`'s silent-refresh resolves, has the actual
answer. Choosing the weaker (middleware) approach here would silently
undermine the in-memory-token decision it should be built on top of.

## 18. Class listing — backend-enforced role scoping, not a frontend filter
**Decision:** `GET /api/classes` branches its Prisma query by the caller's
role: `STUDENT` sees only classes they're enrolled in, `TEACHER` sees only
classes they teach, `ADMIN` sees everything, unfiltered. The existing
ID-based `POST /:id/enroll` endpoint was kept as-is rather than deprecated
once class-code joining shipped.
**Why:** Before this, any authenticated user could list — and then
self-enroll in — any class on the platform, since `listClasses` returned
everything unscoped. That's an unconventional design for a classroom app
(Google Classroom/Canvas don't let you browse a directory of every class
in the system) and made the class-code join flow a decorative shortcut
sitting next to a wide-open front door rather than the actual intended
discovery mechanism. The fix belongs in the service layer, not the
frontend, per decision #14's reasoning — a filtered UI is cosmetic if the
API itself still hands out everything to anyone who asks. `POST /:id/enroll`
stayed rather than being removed: a student who already knows a class ID
(e.g., shared outside the app) has no compelling reason to be blocked from
joining it, and removing a working endpoint isn't free — that's a separate
decision from closing the *listing* leak.

## 19. Production Docker images — multi-stage builds, Alpine base
**Decision:** Both `server/Dockerfile` and `client/Dockerfile` use a
three-stage build (`deps` → `build` → `runtime`), with the runtime stage
copying only compiled output and production dependencies. Both use
`node:20-alpine` as the base image.
**Why:** Alpine is the classic trap for Prisma projects — the native
query-engine binary Prisma normally downloads doesn't reliably support
Alpine's musl libc, and it's a common source of "works on my machine, fails
in the container" bugs. That risk doesn't apply here because of decision
#9: Cohort already uses Prisma's driver-adapter pattern (`@prisma/adapter-pg`
+ `pg`), which never fetches a platform-specific query-engine binary in the
first place. Multi-stage builds keep the shipped runtime image small — dev
dependencies, TypeScript source, and the Prisma CLI never make it past the
`build` stage.

## 20. `NEXT_PUBLIC_API_URL` — a Docker build arg, not a runtime env var
**Decision:** The client Dockerfile declares `NEXT_PUBLIC_API_URL` as a
build `ARG`, set as an `ENV` only for the duration of `next build`, and
passed in via Compose's `build.args` — not as a `runtime` environment
variable on the running container.
**Why:** Next.js inlines every `NEXT_PUBLIC_*` variable directly into the
compiled JavaScript bundle at build time; it is not read from `process.env`
when the container starts. Setting it as a normal runtime environment
variable (the instinctive Docker default) would silently do nothing — the
browser bundle would still contain whatever value was present, or absent,
at build time. This is a real Next.js/Docker gotcha worth being able to
explain, not an arbitrary Dockerfile choice.

## 21. Production migrations — a separate step, never automatic on app boot
**Decision:** The compiled server image never runs `prisma migrate deploy`
on startup. Migrations are applied as an explicit, separate step — today
that's a manual `npx prisma migrate deploy` run against the Compose
database; once deployed to ECS, the plan is a one-off Fargate task using
the same image with its command overridden, run before the long-running
app service is updated.
**Why:** ECS can and does run multiple instances of a service concurrently
even briefly during a routine rolling deployment. If every booting container
tried to apply pending migrations on startup, two containers starting near-
simultaneously could race to alter the same schema at once — a subtle,
hard-to-reproduce production bug. Decoupling "apply schema changes" from
"start serving traffic" removes that race by construction, the same
category of fix as decision #15's DB-constraint-over-pre-check reasoning.

## 22. Two real Docker build bugs — and what they revealed
**Decision:** Two issues surfaced getting the server image to build and run,
both fixed inside the Dockerfile rather than by changing application code:
(1) `prisma.config.ts`'s `env("DATABASE_URL")` is resolved eagerly the
moment the config file loads — even for `prisma generate`, which needs no
real database connection at all — so the `build` stage sets a dummy,
never-used `DATABASE_URL` just to satisfy that eager check; (2) `tsc` only
compiles `.ts` files, so `src/graphql/schema.graphql` was never copied into
`dist/`, crashing `typeDefs.ts`'s `readFileSync` call at runtime — fixed
with an explicit `cp` step after `npm run build`.
**Why:** Both are worth documenting because they weren't Docker-specific
bugs in disguise — they were latent bugs in the plain `npm run build` /
`node dist/index.js` path that had simply never been exercised before,
since local development always ran through `ts-node-dev` against `src/`
directly. Containerizing the app was what finally ran the real production
build path for the first time and surfaced both.

## 23. Privileged account creation — admin-issued invite codes
**Decision:** `TEACHER` and `ADMIN` accounts are created by signing up with a
valid invite code. Only an authenticated `ADMIN` can create, list, or revoke
invites (`/api/invites`, gated by `requireRole('ADMIN')`). Each invite is
single-use, role-bound, and expiring (1 hour to 30 days, 72 hours by default).
`STUDENT` stays public signup with no invite. Promoting an existing user's
role is deliberately not built yet.
**Why:** Three options were weighed. *Admin promotes existing users* is the
simplest, but a teacher has to exist as a student first, and there is no way to
create someone in the right role from the start. *Self-signup with an approval
queue* is the most realistic, but it needs a pending state, a review UI, and
notifications, which is far more scope than the gap justified. *Invite codes*
fit the app's existing vocabulary (class codes already work this way), need no
email infrastructure, and make the privileged role something an admin
explicitly grants, not something a user requests. Known tradeoffs: an admin can
mint other admin invites (acceptable, and still admin-only), codes are
delivered out of band by the admin, and there is no rate limiting on
`/signup` today (see #24 for why guessing a code is still infeasible).

## 24. Invite codes — 256 bits of randomness, stored as a SHA-256 hash, shown once
**Decision:** Codes are `crypto.randomBytes(32)` encoded as base64url. Only
`SHA-256(code)` is stored (`Invite.token_hash`, unique). The raw code exists
only in the create response (sent with `Cache-Control: no-store`) and, on the
client, only in React state. It cannot be recovered afterward.
**Why:** Storing only a hash means a database leak does not leak usable
invites, the same reasoning as password hashing. But SHA-256 and not bcrypt:
bcrypt is deliberately slow to make brute-forcing *low-entropy* secrets
(human-chosen passwords) expensive. A 256-bit random code has nothing to
brute-force, and we need a *deterministic* hash so the invite can be looked up
by it, which a salted bcrypt hash cannot do. This is a good example of
matching the primitive to the threat model, not applying "bcrypt everything."

## 25. Invite redemption — one transaction, a conditional update as the lock
**Decision:** Signup with an invite runs inside a single `prisma.$transaction`:
look up the invite by hash, create the user, then claim the invite with
`updateMany({ where: { id, used_at: null, expires_at: { gt: now } } })`. If the
update matches anything other than exactly one row, the transaction throws and
the just-created user is rolled back. A concurrent test asserts that two
simultaneous signups with one code produce exactly one user.
**Why:** A check-then-update ("is it unused? then mark it used") has the same
race as decision #15: two requests can both pass the check before either
writes. The conditional `UPDATE` makes the claim atomic: under Postgres'
default isolation, the second transaction blocks on the first's row lock, then
re-evaluates the `WHERE` and finds `used_at` already set, matching zero rows.
The user creation shares the transaction so a failed claim leaves no orphan
account, and a taken email (caught as `P2002`, see #15) leaves the invite
unburned.

## 26. Role integrity on privileged accounts — three independent layers
**Decision:** (1) The service reads the new user's role only from the invite
row, never from request input. (2) Invite creation validates the role against
`TEACHER | ADMIN`, so a `STUDENT` invite cannot be created through the API.
(3) A hand-written `CHECK ("role" IN ('TEACHER','ADMIN'))` on `Invite.role`,
added via a `--create-only` migration as in decision #10, makes the database
reject a `STUDENT` invite even if the API has a bug. Unknown, expired, and
already-used codes all return one identical error message.
**Why:** Same principle as #7 and #13: the database is the final source of
truth and the app layer gives the friendly path. The single generic error
avoids turning signup into an oracle that tells an attacker whether a guessed
code exists, has expired, or has been used.

## 27. First admin — a bootstrap script, never a public endpoint
**Decision:** The first `ADMIN` is created by `npm run create-admin`, reading
`ADMIN_EMAIL`/`ADMIN_PASSWORD` from the environment. It is idempotent
(re-running for an existing admin does nothing), refuses to touch an existing
non-admin account, and requires a password of at least 12 characters. It does
not import the app's `env` config, so it needs only `DATABASE_URL`. In
production it is planned to run as a one-off ECS task with the command
overridden, the same pattern as migrations in decision #21.
**Why:** Every privilege system has a chicken-and-egg problem: invites need an
admin, and an admin needs an invite. Solving it with an HTTP endpoint (even a
"first user only" one) creates an attack surface that exists in production
forever to solve a problem that occurs once. A script confines the privilege
to whoever already has infrastructure access. Refusing to silently promote an
existing account prevents the script from becoming an accidental
privilege-escalation tool.

## 28. Client-side role gating is UX, not security
**Decision:** The `/admin/invites` page redirects non-admins to `/dashboard`,
and the nav hides the Invites link from non-admins. Neither is relied on for
protection; every invite API route independently enforces `ADMIN` server-side.
**Why:** Anyone can edit client code or call the API directly. The redirect and
the hidden link only keep legitimate users from landing on a page that would
fail. This is the same layering as decisions #17 and #18: the client improves
the experience, the server holds the line.

---

# Tooling & CI Decisions

A separate log for decisions about how the project is built, tested, and
deployed — as opposed to the architecture decisions above, which are about
what Cohort itself does.

## T1. Dev and prod Docker Compose kept fully separate
**Decision:** `docker-compose.yml` (Postgres + Redis only, for fast local
iteration against `npm run dev:server`/`dev:client`) and
`docker-compose.prod.yml` (all four services, built from the real production
Dockerfiles) are two independent files, each declaring its own Compose
`name` so they can never collide.
**Why:** Containerized hot-reload for day-to-day development wasn't worth
trading away — rebuilding an image on every source change is slower than
`ts-node-dev`/`next dev`'s native reload, with no compensating benefit for
a solo developer. Production images are a genuinely separate concern (small,
immutable, security-hardened) best verified on their own before anything
touches AWS. The explicit `name:` field exists because of a real incident:
without it, both files shared the same default Compose project name and
identical service names (`postgres`, `redis`), so running the prod stack
silently replaced the running dev containers — dev data survived only
because it lived in a separate named volume, not because the collision was
harmless.

## T2. CI test environment — plain values, not GitHub Secrets
**Decision:** The GitHub Actions test job sets `DATABASE_URL`,
`REDIS_URL`, `JWT_ACCESS_SECRET`, and `JWT_REFRESH_SECRET` as plain,
hardcoded environment variables in the workflow file, pointing at
short-lived Postgres/Redis service containers spun up for that run only.
**Why:** None of these values are real credentials — the database and
Redis instance are destroyed the moment the job finishes, and the JWT
secrets sign tokens nobody but that same ephemeral run will ever verify.
GitHub Secrets exist to keep genuinely sensitive values (real AWS
credentials, the actual production JWT secrets) out of workflow logs and
history — using them here would add process overhead without adding any
real protection. This is a deliberate contrast with how AWS authentication
is planned (OIDC federation, no long-lived keys stored anywhere) once the
ECR push stage is built.

## T3. CI test job — service containers, not a mocked database
**Decision:** The `test` job runs real `postgres:16` and `redis:7-alpine`
containers as GitHub Actions services, applies actual Prisma migrations via
`prisma migrate deploy`, then runs the full Jest suite against them — no
mocking of the database or cache layer.
**Why:** Consistent with how local tests already worked (`server/.env.test`
pointing at the same Docker Compose Postgres/Redis used for dev), and it
means CI genuinely proves the same thing local `npm test` proves: that
migrations apply cleanly to an empty database and the app behaves correctly
against a real Postgres/Redis, not against a mocked approximation of one.

## T4. Docker build verification runs in CI, but doesn't push anywhere
**Decision:** A `docker-build` job runs after `test` passes, building both
the server and client production images with `push: false` — proving they
build successfully on every push/PR, without publishing anything to a
registry.
**Why:** Catches Docker-specific build failures (like the two documented in
decision #22) at commit time, before they'd otherwise surface only when
someone runs `docker compose -f docker-compose.prod.yml up --build`
locally, or worse, at actual deploy time. Actually pushing to ECR is
deliberately deferred to a second, manually-triggered workflow stage, built
only after Terraform provisions the ECR repositories and the IAM role
GitHub Actions will assume — provisioning AWS resources by hand ahead of
Terraform would undermine the point of managing infrastructure as code.

## T5. GitHub OIDC subject claims aren't a single universal format
**Decision:** The IAM role's trust policy condition matches the exact
`sub` claim GitHub Actions actually issues for this account/repo —
`repo:markandray@224986735/cohort@1392252379:ref:refs/heads/main` — via
`StringEquals`, rather than the commonly-documented
`repo:owner/repo:ref:...` pattern matched with `StringLike`.
**Why:** The first OIDC setup attempt used the classic, widely-documented
subject format and failed every time with `Not authorized to perform
sts:AssumeRoleWithWebIdentity`, despite the OIDC provider, IAM role, and
trust policy all being independently verified correct via the AWS CLI.
The actual cause only became visible by adding a temporary debug step that
fetched and decoded the real JWT GitHub issued for a live run — it used a
newer, immutable-ID-based subject format
(`repo:owner@ownerID/repo@repoID:ref:...`) instead of the name-based one
most tutorials and even AWS's own documentation examples show. This is a
real lesson in debugging distributed auth failures: when every component
checks out individually but the handshake still fails, stop reasoning
about what *should* be true and inspect the actual artifact (the token
itself) instead of the documentation's assumed shape of it.

## T6. Schema changes break every test suite until the test DB is migrated
**Decision:** Adding the `Invite` table also meant adding it to `resetDb()`'s
`TRUNCATE` list, and the new migration had to be applied to the test database
(`prisma migrate deploy` against `.env.test`) before any suite could pass.
**Why:** The first run after adding the feature failed all seven suites, not
just the new one: `resetDb()` truncated a table that did not exist yet in the
test DB, which failed every suite's setup. A leftover-state side effect then
also surfaced as unrelated `class_code` collisions. CI avoids this by
construction (decision T3: it applies real migrations to an empty database on
every run), but local test databases drift if migrations are not applied.