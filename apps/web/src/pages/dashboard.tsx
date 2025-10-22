import Head from "next/head";
import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/layout/AppShell";
import SummaryCard from "@/components/SummaryCard";
import ActivityTable, { type ActivityRow } from "@/components/ActivityTable";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/contexts/AuthContext";
import {
  buildCategoryLabel,
  buildMemoFromItems,
  buildPaymentMethodLabel,
  formatCurrency,
  formatDate,
  translateStatus
} from "@/lib/expensePresenters";

interface DashboardMetrics {
  approvalRate: number;
  pendingSite: number;
  pendingHq: number;
  approved: number;
}

interface DashboardRecentItem {
  id: string;
  status: string;
  totalAmount: string;
  usageDate: string;
  updatedAt: string;
  vendor: string | null;
  purposeDetail: string | null;
  siteId: string | null;
  userId: string | null;
  site: {
    id: string;
    name: string;
    code: string;
  } | null;
  user: {
    id: string;
    fullName: string | null;
    email: string;
  } | null;
  items: Array<{
    category: string;
    paymentMethod: string | null;
    amount: string;
    usageDate: string;
    vendor: string | null;
    description: string | null;
  }>;
  approvals: Array<{
    step: number;
    comment: string | null;
  }>;
}

interface DashboardResponse {
  metrics: DashboardMetrics;
  recent: DashboardRecentItem[];
}

const EDITABLE_STATUSES = new Set(["DRAFT", "REJECTED_SITE", "REJECTED_HQ"]);

const findApprovalByStep = (approvals: DashboardRecentItem["approvals"], step: number) =>
  approvals.find((approval) => approval.step === step);

const DashboardPage = () => {
  const { token, loading: authLoading, user } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboard = async () => {
      if (authLoading) {
        return;
      }
      if (!token) {
        setMetrics(null);
        setActivity([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const data = await apiClient.get<DashboardResponse>("/expenses/dashboard");
        setMetrics(data.metrics);
        const rows = data.recent.slice(0, 10).map((item) => {
          const memoFromItems = buildMemoFromItems(item.items ?? []);
        const memo =
          memoFromItems !== "-" && memoFromItems.length > 0
            ? memoFromItems
            : item.purposeDetail && item.purposeDetail.trim().length > 0
            ? item.purposeDetail
            : "-";

        const managerApproval = findApprovalByStep(item.approvals ?? [], 1);
        const hqApproval = findApprovalByStep(item.approvals ?? [], 2);
        const canEdit =
          user?.role === "submitter" &&
          Boolean(user.id) &&
          user.id === item.userId &&
          EDITABLE_STATUSES.has(item.status);

        return {
          id: item.id,
          submittedDate: formatDate(item.updatedAt),
          userName: item.user?.fullName?.trim().length ? item.user.fullName : item.user?.email ?? "-",
            site: item.site?.name ?? item.site?.code ?? "-",
            paymentMethod: buildPaymentMethodLabel(item.items ?? []),
            category: buildCategoryLabel(item.items ?? []),
            vendor: item.vendor ?? "-",
            amount: formatCurrency(item.totalAmount),
          statusCode: item.status,
          statusLabel: translateStatus(item.status),
          memo,
          managerComment: managerApproval?.comment ?? "-",
          hqComment: hqApproval?.comment ?? "-",
          canEdit
        } satisfies ActivityRow;
      });

        setActivity(rows);
      } catch (err) {
        setError(err instanceof Error ? err.message : "데이터를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    };

    void fetchDashboard();
  }, [token, authLoading, user]);

  const summaryCards = metrics
    ? [
        {
          label: "이번 달 승인률",
          value: `${metrics.approvalRate}%`,
          helper: "목표 90%"
        },
        {
          label: "소장 승인 대기",
          value: `${metrics.pendingSite}건`
        },
        {
          label: "본사 승인 대기",
          value: `${metrics.pendingHq}건`
        }
      ]
    : [
        { label: "이번 달 승인률", value: "-" },
        { label: "소장 승인 대기", value: "-" },
        { label: "본사 승인 대기", value: "-" }
      ];

  return (
    <AppShell title="대시보드">
      <Head>
        <title>IKJIN EMS · 대시보드</title>
      </Head>
      <section className="grid gap-6 md:grid-cols-3">
        {summaryCards.map((card) => (
          <SummaryCard key={card.label} {...card} />
        ))}
      </section>
      <section className="mt-8 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#0F4C81]">최근 활동</h2>
          <Link
            className="rounded-md border border-[#E4E7EB] px-3 py-1 text-sm text-[#0F4C81] transition hover:bg-[#0F4C8110]"
            href="/expenses"
          >
            전체 보기
          </Link>
        </div>
        {error ? <p className="text-sm text-[#D64545]">{error}</p> : null}
        {loading ? <p className="text-sm text-[#3E4C59]">로딩 중...</p> : <ActivityTable rows={activity} />}
      </section>
    </AppShell>
  );
};

export default DashboardPage;
