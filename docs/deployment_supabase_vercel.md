# Supabase & Vercel Deployment Playbook

프로덕션 환경으로 배포할 때 따라야 할 전체 흐름을 정리했습니다. 실제 키 값은 안전한 장소에 보관하고, Vercel/Supabase 대시보드에도 동일하게 등록하세요.

---

## 1. Supabase 설정

1. **프로젝트 생성**
   - Supabase 대시보드에서 새 프로젝트 생성.
   - 강력한 DB 비밀번호 설정 후 저장.
   - Project Settings → Database → Connection info에서 아래 URL 확보:
     - `DIRECT_URL` (Non-pooled: 기본 6543/5432 포트) – Prisma 마이그레이션/seed용
     - `DATABASE_URL` (Pooled: PgBouncer, 5432 포트) – 런타임(서버리스)에서 사용  
       Vercel Serverless에서 안정적으로 쓰려면 `?pgbouncer=true&connection_limit=1&sslmode=require`를 붙입니다.

2. **서비스 키 & JWT**
   - Project Settings → API:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (클라이언트에서 사용)
     - `SUPABASE_SERVICE_ROLE_KEY` (선택: 서버에서 관리자 작업 시 필요)
     - `SUPABASE_JWT_SECRET` (Auth 정책에서 JWT 검증할 때 사용)

3. **Prisma 마이그레이션**
   ```bash
   pnpm install
   pnpm --filter @ikjin/api prisma generate
   pnpm --filter @ikjin/api prisma migrate deploy
   pnpm seed               # 초기 데이터가 필요할 때만
   ```
   로컬에서 Supabase DB에 직접 연결하여 실행합니다. `prisma migrate deploy`는 `DATABASE_URL` 대신 `DIRECT_URL`을 사용하도록 `.env`에 정의해야 합니다.

---

## 2. 환경 변수 템플릿

### 루트 `.env.production` (CI나 스크립트에서 공통으로 쓸 값)
```ini
NODE_ENV=production

# Supabase DB
DATABASE_URL=postgresql://<user>:<pass>@db.<hash>.supabase.co:5432/postgres?pgbouncer=true&connection_limit=1&sslmode=require
DIRECT_URL=postgresql://<user>:<pass>@db.<hash>.supabase.co:6543/postgres?sslmode=require
SHADOW_DATABASE_URL=postgresql://<user>:<pass>@db.<hash>.supabase.co:6543/postgres?sslmode=require

# JWT / Auth
JWT_SECRET=<prod-jwt-secret>
REFRESH_TOKEN_SECRET=<prod-refresh-secret>
JWT_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d

# (선택) Supabase Service Role
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
SUPABASE_JWT_SECRET=<jwt-secret>
```

### `apps/api/.env.production`
```ini
DATABASE_URL=${DATABASE_URL}
DIRECT_URL=${DIRECT_URL}
SHADOW_DATABASE_URL=${SHADOW_DATABASE_URL}
JWT_SECRET=${JWT_SECRET}
REFRESH_TOKEN_SECRET=${REFRESH_TOKEN_SECRET}
JWT_EXPIRY=${JWT_EXPIRY}
REFRESH_TOKEN_EXPIRY=${REFRESH_TOKEN_EXPIRY}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
SUPABASE_JWT_SECRET=${SUPABASE_JWT_SECRET}
```

### `apps/web/.env.production`
```ini
NEXT_PUBLIC_API_BASE_URL=https://ikjin-ems-api.vercel.app
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

> 실제 배포 시에는 파일 대신 Vercel 환경 변수에 입력합니다. 로컬 프로덕션 빌드 테스트가 필요할 때만 `.env.production` 파일을 사용하세요.

---

## 3. Vercel 프로젝트 구성

### 3.1 웹 (Next.js)
- **Project Root:** `apps/web`
- **Build Command:** `pnpm --filter @ikjin/web build`
- **Install Command:** 빈칸(default) 또는 `pnpm install`
- **Output Directory:** `.next`
- **Env:** 위 `apps/web/.env.production`의 값 등록
- 필요 시 Preview/Production 환경 변수를 분리해서 관리합니다.

### 3.2 API (NestJS)
서버리스 함수로 동작시키기 위해 아래 구성을 권장합니다.

1. `apps/api/src/bootstrap.ts`에서 Nest 애플리케이션을 초기화하고, `apps/api/src/serverless.ts`에 Vercel 함수를 위한 핸들러를 구현합니다.
2. `apps/api/api/index.ts`가 `serverless.ts`의 기본 핸들러를 그대로 export 하도록 구성합니다.
3. `apps/api/vercel.json` 예시:
   ```json
   {
     "functions": {
       "api/index.ts": {
         "runtime": "nodejs20.x",
         "memory": 1024,
         "maxDuration": 30
       }
     },
     "buildCommand": "pnpm install && pnpm --filter @ikjin/api build && pnpm --filter @ikjin/api prisma migrate deploy"
   }
   ```
4. 환경 변수는 `apps/api/.env.production`과 동일하게 Vercel에 등록합니다.

> 빌드 후 서버less 엔드포인트는 `https://<api-project>.vercel.app`입니다. 웹 앱에서 `NEXT_PUBLIC_API_BASE_URL`을 이 URL로 설정하면 됩니다.

---

## 4. CI/CD 흐름

1. **GitHub → Vercel 연결**
   - 저장소 `gpdavidyang/IKJIN_EMS`를 Vercel에서 Import.
   - Production Branch를 `main`으로 설정.
   - Preview Branch는 기본값 그대로 사용.

2. **자동 배포**
   - `main`에 머지되면 Vercel이 웹/API 프로젝트를 각각 빌드 후 배포.
   - `pnpm seed`가 프로덕션에서 단 한 번만 실행되도록(또는 idempotent하도록) 조정하세요.

3. **DB 마이그레이션**
   - Vercel Build Command에 `pnpm --filter @ikjin/api prisma migrate deploy`가 포함되어 있으면 배포마다 최신 마이그레이션을 반영합니다.
   - 대규모 마이그레이션은 Supabase SQL Editor나 로컬에서 미리 실행 후 배포하는 전략도 가능.

---

## 5. 점검 체크리스트

- [ ] Supabase 프로젝트에서 필요한 RLS/정책, Storage, Auth 설정을 완료했다.
- [ ] 필수 환경 변수를 Vercel Project(Production/Preview)에 입력했다.
- [ ] `pnpm build` / `pnpm test`를 로컬에서 통과했다.
- [ ] `pnpm --filter @ikjin/api prisma migrate deploy`가 Supabase DB에서 성공적으로 수행됐다.
- [ ] Vercel 배포 후 `https://<api>.vercel.app/health` 및 Next.js 앱을 직접 검증했다.
- [ ] 로그/모니터링 (Supabase Logs, Vercel Observability)을 확인했다.

---

필요 시 `docs/setup_guide.md`와 이 문서를 함께 업데이트해 최신 상태를 유지해 주세요. Supabase와 Vercel 구성이 변경되면 환경 변수 목록도 잊지 말고 갱신해야 합니다.
