import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/layout/AppShell";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/contexts/AuthContext";

type ExpenseStatusValue = "PENDING_SITE" | "DRAFT";

interface ExpenseFormState {
  vendor: string;
  status: ExpenseStatusValue;
  siteId?: string;
}

type PaymentMethodValue = "CORPORATE_CARD" | "PERSONAL_CARD" | "CASH" | "OTHER";

interface ExpenseItemInput {
  id: string;
  category: string;
  amount: string;
  usageDate: string;
  siteId?: string;
  paymentMethod: PaymentMethodValue;
  status: ExpenseStatusValue;
  vendor: string;
  description: string;
}

const makeItemId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `expense-item-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const createEmptyItem = (
  categoryCode?: string,
  vendor?: string,
  siteId?: string,
  status?: ExpenseStatusValue,
  paymentMethod?: PaymentMethodValue
): ExpenseItemInput => ({
  id: makeItemId(),
  category: categoryCode ?? "",
  amount: "",
  usageDate: "",
  siteId,
  paymentMethod: paymentMethod ?? "CORPORATE_CARD",
  status: status ?? "PENDING_SITE",
  vendor: vendor ?? "",
  description: ""
});

const truncate = (value: string, limit = 500) => {
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, limit - 1)}…`;
};

const buildPurposeDetail = (entries: ExpenseItemInput[], vendor: string) => {
  const descriptions = entries
    .map((item) => item.description?.trim())
    .filter((desc): desc is string => Boolean(desc && desc.length > 0));
  if (descriptions.length > 0) {
    return truncate(descriptions.join(" / "));
  }

  const categories = Array.from(
    new Set(entries.map((item) => item.category).filter((category) => category && category.trim().length > 0))
  );
  const usageDate = entries[0]?.usageDate;
  const labelParts = [
    vendor.trim() || undefined,
    categories.length > 0 ? categories.join(", ") : undefined,
    usageDate ? usageDate.replace(/-/g, ".") : undefined
  ];
  const label = labelParts.filter(Boolean).join(" · ");
  return truncate(label || vendor.trim() || "경비 지출");
};

const statusOptions: Array<{ value: ExpenseStatusValue; label: string }> = [
  { value: "PENDING_SITE", label: "제출 (소장 승인 대기)" },
  { value: "DRAFT", label: "임시 저장" }
];

const rowStatusOptions: Array<{ value: ExpenseStatusValue; label: string }> = [
  { value: "PENDING_SITE", label: "미제출" },
  { value: "DRAFT", label: "임시 저장" }
];

const paymentMethodOptions: Array<{ value: PaymentMethodValue; label: string }> = [
  { value: "CORPORATE_CARD", label: "법인카드" },
  { value: "PERSONAL_CARD", label: "개인카드" },
  { value: "CASH", label: "현금" },
  { value: "OTHER", label: "기타" }
];

const sanitizeAmountInput = (value: string) => value.replace(/[^0-9]/g, "");

const formatAmountDisplay = (value: string) => {
  const digits = sanitizeAmountInput(value);
  if (!digits) {
    return "";
  }
  const formatted = Number(digits).toLocaleString("ko-KR");
  return `₩${formatted}`;
};

const getPaymentLabel = (value: PaymentMethodValue) =>
  paymentMethodOptions.find((option) => option.value === value)?.label ?? "";

const NewExpensePage = () => {
  const router = useRouter();
  const { token, loading: authLoading, user } = useAuth();
  const [form, setForm] = useState<ExpenseFormState>({
    vendor: "",
    status: "PENDING_SITE",
    siteId: undefined
  });
  const [items, setItems] = useState<ExpenseItemInput[]>([createEmptyItem()]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [categories, setCategories] = useState<Array<{ code: string; name: string }>>([]);
  const [sites, setSites] = useState<Array<{ id: string; name: string; code: string }>>([]);

  const currentUserLabel = useMemo(() => {
    if (!user) {
      return "-";
    }
    return user.fullName?.trim() || user.email;
  }, [user]);

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
        const defaultSiteId = (data.sites?.[0]?.id as string | undefined) ?? undefined;
        const defaultStatus = rowStatusOptions[0]?.value ?? "PENDING_SITE";
        setItems((prev) =>
          prev.map((item) => ({
            ...item,
            category: item.category || data.categories?.[0]?.code || "",
            siteId: item.siteId ?? defaultSiteId,
            paymentMethod: item.paymentMethod || paymentMethodOptions[0]?.value || "CORPORATE_CARD",
            status: item.status || defaultStatus
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
      const digits = sanitizeAmountInput(item.amount);
      if (!digits) {
        return sum;
      }
      return sum + Number(digits);
    }, 0);
  }, [items]);

  const selectedTotal = useMemo(() => {
    if (selectedItemIds.length === 0) {
      return 0;
    }
    const selectedSet = new Set(selectedItemIds);
    return items.reduce((sum, item) => {
      if (!selectedSet.has(item.id)) {
        return sum;
      }
      const digits = sanitizeAmountInput(item.amount);
      if (!digits) {
        return sum;
      }
      return sum + Number(digits);
    }, 0);
  }, [items, selectedItemIds]);

  const handleFormChange = (field: keyof ExpenseFormState, value: string | undefined) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === "vendor" && typeof value === "string") {
      setItems((prev) =>
        prev.map((item) => (item.vendor.trim().length > 0 ? item : { ...item, vendor: value }))
      );
    }
    if (field === "siteId" && typeof value === "string") {
      setItems((prev) =>
        prev.map((item) => (item.siteId ? item : { ...item, siteId: value || undefined }))
      );
    }
    if (field === "status" && typeof value === "string") {
      const newStatus = value as ExpenseStatusValue;
      setItems((prev) => prev.map((item) => ({ ...item, status: item.status ?? newStatus })));
    }
  };

  const handleItemChange = (itemId: string, field: keyof ExpenseItemInput, value: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) {
          return item;
        }
        if (field === "siteId") {
          return { ...item, siteId: value || undefined };
        }
        if (field === "status") {
          return { ...item, status: (value as ExpenseStatusValue) ?? item.status };
        }
        return { ...item, [field]: value };
      })
    );
  };

  const handleAmountInput = (itemId: string, rawValue: string) => {
    const digits = sanitizeAmountInput(rawValue);
    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, amount: digits } : item))
    );
  };

  const addItem = () => {
    const defaultCategory = categories[0]?.code ?? "";
    const vendorValue = form.vendor.trim();
    const defaultSiteId = form.siteId ?? sites[0]?.id;
    setItems((prev) => [
      ...prev,
      createEmptyItem(
        defaultCategory,
        vendorValue || undefined,
        defaultSiteId,
        form.status,
        paymentMethodOptions[0]?.value
      )
    ]);
  };

  const toggleItemSelection = (itemId: string, checked: boolean) => {
    setSelectedItemIds((prev) => {
      if (checked) {
        if (prev.includes(itemId)) {
          return prev;
        }
        return [...prev, itemId];
      }
      return prev.filter((id) => id !== itemId);
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItemIds(items.map((item) => item.id));
    } else {
      setSelectedItemIds([]);
    }
  };

  const duplicateSelectedItems = () => {
    if (selectedItemIds.length === 0) {
      setError("복제할 행을 먼저 선택해 주세요.");
      return;
    }
    setItems((prev) => {
      const selectedSet = new Set(selectedItemIds);
      const duplicates = prev
        .filter((item) => selectedSet.has(item.id))
        .map((item) => ({
          ...item,
          id: makeItemId()
        }));
      return [...prev, ...duplicates];
    });
    setSelectedItemIds([]);
    setSuccess("선택된 행을 복제했습니다.");
  };

  const removeSelectedItems = () => {
    if (selectedItemIds.length === 0) {
      setError("삭제할 행을 먼저 선택해 주세요.");
      return;
    }
    setItems((prev) => prev.filter((item) => !selectedItemIds.includes(item.id)));
    setSelectedItemIds([]);
    setSuccess("선택된 행을 삭제했습니다.");
  };

  const resetTableRows = () => {
    const defaultCategory = categories[0]?.code ?? "";
    const vendorValue = form.vendor.trim();
    const defaultSiteId = form.siteId ?? sites[0]?.id;
    setItems([
      createEmptyItem(
        defaultCategory,
        vendorValue || undefined,
        defaultSiteId,
        form.status,
        paymentMethodOptions[0]?.value
      )
    ]);
    setSelectedItemIds([]);
    setSuccess("입력 행을 초기화했습니다.");
    setError(null);
  };

  const removeItem = (itemId: string) => {
    setItems((prev) => prev.filter((item) => item.id !== itemId));
    setSelectedItemIds((prev) => prev.filter((id) => id !== itemId));
  };

  const validateForm = (itemsToValidate: ExpenseItemInput[], statusOverride?: ExpenseStatusValue) => {
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
    if (itemsToValidate.length === 0) {
      setError("최소 1개 이상의 항목을 입력해 주세요.");
      return false;
    }
    const hasUsageDate = itemsToValidate.every((item) => item.usageDate && item.usageDate.trim().length > 0);
    if (!hasUsageDate) {
      setError("각 행의 사용일을 입력해 주세요.");
      return false;
    }
    for (const item of itemsToValidate) {
      if (!item.category.trim()) {
        setError("항목의 분류를 입력해 주세요.");
        return false;
      }
      const amountDigits = sanitizeAmountInput(item.amount);
      if (!amountDigits) {
        setError("항목 금액은 숫자로 입력해 주세요.");
        return false;
      }
      if (!item.vendor.trim()) {
        setError("상호명을 입력해 주세요.");
        return false;
      }
      if (!item.siteId) {
        setError("행마다 현장을 선택해 주세요.");
        return false;
      }
      if (!item.paymentMethod) {
        setError("행마다 결제 수단을 선택해 주세요.");
        return false;
      }
      const effectiveStatus = statusOverride ?? item.status;
      if (!effectiveStatus) {
        setError("행 상태를 선택해 주세요.");
        return false;
      }
    }
    return true;
  };

  const submitSelectedRows = async (statusOverride?: ExpenseStatusValue) => {
    setError(null);
    setSuccess(null);
    const rowsToSubmit = items.filter((item) => selectedItemIds.includes(item.id));
    if (!validateForm(rowsToSubmit, statusOverride)) {
      return;
    }

    setSubmitting(true);
    const defaultCategory = categories[0]?.code ?? "";
    let processedCount = 0;
    try {
      for (const row of rowsToSubmit) {
        const usageDate = row.usageDate;
        const amountDigits = sanitizeAmountInput(row.amount);
        const amountValue = amountDigits ? Number(amountDigits) : 0;
        const vendorValue = row.vendor.trim() || form.vendor.trim();
        const siteId = row.siteId ?? form.siteId ?? sites[0]?.id;
        if (!siteId) {
          setError("현장 정보가 없습니다. 기본 정보를 확인해 주세요.");
          continue;
        }
        const paymentLabel = getPaymentLabel(row.paymentMethod);
        const basePurpose = buildPurposeDetail([row], vendorValue);
        const purposeDetail = paymentLabel ? `${basePurpose} · 결제수단: ${paymentLabel}` : basePurpose;
        const descriptionDetail = row.description.trim();
        const combinedDescription = paymentLabel
          ? descriptionDetail
            ? `${descriptionDetail} (결제수단: ${paymentLabel})`
            : `결제수단: ${paymentLabel}`
          : descriptionDetail || undefined;
        const payload = {
          status: statusOverride ?? row.status ?? form.status,
          totalAmount: Number(amountValue.toFixed(2)),
          usageDate,
          vendor: vendorValue,
          purposeDetail,
          siteId,
          items: [
            {
              category: row.category.trim(),
              paymentMethod: row.paymentMethod,
              amount: amountValue,
              usageDate,
              vendor: vendorValue,
              description: combinedDescription
            }
          ]
        };
        await apiClient.post<{ id: string }>("/expenses", payload);
        processedCount += 1;
      }
      const actionLabel = statusOverride === "DRAFT" ? "임시 저장" : "제출";
      setSuccess(`선택된 ${processedCount}개 행을 ${actionLabel}했습니다.`);
      const fallbackVendor = form.vendor.trim() || "";
      const defaultSiteId = form.siteId ?? sites[0]?.id;
      setItems([
        createEmptyItem(
          defaultCategory,
          fallbackVendor || undefined,
          defaultSiteId,
          form.status,
          paymentMethodOptions[0]?.value
        )
      ]);
      setSelectedItemIds([]);
    } catch (err) {
      if (processedCount > 0) {
        setSuccess(`이미 ${processedCount}개 행은 저장되었습니다.`);
      }
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
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submitSelectedRows();
        }}
      >
        <section className="space-y-3 rounded-lg border border-[#E4E7EB] bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-[#0F4C81]">경비 작성 리스트</h2>
                  <p className="text-xs text-[#52606D]">
                    행 단위로 사용일·금액·메모를 입력하고 선택한 행을 한 번에 제출합니다.
                  </p>
                </div>
                <div className="space-y-1 text-right text-xs text-[#52606D]">
                  <p>
                    전체 금액{" "}
                    <span className="font-semibold text-[#0F4C81]">
                      {totalAmount.toLocaleString("ko-KR", { style: "currency", currency: "KRW" })}
                    </span>
                  </p>
                  <p>
                    선택 금액{" "}
                    <span className="font-semibold text-[#0F4C81]">
                      {selectedTotal.toLocaleString("ko-KR", {
                        style: "currency",
                        currency: "KRW"
                      })}
                    </span>{" "}
                    · 선택 {selectedItemIds.length}건
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  type="button"
                  className="rounded-md border border-[#CBD2D9] px-3 py-1.5 text-[#0F4C81] transition hover:bg-[#0F4C8110]"
                  onClick={addItem}
                  disabled={submitting}
                >
                  행 추가
                </button>
                <button
                  type="button"
                  className="rounded-md border border-[#CBD2D9] px-3 py-1.5 text-[#0F4C81] transition hover:bg-[#0F4C8110] disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={duplicateSelectedItems}
                  disabled={submitting || selectedItemIds.length === 0}
                >
                  선택된 행 복제
                </button>
                <button
                  type="button"
                  className="rounded-md border border-[#CBD2D9] px-3 py-1.5 text-[#D64545] transition hover:bg-[#FDECEC] disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={removeSelectedItems}
                  disabled={submitting || selectedItemIds.length === 0}
                >
                  선택된 행 삭제
                </button>
                <button
                  type="button"
                  className="rounded-md border border-[#CBD2D9] px-3 py-1.5 text-[#0F4C81] transition hover:bg-[#0F4C8110] disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => submitSelectedRows("DRAFT")}
                  disabled={submitting || selectedItemIds.length === 0}
                >
                  선택된 행 임시저장
                </button>
                <button
                  type="button"
                  className="rounded-md bg-[#0F4C81] px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-[#0c3b64] disabled:cursor-not-allowed disabled:bg-[#9AA5B1]"
                  onClick={() => submitSelectedRows()}
                  disabled={submitting || selectedItemIds.length === 0}
                >
                  선택된 행 제출
                </button>
                <button
                  type="button"
                  className="rounded-md border border-[#CBD2D9] px-3 py-1.5 text-[#3E4C59] transition hover:bg-[#E4E7EB] disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={resetTableRows}
                  disabled={submitting}
                >
                  새로고침
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full table-fixed text-xs text-[#3E4C59]">
                  <thead className="bg-[#E4E7EB] text-[11px] uppercase text-[#52606D]">
                    <tr>
                      <th className="w-10 px-2 py-2 text-left">
                        <input
                          type="checkbox"
                          checked={items.length > 0 && selectedItemIds.length === items.length}
                          onChange={(event) => toggleSelectAll(event.target.checked)}
                        />
                      </th>
                      <th className="w-28 px-2 py-2 text-left">날짜</th>
                      <th className="w-40 px-2 py-2 text-left">현장</th>
                      <th className="w-32 px-2 py-2 text-left">결제 수단</th>
                      <th className="w-36 px-2 py-2 text-left">분류(계정)</th>
                      <th className="w-32 px-2 py-2 text-left">상호명</th>
                      <th className="w-28 px-2 py-2 text-right">금액</th>
                      <th className="px-2 py-2 text-left">비고</th>
                      <th className="w-16 px-2 py-2 text-center">액션</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={item.id} className="border-b border-[#E4E7EB] last:border-b-0">
                        <td className="px-2 py-1">
                          <input
                            type="checkbox"
                            checked={selectedItemIds.includes(item.id)}
                            onChange={(event) => toggleItemSelection(item.id, event.target.checked)}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="date"
                            className="w-full rounded-md border border-[#CBD2D9] px-2 py-1 text-[13px]"
                            value={item.usageDate}
                            onChange={(event) =>
                              handleItemChange(item.id, "usageDate", event.target.value)
                            }
                          />
                        </td>
                        <td className="px-2 py-1">
                          <select
                            className="w-full rounded-md border border-[#CBD2D9] px-2 py-1 text-[13px]"
                            value={item.siteId ?? ""}
                            onChange={(event) => handleItemChange(item.id, "siteId", event.target.value)}
                          >
                            <option value="">현장 선택</option>
                            {sites.map((site) => (
                              <option key={site.id} value={site.id}>
                                {site.name ?? site.code}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-1">
                          <select
                            className="w-full rounded-md border border-[#CBD2D9] px-2 py-1 text-[13px]"
                            value={item.paymentMethod}
                            onChange={(event) =>
                              handleItemChange(
                                item.id,
                                "paymentMethod",
                                event.target.value as PaymentMethodValue
                              )
                            }
                          >
                            {paymentMethodOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-1">
                          <select
                            className="w-full rounded-md border border-[#CBD2D9] px-2 py-1 text-[13px]"
                            value={item.category}
                            onChange={(event) =>
                              handleItemChange(item.id, "category", event.target.value)
                            }
                          >
                            <option value="">분류 선택</option>
                            {categories.map((category) => (
                              <option key={category.code} value={category.code}>
                                {category.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="text"
                            className="w-full rounded-md border border-[#CBD2D9] px-2 py-1 text-[13px]"
                            value={item.vendor}
                            onChange={(event) =>
                              handleItemChange(item.id, "vendor", event.target.value)
                            }
                            placeholder="상호명"
                          />
                        </td>
                        <td className="px-2 py-1 text-right">
                          <input
                            type="text"
                            inputMode="numeric"
                            className="w-full rounded-md border border-[#CBD2D9] px-2 py-1 text-right text-[13px]"
                            value={formatAmountDisplay(item.amount)}
                            onChange={(event) => handleAmountInput(item.id, event.target.value)}
                            placeholder="₩0"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="text"
                            className="w-full rounded-md border border-[#CBD2D9] px-2 py-1 text-[13px]"
                            value={item.description}
                            onChange={(event) =>
                              handleItemChange(item.id, "description", event.target.value)
                            }
                            placeholder="비고"
                          />
                        </td>
                        <td className="px-2 py-1 text-center">
                          <button
                            type="button"
                            className="inline-flex items-center justify-center rounded-md border border-[#D64545] px-2 py-1 text-xs text-[#D64545] transition hover:bg-[#FDECEC] disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={() => removeItem(item.id)}
                            disabled={submitting || (items.length === 1 && index === 0)}
                          >
                            삭제
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-[#9AA5B1]">
                선택된 행은 상단 버튼 또는 하단의 제출 버튼으로 저장됩니다. 저장된 후에는 경비 상세 화면에서
                첨부와 추가 수정을 할 수 있습니다.
              </p>
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
              disabled={submitting || selectedItemIds.length === 0}
            >
              선택된 행 제출
            </button>
        </div>
      </form>
    </AppShell>
  );
};

export default NewExpensePage;
