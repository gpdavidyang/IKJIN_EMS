# IKJIN EMS Reference Data

## 1. Expense Categories
| Code | Name (KR) | Description | Notes |
| --- | --- | --- | --- |
| CAT001 | 인건비 | 일용직/외주 인건비 (식대 제외) | 세금계산서 여부 필드 추후 추가 가능 |
| CAT002 | 식대/다과 | 현장 식대, 회의 다과비 | 1일 한도 정책 검토 |
| CAT003 | 교통/주유 | 교통비, 주유비, 통행료 | 차량 번호/주행거리 필드 optional |
| CAT004 | 자재구매 | 소모성 자재 및 현장 소모품 | 발주 시스템 연계 가능성 높음 |
| CAT005 | 공구/장비임대 | 공구 구입 및 장비 렌탈 비용 | 렌탈 기간 입력 필드 optional |
| CAT006 | 안전관리 | 안전 장비, 교육비 | 안전팀 보고서와 연동 고려 |
| CAT007 | 사무/통신 | 사무용품, 통신비 | HQ 비용 분류와 매핑 필요 |
| CAT008 | 복지/경조사 | 현장 복지, 경조사 지원 | HQ 승인 기준 별도 문서 참조 |
| CAT999 | 기타 | 위 분류에 속하지 않는 비용 | 자유입력, HQ 추가 확인 필요 |

> 카테고리 코드는 발주 시스템과 동일 포맷(3자리 숫자) 유지. 향후 마스터 테이블(`expense_categories`) 관리.

## 2. Payment Methods (optional MVP scope)
- `cash`
- `corporate_card`
- `personal_card`
- `bank_transfer`

## 3. Status & Workflow Codes
| Status Code | Label | Description |
| --- | --- | --- |
| DRAFT | 임시저장 | 제출자 임시 저장 상태 |
| PENDING_SITE | 소장승인대기 | 현장 소장 결재 대기 |
| REJECTED_SITE | 소장반려 | 소장 반려, 코멘트 필수 |
| PENDING_HQ | 본사승인대기 | HQ 관리자 결재 대기 |
| REJECTED_HQ | 본사반려 | HQ 반려, 코멘트 필수 |
| APPROVED | 승인완료 | 최종 승인 완료 |

`approvals` 테이블의 `step` 값은 1(소장), 2(HQ), 3(비워두거나 차기 확장용)로 정의.

## 4. Site Metadata (예시)
| Site Code | Site Name | Region | Manager Role |
| --- | --- | --- | --- |
| SITE001 | 서울-한강재개발 | 수도권 | SiteManager |
| SITE002 | 부산-해양물류센터 | 영남 | SiteManager |
| SITE003 | 대전-연구단지 | 충청 | SiteManager |

> 실제 운영 시 발주 시스템 Supabase `projects` 테이블과 싱크.

## 5. Approval Comment Templates
- `현장 검토 완료, HQ 승인 요청드립니다.`
- `증빙 미비: 영수증 첨부 후 재제출 바랍니다.`
- `금액 조정 필요: 세부 내역 확인 요청.`
- `중복 제출 의심: 기존 건과 비교 필요.` (SiteManager/HQ 공용)

## 6. Notification Templates (Email Subject)
- `[IKJIN EMS] 소장 승인 대기 알림`
- `[IKJIN EMS] 본사 승인 대기 알림`
- `[IKJIN EMS] 반려 안내`
- `[IKJIN EMS] 최종 승인 완료`

본문은 추후 UX 라이팅 가이드에 따라 구성.
