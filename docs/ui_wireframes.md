# IKJIN EMS – Textual Wireframes & User Flows

## 1. Global Layout
- **Header**: IKJIN logo, system name, user dropdown (profile, settings, logout), role badge.
- **Sidebar Navigation** (role-based):
  - Submitter: `대시보드`, `경비 작성`, `제출 내역`, `공지/도움말`.
  - SiteManager: + `승인 대기`, `현장 리포트`.
  - HQAdmin: + `전체 현황`, `사용자/현장 관리`, `감사 로그`.
- **Main Content**: 12-column grid, responsive down to tablet; mobile collapses sidebar into drawer.
- **Footer**: 버전 정보, 문의처 링크.

## 2. Submitter Dashboard (Home)
- **Hero Panel**: “이번 달 승인률”, 최근 반려 건 알림.
- **Cards Row**:
  - `승인 대기 중`: count of submitted items.
  - `반려됨`: 최근 30일 반려 건.
  - `임시 저장`: draft 수.
- **Recent Activity Table** (columns: 상태, 현장, 금액, 사용일자, 마지막 업데이트).
- **CTA Buttons**: `새 경비 작성`, `임시 저장 불러오기`.

## 3. Expense Entry Form
- **Breadcrumb**: `경비 작성 / 새 경비`.
- **Form Sections**:
  1. **기본 정보**
     - 필드: 현장 (dropdown), 사용일자 (date picker), 경비 항목 (dropdown), 금액 (numeric with comma), 사용처 (text), 용도 상세 (textarea).
  2. **추가 옵션 (Phase 2)**
     - 영수증 첨부 placeholder card (disabled state).
  3. **버튼 영역**
     - `임시 저장` (secondary), `제출` (primary), `취소`.
     - Autosave indicator (`마지막 저장: 10초 전`).
- **Right Sidebar**: Draft version info, 정책 링크, FAQ.
- **Validation Feedback**: Inline; top-level alert for submission errors.

## 4. Submitter – My Expenses List
- **Filter Bar**: 기간(캘린더 range), 상태 multi-select, 현장, 항목, 금액 범위, 검색(사용처/용도).
- **Table**:
  - Columns: 선택(checkbox for batch actions in future), 상태 badge, 현장, 항목, 금액, 사용일자, 최종 승인자, 업데이트일자.
  - Row click → detail drawer.
- **Bulk Actions**: (Submitter) `반려 건 재제출` CTA appears per row.
- **Empty State**: Illustration + “경비를 등록해보세요” CTA.

## 5. Expense Detail Drawer / Page
- **Header**: 상태, 금액, 현장, 사용일자.
- **Tabs**:
  1. `상세내역`: 입력 필드 read-only.
  2. `승인 이력`: Timeline (icons for Site/HQ), 코멘트 표시.
  3. `첨부파일`: Phase 2 placeholder.
- **Actions** (contextual):
  - Submitter: `편집` (if Draft/Rejected), `재제출`.
  - SiteManager/HQ: `승인`, `반려`, `코멘트`.

## 6. Site Manager – Approval Queue
- **Header KPIs**: 대기 건수, 이번 주 승인 완료, 평균 처리시간.
- **Queue Table**:
  - Columns: 선택(checkbox), 제출자, 현장, 항목, 금액, 사용일자, 제출일, 코멘트 존재 여부 아이콘.
  - Multi-select enabling `일괄 승인`, `일괄 반려`.
- **Detail Panel**: Right side slide-over with expense detail and comment box.
- **Batch Action Flow**:
  1. Select rows.
  2. Choose action → modal.
  3. 입력: 공통 코멘트 (반려 시 필수), 확인 버튼.
  4. 처리 결과 토스트/리포트 (성공/부분실패).

## 7. HQ Admin – Global Dashboard
- **Top Filters**: 기간, 현장, 상태, 항목, 금액 범위.
- **Widgets**:
  - `승인 현황 그래프` (Stacked bar: pending/approved/rejected).
  - `현장별 지출 Top 5`.
  - `반려 사유 Top 3` (tags cloud).
- **Tabs**:
  - `승인 대기` (table similar to SiteManager but 모든 현장).
  - `전체 내역` (advanced filters).
  - `보고서 다운로드` (form: 기간, 현장, 항목 → `CSV` / `XLSX` 버튼).

## 8. User & Site Management
- **List Page**:
  - Tabs: `사용자`, `현장`.
  - Search + filters (역할, 상태).
  - Table columns: 이름, 이메일, 역할, 소속 현장, 마지막 로그인, 상태 toggle.
- **Form Modal**: Add/Edit user.
  - 필드: 이름, 이메일, 역할 select, 현장 multiselect (SiteManager), status toggle.
  - Invite email 옵션(Phase 2).
- **Site Form**: 코드, 이름, 주소, 상태.

## 9. Auditor – Read-only Views
- Limited navigation: `전체 내역`, `보고서 다운로드`, `감사 로그`.
- **Audit Log Page**:
  - Filters: 엔티티 타입(expense/user), 기간, 사용자, 액션.
  - Table: 시간, 사용자, 액션, 대상, 코멘트, 원본 JSON (`보기` 버튼 → modal).

## 10. User Flows (Text)
### 10.1 경비 제출
`대시보드 → 새 경비 작성 → 필수 필드 입력 → 제출 → 토스트 “소장 승인 대기” → 리스트에서 상태 업데이트`

### 10.2 Site Manager 승인
`승인 대기 → 필터(현장) 적용 → 테이블 선택 → 상세 검토 → 승인/반려 → 결과 토스트 → 본사 대기열 이동`

### 10.3 반려 후 재제출
`Submitter 알림 수신 → 리스트에서 반려 건 → 상세 → 편집 → 수정 → 재제출 → 승인 히스토리 갱신`

### 10.4 보고서 다운로드
`HQ Dashboard → 보고서 탭 → 기간/현장 선택 → XLSX 다운로드 → 진행 스피너 → 파일 저장`

### 10.5 감사 로그 검토
`Auditor 로그인 → 감사 로그 → 필터(기간/엔티티) → 레코드 선택 → JSON modal 확인 → 필요 시 CSV export`
