# IKJIN EMS – Development Setup Guide

## 1. Repository Structure (Monorepo)
```
ikjin-ems/
├── apps/
│   ├── web/           # Next.js frontend
│   └── api/           # NestJS backend
├── packages/
│   ├── ui/            # Shared UI components (Storybook)
│   ├── config/        # ESLint, TS configs
│   └── utils/         # Shared helper libraries
├── infra/
│   ├── docker-compose.yaml
│   ├── terraform/     # optional, phase 2
│   └── k8s/           # manifests (future)
├── docs/
│   └── ...            # product & architecture docs
└── tools/
    ├── scripts/       # seed, migration helpers
    └── ci/            # GH Actions workflows
```

> Monorepo leverages Turborepo (optional) to speed up builds and share tooling.

## 2. Prerequisites
- Node.js 20.x (via nvm)
- pnpm 8.x
- Docker Desktop or compatible runtime
- PostgreSQL client (psql)
- Redis CLI
- Supabase CLI (for schema sync & local linting)
- AWS CLI (phase 2, optional)

## 3. Initial Scaffolding Commands
### 3.1 Monorepo bootstrap
```bash
pnpm dlx create-turbo@latest ikjin-ems
cd ikjin-ems
pnpm install
```

### 3.2 Frontend app
```bash
cd apps
pnpm dlx create-next-app@latest web \
  --ts --eslint --tailwind --app --src-dir --import-alias "@/*"
```

Add dependencies:
```bash
cd ../..
pnpm add -r @tanstack/react-query @tanstack/react-table axios zustand
pnpm add -r -D tailwind-merge @testing-library/react @testing-library/jest-dom vitest msw-storybook-addon
```

### 3.3 Backend app
```bash
pnpm dlx @nestjs/cli new api --directory apps/api --package-manager pnpm
```
Install core packages:
```bash
pnpm add -r @nestjs/config @nestjs/jwt @nestjs/passport passport passport-jwt bcrypt
pnpm add -r @prisma/client
pnpm add -r -D prisma @nestjs/swagger swagger-ui-express
```

Initialize Prisma:
```bash
cd apps/api
pnpm prisma init --datasource-provider postgresql
```

### 3.4 Shared packages
```bash
pnpm create @storybook/react@latest packages/ui --type react --framework vite
pnpm add -r tailwindcss postcss autoprefixer
```

## 4. Environment Configuration
Create `.env.example` at repo root:
```ini
# Shared
NODE_ENV=development
DATABASE_URL=postgresql://ikjin:password@postgres:5432/ikjin_ems
REDIS_URL=redis://redis:6379

# API
API_PORT=4000
JWT_SECRET=replace-me
JWT_EXPIRY=15m
REFRESH_TOKEN_SECRET=replace-me-too
REFRESH_TOKEN_EXPIRY=7d
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=ikjin_ems
SMTP_PASS=changeme

# Frontend
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
NEXT_PUBLIC_SUPABASE_PROJECT_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=public-anon-key
```

Backend `.env` overrides (apps/api/.env):
```ini
DATABASE_URL=postgresql://ikjin:password@localhost:5432/ikjin_ems
```

## 5. Database Setup
```bash
docker exec -it postgres psql -U postgres -c "CREATE USER ikjin WITH PASSWORD 'password';"
docker exec -it postgres psql -U postgres -c "CREATE DATABASE ikjin_ems OWNER ikjin;"
```

Prisma migration:
```bash
cd apps/api
pnpm prisma migrate dev --name init
```

Seed script outline (`tools/scripts/seed.ts`):
1. Upsert roles (`submitter`, `site_manager`, `hq_admin`, `auditor`).
2. Create default sites (from `docs/reference_data.md`).
3. Create sample users linked to sites.

## 6. Docker Compose (infra/docker-compose.yaml)
```yaml
version: "3.9"
services:
  postgres:
    image: postgres:15
    restart: unless-stopped
    environment:
      POSTGRES_PASSWORD: password
      POSTGRES_DB: ikjin_ems
      POSTGRES_USER: ikjin
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    ports:
      - "6379:6379"

  api:
    build: ../apps/api
    command: pnpm run start:dev
    volumes:
      - ../:/workspace
    env_file:
      - ../apps/api/.env
    depends_on:
      - postgres
      - redis
    ports:
      - "4000:4000"

  web:
    build: ../apps/web
    command: pnpm run dev
    volumes:
      - ../:/workspace
    env_file:
      - ../apps/web/.env.local
    ports:
      - "3000:3000"
    depends_on:
      - api

volumes:
  postgres_data:
```

## 7. CI/CD (GitHub Actions skeleton)
- `tools/ci/frontend.yml`: install pnpm, lint, test, build Next.js.
- `tools/ci/backend.yml`: install pnpm, run `pnpm prisma generate`, `pnpm test`, build NestJS.
- `tools/ci/deploy.yml`: placeholder for deploy to staging (manual trigger).

Example `frontend.yml` snippet:
```yaml
name: Frontend CI
on:
  pull_request:
    paths:
      - "apps/web/**"
      - "packages/ui/**"

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with:
          version: 8
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "pnpm"
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint:web
      - run: pnpm test:web
      - run: pnpm build:web
```

## 8. Local Development Workflow
1. `pnpm install`
2. `docker compose -f infra/docker-compose.yaml up -d`
3. `pnpm prisma migrate dev`
4. `pnpm dev` (runs both frontend/backend via Turborepo)
5. Access web at `http://localhost:3000`, API at `http://localhost:4000`.

## 9. Quality Gates
- Required PR checks: lint, unit tests, typecheck, format.
- Conventional commit messages (configurable via `commitlint`).
- Pre-commit hook with `lint-staged` (format staged files).
- Security scans: `pnpm audit`, `npm audit` (monitoring).

## 10. Documentation & Knowledge Sharing
- Maintain setup instructions in `README.md` referencing this guide.
- Add `docs/setup_guide.md` updates when dependencies change.
- Create Loom or screenshot walkthrough for new team members.

## 11. Next Actions After Setup
- Implement user stories from `docs/sprint_backlog_sprint1.md`.
- Generate actual mockups (Figma) based on `docs/ui_wireframes.md`.
- Coordinate with Supabase team for schema verification.
