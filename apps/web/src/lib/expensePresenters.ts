const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CORPORATE_CARD: "법인카드",
  PERSONAL_CARD: "개인카드",
  CASH: "현금",
  OTHER: "기타"
};

const CATEGORY_LABELS: Record<string, string> = {
  CAT001: "인건비",
  CAT002: "식대/다과",
  CAT003: "교통/주유",
  CAT004: "자재구매",
  CAT005: "공구/장비임대",
  CAT006: "안전관리",
  CAT007: "사무/통신",
  CAT008: "복지/경조사",
  CAT999: "기타"
};

const STATUS_OPTIONS = [
  { value: "DRAFT", label: "임시저장" },
  { value: "PENDING_SITE", label: "소장승인대기" },
  { value: "REJECTED_SITE", label: "소장반려" },
  { value: "PENDING_HQ", label: "본사승인대기" },
  { value: "REJECTED_HQ", label: "본사반려" },
  { value: "APPROVED", label: "승인완료" }
];

const translateStatus = (status: string) => {
  const map: Record<string, string> = STATUS_OPTIONS.reduce<Record<string, string>>((acc, option) => {
    acc[option.value] = option.label;
    return acc;
  }, {});
  return map[status] ?? status;
};

const buildMemoFromItems = (items: any[]): string => {
  if (!Array.isArray(items)) {
    return "-";
  }
  const descriptions = items
    .map((item) => (typeof item?.description === "string" ? item.description.trim() : ""))
    .filter((value) => value.length > 0);
  return descriptions.length > 0 ? descriptions.join(", ") : "-";
};

const buildCategoryLabel = (items: any[]): string => {
  if (!Array.isArray(items) || items.length === 0) {
    return "-";
  }
  const categories = Array.from(
    new Set(
      items
        .map((item) => (typeof item?.category === "string" ? item.category.trim() : ""))
        .filter((category) => category.length > 0)
    )
  );
  if (categories.length === 0) {
    return "-";
  }
  return categories
    .map((code) => CATEGORY_LABELS[code] ?? code)
    .join(", ");
};

const buildPaymentMethodLabel = (items: any[]): string => {
  if (!Array.isArray(items) || items.length === 0) {
    return "-";
  }
  const methods = Array.from(
    new Set(
      items
        .map((item) => (typeof item?.paymentMethod === "string" ? item.paymentMethod.trim() : ""))
        .filter((method) => method.length > 0)
    )
  );
  if (methods.length === 0) {
    return "-";
  }
  return methods.map((method) => PAYMENT_METHOD_LABELS[method] ?? method).join(", ");
};

const formatCurrency = (value: string | number) => {
  const amount = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(amount)) return typeof value === "string" ? value : amount.toString();
  return amount.toLocaleString("ko-KR", { style: "currency", currency: "KRW" });
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().split("T")[0];
};

export {
  CATEGORY_LABELS,
  PAYMENT_METHOD_LABELS,
  STATUS_OPTIONS,
  buildCategoryLabel,
  buildMemoFromItems,
  buildPaymentMethodLabel,
  formatCurrency,
  formatDate,
  translateStatus
};
