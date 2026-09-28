# Cohort — Product Requirements

## Problem
Students and teachers currently coordinate classwork across scattered tools
(chat apps, email, paper). Cohort is a single platform where a class's
roster, assignments, submissions, and informal study coordination live
together.

## Users
- **Student** — enrolls in classes, views/submits assignments, forms study
  groups, keeps personal notes and deadlines.
- **Teacher** — creates and manages their own classes, views enrolled
  students, creates assignments, reviews/grades submissions.
- **Admin** — platform-level oversight (not user-facing yet; exists in the
  schema and permission model for future use — see architecture.md #5).

## Features

### Implemented
- **Auth** — signup (student-only self-serve), login, logout, silent session
  restore, access/refresh token rotation.
- **Classes** — teacher creates a class; any authenticated user can list/view
  classes.
- **Enrollment** — student self-enrolls in a class via its id; duplicate
  enrollment is rejected; a student can view their own enrollments; the
  owning teacher (or an admin) can view a class's roster.

### Planned (not yet built)
- Assignments — teacher creates assignments on a class; students view and
  submit; teacher grades.
- Study Groups — students form/join informal groups within a class.
- Notes & Deadlines — personal, optionally tied to a class or assignment.
- Admin tooling — proper teacher account creation/promotion (currently done
  by hand in the DB), platform-level management.
- Dashboard — aggregated view (assignments, deadlines, notes, group
  activity) — the one place GraphQL is used (architecture.md #2).

### Explicitly out of scope for now
Notifications, direct messaging, attendance tracking, a calendar view,
quizzes, course materials/file storage, grades as a concept separate from
`Submission.grade`, comments, and any AI-assisted features. Revisit only when
a concrete feature need arises — see architecture.md #8 on scope discipline.

## Non-goals
- Multi-tenant/white-label support.
- Payment or billing of any kind.
- Native mobile apps — web only.