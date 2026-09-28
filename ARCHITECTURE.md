# Cohort — Architecture Decisions

A running log of the "why" behind each major decision. Updated as the project evolves.

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
**Decision:** `User.role` as an enum: `STUDENT | TEACHER | ADMIN`. Admin isn't
in the MVP UI but exists in the schema.
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
**Decision:** Signup only ever creates `STUDENT` accounts — the client cannot
choose a role, not even from an allow-list. `TEACHER`/`ADMIN` creation is
deferred to a future Admin feature (manual DB promotion in the meantime).
The allowed-roles check additionally exists in the service layer (not just
the controller), so any future caller of `authService.signup()` — a script,
a CLI, another route — can't bypass it by skipping the HTTP layer.
**Why:** A privilege-escalation-at-signup bug is exactly the kind of thing
that's cheap to prevent now and expensive to discover later. Defense in depth
(same rule enforced at two layers) is a real pattern worth demonstrating, not
redundant work — the controller guards the common path, the service guards
against any path.

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