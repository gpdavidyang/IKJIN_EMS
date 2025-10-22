import Head from "next/head";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import AppShell from "@/layout/AppShell";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/contexts/AuthContext";
import StatusBadge from "@/components/StatusBadge";
import {
  STATUS_OPTIONS,
  buildCategoryLabel,
  buildMemoFromItems,
  buildPaymentMethodLabel,
  formatCurrency,
  formatDate,
  translateStatus
} from "@/lib/expensePresenters";

const EDITABLE_STATUSES = ["DRAFT", "PENDING_SITE", "PENDING_HQ", "REJECTED_SITE", "REJECTED_HQ"];

interface ExpenseRow {
  id: string;
  siteId: string | null;
  userId: string | null;
  categoryCodes: string[];
  statusCode: string;
  statusLabel: string;
  submittedDate: string;
  userName: string;
  site: string;
  paymentMethod: string;
  category: string;
  vendor: string;
  amount: string;
  memo: string;
  managerComment: string;
  hqComment: string;
  permissions?: {
    canEdit: boolean;
    canResubmit: boolean;
  };
}

interface CategoryOption {
  code: string;
  name: string;
  description?: string;
}

interface SiteOption {
  id: string;
  code: string;
  name: string;
}

interface UserOption {
  id: string;
  fullName: string;
  email: string;
  siteId: string | null;
}

const findApprovalByStep = (approvals: any[] | undefined, step: number) => {
  if (!Array.isArray(approvals)) {
    return undefined;
  }
  return approvals.find((approval) => approval?.step === step);
};

const ExpensesPage = () => {
  const { token, loading: authLoading, user } = useAuth();
  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [siteFilter, setSiteFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [userFilter, setUserFilter] = useState<string>("ALL");
  const [searchInput, setSearchInput] = useState<string>("");
  const [keyword, setKeyword] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [amountMin, setAmountMin] = useState<string>("");
  const [amountMax, setAmountMax] = useState<string>("");
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);
  const [siteOptions, setSiteOptions] = useState<SiteOption[]>([]);
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);

  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (!token) {
      setCategoryOptions([]);
      setSiteOptions([]);
      setUserOptions([]);
      setSiteFilter("ALL");
      setCategoryFilter("ALL");
      setUserFilter("ALL");
      setSearchInput("");
      setKeyword("");
      return;
    }
    let cancelled = false;
    const fetchMetadata = async () => {
      try {
        const meta = await apiClient.get<{
          categories: CategoryOption[];
          sites: SiteOption[];
          users?: UserOption[];
        }>("/expenses/meta");
        if (cancelled) {
          return;
        }
        setCategoryOptions(meta.categories ?? []);
        setSiteOptions(meta.sites ?? []);
        setUserOptions(meta.users ?? []);
      } catch {
        if (!cancelled) {
          setCategoryOptions([]);
          setSiteOptions([]);
          setUserOptions([]);
        }
      }
    };
    void fetchMetadata();
    return () => {
      cancelled = true;
    };
  }, [token, authLoading]);

  useEffect(() => {
    if (siteFilter !== "ALL" && siteOptions.length > 0 && !siteOptions.some((site) => site.id === siteFilter)) {
      setSiteFilter("ALL");
    }
    if (
      categoryFilter !== "ALL" &&
      categoryOptions.length > 0 &&
      !categoryOptions.some((category) => category.code === categoryFilter)
    ) {
      setCategoryFilter("ALL");
    }
    if (userFilter !== "ALL" && userOptions.length > 0 && !userOptions.some((metaUser) => metaUser.id === userFilter)) {
      setUserFilter("ALL");
    }
  }, [siteOptions, categoryOptions, userOptions, siteFilter, categoryFilter, userFilter]);
  const buildQueryString = useCallback(() => {
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
    if (categoryFilter !== "ALL") {
      params.set("category", categoryFilter);
    }
    if (userFilter !== "ALL") {
      params.set("userId", userFilter);
    }
    if (keyword) {
      params.set("keyword", keyword);
    }
    return params.toString();
  }, [
    siteFilter,
    statusFilter,
    dateFrom,
    dateTo,
    amountMin,
    amountMax,
    categoryFilter,
    userFilter,
    keyword
  ]);

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
        const query = buildQueryString();
        const data = await apiClient.get<Array<any>>(query ? `/expenses?${query}` : "/expenses");
        setRows(
          data.map((item) => {
            const rawCategories: string[] = (item.items ?? []).map((expenseItem: any) =>
              typeof expenseItem?.category === "string" ? expenseItem.category.trim() : ""
            );
            const categoryCodes = Array.from(new Set(rawCategories.filter((code) => code.length > 0)));
            return {
              id: item.id,
              siteId: item.site?.id ?? null,
              userId: item.user?.id ?? null,
              categoryCodes,
              statusCode: item.status,
              statusLabel: translateStatus(item.status),
              submittedDate: formatDate(item.updatedAt),
              userName: item.user?.fullName ?? item.user?.email ?? "-",
              site: item.site?.name ?? item.site?.code ?? "-",
              paymentMethod: buildPaymentMethodLabel(item.items ?? []),
              category: buildCategoryLabel(item.items ?? []),
              vendor: item.vendor ?? "-",
              amount: formatCurrency(item.totalAmount),
              memo: (() => {
                const memoFromItems = buildMemoFromItems(item.items ?? []);
                if (memoFromItems !== "-" && memoFromItems.length > 0) {
                  return memoFromItems;
                }
                return typeof item.purposeDetail === "string" && item.purposeDetail.trim().length > 0
                  ? item.purposeDetail
                  : "-";
              })(),
              managerComment: findApprovalByStep(item.approvals, 1)?.comment ?? "-",
              hqComment: findApprovalByStep(item.approvals, 2)?.comment ?? "-",
              permissions: {
                canEdit: Boolean(item.permissions?.canEdit),
                canResubmit: Boolean(item.permissions?.canResubmit)
              }
            } satisfies ExpenseRow;
          })
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "경비 신청 현황을 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    };
    void fetchExpenses();
  }, [token, authLoading, buildQueryString]);

  const handleDownload = async () => {
    if (!token) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const query = buildQueryString();
      const path = query ? `/expenses/export?${query}` : "/expenses/export";
      const { blob, filename } = await apiClient.download(path);
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename ?? "expenses.xlsx";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Excel 파일을 내려받지 못했습니다.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <AppShell title="경비 신청 현황">
      <Head>
        <title>IKJIN EMS · 경비 신청 현황</title>
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
              {siteOptions.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name ?? site.code}
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
            <select
              className="rounded-md border border-[#E4E7EB] px-3 py-2 text-sm text-[#3E4C59]"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
            >
              <option value="ALL">전체 분류</option>
              {categoryOptions.map((category) => (
                <option key={category.code} value={category.code}>
                  {category.name}
                </option>
              ))}
            </select>
            <select
              className="rounded-md border border-[#E4E7EB] px-3 py-2 text-sm text-[#3E4C59]"
              value={userFilter}
              onChange={(event) => setUserFilter(event.target.value)}
            >
              <option value="ALL">전체 작성자</option>
              {userOptions.map((option) => {
                const label =
                  option.fullName && option.fullName.trim().length > 0
                    ? `${option.fullName} (${option.email})`
                    : option.email;
                return (
                  <option key={option.id} value={option.id}>
                    {label}
                  </option>
                );
              })}
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
            <div className="flex items-center gap-2">
              <input
                type="text"
                className="w-40 rounded-md border border-[#E4E7EB] px-3 py-2 text-sm text-[#3E4C59]"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    setKeyword(searchInput.trim());
                  }
                }}
                placeholder="검색어"
              />
              <button
                className="rounded-md border border-[#E4E7EB] px-3 py-2 text-sm text-[#0F4C81]"
                type="button"
                onClick={() => setKeyword(searchInput.trim())}
                disabled={loading}
              >
                검색
              </button>
            </div>
            <button
              className="rounded-md border border-[#E4E7EB] px-3 py-2 text-sm text-[#0F4C81]"
              onClick={() => {
                setSiteFilter("ALL");
                setStatusFilter("ALL");
                setCategoryFilter("ALL");
                setUserFilter("ALL");
                setDateFrom("");
                setDateTo("");
                setAmountMin("");
                setAmountMax("");
                setSearchInput("");
                setKeyword("");
              }}
            >
              필터 초기화
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="rounded-md border border-[#E4E7EB] px-3 py-2 text-sm text-[#0F4C81] transition hover:bg-[#0F4C8110] disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => void handleDownload()}
              disabled={downloading || !token || loading}
              type="button"
            >
              {downloading ? "다운로드 중..." : "Excel 다운로드"}
            </button>
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
        </div>
        {error ? <p className="text-sm text-[#D64545]">{error}</p> : null}
        {downloadError ? <p className="text-sm text-[#D64545]">{downloadError}</p> : null}
        {loading ? (
          <p className="text-sm text-[#3E4C59]">로딩 중...</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[#E4E7EB] bg-white">
            <table className="min-w-full table-fixed text-left text-sm text-[#3E4C59]">
              <thead className="bg-[#E4E7EB] text-xs uppercase text-[#3E4C59]">
                <tr>
                  <th className="w-[8%] px-3 py-3 whitespace-nowrap">날짜(제출일)</th>
                  <th className="w-[8%] px-3 py-3 whitespace-nowrap">작성자</th>
                  <th className="w-[10%] px-3 py-3 whitespace-nowrap">현장</th>
                  <th className="w-[8%] px-3 py-3 whitespace-nowrap">결제 수단</th>
                  <th className="w-[12%] px-3 py-3 whitespace-nowrap">분류(계정)</th>
                  <th className="w-[8%] px-3 py-3 whitespace-nowrap">상호명</th>
                  <th className="w-[10%] px-3 py-3 text-right whitespace-nowrap">금액</th>
                  <th className="w-[10%] px-3 py-3 whitespace-nowrap">상태</th>
                  <th className="w-[16%] px-3 py-3 whitespace-nowrap">비고</th>
                  <th className="w-[14%] px-3 py-3 whitespace-nowrap">소장 코멘트</th>
                  <th className="w-[14%] px-3 py-3 whitespace-nowrap">본사 코멘트</th>
                  <th className="w-[7%] px-3 py-3 text-center whitespace-nowrap">액션</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-[#E4E7EB]">
                    <td className="px-3 py-3">{row.submittedDate}</td>
                    <td className="px-3 py-3">{row.userName}</td>
                    <td className="px-3 py-3">{row.site}</td>
                    <td className="px-3 py-3">{row.paymentMethod}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{row.category}</td>
                    <td className="px-3 py-3">{row.vendor}</td>
                    <td className="px-3 py-3 text-right">{row.amount}</td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <StatusBadge status={row.statusCode} label={row.statusLabel} />
                    </td>
                    <td className="px-3 py-3">{row.memo}</td>
                    <td className="px-3 py-3">{row.managerComment || "-"}</td>
                    <td className="px-3 py-3">{row.hqComment || "-"}</td>
                    <td className="px-3 py-3 text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <Link
                          className="rounded-md border border-[#0F4C81] px-2 py-1 text-xs text-[#0F4C81] transition hover:bg-[#0F4C8110]"
                          href={`/expenses/${row.id}`}
                        >
                          상세
                        </Link>
                        {user?.role === "submitter" &&
                        row.userId === user?.id &&
                        EDITABLE_STATUSES.includes(row.statusCode) ? (
                          <Link
                            className="rounded-md border border-[#0F4C81] px-2 py-1 text-xs text-[#0F4C81] transition hover:bg-[#0F4C8110]"
                            href={`/expenses/${row.id}/edit`}
                          >
                            수정
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-6 text-center text-sm text-[#3E4C59]">
                      경비 신청 현황이 없습니다.
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

export default ExpensesPage;
