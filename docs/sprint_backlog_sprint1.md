# Sprint 1 Backlog – IKJIN EMS (Foundation Sprint)
**Sprint Length**: 2 weeks  
**Sprint Goal**: Establish baseline architecture, authentication, and environment to unblock expense workflow development.

## 1. User Stories
- **US-001**: _As an IKJIN employee, I can log in with my credentials so that I can access my role-based dashboard._
  - Acceptance Criteria:
    - Basic login form + validation.
    - JWT issued with role/permissions claims.
    - Failed login surfaces error without leaking details.
- **US-002**: _As an HQ admin, I can seed initial users and sites so that I can onboard the first pilot team._
  - Acceptance Criteria:
    - DB migrations for `users`, `roles`, `sites`.
    - CLI or script to seed sample data.
    - Admin endpoint to list users/sites.
- **US-003**: _As a developer, I have CI/CD pipelines so that each commit is validated automatically._
  - Acceptance Criteria:
    - Lint/test workflows for frontend & backend.
    - Dockerized dev environment.
    - Branch protection rules documented.

## 2. Backlog Items & Estimates
| ID | Type | Description | Owner | Estimate |
| --- | --- | --- | --- | --- |
| DEV-101 | FE | Next.js project scaffolding, ESLint/Prettier setup | FE1 | 3 pts |
| DEV-102 | FE | Auth pages (login, forgot password placeholder) | FE2 | 5 pts |
| DEV-201 | BE | NestJS project scaffolding, env config, Swagger baseline | BE1 | 5 pts |
| DEV-202 | BE | Prisma schema for core tables (`users`, `sites`, `roles`) | BE2 | 3 pts |
| DEV-203 | BE | Auth module (login, JWT, RBAC guard) | BE1 | 8 pts |
| DEV-301 | Infra | Docker Compose (frontend, backend, Postgres, Redis) | DevOps | 5 pts |
| DEV-302 | Infra | GitHub Actions (build/test/lint) | DevOps | 5 pts |
| QA-101 | QA | Test plan outline + smoke checklist | QA | 2 pts |
| UX-101 | UX | Update design tokens + layout guidelines | UX | 3 pts |

## 3. Sprint Deliverables
- Running dev environment with seeded data.
- Authenticated entry point landing on role-based placeholder pages.
- CI pipeline passing on main branches.
- Documentation update: setup guide, env variables, seed instructions.

## 4. Dependencies & Notes
- Confirm SMTP credentials for auth (password reset email) – may be stubbed this sprint.
- Coordinate with Supabase team for site/user data export (read-only) to align schemas.
- Security review scheduled end of sprint to validate RBAC foundations.

## 5. Risks
- Delay in SMTP credentials → mitigation: use console logging mailer for dev.
- Scope creep into expense forms; keep sprint focused on foundation artifacts.
- Docker networking issues on certain developer machines → provide troubleshooting doc.
