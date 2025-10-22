import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/layout/AppShell";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/contexts/AuthContext";

interface ExpenseDetailItem {
  id: string;
  category: string;
  paymentMethod: string;
  amount: string;
  usageDate: string;
  vendor: string;
  description?: string | null;
}

interface ExpenseApprovalItem {
  id: string;
  step: number;
  action: string;
  comment?: string | null;
  actedAt: string | null;
  approver?: {
    id: string;
    fullName?: string | null;
    email: string;
  } | null;
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
  user: {
    id: string;
    fullName?: string | null;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
  items: ExpenseDetailItem[];
  approvals: ExpenseApprovalItem[];
  permissions: {
    canEdit: boolean;
    canResubmit: boolean;
  };
}

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

const extractPaymentMethod = (expense: ExpenseDetailResponse | null): string => {
  if (!expense) return "-";
  const methods = Array.from(
    new Set(
      expense.items
        .map((item) => (typeof item.paymentMethod === "string" ? item.paymentMethod.trim() : ""))
        .filter((value) => value.length > 0)
    )
  );
  if (methods.length === 0) {
    return "-";
  }
  return methods.map((method) => PAYMENT_METHOD_LABELS[method] ?? method).join(", ");
};

const buildMemoFromItems = (items: ExpenseDetailItem[]): string => {
  const descriptions = items
    .map((item) => (item.description ? item.description.trim() : ""))
    .filter((value) => value.length > 0);
  return descriptions.length > 0 ? descriptions.join(", ") : "-";
};

const translateCategoryCode = (code: string): string => CATEGORY_LABELS[code] ?? code;

const findApprovalByStep = (approvals: ExpenseApprovalItem[], step: number) =>
  approvals.find((approval) => approval.step === step);

const ExpenseDetailPage = () => {
  const router = useRouter();
  const { id } = router.query;
  const { loading: authLoading, token } = useAuth();
  const [expense, setExpense] = useState<ExpenseDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const paymentMethod = useMemo(() => extractPaymentMethod(expense), [expense]);
  const memoText = useMemo(() => (expense ? buildMemoFromItems(expense.items) : "-"), [expense]);
  const managerApproval = useMemo(
    () => (expense ? findApprovalByStep(expense.approvals, 1) : undefined),
    [expense]
  );
  const hqApproval = useMemo(
    () => (expense ? findApprovalByStep(expense.approvals, 2) : undefined),
    [expense]
  );
  const submittedDate = useMemo(() => (expense ? formatDate(expense.updatedAt) : "-"), [expense]);

  useEffect(() => {
    if (!router.isReady || authLoading) return;
    if (!token) {
      setError("로그인이 필요합니다.");
      return;
    }

    const fetchDetail = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiClient.get<ExpenseDetailResponse>(`/expenses/${id}`);
        setExpense(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "경비 정보를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    };

    void fetchDetail();
  }, [router, id, authLoading, token]);

  const handleEdit = () => {
    if (!expense) return;
    router.push(`/expenses/${expense.id}/edit`).catch(() => undefined);
  };

  return (
    <AppShell title="경비 상세">
      <Head>
        <title>IKJIN EMS · 경비 상세</title>
      </Head>
      {loading ? <p className="text-sm text-[#3E4C59]">로딩 중...</p> : null}
      {error ? <p className="text-sm text-[#D64545]">{error}</p> : null}
      {!loading && !expense && !error ? (
        <p className="text-sm text-[#3E4C59]">경비 정보를 찾을 수 없습니다.</p>
      ) : null}
      {expense ? (
        <div className="space-y-6">
          <section className="rounded-lg border border-[#E4E7EB] bg-white p-6 shadow-sm">
            <header className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm text-[#52606D]">경비 ID · {expense.id}</p>
                <h1 className="text-xl font-semibold text-[#0F4C81]">{translateStatus(expense.status)}</h1>
                <p className="mt-1 text-sm text-[#52606D]">
                  {expense.site?.name ?? expense.site?.code ?? "현장 미지정"} · 제출일 {submittedDate}
                </p>
              </div>
              <div className="flex gap-2">
                <Link
                  className="rounded-md border border-[#E4E7EB] px-3 py-2 text-sm text-[#3E4C59]"
                  href="/expenses"
                >
                  목록으로
                </Link>
                {expense.permissions.canEdit ? (
                  <button
                    className="rounded-md bg-[#0F4C81] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#0c3b64]"
                    onClick={handleEdit}
                  >
                    수정
                  </button>
                ) : null}
              </div>
            </header>
            <dl className="mt-6 grid gap-4 md:grid-cols-3">
              <div>
                <dt className="text-xs uppercase text-[#9AA5B1]">제출자</dt>
                <dd className="text-sm text-[#1F2933]">
                  {expense.user.fullName ?? expense.user.email}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-[#9AA5B1]">현장</dt>
                <dd className="text-sm text-[#1F2933]">
                  {expense.site?.name ?? expense.site?.code ?? "현장 미지정"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-[#9AA5B1]">결제 수단</dt>
                <dd className="text-sm text-[#1F2933]">{paymentMethod}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-[#9AA5B1]">총 금액</dt>
                <dd className="text-sm text-[#1F2933]">{formatCurrency(expense.totalAmount)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-[#9AA5B1]">상호명</dt>
                <dd className="text-sm text-[#1F2933]">{expense.vendor}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-[#9AA5B1]">최근 업데이트</dt>
                <dd className="text-sm text-[#1F2933]">{formatDateTime(expense.updatedAt)}</dd>
              </div>
              <div className="md:col-span-3">
                <dt className="text-xs uppercase text-[#9AA5B1]">비고</dt>
                <dd className="mt-1 whitespace-pre-wrap rounded-md border border-[#E4E7EB] bg-[#F8FAFC] px-3 py-2 text-sm text-[#1F2933]">
                  {memoText}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-lg border border-[#E4E7EB] bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-[#0F4C81]">승인 요약</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <ApprovalSummaryCard
                title="소장 승인"
                approval={managerApproval}
              />
              <ApprovalSummaryCard
                title="본사 승인"
                approval={hqApproval}
              />
            </div>
          </section>

          <section className="rounded-lg border border-[#E4E7EB] bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-[#0F4C81]">지출 항목</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm text-[#3E4C59]">
                <thead className="bg-[#E4E7EB] text-xs uppercase text-[#3E4C59]">
                  <tr>
                    <th className="px-4 py-3">분류</th>
                    <th className="px-4 py-3">금액</th>
                    <th className="px-4 py-3">사용일</th>
                    <th className="px-4 py-3">지출처</th>
                    <th className="px-4 py-3">비고</th>
                  </tr>
                </thead>
                <tbody>
                  {expense.items.map((item) => (
                    <tr key={item.id} className="border-t border-[#E4E7EB]">
                      <td className="px-4 py-3">{translateCategoryCode(item.category)}</td>
                      <td className="px-4 py-3">{formatCurrency(item.amount)}</td>
                      <td className="px-4 py-3">{formatDate(item.usageDate)}</td>
                      <td className="px-4 py-3">{item.vendor}</td>
                      <td className="px-4 py-3">{item.description ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-lg border border-[#E4E7EB] bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-[#0F4C81]">결재 이력</h2>
            {expense.approvals.length === 0 ? (
              <p className="mt-2 text-sm text-[#52606D]">아직 결재 이력이 없습니다.</p>
            ) : (
              <ul className="mt-4 space-y-3 text-sm text-[#3E4C59]">
                {expense.approvals.map((approval) => (
                  <li key={approval.id} className="rounded-md border border-[#E4E7EB] px-4 py-3">
                    <p className="font-medium text-[#0F4C81]">
                      {translateApprovalAction(approval.action)} · {approval.approver?.fullName ?? approval.approver?.email ?? "-"}
                    </p>
                    <p className="text-xs text-[#52606D]">{approval.actedAt ? formatDateTime(approval.actedAt) : "처리 대기"}</p>
                    {approval.comment ? (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-[#1F2933]">{approval.comment}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}
    </AppShell>
  );
};

function translateStatus(status: string) {
  const map: Record<string, string> = {
    DRAFT: "임시저장",
    PENDING_SITE: "소장승인대기",
    REJECTED_SITE: "소장반려",
    PENDING_HQ: "본사승인대기",
    REJECTED_HQ: "본사반려",
    APPROVED: "승인완료"
  };
  return map[status] ?? status;
}

function translateApprovalAction(action: string) {
  const map: Record<string, string> = {
    APPROVED: "승인",
    REJECTED: "반려",
    PENDING: "대기"
  };
  return map[action] ?? action;
}

function formatCurrency(value: string | number) {
  const amount = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(amount)) return typeof value === "string" ? value : amount.toString();
  return amount.toLocaleString("ko-KR", { style: "currency", currency: "KRW" });
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().split("T")[0];
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toISOString().split("T")[0]} ${date.toTimeString().slice(0, 5)}`;
}

export default ExpenseDetailPage;

interface ApprovalSummaryCardProps {
  title: string;
  approval?: ExpenseApprovalItem;
}

const ApprovalSummaryCard = ({ title, approval }: ApprovalSummaryCardProps) => {
  const statusLabel = approval ? translateApprovalAction(approval.action) : "대기";
  const approver = approval?.approver?.fullName ?? approval?.approver?.email ?? "-";
  const actedAtLabel = approval?.actedAt ? formatDateTime(approval.actedAt) : "처리 대기";
  const comment = approval?.comment?.trim() ? approval.comment : "-";

  return (
    <div className="rounded-md border border-[#E4E7EB] bg-[#F8FAFC] p-4">
      <p className="text-sm font-semibold text-[#0F4C81]">{title}</p>
      <dl className="mt-3 space-y-2 text-sm text-[#1F2933]">
        <div>
          <dt className="text-xs uppercase text-[#9AA5B1]">상태</dt>
          <dd>{statusLabel}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-[#9AA5B1]">승인자</dt>
          <dd>{approver}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-[#9AA5B1]">처리일</dt>
          <dd>{actedAtLabel}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-[#9AA5B1]">코멘트</dt>
          <dd className="whitespace-pre-wrap">{comment}</dd>
        </div>
      </dl>
    </div>
  );
};
