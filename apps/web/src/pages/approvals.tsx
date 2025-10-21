import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import AppShell from "@/layout/AppShell";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/contexts/AuthContext";

interface PendingRow {
  id: string;
  submitter: string;
  site: string;
  category: string;
  amount: string;
  usageDate: string;
  submittedAt: string;
  hasComment: boolean;
}

const ApprovalsPage = () => {
  const router = useRouter();
  const { token, loading: authLoading, user } = useAuth();
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [actionComment, setActionComment] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const fetchPending = async () => {
      if (authLoading) {
        return;
      }
      const isAuthorized = user ? user.role === "site_manager" || user.role === "hq_admin" : false;
      if (!token || !isAuthorized) {
        setPending([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const data = await apiClient.get<Array<any>>("/expenses/pending");
        setPending(
          data.map((item) => ({
            id: item.id,
            submitter: item.user?.fullName ?? item.user?.email ?? "-",
            site: item.site?.name ?? item.site?.code ?? "-",
            category: item.items?.[0]?.category ?? "-",
            amount: formatCurrency(item.totalAmount),
            usageDate: formatDate(item.usageDate),
            submittedAt: formatDate(item.updatedAt),
            hasComment: Boolean(item.approvals?.some((approval: any) => approval.comment))
          }))
        );
        setSelected({});
      } catch (err) {
        setError(err instanceof Error ? err.message : "승인 대기 목록을 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    };
    void fetchPending();
  }, [token, authLoading, user]);

  useEffect(() => {
    if (authLoading) return;
    const isAuthorized = user ? user.role === "site_manager" || user.role === "hq_admin" : false;
    if (user && !isAuthorized) {
      router.replace("/dashboard").catch(() => undefined);
    }
  }, [user, authLoading, router]);

  const selectedIds = useMemo(() => Object.entries(selected).filter(([, value]) => value).map(([id]) => id), [selected]);

  const reloadPending = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<Array<any>>("/expenses/pending");
      setPending(
        data.map((item) => ({
          id: item.id,
          submitter: item.user?.fullName ?? item.user?.email ?? "-",
          site: item.site?.name ?? item.site?.code ?? "-",
          category: item.items?.[0]?.category ?? "-",
          amount: formatCurrency(item.totalAmount),
          usageDate: formatDate(item.usageDate),
          submittedAt: formatDate(item.updatedAt),
          hasComment: Boolean(item.approvals?.some((approval: any) => approval.comment))
        }))
      );
      setSelected({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "승인 대기 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleSelectAll = (value: boolean) => {
    const entries = pending.reduce<Record<string, boolean>>((acc, row) => {
      acc[row.id] = value;
      return acc;
    }, {});
    setSelected(entries);
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
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-[#0F4C81]">승인 대기 {pending.length}건</p>
            <p className="text-sm text-[#3E4C59]">현장 별 승인 우선순위를 검토해 주세요.</p>
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
                {actionType === "approve"
                  ? "필요하면 비고를 남겨 주세요."
                  : "반려 사유를 꼭 입력해 주세요."}
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
          <div className="overflow-hidden rounded-lg border border-[#E4E7EB] bg-white">
            <table className="min-w-full text-left text-sm text-[#3E4C59]">
              <thead className="bg-[#E4E7EB] text-xs uppercase text-[#3E4C59]">
                <tr>
                  <th className="px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label="전체 선택"
                      checked={pending.length > 0 && selectedIds.length === pending.length}
                      onChange={(event) => toggleSelectAll(event.target.checked)}
                    />
                  </th>
                  <th className="px-4 py-3">제출자</th>
                  <th className="px-4 py-3">현장</th>
                  <th className="px-4 py-3">항목</th>
                  <th className="px-4 py-3">금액</th>
                  <th className="px-4 py-3">사용일</th>
                  <th className="px-4 py-3">제출일</th>
                  <th className="px-4 py-3">코멘트</th>
                </tr>
              </thead>
                <tbody>
                {pending.map((row) => (
                  <tr key={row.id} className="border-t border-[#E4E7EB]">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label={`${row.site} 경비 선택`}
                        checked={Boolean(selected[row.id])}
                        onChange={() => toggleSelect(row.id)}
                      />
                    </td>
                    <td className="px-4 py-3">{row.submitter}</td>
                    <td className="px-4 py-3">{row.site}</td>
                    <td className="px-4 py-3">{row.category}</td>
                    <td className="px-4 py-3">{row.amount}</td>
                    <td className="px-4 py-3">{row.usageDate}</td>
                    <td className="px-4 py-3">{row.submittedAt}</td>
                    <td className="px-4 py-3">{row.hasComment ? <span className="text-[#0F4C81]">있음</span> : <span>-</span>}</td>
                  </tr>
                ))}
                {pending.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-center text-sm text-[#3E4C59]">
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

export default ApprovalsPage;
