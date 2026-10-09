# Cohort — Product Requirements

## Problem
Students and teachers currently coordinate classwork across scattered tools
(chat apps, email, paper). Cohort is a single platform where a class's
roster, assignments, submissions, and informal study coordination live
together.

## Users
- **Student** — enrolls in classes, views and submits assignments, sees
  grades and feedback, forms study groups, keeps personal notes, and sees
  upcoming and overdue work on a dashboard.
- **Teacher** — creates and manages their own classes, views enrolled
  students, creates assignments, reviews and grades submissions. Teacher
  accounts are created through an admin-issued invite code.
- **Admin** — platform-level oversight: a dashboard of platform-wide counts,
  and management of invite codes (create, list, revoke) that grant teacher or
  admin accounts. The first admin is created from the command line
  (see architecture #27).

## Features

### Implemented
- **Auth** — student self-signup; teacher and admin accounts via admin-issued
  invite codes; login, logout, silent session restore. Short-lived access
  tokens are refreshed from an httpOnly cookie, and refresh tokens are revoked
  at logout.
- **Classes** — teachers create classes with a shareable class code. Listing
  is role-scoped: students see classes they are enrolled in, teachers see
  classes they teach, admins see all (architecture #18).
- **Enrollment** — students join by class code or class id; duplicate
  enrollment is rejected; the owning teacher (or an admin) can view a class's
  roster.
- **Assignments and grading** — teachers create assignments on a class;
  students submit text and/or a link and can resubmit; teachers and admins
  grade submissions (0-100) with optional feedback; students see their grade
  and feedback.
- **Study groups** — students create, join and leave groups within a class;
  the creator can rename or delete the group.
- **Notes** — personal notes, optionally tied to a class; create, edit and
  delete.
- **Dashboards** (GraphQL, the one place it is used — architecture #2) — a
  different view per role: upcoming and overdue work, grades and groups for
  students; the grading queue and upcoming deadlines for teachers; platform
  counts for admins.
- **Admin tooling** — invite management UI and a bootstrap script for the
  first admin.

### Planned (not yet built)
- Personal custom deadlines. The `Deadline` model exists in the schema, but
  there is no API or UI for creating them yet; dashboards currently show
  assignment due dates only.
- Promoting an existing user's role (invite codes currently cover account
  creation only).
- Password reset and email verification.
- Rate limiting on auth endpoints.
- Dark mode.

### Explicitly out of scope for now
Notifications, direct messaging, attendance tracking, a calendar view,
quizzes, course materials/file storage, grades as a concept separate from
`Submission.grade`, comments, and any AI-assisted features. Revisit only when
a concrete feature need arises — see architecture #8 on scope discipline.

## Known limitations
- No rate limiting on login or signup. Invite codes are 256-bit random values,
  so guessing one is not feasible, but password guessing is not throttled.
- No password reset or email verification.
- Submissions are text and links only; there is no file upload or storage.
- Logging out revokes the refresh token, but an already-issued access token
  stays valid until it expires (up to 15 minutes). This is a deliberate
  tradeoff (architecture #12).
- Invite codes cannot be recovered after creation; a lost code has to be
  revoked and replaced.

## Non-goals
- Multi-tenant/white-label support.
- Payment or billing of any kind.
- Native mobile apps — web only.