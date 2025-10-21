import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/layout/AppShell";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/contexts/AuthContext";

interface ExpenseRow {
  id: string;
  status: string;
  statusCode: string;
  site: string;
  category: string;
  amount: string;
  usageDate: string;
  submittedAt: string;
}

const ExpensesPage = () => {
  const { token, loading: authLoading, user } = useAuth();
  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [siteFilter, setSiteFilter] = useState<string>("ALL");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [amountMin, setAmountMin] = useState<string>("");
  const [amountMax, setAmountMax] = useState<string>("");

  useEffect(() => {
    const fetchExpenses = async () => {
      if (authLoading) {
        return;
      }
      if (!token) {
        setRows([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (siteFilter !== "ALL") {
          params.set("siteId", siteFilter);
        }
        if (statusFilter !== "ALL") {
          params.append("status", statusFilter);
        }
        if (dateFrom) {
          params.set("dateFrom", dateFrom);
        }
        if (dateTo) {
          params.set("dateTo", dateTo);
        }
        if (amountMin) {
          params.set("amountMin", amountMin);
        }
        if (amountMax) {
          params.set("amountMax", amountMax);
        }

        const query = params.toString();
        const data = await apiClient.get<Array<any>>(query ? `/expenses?${query}` : "/expenses");
        setRows(
          data.map((item) => ({
            id: item.id,
            status: translateStatus(item.status),
            statusCode: item.status,
            site: item.site?.name ?? item.site?.code ?? "-",
            category: item.items?.[0]?.category ?? "-",
            amount: formatCurrency(item.totalAmount),
            usageDate: formatDate(item.usageDate),
            submittedAt: formatDate(item.updatedAt)
          }))
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "경비 내역을 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    };
    void fetchExpenses();
  }, [token, authLoading, siteFilter, statusFilter, dateFrom, dateTo, amountMin, amountMax]);

  const sites = useMemo(() => {
    const unique = new Set<string>();
    rows.forEach((row) => {
      if (row.site !== "-") unique.add(row.site);
    });
    return Array.from(unique);
  }, [rows]);

  const filteredRows = rows.filter((row) => {
    const passSite = siteFilter === "ALL" || row.site === siteFilter;
    const passStatus = statusFilter === "ALL" || row.statusCode === statusFilter;
    return passSite && passStatus;
  });

  return (
    <AppShell title="경비 내역">
      <Head>
        <title>IKJIN EMS · 경비 내역</title>
      </Head>
      <section className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <select
              className="rounded-md border border-[#E4E7EB] px-3 py-2 text-sm text-[#3E4C59]"
              value={siteFilter}
              onChange={(event) => setSiteFilter(event.target.value)}
            >
              <option value="ALL">전체 현장</option>
              {sites.map((site) => (
                <option key={site} value={site}>
                  {site}
                </option>
              ))}
            </select>
            <select
              className="rounded-md border border-[#E4E7EB] px-3 py-2 text-sm text-[#3E4C59]"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="ALL">전체 상태</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
            <input
              type="date"
              className="rounded-md border border-[#E4E7EB] px-3 py-2 text-sm text-[#3E4C59]"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              placeholder="시작일"
            />
            <input
              type="date"
              className="rounded-md border border-[#E4E7EB] px-3 py-2 text-sm text-[#3E4C59]"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              placeholder="종료일"
            />
            <input
              type="number"
              min="0"
              className="w-32 rounded-md border border-[#E4E7EB] px-3 py-2 text-sm text-[#3E4C59]"
              value={amountMin}
              onChange={(event) => setAmountMin(event.target.value)}
              placeholder="최소금액"
            />
            <input
              type="number"
              min="0"
              className="w-32 rounded-md border border-[#E4E7EB] px-3 py-2 text-sm text-[#3E4C59]"
              value={amountMax}
              onChange={(event) => setAmountMax(event.target.value)}
              placeholder="최대금액"
            />
            <button
              className="rounded-md border border-[#E4E7EB] px-3 py-2 text-sm text-[#0F4C81]"
              onClick={() => {
                setSiteFilter("ALL");
                setStatusFilter("ALL");
                setDateFrom("");
                setDateTo("");
                setAmountMin("");
                setAmountMax("");
              }}
            >
              필터 초기화
            </button>
          </div>
          {user && ["submitter", "site_manager", "hq_admin"].includes(user.role) ? (
            <Link
              className="inline-flex items-center gap-2 rounded-md bg-[#0F4C81] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#0c3b64]"
              href="/expenses/new"
            >
              <span className="text-base leading-none">＋</span>
              경비 작성
            </Link>
          ) : null}
        </div>
        {error ? <p className="text-sm text-[#D64545]">{error}</p> : null}
        {loading ? (
          <p className="text-sm text-[#3E4C59]">로딩 중...</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-[#E4E7EB] bg-white">
            <table className="min-w-full text-left text-sm text-[#3E4C59]">
              <thead className="bg-[#E4E7EB] text-xs uppercase text-[#3E4C59]">
                <tr>
                  <th className="px-4 py-3">상태</th>
                  <th className="px-4 py-3">현장</th>
                  <th className="px-4 py-3">항목</th>
                  <th className="px-4 py-3">금액</th>
                  <th className="px-4 py-3">사용일</th>
                  <th className="px-4 py-3">제출/업데이트</th>
                  <th className="px-4 py-3">상세</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id} className="border-t border-[#E4E7EB]">
                    <td className="px-4 py-3">{row.status}</td>
                    <td className="px-4 py-3">{row.site}</td>
                    <td className="px-4 py-3">{row.category}</td>
                    <td className="px-4 py-3">{row.amount}</td>
                    <td className="px-4 py-3">{row.usageDate}</td>
                    <td className="px-4 py-3">{row.submittedAt}</td>
                    <td className="px-4 py-3">
                      <Link className="text-[#0F4C81] underline" href={`/expenses/${row.id}`}>
                        보기
                      </Link>
                    </td>
                  </tr>
                ))}
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-sm text-[#3E4C59]">
                      경비 내역이 없습니다.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppShell>
  );
};

const STATUS_OPTIONS = [
  { value: "DRAFT", label: "임시저장" },
  { value: "PENDING_SITE", label: "소장승인대기" },
  { value: "REJECTED_SITE", label: "소장반려" },
  { value: "PENDING_HQ", label: "본사승인대기" },
  { value: "REJECTED_HQ", label: "본사반려" },
  { value: "APPROVED", label: "승인완료" }
];

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

export default ExpensesPage;
