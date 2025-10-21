# IKJIN Expense Management System – Implementation Plan

## 1. 프로젝트 개요
- **프로젝트명**: IKJIN Expense Management System (IKJIN EMS)
- **목적**: 경비 입력 및 3단계 승인 프로세스를 디지털화하고 향후 발주/프로젝트 시스템과 통합 가능한 기반 구축.
- **근거 문서**: `docs/expense_management_prd.md`, `docs/architecture.md`.

## 2. 기술 스택 제안
- **Frontend**: Next.js (React) + TypeScript, TanStack Query, Tailwind CSS, Component Storybook.
- **Backend**: NestJS (TypeScript), REST API, Zod/DTO validation, Prisma ORM.
- **Database**: PostgreSQL (Supabase 호환 스키마), Prisma migrations.
- **Cache/Session**: Redis (session, job queue).
- **Infra**: Docker Compose (dev), AWS ECS/Fargate or Supabase-hosted Postgres in production.
- **CI/CD**: GitHub Actions (lint, test, build, deploy). Terraform or Pulumi for IaC (optional phase 2).
- **Monitoring**: OpenTelemetry instrumentation, Prometheus + Grafana, Sentry for error tracking.
- **Notifications**: SMTP relay (SES or 사내 SMTP) via Nest mailer.

## 3. 시스템 아키텍처 하이라이트
- 단일 BFF (Backend-for-Frontend) API 서비스 → PostgreSQL + Redis.
- Supabase 사용자/현장 데이터와 호환되는 스키마 유지; 향후 Federation/API Gateway에 쉽게 편입하도록 모듈화.
- Object Storage 연동 레이어(비활성 상태) 구축: 업로드 URL 발급 로직만 선반영, UI/권한은 Phase 2.
- 각 모듈(인증, 경비, 승인, 보고)별 독립 서비스 레이어 구성하여 마이크로서비스 전환 여지 확보.

## 4. 일정 계획 (예상 12주)
| 주차 | 마일스톤 | 주요 deliverable |
| --- | --- | --- |
| 1 | Kick-off & Discovery | 요구사항 확정, 스프린트 계획, 디자인 시스템 방향 |
| 2-3 | Foundation Sprint | Repo scaffolding, CI/CD 구축, 인증/권한 베이스 |
| 4-5 | Expense Intake | 경비 입력/임시저장/제출 UI+API, Prisma 스키마 |
| 6-7 | Approval Workflow | 상태 머신, 승인/반려, 알림, 감사 로그 |
| 8 | Reporting & Export | 필터링, 서버 페이지네이션, XLSX export |
| 9 | Integration Prep | Supabase 스키마 매핑, SSO 전략 초안, API 문서 |
| 10 | Hardening | 부하 테스트, 보안 점검, 모니터링/알림 |
| 11 | UAT / Pilot | 베타 테스트, 피드백 반영 |
| 12 | Launch & Handover | 운영 문서, 교육, 릴리스 계획 실행 |

> 애자일 2주 스프린트를 기준으로 하며, 각 스프린트 종료 시 데모 및 리뷰 진행.

## 5. 작업 분류 (Work Breakdown Structure)
- **FE-01**: Next.js 프로젝트 세팅, 인증/역할 기반 라우팅.
- **FE-02**: 경비 입력 폼 + 임시저장 상태 표시.
- **FE-03**: 승인 대시보드(현장/본사) + 일괄 처리 UI.
- **FE-04**: 필터/검색/다운로드 컴포넌트.
- **FE-05**: 감사 로그/활동 타임라인 컴포넌트.
- **BE-01**: NestJS 모듈 스캐폴딩, RBAC 가드, Supabase Auth 연동 Adapter.
- **BE-02**: Expense CRUD + Draft 저장소(Prisma JSON).
- **BE-03**: Approval Service (state machine, batch endpoints).
- **BE-04**: Notification Service (email queue).
- **BE-05**: Reporting Service (SQL view, XLSX stream).
- **Infra-01**: Docker Compose dev 환경, GitHub Actions pipeline.
- **Infra-02**: Terraform/Pulumi 초안, staging 환경 구성.
- **QA-01**: Cypress E2E 시나리오 (중요 플로우 6개).
- **QA-02**: Performance test (k6) – 승인/보고 API.

## 6. 테스트 전략
- **단위 테스트**: Jest (backend), React Testing Library (frontend).
- **통합 테스트**: Backend services with Testcontainers (PostgreSQL, Redis).
- **E2E 테스트**: Cypress (브라우저), Critical path: 제출/승인/반려/재제출/엑셀 다운로드.
- **부하 테스트**: k6 – 30 동시 사용자 시나리오, 승인 배치 처리.
- **보안 테스트**: OWASP ZAP 스캔(사전 승인 하에), JWT 토큰 만료/재발급 시나리오.

## 7. 데이터 및 통합 전략
- Supabase와 공유 예정인 테이블(`users`, `sites`)은 동일 컬럼 명과 타입 유지. 내부 DB는 UUID primary key 사용.
- `expenses`, `expense_items`, `approvals` 테이블은 독립 운영하되, 향후 CDC(예: Supabase pg_net) 연동을 고려하여 `updated_at` 및 soft delete 관리.
- API 문서(OpenAPI)와 GraphQL 스키마 초안 제공 → 발주시스템/프로젝트 시스템과의 통합 시 레퍼런스.
- 사용자 동기화 시나리오 옵션:
  1. Supabase를 소스 오브 트루스로 두고 EMS에서 읽기/캐시.
  2. EMSAuth → Supabase Auth 마이그레이션 (phase 2): 토큰 교환 미들웨어 구현.

## 8. 보안 및 거버넌스
- RBAC와 현장 스코프 검증을 서비스 레이어에서 중앙집중식으로 처리.
- 감사 로그는 WORM(Write-Once Read-Many) 정책 적용 가능하도록 주기적 스냅샷.
- 비밀번호/비밀키는 AWS Secrets Manager 또는 Supabase Vault에 저장.
- 접속 로그/IP 추적 및 관리자 알림 설정.

## 9. 리스크 및 완화
| 리스크 | 영향 | 대책 |
| --- | --- | --- |
| Supabase와의 인증 통합 지연 | 사용자 혼란 | Phase 1: 독립 로그인, Phase 2: 토큰 교환 모듈 계획 및 문서화 |
| 현장별 권한 오류 | 데이터 노출 | RBAC 통합 테스트, 현장 단위 시연 및 training |
| 일괄 처리 성능 문제 | 승인 병목 | Batch API 최적화, SQL 튜닝, 큐잉 도입 고려 |
| 보고서 용량 증가 | 메모리/시간 초과 | Streaming export, 백그라운드 Job(Phase 2) |

## 10. 커뮤니케이션 & 거버넌스
- 주간 스탠드업, 양측 PM 1:1 진행.
- 스프린트 플래닝/리뷰/회고(격주).
- Jira(또는 Linear) 이슈 트래킹, Confluence/Notion에 문서 공유.
- 출시 전 운영 교육 세션 + 사용자 매뉴얼(영상/문서) 제공.

## 11. 인력 구성 제안
- **PM/PO** 1명, **Tech Lead** 1명, **Frontend** 2명, **Backend** 2명, **QA** 1명, **DevOps** 0.5명(파트타임), **UX/UI 디자이너** 1명.
- 필요 시 Supabase 전문 엔지니어(컨설턴트) 0.5명 투입하여 통합 전략 가속.

## 12. 론칭 후 운영 계획
- 1~2개월 초기 운영 핫라인, 버그 우선 대응.
- 분기별 기능 요청 로드맵 리뷰.
- Phase 2: 영수증 첨부, 발주/프로젝트 시스템과의 통합 착수.
- KPI 모니터링 대시보드 구축, 경영진 보고 템플릿 제공.
