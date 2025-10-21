import Head from "next/head";
import { useRouter } from "next/router";
import { FormEvent, useEffect, useMemo, useState } from "react";
import AppShell from "@/layout/AppShell";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/contexts/AuthContext";

type ExpenseStatusValue = "PENDING_SITE" | "DRAFT";

interface ExpenseFormState {
  usageDate: string;
  vendor: string;
  purposeDetail: string;
  status: ExpenseStatusValue;
  siteId?: string;
}

interface ExpenseItemInput {
  category: string;
  amount: string;
  usageDate: string;
  vendor: string;
  description: string;
}

const createEmptyItem = (categoryCode?: string): ExpenseItemInput => ({
  category: categoryCode ?? "",
  amount: "",
  usageDate: "",
  vendor: "",
  description: ""
});

const statusOptions: Array<{ value: ExpenseStatusValue; label: string }> = [
  { value: "PENDING_SITE", label: "제출 (소장 승인 대기)" },
  { value: "DRAFT", label: "임시 저장" }
];

const NewExpensePage = () => {
  const router = useRouter();
  const { token, loading: authLoading, user } = useAuth();
  const [form, setForm] = useState<ExpenseFormState>({
    usageDate: "",
    vendor: "",
    purposeDetail: "",
    status: "PENDING_SITE",
    siteId: undefined
  });
  const [items, setItems] = useState<ExpenseItemInput[]>([createEmptyItem()]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [categories, setCategories] = useState<Array<{ code: string; name: string }>>([]);
  const [sites, setSites] = useState<Array<{ id: string; name: string; code: string }>>([]);

  useEffect(() => {
    if (authLoading) return;
    const isAuthorized = user ? ["submitter", "site_manager", "hq_admin"].includes(user.role) : false;
    if (user && !isAuthorized) {
      router.replace("/expenses").catch(() => undefined);
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (authLoading || !token) return;
    const fetchMetadata = async () => {
      setMetaLoading(true);
      try {
        const data = await apiClient.get<{
          categories: Array<{ code: string; name: string }>;
          sites: Array<{ id: string; name: string; code: string }>;
        }>("/expenses/meta");
        setCategories(data.categories ?? []);
        setSites(data.sites ?? []);
        if ((data.sites?.length ?? 0) === 1) {
          setForm((prev) => ({ ...prev, siteId: data.sites[0].id }));
        }
        setItems((prev) =>
          prev.map((item) => ({
            ...item,
            category: item.category || data.categories?.[0]?.code || ""
          }))
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "경비 작성 정보를 불러오지 못했습니다.");
      } finally {
        setMetaLoading(false);
      }
    };

    void fetchMetadata();
  }, [authLoading, token]);

  const totalAmount = useMemo(() => {
    return items.reduce((sum, item) => {
      const parsed = Number(item.amount);
      if (Number.isNaN(parsed)) {
        return sum;
      }
      return sum + parsed;
    }, 0);
  }, [items]);

  const handleFormChange = (field: keyof ExpenseFormState, value: string | undefined) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === "vendor" && typeof value === "string") {
      setItems((prev) =>
        prev.map((item) => (item.vendor.trim().length > 0 ? item : { ...item, vendor: value }))
      );
    }
    if (field === "usageDate" && typeof value === "string") {
      setItems((prev) =>
        prev.map((item) => (item.usageDate.trim().length > 0 ? item : { ...item, usageDate: value }))
      );
    }
  };

  const handleItemChange = (index: number, field: keyof ExpenseItemInput, value: string) => {
    setItems((prev) =>
      prev.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item))
    );
  };

  const addItem = () => {
    const defaultCategory = categories[0]?.code ?? "";
    setItems((prev) => [...prev, createEmptyItem(defaultCategory)]);
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const validateForm = () => {
    if (authLoading) {
      setError(null);
      return false;
    }
    const isAuthorized = user ? ["submitter", "site_manager", "hq_admin"].includes(user.role) : false;
    if (!token) {
      setError("로그인 세션이 만료되었습니다. 다시 로그인해 주세요.");
      return false;
    }
    if (!isAuthorized) {
      setError("경비 작성 권한이 없습니다.");
      return false;
    }
    if (!form.usageDate) {
      setError("사용일을 입력해 주세요.");
      return false;
    }
    if (!form.vendor.trim()) {
      setError("지출처(거래처)를 입력해 주세요.");
      return false;
    }
    if (!form.purposeDetail.trim()) {
      setError("지출 사유를 입력해 주세요.");
      return false;
    }
    if (sites.length > 0 && !form.siteId) {
      setError("적용할 현장을 선택해 주세요.");
      return false;
    }
    if (items.length === 0) {
      setError("최소 1개 이상의 항목을 입력해 주세요.");
      return false;
    }
    for (const item of items) {
      if (!item.category.trim()) {
        setError("항목의 분류를 입력해 주세요.");
        return false;
      }
      if (!item.amount.trim() || Number.isNaN(Number(item.amount))) {
        setError("항목 금액은 숫자로 입력해 주세요.");
        return false;
      }
      if (!item.usageDate) {
        setError("항목 사용일을 입력해 주세요.");
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!validateForm()) {
      return;
    }

    const totalAmountValue = Number(totalAmount.toFixed(2));

  const payload: {
    status: ExpenseStatusValue;
    totalAmount: number;
    usageDate: string;
    vendor: string;
    purposeDetail: string;
    siteId?: string;
    items: Array<{
      category: string;
      amount: number;
      usageDate: string;
      vendor: string;
        description?: string;
      }>;
    } = {
      status: form.status,
      totalAmount: totalAmountValue,
      usageDate: form.usageDate,
      vendor: form.vendor.trim(),
      purposeDetail: form.purposeDetail.trim(),
      siteId: form.siteId,
      items: items.map((item) => ({
        category: item.category.trim(),
        amount: Number(item.amount),
        usageDate: item.usageDate,
        vendor: item.vendor.trim() || form.vendor.trim(),
        description: item.description.trim() ? item.description.trim() : undefined
      }))
    };

    try {
      setSubmitting(true);
      await apiClient.post("/expenses", payload);
      setSuccess("경비가 저장되었습니다.");
      setTimeout(() => {
        router.push("/expenses").catch(() => undefined);
      }, 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "경비 저장 중 문제가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell title="경비 작성">
      <Head>
        <title>IKJIN EMS · 경비 작성</title>
      </Head>
      {metaLoading ? <p className="text-sm text-[#3E4C59]">경비 작성 정보를 불러오는 중...</p> : null}
      <form className="space-y-8" onSubmit={handleSubmit}>
        <section className="space-y-4 rounded-lg border border-[#E4E7EB] bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-[#0F4C81]">기본 정보</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {sites.length > 0 ? (
              <label className="flex flex-col gap-1 text-sm text-[#3E4C59]">
                <span>현장</span>
                <select
                  className="rounded-md border border-[#CBD2D9] px-3 py-2"
                  value={form.siteId ?? ""}
                  onChange={(event) => handleFormChange("siteId", event.target.value || undefined)}
                  disabled={sites.length === 1}
                >
                  <option value="">현장을 선택하세요</option>
                  {sites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.name ?? site.code}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="flex flex-col gap-1 text-sm text-[#3E4C59]">
              <span>사용일</span>
              <input
                className="rounded-md border border-[#CBD2D9] px-3 py-2"
                type="date"
                value={form.usageDate}
                onChange={(event) => handleFormChange("usageDate", event.target.value)}
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-[#3E4C59]">
              <span>지출처 (거래처)</span>
              <input
                className="rounded-md border border-[#CBD2D9] px-3 py-2"
                type="text"
                value={form.vendor}
                onChange={(event) => handleFormChange("vendor", event.target.value)}
                placeholder="예: ㈜익진엔지니어링"
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-[#3E4C59] md:col-span-2">
              <span>지출 사유</span>
              <textarea
                className="min-h-[96px] rounded-md border border-[#CBD2D9] px-3 py-2"
                value={form.purposeDetail}
                onChange={(event) => handleFormChange("purposeDetail", event.target.value)}
                placeholder="업무 관련 상세 내용을 입력해 주세요."
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-[#3E4C59] md:col-span-2">
              <span>저장 방식</span>
              <select
                className="rounded-md border border-[#CBD2D9] px-3 py-2"
                value={form.status}
                onChange={(event) => handleFormChange("status", event.target.value)}
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="space-y-4 rounded-lg border border-[#E4E7EB] bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-[#0F4C81]">지출 항목</h2>
            <div className="text-sm text-[#52606D]">
              총 금액:{" "}
              <span className="font-semibold text-[#0F4C81]">
                {totalAmount.toLocaleString("ko-KR", { style: "currency", currency: "KRW" })}
              </span>
            </div>
          </div>
          <div className="space-y-6">
            {items.map((item, index) => (
              <div
                key={`expense-item-${index}`}
                className="space-y-4 rounded-md border border-[#E4E7EB] p-4"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-[#0F4C81]">항목 #{index + 1}</p>
                  {items.length > 1 ? (
                    <button
                      type="button"
                      className="text-sm text-[#D64545] hover:underline"
                      onClick={() => removeItem(index)}
                    >
                      삭제
                    </button>
                  ) : null}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-1 text-sm text-[#3E4C59]">
                    <span>분류</span>
                    <select
                      className="rounded-md border border-[#CBD2D9] px-3 py-2"
                      value={item.category}
                      onChange={(event) => handleItemChange(index, "category", event.target.value)}
                      required
                    >
                      <option value="">분류 선택</option>
                      {categories.map((category) => (
                        <option key={category.code} value={category.code}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-[#3E4C59]">
                    <span>금액 (원)</span>
                    <input
                      className="rounded-md border border-[#CBD2D9] px-3 py-2"
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.amount}
                      onChange={(event) => handleItemChange(index, "amount", event.target.value)}
                      required
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-[#3E4C59]">
                    <span>사용일</span>
                    <input
                      className="rounded-md border border-[#CBD2D9] px-3 py-2"
                      type="date"
                      value={item.usageDate}
                      onChange={(event) => handleItemChange(index, "usageDate", event.target.value)}
                      required
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-[#3E4C59]">
                    <span>지출처</span>
                    <input
                      className="rounded-md border border-[#CBD2D9] px-3 py-2"
                      type="text"
                      value={item.vendor}
                      onChange={(event) => handleItemChange(index, "vendor", event.target.value)}
                      placeholder="미입력 시 기본 지출처가 사용됩니다."
                    />
                  </label>
                  <label className="md:col-span-2 flex flex-col gap-1 text-sm text-[#3E4C59]">
                    <span>비고</span>
                    <textarea
                      className="min-h-[72px] rounded-md border border-[#CBD2D9] px-3 py-2"
                      value={item.description}
                      onChange={(event) =>
                        handleItemChange(index, "description", event.target.value)
                      }
                      placeholder="추가 설명이 있으면 입력해 주세요."
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="rounded-md border border-dashed border-[#0F4C81] px-4 py-2 text-sm font-medium text-[#0F4C81] transition hover:bg-[#0F4C8110]"
            onClick={addItem}
          >
            항목 추가
          </button>
        </section>

        {error ? <p className="text-sm text-[#D64545]">{error}</p> : null}
        {success ? <p className="text-sm text-[#0F4C81]">{success}</p> : null}

        <div className="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            className="rounded-md border border-[#E4E7EB] px-4 py-2 text-sm text-[#3E4C59] transition hover:bg-[#E4E7EB]"
            onClick={() => router.push("/expenses").catch(() => undefined)}
            disabled={submitting}
          >
            목록으로
          </button>
          <button
            type="submit"
            className="rounded-md bg-[#0F4C81] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#0c3b64] disabled:cursor-not-allowed disabled:bg-[#9AA5B1]"
            disabled={submitting}
          >
            {form.status === "DRAFT" ? "임시 저장" : "경비 제출"}
          </button>
        </div>
      </form>
    </AppShell>
  );
};

export default NewExpensePage;
