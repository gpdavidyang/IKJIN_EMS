import Head from "next/head";
import { useEffect, useState } from "react";
import AppShell from "@/layout/AppShell";
import SummaryCard from "@/components/SummaryCard";
import ActivityTable, { type ActivityRow } from "@/components/ActivityTable";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/contexts/AuthContext";

interface DashboardMetrics {
  approvalRate: number;
  pendingSite: number;
  pendingHq: number;
  approved: number;
}

interface DashboardResponse {
  metrics: DashboardMetrics;
  recent: Array<{
    id: string;
    status: string;
    site: string;
    amount: string;
    usageDate: string;
    updatedAt: string;
  }>;
}

const DashboardPage = () => {
  const { token, loading: authLoading } = useAuth();
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
        setActivity(
          data.recent.map((item) => ({
            id: item.id,
            status: translateStatus(item.status),
            site: item.site,
            amount: formatCurrency(item.amount),
            usageDate: formatDate(item.usageDate),
            updatedAt: formatDate(item.updatedAt)
          }))
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "데이터를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    };

    void fetchDashboard();
  }, [token, authLoading]);

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
          <button className="rounded-md border border-[#E4E7EB] px-3 py-1 text-sm text-[#0F4C81]">
            전체 보기
          </button>
        </div>
        {error ? <p className="text-sm text-[#D64545]">{error}</p> : null}
        {loading ? <p className="text-sm text-[#3E4C59]">로딩 중...</p> : <ActivityTable rows={activity} />}
      </section>
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

function formatCurrency(value: string) {
  const amount = Number(value);
  if (Number.isNaN(amount)) return value;
  return amount.toLocaleString("ko-KR", { style: "currency", currency: "KRW" });
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().split("T")[0];
}

export default DashboardPage;
