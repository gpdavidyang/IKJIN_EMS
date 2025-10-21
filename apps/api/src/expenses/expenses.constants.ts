export interface ExpenseCategoryMeta {
  code: string;
  name: string;
  description?: string;
}

export const EXPENSE_CATEGORIES: ExpenseCategoryMeta[] = [
  { code: "CAT001", name: "인건비", description: "일용직/외주 인건비" },
  { code: "CAT002", name: "식대/다과", description: "현장 식대, 회의 다과비" },
  { code: "CAT003", name: "교통/주유", description: "교통비, 주유비, 통행료" },
  { code: "CAT004", name: "자재구매", description: "소모성 자재 및 현장 소모품" },
  { code: "CAT005", name: "공구/장비임대", description: "공구 구입 및 장비 렌탈 비용" },
  { code: "CAT006", name: "안전관리", description: "안전 장비, 교육비" },
  { code: "CAT007", name: "사무/통신", description: "사무용품, 통신비" },
  { code: "CAT008", name: "복지/경조사", description: "현장 복지 및 경조사 지원" },
  { code: "CAT999", name: "기타", description: "기타 비용" }
];
