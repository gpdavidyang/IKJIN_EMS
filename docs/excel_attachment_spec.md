# Excel Export & Attachment Workflow Specification

## 1. 목표
- 경비 데이터에 대한 Excel 추출 기능을 제공해 사용자(Submitter, Site Manager, HQ, Auditor)가 필터 적용된 데이터를 내려받을 수 있도록 한다.
- 경비 건 별 첨부 파일 업로드/다운로드 기능을 제공해 증빙 자료 관리 요구를 충족한다.

## 2. 공통 고려 사항
- 모든 엔드포인트는 기존 JWT 기반 인증/인가 체계를 따른다.
- HQ/Site Manager/Submitter 권한만 첨부 업로드 가능, Auditor는 다운로드만 가능하도록 한다.
- 파일 크기 제한은 10 MB/파일, 허용 확장자는 일반 문서(이미지, pdf, xlsx 등)로 제한하지 않고 서버 단에서 MIME 타입을 저장해 추후 정책에 활용할 수 있도록 한다.
- 저장소는 로컬 디스크(`uploads/expenses`)를 기본 사용하되, 추후 S3 등 외부 스토리지로 교체 가능하도록 경로/파일명 정보를 DB에 저장한다.

## 3. Excel 내보내기
### 3.1 API
- `GET /expenses/export`
  - 쿼리 파라미터: 기존 `/expenses` 목록과 동일 (`siteId`, `status`, `dateFrom`, `dateTo`, `amountMin`, `amountMax`)
  - 응답: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` 바이너리 스트림
- 권한: `submitter`, `site_manager`, `hq_admin`, `auditor`
- 파일명 규칙: `expenses_YYYYMMDD_HHmm.xlsx`
- 컬럼 구성: 경비 ID, 상태, 현장, 제출자, 총액, 사용일, 제출/업데이트 일시, 항목 목록(카테고리·금액), 최근 승인 히스토리 요약.

### 3.2 FE 플로우
- 경비 목록 화면에 “Excel 다운로드” 버튼을 추가, 현재 필터 상태를 그대로 쿼리 스트링으로 전달.
- 다운로드 결과를 Blob으로 받아 사용자 단에서 저장.

## 4. 첨부 파일
### 4.1 데이터 모델
- `ExpenseAttachment`
  - `id`, `expenseId`, `filePath`, `originalName`, `mimeType`, `size`, `createdAt`
  - `Expense` ↔ `ExpenseAttachment` (1:N)
- `Expense` 모델에 `attachments` relation 추가.

### 4.2 API
- `POST /expenses/:id/attachments`
  - 멀티파트(FormData) 기반, 필드 이름 `files`
  - 최대 5개 파일, 각 10 MB 이하
  - 응답: 업로드된 첨부 메타데이터 배열
  - 권한: 소유자 Submitter, 해당 현장 Site Manager, HQ Admin
- `DELETE /expenses/:id/attachments/:attachmentId`
  - 권한: 업로드와 동일
- `GET /expenses/:id/attachments/:attachmentId`
  - 첨부 다운로드 스트림
  - 권한: 열람 가능한 모든 역할 (Submitter 본인, Site Manager 현장, HQ, Auditor)
- 경비 상세 API 응답에 `attachments` 배열 추가.

### 4.3 FE 플로우
- 경비 작성/수정 화면에 첨부 선택 UI 제공 (Drag & Drop 또는 `<input type="file" multiple>`).
- 저장 시:
  1. 경비 생성/수정 API 호출
  2. 성공 후 첨부 파일이 있으면 `POST /attachments` 호출
  3. 실패 시 사용자에게 업로드 실패 안내
- 경비 상세 화면:
  - 첨부 목록과 용량 표시
  - 다운로드 버튼 클릭 시 Blob 다운로드 처리
  - (권한 있는 경우) 첨부 삭제 버튼 제공

## 5. 후속 고려 사항
- 대용량 파일 업로드를 위한 스트리밍/S3 전환
- 감사 로그 테이블과의 연동 (첨부 업로드/삭제/다운로드 기록)
- 첨부 버전 관리 또는 주석 기능
