# Expense Management System – Architecture Blueprint

## 1. Overview
- **Goal**: Replace manual expense processing (paper/Excel) with a web-based platform that streamlines submissions, approvals, and reporting for up to 30 concurrent users.
- **Scope**: MVP focuses on authentication/authorization, expense intake, 3-step approval workflow, reporting with Excel export, and future-ready attachments.
- **User Roles**: `Submitter` (general employee), `SiteManager` (field approver), `HQAdmin` (final approver & system admin).

## 2. Key Requirements
- **Workflow States**: `Draft` → `PendingSiteApproval` → `PendingHQApproval` → `Approved` or `RejectedBySite` / `RejectedByHQ`.
- **Concurrency**: Support 24/7 availability with burst throughput (~30 users). Target <200 ms backend response for typical operations.
- **Auditability**: Track every mutation (timestamps, actors, comments).
- **Security**: Role-based access, per-site scoping, secure session handling, OWASP-aligned hardening.
- **Extensibility**: Allow future receipt file uploads (object storage).

## 3. Proposed Architecture

### 3.1 High-Level View
```
Front-End (React/Next.js or Vue/Nuxt) → REST/GraphQL API (NestJS/TypeScript) → PostgreSQL (primary store)
                                                           ↓
                                               Redis (cache & session store)
                                                           ↓
                                          Object Storage (AWS S3 / MinIO) – future use
```

### 3.2 Deployment Topology
- **Application Layer**: Containerized services (Docker), orchestrated via ECS/Kubernetes or Docker Compose for early stages.
- **Database Layer**: PostgreSQL with daily backups, point-in-time recovery enabled.
- **Cache/Session**: Redis for session tokens, rate limiting, and background job queues (email notifications).
- **File Storage Prep**: Configure object storage bucket and credentials but disable upload UI until phase 2.
- **CI/CD**: GitHub Actions pipeline running lint, tests, and deploy to staging/production.

## 4. Major Components
- **Auth Service**: Handles registration, login, password resets, MFA readiness; issues JWT access/refresh tokens and stores refresh tokens in Redis.
- **User & Site Management**: CRUD for users, mapping to `Site` entities. Only HQ admins can manage global settings; site managers can manage users for their sites if granted.
- **Expense Service**: Manages expense headers and line items, drafts, submissions, and revisions post-rejection.
- **Approval Workflow Engine**: Encapsulates state machine transitions, assigns approvers by site, logs comments, supports batch approvals.
- **Reporting & Export Module**: Shared filters, server-side pagination, XLSX export (streaming to avoid memory spikes).
- **Notification Module**: Email/SMS hooks for status changes (implement email first; SMS optional).

## 5. Data Model (Core Tables)
| Table | Key Fields | Notes |
| --- | --- | --- |
| `users` | `id`, `email`, `password_hash`, `role`, `site_id`, `status`, `last_login_at` | Role enum: submitter/site_manager/hq_admin. `site_id` nullable for HQ. |
| `sites` | `id`, `name`, `code`, `address`, `is_active` | Site managers scoped by this table. |
| `expenses` | `id`, `user_id`, `site_id`, `status`, `submitted_at`, `total_amount`, `purpose_detail`, `current_step`, `version` | Represents a singular expense request (header). |
| `expense_items` | `id`, `expense_id`, `category`, `amount`, `usage_date`, `vendor`, `description` | Line items captured at submission. |
| `approvals` | `id`, `expense_id`, `step`, `approver_id`, `action`, `comment`, `acted_at` | Tracks each decision; `step` values 1/2/3; `action` enum pending/approved/rejected. |
| `drafts` | `id`, `user_id`, `payload`, `updated_at` | JSON blob storing partially completed forms for draft feature. |
| `audit_logs` | `id`, `entity_type`, `entity_id`, `action`, `actor_id`, `payload`, `created_at` | Uniform auditing. |
| `attachments` (future) | `id`, `expense_id`, `file_key`, `file_name`, `file_size`, `content_type`, `uploaded_at` | `file_key` references object storage path. |

> **Indexes**: `expenses(site_id, status)`, `approvals(expense_id, step)`, `drafts(user_id)`, `audit_logs(entity_type, entity_id)` to keep filtering performant.

## 6. Workflow Design
- **Draft (submitter)**: Save partial data in `drafts`; no approval records yet.
- **Submit**: Create/update `expenses` and `expense_items`, set `status=PendingSiteApproval`; enqueue notification for site manager(s).
- **Site Approval**:
  - Actions: `Approve`, `Reject`, `BatchApprove`, `BatchReject`.
  - On approve: log to `approvals`, transition to `PendingHQApproval`.
  - On reject: set `status=RejectedBySite`, require comment, notify submitter.
- **HQ Approval**:
  - Same structure; on approve finalizes to `Approved`. On reject: `RejectedByHQ`.
- **Resubmission**:
  - Submitter can clone previous expense data, adjust fields, increment `version`, reset workflow to step 1; previous approvals retained in history.

## 7. API Sketch (REST)
- `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`
- `GET /users/me`, `PATCH /users/:id`, `POST /sites`
- `POST /expenses` (submit), `POST /expenses/:id/draft`, `PATCH /expenses/:id` (edit), `POST /expenses/:id/resubmit`
- `GET /expenses` (filters: date range, site, status, category, keyword)
- `POST /expenses/:id/approve` with body `{ step, action, comment }`
- `POST /expenses/batch` for bulk approve/reject
- `GET /reports/export?filters...` returns XLSX stream
- Future: `POST /expenses/:id/attachments` (stores metadata, uploads to object storage pre-signed URL)

All endpoints enforce role-based permissions via middleware/guards.

## 8. Frontend Considerations
- Use component-driven UI (Storybook) for form inputs, filter panels, approval tables.
- Role-based routing: `Submitter` sees submission history; `SiteManager` and `HQAdmin` dashboards show pending queues tailored to site scopes.
- Draft auto-save using debounced API calls.
- Bulk actions with client-side selection + server-side validation.

## 9. Security & Compliance
- Password hashing with Argon2id (or bcrypt if Argon2 unavailable).
- HTTPS everywhere, HSTS, secure cookies for refresh tokens if using cookie-based auth.
- CSRF protection (double-submit tokens) if cookies used.
- Input validation with shared schema (e.g., Zod/DTOs).
- Logging + monitoring (structured logs, performance metrics, alerting on error rates).

## 10. Operational Concerns
- **Monitoring**: Prometheus metrics, Grafana dashboards; log aggregation via ELK or CloudWatch.
- **Backups**: Automated DB snapshot & retention policy; verify restore quarterly.
- **Access Control**: Admin UI to manage users/sites; ensure least privilege in cloud IAM policies.
- **Disaster Recovery**: Document RPO/RTO targets (e.g., RPO 15 min, RTO 1 hr).

## 11. Implementation Roadmap
1. **Foundation**: Project scaffolding, CI/CD, auth, user/site management.
2. **Expense Intake**: Draft handling, submission forms, validation.
3. **Workflow Engine**: Approval endpoints, state machine, notifications.
4. **Reporting**: Filterable grids, Excel export.
5. **Hardening**: Auditing, monitoring, load tests, access reviews.
6. **Attachments (Phase 2)**: Object storage integration, file management UI.

## 12. Next Steps
- Confirm tech stack preference with stakeholders (React vs Vue, NestJS vs Spring Boot, etc.).
- Define category taxonomy and reference data for dropdowns.
- Design UI wireframes for submission + approval flows.
- Prepare seed data scripts for users/sites to accelerate onboarding.
