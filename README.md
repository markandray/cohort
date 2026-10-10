# Cohort

![CI](https://github.com/markandray/cohort/actions/workflows/ci.yml/badge.svg)

**A full-stack classroom platform** where teachers manage classes and assignments, students submit work and track grades, and admins control how privileged accounts are created.

Cohort is a portfolio project built around engineering decisions, not only features. [ARCHITECTURE.md](ARCHITECTURE.md) records why each major choice was made, covering authentication, database integrity, concurrent invite redemption, testing, and deployment. See also [PRD.md](PRD.md) for scope and [RULES.md](RULES.md) for conventions.

<!--
Uncomment once the images are in docs/screenshots/:

![Student dashboard](docs/screenshots/student-dashboard.png)
![Grading a submission](docs/screenshots/grading.png)
![Admin invites](docs/screenshots/admin-invites.png)
-->

## Features

### Students

* Join classes using class codes.
* Submit assignments, resubmit work, and view grades and feedback.
* Create and join study groups within a class.
* Keep personal notes, optionally tied to a class.
* Track upcoming assignments, overdue work, grades, classes, and study groups from a dashboard.

### Teachers

* Create classes and assignments.
* View class rosters and student submissions.
* Grade submissions on a 0-100 scale with feedback.
* See ungraded submissions and upcoming deadlines on a dashboard.

### Admins

* View platform-wide statistics.
* Create teacher and admin invitations with configurable expiry.
* See invite status and revoke unused invitations.
* Bootstrap the first admin from the command line, with no public registration path to a privileged role.

## Tech stack

| Layer | Technologies |
| --- | --- |
| Frontend | Next.js App Router, React, TypeScript, Tailwind CSS v4 |
| Backend | Node.js, Express 5, TypeScript |
| API | REST for resources, GraphQL (Apollo Server) for the role-based dashboard |
| Database | PostgreSQL, Prisma 7 with the PostgreSQL driver adapter |
| Token revocation | Redis |
| Authentication | JWT access and refresh tokens, bcrypt, HTTP-only refresh cookie |
| Testing | Jest and Supertest against real PostgreSQL and Redis |
| Infrastructure | Docker, Terraform, AWS (ECS Fargate, RDS, ECR) |
| CI/CD | GitHub Actions, AWS authentication through GitHub OIDC |

## Architecture

```mermaid
flowchart LR
  Browser["Browser<br/>Next.js client"] -->|REST + Bearer token| API["Express API<br/>REST + GraphQL dashboard"]
  API --> PG[("PostgreSQL<br/>via Prisma")]
  API --> Redis[("Redis<br/>refresh-token blacklist")]
```

Authentication and authorization run as middleware in front of every protected route. REST handles resource operations, and GraphQL powers the role-based dashboard.

```text
cohort/
├── client/       Next.js frontend (shared UI components in src/components/ui)
├── server/       Express API, Prisma schema and migrations, tests
├── terraform/    AWS infrastructure as code
├── .github/      GitHub Actions workflows
├── ARCHITECTURE.md
├── RULES.md
├── PRD.md
└── README.md
```

## Engineering decisions

The full log is in [ARCHITECTURE.md](ARCHITECTURE.md). A few highlights:

* **Invite-based privileged onboarding.** Invite codes are 256-bit random values stored only as SHA-256 hashes. Redemption runs in a single transaction with a conditional update, so two concurrent signups cannot both claim the same invite. The role is enforced in the service layer, the API, and a database `CHECK` constraint.
* **Access tokens stay in memory.** Nothing auth-related is written to `localStorage`. Sessions are restored through the HTTP-only refresh cookie.
* **Database constraints protect integrity.** Duplicate enrollment is caught from the unique-constraint error instead of a race-prone check-then-insert.
* **Migrations are a separate deploy step.** The application never migrates on boot, which removes a race between containers starting at the same time.
* **Tests use real infrastructure.** Backend integration tests run against PostgreSQL and Redis instead of mocks.
* **A failing OIDC handshake was debugged from evidence.** When every component checked out individually, decoding the real token showed the subject claim used a different format than the documentation assumed.

## Getting started

### Prerequisites

* Node.js 20 or later
* Docker and Docker Compose
* npm

### 1. Start PostgreSQL and Redis

From the repository root:

```bash
docker compose up -d
```

### 2. Configure and start the backend

Create `server/.env`, using the database credentials from your Docker Compose file:

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/DBNAME
REDIS_URL=redis://localhost:6379
JWT_ACCESS_SECRET=replace-with-a-secure-secret
JWT_REFRESH_SECRET=replace-with-another-secure-secret
CORS_ORIGIN=http://localhost:3000
PORT=5000
```

Install dependencies, apply migrations, and start the server:

```bash
cd server
npm install
npx prisma migrate deploy
npm run dev
```

The API listens on port 5000 by default.

### 3. Create the first admin

Admin accounts are bootstrapped from the command line, never through a public endpoint:

```bash
cd server
ADMIN_EMAIL=you@example.com \
ADMIN_PASSWORD='a-strong-password-of-at-least-12-characters' \
npm run create-admin
```

Log in with that account, open **Invites**, and generate a teacher invite. Student signup needs no invite code.

### 4. Configure and start the frontend

Create `client/.env.local`:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:5000
```

Then:

```bash
cd client
npm install
npm run dev
```

Open http://localhost:3000.

## Testing

### Backend

The suite covers authentication, authorization, enrollment, submissions and grading, notes, study groups, dashboard queries, invite management, and concurrent invite redemption.

It needs PostgreSQL, Redis, and a dedicated database configured in `server/.env.test`. **The suite truncates every table, so never point it at a database whose data you want to keep.**

```bash
cd server
npx prisma migrate deploy   # run against the test database first
npm test
```

### Frontend

```bash
cd client
npm run lint
npm run build
```

## CI/CD and deployment

### Continuous integration

The GitHub Actions workflow starts PostgreSQL and Redis service containers, applies the real migrations, runs the full backend suite, lints and builds the frontend, and verifies that both production Docker images build.

### AWS infrastructure

Terraform defines the deployment environment: VPC, ECS Fargate, RDS, Redis, ECR, IAM, SSM parameters, and CloudWatch. It is provisioned on demand for demonstrations and destroyed afterward, not left running.

GitHub Actions authenticates to AWS through OIDC, so no long-lived AWS keys are stored in GitHub secrets.

### Migrations and first-admin creation

Production images are multi-stage builds. Schema migrations and the first-admin script are separate one-off operations, designed to run as one-off ECS tasks using the same image with the command overridden. Neither runs when application containers start.

## Roadmap

* Dark mode (the UI is built on semantic design tokens, so this is one additional theme block)
* Rate limiting on authentication endpoints
* Password reset and email verification
* Promoting an existing user's role