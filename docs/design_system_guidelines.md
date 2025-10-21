# IKJIN EMS – Design System Guidelines

## 1. Brand Palette
| Token | Hex | Usage |
| --- | --- | --- |
| `color.primary` | `#0F4C81` | 메인 브랜드 색 (버튼, 링크). 안정감 있는 블루, 건설 본사의 신뢰감 표현. |
| `color.primary-dark` | `#0B365F` | Hover/active 상태. |
| `color.secondary` | `#F2A900` | 현장 하이라이트, KPI 강조. 안전 조끼/건설 장비에서 영감. |
| `color.accent` | `#2EBFA5` | 성공/승인 상태, 긍정 알림. |
| `color.error` | `#D64545` | 반려/에러 상태. |
| `color.warning` | `#F5B13D` | 주의/검토 필요. |
| `color.neutral-900` | `#1F2933` | 메인 텍스트. |
| `color.neutral-700` | `#3E4C59` | 보조 텍스트. |
| `color.neutral-100` | `#E4E7EB` | 테이블 헤더, 구분선. |
| `color.background` | `#F8FAFC` | 앱 배경. |
| `color.surface` | `#FFFFFF` | 카드/패널 배경. |

> 대비: 주요 텍스트와 배경 대비율 ≥ 4.5:1 유지. 보조 텍스트는 3:1 이상.

## 2. Typography
- **Primary Typeface**: Pretendard (국문/영문 혼용 가능, 웹폰트 지원).
- **Fallback**: Noto Sans KR, Apple SD Gothic Neo, sans-serif.
- **Scale** (rem):
  - Display 32/40 Bold (`--font-display`)
  - Heading 24/32 SemiBold
  - Subheading 20/28 Medium
  - Body 16/24 Regular (기본 텍스트)
  - Small 14/20 Regular
  - Caption 12/18 Regular
- **Numerical Data**: Use tabular figures (CSS `font-variant-numeric: tabular-nums;`) for 금액/날짜 alignment.

## 3. Spacing & Layout
- Base unit: 8px.
- Layout grid: 12-column, gutter 24px (desktop). Tablet 8-column, mobile single column.
- Section padding: 32px top/bottom for dashboard panels, 24px for forms.
- Card corner radius: 8px; modal radius 12px.
- Shadow tokens:
  - `shadow.sm`: 0 1px 2px rgba(15, 76, 129, 0.08)
  - `shadow.md`: 0 4px 12px rgba(15, 76, 129, 0.12)

## 4. Iconography
- Style: 1.5px stroke line icons, rounded corners.
- Source: Heroicons / RemixIcon customized with brand colors.
- Consistent size: 20px in navigation, 16px inline, 24px in dashboard widgets.

## 5. Components (Core Library)

### 5.1 Buttons
- Variants: Primary (filled), Secondary (outline), Tertiary (text), Destructive.
- Heights: 40px (default), 32px (compact).
- Loading state with spinner left of label.
- Disabled: 40% opacity, no hover shadow.

### 5.2 Form Controls
- Input field with label on top, helper text below (14px).
- Error state: border `color.error`, icon + error text.
- Date picker integrated with range selection, highlight weekends in neutral tone.
- Currency input: right-aligned, thousand separators; show currency hint (`₩`).

### 5.3 Tables
- Header background `color.neutral-100`.
- Zebra stripes using `rgba(15, 76, 129, 0.03)`.
- Sorting indicators (chevron icon).
- Sticky header and first column for approval queue (desktop).
- Row status badge color coding (primary, accent, warning, error).

### 5.4 Status Badges
| Status | Label | Color Token |
| --- | --- | --- |
| Draft | 회색 | `color.neutral-700` |
| Pending (Site/HQ) | 네이비 | `color.primary` |
| Approved | 청록 | `color.accent` |
| Rejected | 레드 | `color.error` |

### 5.5 Cards & Panels
- Dashboard cards: icon top-left, value in Display typography, label small text.
- Collapsible sections for filters (mobile).
- Audit timeline uses stepper component with icons (clock, check, x).

### 5.6 Modals
- Width: 480px default, 640px for batch actions.
- Primary action right, destructive actions outlined in `color.error`.
- Scrollable content with max-height 70vh.

### 5.7 Notifications
- Toast position: top-right, auto dismiss 6s, accessible focus fallback.
- Color-coded side bar (4px) per status.

## 6. Data Visualization
- Bar/line charts using ECharts or Recharts with palette:
  - `color.primary`, `color.secondary`, `color.accent`.
  - Rejected data uses `color.error`.
- Tooltip style: surface background with subtle shadow, detail labels bold.
- Gridlines faint (`rgba(15, 76, 129, 0.08)`).

## 7. Accessibility
- Minimum touch target 44px (mobile) / 40px (desktop).
- Focus outline: 2px dashed `color.secondary` with offset 2px.
- Provide skip navigation (`Skip to content`) link.
- Form validation messages referenced with `aria-describedby`.

## 8. Design Tokens (Structure)
```json
{
  "color": {
    "primary": "#0F4C81",
    "primaryDark": "#0B365F",
    "secondary": "#F2A900",
    "accent": "#2EBFA5",
    "error": "#D64545"
  },
  "font": {
    "family": "Pretendard, 'Noto Sans KR', sans-serif",
    "size": {
      "body": "16px",
      "small": "14px"
    }
  },
  "radius": {
    "sm": "8px",
    "md": "12px"
  },
  "shadow": {
    "sm": "0 1px 2px rgba(15, 76, 129, 0.08)",
    "md": "0 4px 12px rgba(15, 76, 129, 0.12)"
  }
}
```

## 9. Design QA Checklist
- 색상 대비 검사 (Stark 플러그인).
- 컴포넌트 spacing 8px 배수 검증.
- 상태/에러/빈 상태 시나리오 포함.
- 다국어 대비: 라벨 길이 2배 시 레이아웃 확인.
- Responsive: Desktop ≥1280px, Tablet 768–1024px, Mobile ≤767px.

## 10. Alignment with Existing Systems
- 발주시스템에서 사용 중인 UI 요소와 매칭 표 작성 (Phase 2).
- 공통 디자인 토큰을 packages/ui 내 `tokens.json`으로 관리.
- 향후 디자인 시스템 문서화 도구(Storybook Docs / Zeroheight) 도입.
