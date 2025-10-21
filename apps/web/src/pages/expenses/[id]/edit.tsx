import Head from "next/head";
import { useRouter } from "next/router";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
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
  id?: string;
  category: string;
  amount: string;
  usageDate: string;
  vendor: string;
  description: string;
}

const statusOptions: Array<{ value: ExpenseStatusValue; label: string }> = [
  { value: "PENDING_SITE", label: "제출 (소장 승인 대기)" },
  { value: "DRAFT", label: "임시 저장" }
];

interface ExpenseDetailResponse {
  id: string;
  status: string;
  usageDate: string;
  vendor: string;
  purposeDetail: string;
  site: { id: string; name: string; code: string } | null;
  items: Array<{
    id: string;
    category: string;
    amount: string;
    usageDate: string;
    vendor: string;
    description?: string | null;
  }>;
  attachments: ExpenseAttachment[];
}

interface ExpenseAttachment {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatAttachmentDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toISOString().split("T")[0]} ${date.toTimeString().slice(0, 5)}`;
};

const EditExpensePage = () => {
  const router = useRouter();
  const { id } = router.query;
  const { token, loading: authLoading, user } = useAuth();
  const [form, setForm] = useState<ExpenseFormState | null>(null);
  const [items, setItems] = useState<ExpenseItemInput[]>([]);
  const [categories, setCategories] = useState<Array<{ code: string; name: string }>>([]);
  const [sites, setSites] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [metaLoading, setMetaLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [existingAttachments, setExistingAttachments] = useState<ExpenseAttachment[]>([]);
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);
  const canDeleteAttachments =
    user ? ["submitter", "site_manager", "hq_admin"].includes(user.role) : false;

  useEffect(() => {
    if (authLoading) return;
    const isAuthorized = user ? ["submitter", "site_manager", "hq_admin"].includes(user.role) : false;
    if (user && !isAuthorized) {
      router.replace("/expenses").catch(() => undefined);
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!router.isReady || authLoading || !token) return;

    const load = async () => {
      setMetaLoading(true);
      setDetailLoading(true);
      setError(null);
      try {
        const [meta, detail] = await Promise.all([
          apiClient.get<{
            categories: Array<{ code: string; name: string }>;
            sites: Array<{ id: string; name: string; code: string }>;
          }>("/expenses/meta"),
          apiClient.get<ExpenseDetailResponse>(`/expenses/${id}`)
        ]);

        setCategories(meta.categories ?? []);
        setSites(meta.sites ?? []);

        const defaultStatus: ExpenseStatusValue =
          detail.status === "PENDING_SITE" ? "PENDING_SITE" : "DRAFT";

        setForm({
          usageDate: detail.usageDate.split("T")[0],
          vendor: detail.vendor,
          purposeDetail: detail.purposeDetail,
          status: defaultStatus,
          siteId: detail.site?.id ?? undefined
        });

        setItems(
          detail.items.map((item) => ({
            id: item.id,
            category: item.category,
            amount: item.amount,
            usageDate: item.usageDate.split("T")[0],
            vendor: item.vendor,
            description: item.description ?? ""
          }))
        );
        setExistingAttachments(detail.attachments ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "경비 정보를 불러오지 못했습니다.");
      } finally {
        setMetaLoading(false);
        setDetailLoading(false);
      }
    };

    void load();
  }, [router, id, authLoading, token]);

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
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev));
    if (!form) return;
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
    setItems((prev) => [
      ...prev,
      {
        category: defaultCategory,
        amount: "",
        usageDate: form?.usageDate ?? "",
        vendor: form?.vendor ?? "",
        description: ""
      }
    ]);
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleAttachmentSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (files.length === 0) return;
    if (pendingAttachments.length + files.length > 5) {
      setError("첨부 파일은 최대 5개까지 추가할 수 있습니다.");
      event.target.value = "";
      return;
    }
    const oversized = files.find((file) => file.size > 10 * 1024 * 1024);
    if (oversized) {
      setError(`"${oversized.name}" 파일이 10MB 제한을 초과했습니다.`);
      event.target.value = "";
      return;
    }
    setError(null);
    setPendingAttachments((prev) => [...prev, ...files]);
    event.target.value = "";
  };

  const removePendingAttachment = (index: number) => {
    setPendingAttachments((prev) => prev.filter((_, fileIndex) => fileIndex !== index));
  };

  const handleDeleteAttachment = async (attachment: ExpenseAttachment) => {
    if (!id) return;
    setError(null);
    try {
      await apiClient.delete(`/expenses/${id}/attachments/${attachment.id}`);
      setExistingAttachments((prev) => prev.filter((item) => item.id !== attachment.id));
      setSuccess("첨부 파일을 삭제했습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "첨부 파일 삭제 중 문제가 발생했습니다.");
    }
  };

  const handleDownloadAttachment = async (attachment: ExpenseAttachment) => {
    if (!id) return;
    setError(null);
    try {
      const { blob, filename } = await apiClient.download(
        `/expenses/${id}/attachments/${attachment.id}`
      );
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename ?? attachment.originalName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "첨부 파일을 내려받지 못했습니다.");
    }
  };

  const validateForm = () => {
    if (authLoading || detailLoading || !form) {
      setError("경비 정보를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.");
      return false;
    }
    const isAuthorized = user ? ["submitter", "site_manager", "hq_admin"].includes(user.role) : false;
    if (!token) {
      setError("로그인 세션이 만료되었습니다. 다시 로그인해 주세요.");
      return false;
    }
    if (!isAuthorized) {
      setError("경비 수정 권한이 없습니다.");
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
    if ((sites.length ?? 0) > 0 && !form.siteId) {
      setError("적용할 현장을 선택해 주세요.");
      return false;
    }
    if (items.length === 0) {
      setError("최소 1개 이상의 항목을 입력해 주세요.");
      return false;
    }
    for (const item of items) {
      if (!item.category.trim()) {
        setError("항목의 분류를 선택해 주세요.");
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

    if (!validateForm() || !form) {
      return;
    }

    const totalAmountValue = Number(totalAmount.toFixed(2));

    const payload = {
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
      await apiClient.patch(`/expenses/${id}`, payload);

      let uploaded: ExpenseAttachment[] = [];
      if (pendingAttachments.length > 0) {
        const formData = new FormData();
        pendingAttachments.forEach((file) => formData.append("files", file));
        try {
          uploaded = (await apiClient.upload<ExpenseAttachment[]>(`/expenses/${id}/attachments`, formData)) ?? [];
        } catch (uploadErr) {
          setError(
            uploadErr instanceof Error
              ? uploadErr.message
              : "첨부 파일 업로드 중 문제가 발생했습니다."
          );
          return;
        }
      }

      if (uploaded.length > 0) {
        setExistingAttachments((prev) => [...prev, ...uploaded]);
      }
      setPendingAttachments([]);
      setSuccess("경비가 업데이트되었습니다.");
      setTimeout(() => {
        router.push(`/expenses/${id}`).catch(() => undefined);
      }, 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "경비 수정 중 문제가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell title="경비 수정">
      <Head>
        <title>IKJIN EMS · 경비 수정</title>
      </Head>
      {metaLoading || detailLoading ? <p className="text-sm text-[#3E4C59]">데이터 불러오는 중...</p> : null}
      <form className="space-y-8" onSubmit={handleSubmit}>
        <section className="space-y-4 rounded-lg border border-[#E4E7EB] bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-[#0F4C81]">기본 정보</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {sites.length > 0 ? (
              <label className="flex flex-col gap-1 text-sm text-[#3E4C59]">
                <span>현장</span>
                <select
                  className="rounded-md border border-[#CBD2D9] px-3 py-2"
                  value={form?.siteId ?? ""}
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
                value={form?.usageDate ?? ""}
                onChange={(event) => handleFormChange("usageDate", event.target.value)}
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-[#3E4C59]">
              <span>지출처 (거래처)</span>
              <input
                className="rounded-md border border-[#CBD2D9] px-3 py-2"
                type="text"
                value={form?.vendor ?? ""}
                onChange={(event) => handleFormChange("vendor", event.target.value)}
                placeholder="예: ㈜익진엔지니어링"
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-[#3E4C59] md:col-span-2">
              <span>지출 사유</span>
              <textarea
                className="min-h-[96px] rounded-md border border-[#CBD2D9] px-3 py-2"
                value={form?.purposeDetail ?? ""}
                onChange={(event) => handleFormChange("purposeDetail", event.target.value)}
                placeholder="업무 관련 상세 내용을 입력해 주세요."
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-[#3E4C59] md:col-span-2">
              <span>저장 방식</span>
              <select
                className="rounded-md border border-[#CBD2D9] px-3 py-2"
                value={form?.status ?? "DRAFT"}
                onChange={(event) => handleFormChange("status", event.target.value as ExpenseStatusValue)}
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
              총 금액: {" "}
              <span className="font-semibold text-[#0F4C81]">
                {totalAmount.toLocaleString("ko-KR", { style: "currency", currency: "KRW" })}
              </span>
            </div>
          </div>
          <div className="space-y-6">
            {items.map((item, index) => (
              <div key={`expense-item-${index}`} className="space-y-4 rounded-md border border-[#E4E7EB] p-4">
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
                      onChange={(event) => handleItemChange(index, "description", event.target.value)}
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

        <section className="space-y-4 rounded-lg border border-[#E4E7EB] bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-[#0F4C81]">증빙 첨부</h2>
            <p className="text-xs text-[#52606D]">최대 5개, 파일당 10MB 이하</p>
          </div>
          {existingAttachments.length > 0 ? (
            <ul className="space-y-2 text-sm text-[#3E4C59]">
              {existingAttachments.map((attachment) => (
                <li
                  key={attachment.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#E4E7EB] px-3 py-2"
                >
                  <div className="flex flex-col">
                    <span className="font-medium text-[#0F4C81]">{attachment.originalName}</span>
                    <span className="text-xs text-[#52606D]">
                      {formatFileSize(attachment.size)} · {formatAttachmentDate(attachment.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="text-xs text-[#0F4C81] underline"
                      onClick={() => void handleDownloadAttachment(attachment)}
                    >
                      다운로드
                    </button>
                    {canDeleteAttachments ? (
                      <button
                        type="button"
                        className="text-xs text-[#D64545] underline"
                        onClick={() => void handleDeleteAttachment(attachment)}
                        disabled={submitting}
                      >
                        삭제
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[#52606D]">등록된 첨부 파일이 없습니다.</p>
          )}
          <div className="border-t border-dashed border-[#E4E7EB] pt-4">
            <label className="flex flex-col gap-2 text-sm text-[#3E4C59]">
              <span>추가 첨부</span>
              <input
                type="file"
                multiple
                onChange={handleAttachmentSelect}
                className="rounded-md border border-dashed border-[#CBD2D9] px-3 py-2"
              />
            </label>
            {pendingAttachments.length > 0 ? (
              <ul className="mt-3 space-y-2 text-sm text-[#3E4C59]">
                {pendingAttachments.map((file, index) => (
                  <li
                    key={`${file.name}-${index}`}
                    className="flex items-center justify-between rounded-md border border-[#E4E7EB] px-3 py-2"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium text-[#0F4C81]">{file.name}</span>
                      <span className="text-xs text-[#52606D]">{formatFileSize(file.size)}</span>
                    </div>
                    <button
                      type="button"
                      className="text-xs text-[#D64545] hover:underline"
                      onClick={() => removePendingAttachment(index)}
                      disabled={submitting}
                    >
                      제거
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-[#52606D]">추가할 첨부 파일을 선택해 주세요.</p>
            )}
          </div>
        </section>

        {error ? <p className="text-sm text-[#D64545]">{error}</p> : null}
        {success ? <p className="text-sm text-[#0F4C81]">{success}</p> : null}

        <div className="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            className="rounded-md border border-[#E4E7EB] px-4 py-2 text-sm text-[#3E4C59] transition hover:bg-[#E4E7EB]"
            onClick={() => router.back()}
            disabled={submitting}
          >
            취소
          </button>
          <button
            type="submit"
            className="rounded-md bg-[#0F4C81] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#0c3b64] disabled:cursor-not-allowed disabled:bg-[#9AA5B1]"
            disabled={submitting || !form}
          >
            {submitting ? "저장 중..." : form?.status === "DRAFT" ? "임시 저장" : "제출"}
          </button>
        </div>
      </form>
    </AppShell>
  );
};

export default EditExpensePage;
