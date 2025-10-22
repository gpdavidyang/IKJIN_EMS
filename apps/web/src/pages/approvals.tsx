import Head from "next/head";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
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

interface PendingRow {
  id: string;
  status: string;
  statusLabel: string;
  submittedDate: string;
  usageDate: string;
  userId: string | null;
  userName: string;
  siteId: string | null;
  site: string;
  paymentMethod: string;
  category: string;
  categoryCodes: string[];
  vendor: string;
  amountValue: number;
  amountLabel: string;
  memo: string;
  managerComment: string;
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

const APPROVAL_STATUS_OPTIONS = STATUS_OPTIONS.filter((option) =>
  ["PENDING_SITE", "PENDING_HQ"].includes(option.value)
);

const findApprovalByStep = (approvals: any[] | undefined, step: number) => {
  if (!Array.isArray(approvals)) return undefined;
  return approvals.find((approval) => approval?.step === step);
};

const toNumber = (value: unknown) => {
  if (typeof value === "number") {
    return Number.isNaN(value) ? 0 : value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (value && typeof value === "object" && "toString" in value) {
    const parsed = Number((value as { toString: () => string }).toString());
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

const ApprovalsPage = () => {
  const router = useRouter();
  const { token, loading: authLoading, user } = useAuth();

  const [rows, setRows] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [actionComment, setActionComment] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);
  const [siteOptions, setSiteOptions] = useState<SiteOption[]>([]);
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);

  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [siteFilter, setSiteFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [userFilter, setUserFilter] = useState<string>("ALL");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [amountMin, setAmountMin] = useState<string>("");
  const [amountMax, setAmountMax] = useState<string>("");
  const [searchInput, setSearchInput] = useState<string>("");
  const [keyword, setKeyword] = useState<string>("");

  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [expandedAction, setExpandedAction] = useState<"approve" | "reject" | null>(null);
  const [expandedComment, setExpandedComment] = useState<string>("");
  const [expandedError, setExpandedError] = useState<string | null>(null);
  const [expandedLoading, setExpandedLoading] = useState(false);

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
  }, [authLoading, token]);

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

  const fetchPending = useCallback(async () => {
    if (authLoading) {
      return;
    }
    const isAuthorized = user ? user.role === "site_manager" || user.role === "hq_admin" : false;
    if (!token || !isAuthorized) {
      setRows([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<Array<any>>("/expenses/pending");
      const mapped = data.map((item) => {
        const rawCategories: string[] = (item.items ?? []).map((expenseItem: any) =>
          typeof expenseItem?.category === "string" ? expenseItem.category.trim() : ""
        );
        const categoryCodes = Array.from(new Set(rawCategories.filter((code) => code.length > 0)));
        const amountValue = toNumber(item.totalAmount);
        const memoText = (() => {
          const memoFromItems = buildMemoFromItems(item.items ?? []);
          if (memoFromItems !== "-" && memoFromItems.length > 0) {
            return memoFromItems;
          }
          return typeof item.purposeDetail === "string" && item.purposeDetail.trim().length > 0
            ? item.purposeDetail
            : "-";
        })();
        return {
          id: item.id,
          status: item.status,
          statusLabel: translateStatus(item.status),
          submittedDate: formatDate(item.updatedAt),
          usageDate: formatDate(item.usageDate),
          userId: item.userId ?? null,
          userName: item.user?.fullName ?? item.user?.email ?? "-",
          siteId: item.siteId ?? null,
          site: item.site?.name ?? item.site?.code ?? "-",
          paymentMethod: buildPaymentMethodLabel(item.items ?? []),
          category: buildCategoryLabel(item.items ?? []),
          categoryCodes,
          vendor: item.vendor ?? "-",
          amountValue,
          amountLabel: formatCurrency(amountValue),
          memo: memoText,
          managerComment: findApprovalByStep(item.approvals, 1)?.comment ?? "-"
        } satisfies PendingRow;
      });
      setRows(mapped);
      setSelected({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "승인 대기 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [authLoading, token, user]);

  useEffect(() => {
    void fetchPending();
  }, [fetchPending]);

  useEffect(() => {
    if (authLoading) return;
    const isAuthorized = user ? user.role === "site_manager" || user.role === "hq_admin" : false;
    if (user && !isAuthorized) {
      router.replace("/dashboard").catch(() => undefined);
    }
  }, [user, authLoading, router]);

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
    if (amountMin.trim()) {
      params.set("amountMin", amountMin.trim());
    }
    if (amountMax.trim()) {
      params.set("amountMax", amountMax.trim());
    }
    if (categoryFilter !== "ALL") {
      params.set("category", categoryFilter);
    }
    if (userFilter !== "ALL") {
      params.set("userId", userFilter);
    }
    if (keyword.trim().length > 0) {
      params.set("keyword", keyword.trim());
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

  const amountMinNumber = amountMin.trim() ? Number(amountMin.trim()) : null;
  const amountMaxNumber = amountMax.trim() ? Number(amountMax.trim()) : null;
  const keywordValue = keyword.trim().toLowerCase();

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (siteFilter !== "ALL" && row.siteId !== siteFilter) {
        return false;
      }
      if (statusFilter !== "ALL" && row.status !== statusFilter) {
        return false;
      }
      if (categoryFilter !== "ALL" && !row.categoryCodes.includes(categoryFilter)) {
        return false;
      }
      if (userFilter !== "ALL" && row.userId !== userFilter) {
        return false;
      }
      if (dateFrom && row.usageDate < dateFrom) {
        return false;
      }
      if (dateTo && row.usageDate > dateTo) {
        return false;
      }
      if (amountMinNumber !== null && !Number.isNaN(amountMinNumber) && row.amountValue < amountMinNumber) {
        return false;
      }
      if (amountMaxNumber !== null && !Number.isNaN(amountMaxNumber) && row.amountValue > amountMaxNumber) {
        return false;
      }
      if (keywordValue.length > 0) {
        const haystack = [
          row.userName,
          row.site,
          row.vendor,
          row.category,
          row.memo,
          row.statusLabel,
          row.managerComment,
          row.submittedDate,
          row.usageDate
        ]
          .map((value) => (typeof value === "string" ? value.toLowerCase() : ""))
          .filter((value) => value.length > 0);
        if (!haystack.some((value) => value.includes(keywordValue))) {
          return false;
        }
      }
      return true;
    });
  }, [
    rows,
    siteFilter,
    statusFilter,
    categoryFilter,
    userFilter,
    dateFrom,
    dateTo,
    amountMinNumber,
    amountMaxNumber,
    keywordValue
  ]);

  const selectedIds = useMemo(
    () => Object.entries(selected).filter(([, value]) => value).map(([id]) => id),
    [selected]
  );

  const visibleSelectedCount = useMemo(
    () => filteredRows.filter((row) => selected[row.id]).length,
    [filteredRows, selected]
  );

  const allVisibleSelected = filteredRows.length > 0 && filteredRows.every((row) => selected[row.id]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleSelectAll = (value: boolean) => {
    setSelected((prev) => {
      const next = { ...prev };
      filteredRows.forEach((row) => {
        next[row.id] = value;
      });
      return next;
    });
  };

  const openRowAction = (rowId: string, action: "approve" | "reject") => {
    setExpandedRowId((prev) => (prev === rowId && expandedAction === action ? null : rowId));
    setExpandedAction(action);
    setExpandedComment("");
    setExpandedError(null);
  };

  const cancelRowAction = () => {
    setExpandedRowId(null);
    setExpandedAction(null);
    setExpandedComment("");
    setExpandedError(null);
  };

  const performRowAction = async (row: PendingRow) => {
    if (!expandedAction) return;
    if (expandedAction === "reject" && expandedComment.trim().length === 0) {
      setExpandedError("반려 사유를 입력해 주세요.");
      return;
    }

    try {
      setExpandedLoading(true);
      setExpandedError(null);
      const endpoint = expandedAction === "approve" ? "/expenses/approve" : "/expenses/reject";
      await apiClient.post(endpoint, {
        expenseIds: [row.id],
        comment: expandedComment.trim() ? expandedComment.trim() : undefined
      });
      setRows((prev) => prev.filter((item) => item.id !== row.id));
      setSelected((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
      cancelRowAction();
      setActionSuccess(expandedAction === "approve" ? "경비를 승인했습니다." : "경비를 반려했습니다.");
      await reloadPending();
    } catch (err) {
      setExpandedError(err instanceof Error ? err.message : "처리 중 오류가 발생했습니다.");
    } finally {
      setExpandedLoading(false);
    }
  };

  const openActionPanel = (type: "approve" | "reject") => {
    if (selectedIds.length === 0) {
      setActionError("처리할 경비를 선택해 주세요.");
      return;
    }
    setActionType(type);
    setActionComment("");
    setActionError(null);
    setActionSuccess(null);
  };

  const cancelAction = () => {
    setActionType(null);
    setActionComment("");
    setActionError(null);
    setActionSuccess(null);
  };

  const reloadPending = useCallback(async () => {
    await fetchPending();
  }, [fetchPending]);

  const performAction = async () => {
    if (!actionType) return;
    if (selectedIds.length === 0) {
      setActionError("처리할 경비를 선택해 주세요.");
      return;
    }
    if (actionType === "reject" && actionComment.trim().length === 0) {
      setActionError("반려 사유를 입력해 주세요.");
      return;
    }

    try {
      setActionLoading(true);
      setActionError(null);
      const endpoint = actionType === "approve" ? "/expenses/approve" : "/expenses/reject";
      await apiClient.post(endpoint, {
        expenseIds: selectedIds,
        comment: actionComment.trim() ? actionComment.trim() : undefined
      });
      setActionSuccess(actionType === "approve" ? "선택한 경비를 승인했습니다." : "선택한 경비를 반려했습니다.");
      setSelected({});
      setActionType(null);
      setActionComment("");
      await reloadPending();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "처리 중 오류가 발생했습니다.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <AppShell title="승인 대기">
      <Head>
        <title>IKJIN EMS · 승인 대기</title>
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
              {APPROVAL_STATUS_OPTIONS.map((status) => (
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
          </div>
        </div>
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-[#0F4C81]">승인 대기 {filteredRows.length}건</p>
            <p className="text-sm text-[#3E4C59]">현장 별 승인 우선순위를 검토해 주세요.</p>
            {visibleSelectedCount > 0 ? (
              <p className="text-xs text-[#52606D]">선택 {visibleSelectedCount}건</p>
            ) : null}
          </div>
          <div className="flex gap-2">
            <button
              className="rounded-md border border-[#E4E7EB] px-3 py-2 text-sm text-[#0F4C81] disabled:opacity-50"
              onClick={() => openActionPanel("approve")}
              disabled={actionLoading}
            >
              일괄 승인
            </button>
            <button
              className="rounded-md border border-[#D64545] px-3 py-2 text-sm text-[#D64545] disabled:opacity-50"
              onClick={() => openActionPanel("reject")}
              disabled={actionLoading}
            >
              일괄 반려
            </button>
          </div>
        </header>
        {error ? <p className="text-sm text-[#D64545]">{error}</p> : null}
        {downloadError ? <p className="text-sm text-[#D64545]">{downloadError}</p> : null}
        {actionError ? <p className="text-sm text-[#D64545]">{actionError}</p> : null}
        {actionSuccess ? <p className="text-sm text-[#0F4C81]">{actionSuccess}</p> : null}
        {actionType ? (
          <div className="rounded-md border border-[#0F4C81] bg-[#0F4C8110] p-4 text-sm text-[#0F4C81]">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="font-medium">
                  {actionType === "approve" ? "선택한 경비 승인" : "선택한 경비 반려"}
                </p>
                <button className="text-xs text-[#3E4C59] underline" onClick={cancelAction} disabled={actionLoading}>
                  닫기
                </button>
              </div>
              <p className="text-[#3E4C59]">
                {actionType === "approve" ? "필요하면 비고를 남겨 주세요." : "반려 사유를 꼭 입력해 주세요."}
              </p>
              <textarea
                className="min-h-[90px] rounded-md border border-[#CBD2D9] bg-white px-3 py-2 text-[#3E4C59]"
                placeholder={actionType === "approve" ? "승인 코멘트 (선택 사항)" : "반려 사유"}
                value={actionComment}
                onChange={(event) => setActionComment(event.target.value)}
                disabled={actionLoading}
              />
              <div className="flex justify-end gap-2">
                <button
                  className="rounded-md border border-[#E4E7EB] px-3 py-2 text-[#3E4C59] disabled:opacity-60"
                  type="button"
                  onClick={cancelAction}
                  disabled={actionLoading}
                >
                  취소
                </button>
                <button
                  className={`rounded-md px-3 py-2 text-white shadow-sm transition disabled:opacity-60 ${
                    actionType === "approve" ? "bg-[#0F4C81] hover:bg-[#0c3b64]" : "bg-[#D64545] hover:bg-[#a53434]"
                  }`}
                  type="button"
                  onClick={() => void performAction()}
                  disabled={actionLoading}
                >
                  {actionLoading ? "처리 중..." : actionType === "approve" ? "승인" : "반려"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {loading ? (
          <p className="text-sm text-[#3E4C59]">로딩 중...</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[#E4E7EB] bg-white">
            <table className="min-w-full table-fixed text-left text-sm text-[#3E4C59]">
              <thead className="bg-[#E4E7EB] text-xs uppercase text-[#3E4C59]">
                <tr>
                  <th className="w-[4%] px-3 py-3">
                    <input
                      type="checkbox"
                      aria-label="전체 선택"
                      checked={allVisibleSelected}
                      onChange={(event) => toggleSelectAll(event.target.checked)}
                    />
                  </th>
                  <th className="w-[10%] px-3 py-3 whitespace-nowrap">날짜(제출일)</th>
                  <th className="w-[10%] px-3 py-3 whitespace-nowrap">작성자</th>
                  <th className="w-[10%] px-3 py-3 whitespace-nowrap">현장</th>
                  <th className="w-[10%] px-3 py-3 whitespace-nowrap">결제 수단</th>
                  <th className="w-[10%] px-3 py-3 whitespace-nowrap">분류(계정)</th>
                  <th className="w-[9%] px-3 py-3 whitespace-nowrap">상호명</th>
                  <th className="w-[8%] px-3 py-3 text-right whitespace-nowrap">금액</th>
                  <th className="w-[8%] px-3 py-3 whitespace-nowrap">상태</th>
                  <th className="w-[14%] px-3 py-3 whitespace-nowrap">비고</th>
                  <th className="w-[14%] px-3 py-3 whitespace-nowrap">소장 코멘트</th>
                  <th className="w-[13%] px-3 py-3 text-center whitespace-nowrap">액션</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <Fragment key={row.id}>
                    <tr className="border-t border-[#E4E7EB] align-top">
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          aria-label={`${row.site} 경비 선택`}
                          checked={Boolean(selected[row.id])}
                          onChange={() => toggleSelect(row.id)}
                        />
                      </td>
                      <td className="px-3 py-3">{row.submittedDate}</td>
                      <td className="px-3 py-3">{row.userName}</td>
                      <td className="px-3 py-3">{row.site}</td>
                      <td className="px-3 py-3">{row.paymentMethod}</td>
                      <td className="px-3 py-3">{row.category}</td>
                      <td className="px-3 py-3">{row.vendor}</td>
                      <td className="px-3 py-3 text-right">{row.amountLabel}</td>
                      <td className="px-3 py-3">
                        <StatusBadge status={row.status} label={row.statusLabel} />
                      </td>
                      <td className="px-3 py-3">{row.memo}</td>
                      <td className="px-3 py-3">{row.managerComment || "-"}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-nowrap items-center justify-center gap-2">
                          <button
                            className="inline-flex items-center justify-center whitespace-nowrap rounded-md border border-[#0F4C81] px-2 py-1 text-xs text-[#0F4C81] transition hover:bg-[#0F4C8110]"
                            type="button"
                            onClick={() => router.push(`/expenses/${row.id}`)}
                          >
                            상세
                          </button>
                          <button
                            className="inline-flex items-center justify-center whitespace-nowrap rounded-md border border-[#0F4C81] px-2 py-1 text-xs text-[#0F4C81] transition hover:bg-[#0F4C8110]"
                            type="button"
                            onClick={() => openRowAction(row.id, "approve")}
                          >
                            승인
                          </button>
                          <button
                            className="inline-flex items-center justify-center whitespace-nowrap rounded-md border border-[#D64545] px-2 py-1 text-xs text-[#D64545] transition hover:bg-[#FDECEC]"
                            type="button"
                            onClick={() => openRowAction(row.id, "reject")}
                          >
                            반려
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedRowId === row.id ? (
                      <tr className="border-t border-[#E4E7EB] bg-[#F8FAFC]">
                        <td colSpan={12} className="px-4 py-3">
                          <div className="flex flex-col gap-3 text-sm text-[#1F2933]">
                            <p className="font-medium text-[#0F4C81]">
                              {expandedAction === "approve" ? "승인 코멘트" : "반려 사유"}
                            </p>
                            <textarea
                              className="min-h-[80px] rounded-md border border-[#CBD2D9] bg-white px-3 py-2"
                              value={expandedComment}
                              onChange={(event) => setExpandedComment(event.target.value)}
                              placeholder={expandedAction === "approve" ? "승인 시 남길 메모 (선택 사항)" : "반려 사유를 입력해 주세요."}
                              disabled={expandedLoading}
                            />
                            {expandedError ? <p className="text-xs text-[#D64545]">{expandedError}</p> : null}
                            <div className="flex justify-end gap-2">
                              <button
                                className="rounded-md border border-[#E4E7EB] px-3 py-2 text-xs text-[#3E4C59] disabled:opacity-60"
                                type="button"
                                onClick={cancelRowAction}
                                disabled={expandedLoading}
                              >
                                취소
                              </button>
                              <button
                                className={`rounded-md px-3 py-2 text-xs text-white shadow-sm transition disabled:opacity-60 ${
                                  expandedAction === "approve"
                                    ? "bg-[#0F4C81] hover:bg-[#0c3b64]"
                                    : "bg-[#D64545] hover:bg-[#a53434]"
                                }`}
                                type="button"
                                onClick={() => void performRowAction(row)}
                                disabled={expandedLoading}
                              >
                                {expandedLoading ? "처리 중..." : expandedAction === "approve" ? "승인" : "반려"}
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-6 text-center text-sm text-[#3E4C59]">
                      승인 대기 건이 없습니다.
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

export default ApprovalsPage;
