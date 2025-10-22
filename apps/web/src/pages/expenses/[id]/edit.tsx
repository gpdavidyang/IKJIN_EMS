import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { FormEvent, useEffect, useMemo, useState } from "react";
import AppShell from "@/layout/AppShell";
import { apiClient } from "@/lib/apiClient";
import { PAYMENT_METHOD_LABELS } from "@/lib/expensePresenters";
import { useAuth } from "@/contexts/AuthContext";

interface SiteOption {
  id: string;
  code: string;
  name: string;
}

interface ExpenseDetailItem {
  id: string;
  category: string;
  paymentMethod: string;
  amount: string;
  usageDate: string;
  vendor: string;
  description?: string | null;
}

interface ExpenseDetailResponse {
  id: string;
  status: string;
  totalAmount: string;
  usageDate: string;
  vendor: string;
  purposeDetail: string;
  site: {
    id: string;
    code: string;
    name: string;
  } | null;
  items: ExpenseDetailItem[];
  permissions: {
    canEdit: boolean;
  };
}

const PAYMENT_METHOD_OPTIONS = Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => ({
  value,
  label
}));

const roundToCurrency = (value: number) => Math.round(value * 100) / 100;

const ExpenseEditPage = () => {
  const router = useRouter();
  const { id } = router.query;
  const { token, loading: authLoading, user } = useAuth();
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [expense, setExpense] = useState<ExpenseDetailResponse | null>(null);
  const [items, setItems] = useState<ExpenseDetailItem[]>([]);
  const [siteId, setSiteId] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("OTHER");
  const [totalAmount, setTotalAmount] = useState<string>("0");
  const [vendor, setVendor] = useState<string>("");
  const [memo, setMemo] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canEdit = useMemo(() => {
    if (!expense || !user) return false;
    return expense.permissions.canEdit && user.role === "submitter";
  }, [expense, user]);

  useEffect(() => {
    if (authLoading) return;
    if (!token) {
      setError("로그인이 필요합니다.");
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchMeta = async () => {
      try {
        const data = await apiClient.get<{ sites: SiteOption[] }>("/expenses/meta");
        if (!cancelled) {
          setSites(data.sites ?? []);
        }
      } catch {
        if (!cancelled) {
          setSites([]);
        }
      }
    };

    const fetchExpense = async () => {
      if (!router.isReady || typeof id !== "string") {
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const detail = await apiClient.get<ExpenseDetailResponse>(`/expenses/${id}`);
        if (cancelled) return;
        setExpense(detail);
        setItems(detail.items);
        setSiteId(detail.site?.id ?? "");
        setVendor(detail.vendor ?? "");
        setMemo(detail.purposeDetail ?? "");
        const numericAmount = Number(detail.totalAmount);
        setTotalAmount(Number.isNaN(numericAmount) ? "0" : numericAmount.toString());
        const firstMethod = detail.items.find((item) => item.paymentMethod)?.paymentMethod ?? "OTHER";
        setPaymentMethod(firstMethod);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "경비 정보를 불러오지 못했습니다.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void fetchMeta();
    void fetchExpense();

    return () => {
      cancelled = true;
    };
  }, [token, authLoading, router, id]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!expense) return;
    if (!canEdit) {
      setError("경비를 수정할 권한이 없습니다.");
      return;
    }
    setError(null);
    setSuccess(null);

    const totalAmountNumber = Number(totalAmount);
    if (!Number.isFinite(totalAmountNumber) || totalAmountNumber <= 0) {
      setError("총 금액을 올바르게 입력해 주세요.");
      return;
    }
    if (!paymentMethod) {
      setError("결제 수단을 선택해 주세요.");
      return;
    }
    if (!siteId) {
      setError("현장을 선택해 주세요.");
      return;
    }
    if (items.length === 0) {
      setError("수정할 항목 정보가 없습니다.");
      return;
    }

    const vendorValue = vendor.trim();
    if (!vendorValue) {
      setError("상호명을 입력해 주세요.");
      return;
    }
    const memoValue = memo.trim();

    const numericItems = items.map((item) => {
      const amount = Number(item.amount);
      return Number.isFinite(amount) ? amount : 0;
    });
    const originalTotal = numericItems.reduce((acc, value) => acc + value, 0);
    const adjustedAmounts: number[] = [];

    if (originalTotal > 0) {
      const ratio = totalAmountNumber / originalTotal;
      let remaining = totalAmountNumber;
      items.forEach((item, index) => {
        if (index === items.length - 1) {
          adjustedAmounts.push(roundToCurrency(Math.max(remaining, 0)));
        } else {
          const base = numericItems[index];
          const scaled = roundToCurrency(base * ratio);
          adjustedAmounts.push(scaled);
          remaining -= scaled;
          if (remaining < 0) {
            remaining = 0;
          }
        }
      });
    } else {
      const remainingItems = items.length - 1;
      items.forEach((_, index) => {
        if (index === 0) {
          adjustedAmounts.push(roundToCurrency(totalAmountNumber));
        } else {
          adjustedAmounts.push(remainingItems > 0 ? 0 : roundToCurrency(totalAmountNumber));
        }
      });
    }

    const payload = {
      status: expense.status,
      totalAmount: roundToCurrency(totalAmountNumber),
      usageDate: expense.usageDate,
      vendor: vendorValue,
      purposeDetail: memoValue,
      siteId,
      items: items.map((item, index) => ({
        category: item.category,
        paymentMethod,
        amount: adjustedAmounts[index],
        usageDate: item.usageDate,
        vendor: vendorValue,
        description: item.description ?? undefined
      }))
    };

    setSaving(true);
    try {
      await apiClient.patch(`/expenses/${expense.id}`, payload);
      setSuccess("경비를 수정했습니다.");
      await router.push(`/expenses/${expense.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "경비를 수정하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const selectedSite = useMemo(() => sites.find((site) => site.id === siteId), [sites, siteId]);
  const paymentMethodLabel = useMemo(
    () => PAYMENT_METHOD_LABELS[paymentMethod] ?? "결제 수단 선택",
    [paymentMethod]
  );
  const summaryAmount = useMemo(() => {
    const parsed = Number(totalAmount);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [totalAmount]);

  return (
    <AppShell title="경비 수정">
      <Head>
        <title>IKJIN EMS · 경비 수정</title>
      </Head>
      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-[#52606D]">경비 ID · {expense?.id ?? "-"}</p>
            <h1 className="text-xl font-semibold text-[#0F4C81]">
              {selectedSite?.name ?? selectedSite?.code ?? "현장 미지정"}
            </h1>
          </div>
          <div className="flex gap-2">
            <Link
              className="rounded-md border border-[#E4E7EB] px-3 py-2 text-sm text-[#3E4C59]"
              href={expense ? `/expenses/${expense.id}` : "/expenses"}
            >
              상세 보기
            </Link>
            <Link
              className="rounded-md border border-[#E4E7EB] px-3 py-2 text-sm text-[#3E4C59]"
              href="/expenses"
            >
              목록으로
            </Link>
          </div>
        </div>

        {loading ? <p className="text-sm text-[#3E4C59]">경비 정보를 불러오는 중...</p> : null}
        {error ? <p className="text-sm text-[#D64545]">{error}</p> : null}
        {success ? <p className="text-sm text-[#0F4C81]">{success}</p> : null}

        <section className="space-y-4 rounded-lg border border-[#E4E7EB] bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-[#0F4C81]">기본 정보</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm text-[#3E4C59]">
              <span>현장</span>
              <select
                className="rounded-md border border-[#E4E7EB] px-3 py-2 text-sm text-[#1F2933]"
                value={siteId}
                onChange={(event) => setSiteId(event.target.value)}
                disabled={!canEdit || loading}
                required
              >
                <option value="">현장을 선택해 주세요</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name ?? site.code}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm text-[#3E4C59]">
              <span>결제 수단</span>
              <select
                className="rounded-md border border-[#E4E7EB] px-3 py-2 text-sm text-[#1F2933]"
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value)}
                disabled={!canEdit || loading}
                required
              >
                <option value="">결제 수단을 선택해 주세요</option>
                {PAYMENT_METHOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm text-[#3E4C59]">
              <span>총 금액</span>
              <input
                type="number"
                step="0.01"
                min="0"
                className="rounded-md border border-[#E4E7EB] px-3 py-2 text-sm text-[#1F2933]"
                value={totalAmount}
                onChange={(event) => setTotalAmount(event.target.value)}
                disabled={!canEdit || loading}
                required
              />
            </label>
            <label className="flex flex-col gap-2 text-sm text-[#3E4C59]">
              <span>상호명</span>
              <input
                type="text"
                maxLength={100}
                className="rounded-md border border-[#E4E7EB] px-3 py-2 text-sm text-[#1F2933]"
                value={vendor}
                onChange={(event) => setVendor(event.target.value)}
                disabled={!canEdit || loading}
                required
              />
            </label>
            <label className="md:col-span-2 flex flex-col gap-2 text-sm text-[#3E4C59]">
              <span>비고</span>
              <textarea
                className="min-h-[120px] rounded-md border border-[#E4E7EB] px-3 py-2 text-sm text-[#1F2933]"
                value={memo}
                onChange={(event) => setMemo(event.target.value)}
                disabled={!canEdit || loading}
                maxLength={500}
                placeholder="경비 사용 목적이나 추가 메모를 입력해 주세요."
              />
            </label>
          </div>
        </section>

        <section className="space-y-4 rounded-lg border border-[#E4E7EB] bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-[#0F4C81]">요약</h2>
          <ul className="space-y-2 text-sm text-[#3E4C59]">
            <li>선택한 현장: {selectedSite?.name ?? selectedSite?.code ?? "현장 미지정"}</li>
            <li>결제 수단: {paymentMethodLabel}</li>
            <li>총 금액: {summaryAmount.toLocaleString("ko-KR", { style: "currency", currency: "KRW" })}</li>
            <li>항목 수: {items.length}건</li>
          </ul>
        </section>

        <div className="flex justify-end gap-2">
          <Link
            className="rounded-md border border-[#E4E7EB] px-4 py-2 text-sm text-[#3E4C59]"
            href={expense ? `/expenses/${expense.id}` : "/expenses"}
          >
            취소
          </Link>
          <button
            type="submit"
            className="rounded-md bg-[#0F4C81] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#0c3b64] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!canEdit || saving || loading}
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </form>
    </AppShell>
  );
};

export default ExpenseEditPage;
