import Head from "next/head";
import { FormEvent, useEffect, useMemo, useState } from "react";
import AppShell from "@/layout/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/apiClient";

interface SiteResponse {
  id: string;
  code: string;
  name: string;
  region?: string | null;
  address?: string | null;
  isActive: boolean;
  manager?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

interface ManagerOption {
  id: string;
  fullName: string;
  email: string;
  role: {
    id: number;
    name: string;
  };
}

interface SiteFormState {
  code: string;
  name: string;
  region: string;
  address: string;
  managerId: string;
}

const AdminSitesPage = () => {
  const { user, loading } = useAuth();
  const isAuthorized = useMemo(() => user?.role === "hq_admin", [user]);

  const [sites, setSites] = useState<SiteResponse[]>([]);
  const [managerOptions, setManagerOptions] = useState<ManagerOption[]>([]);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const createInitialForm = (): SiteFormState => ({
    code: "",
    name: "",
    region: "",
    address: "",
    managerId: ""
  });
  const [form, setForm] = useState<SiteFormState>(createInitialForm);
  const [submitting, setSubmitting] = useState(false);
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null);

  const refreshSites = async () => {
    const data = await apiClient.get<SiteResponse[]>("/sites");
    setSites(data);
  };

  const refreshManagerOptions = async () => {
    const userData = await apiClient.get<ManagerOption[]>("/users");
    setManagerOptions(userData.filter((user) => user.role.name === "site_manager"));
  };

  useEffect(() => {
    if (!isAuthorized) return;
    const load = async () => {
      setFetching(true);
      setError(null);
      try {
        await Promise.all([refreshSites(), refreshManagerOptions()]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "현장 정보를 불러오지 못했습니다.");
      } finally {
        setFetching(false);
      }
    };
    void load();
  }, [isAuthorized]);

  const resetForm = () => {
    setForm(createInitialForm());
    setEditingSiteId(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.code.trim() || !form.name.trim()) {
      setError("현장 코드와 현장명을 모두 입력해 주세요.");
      return;
    }

    setError(null);
    const basePayload: Record<string, unknown> = {
      code: form.code.trim(),
      name: form.name.trim(),
      ...(form.region.trim() ? { region: form.region.trim() } : {}),
      ...(form.address.trim() ? { address: form.address.trim() } : {})
    };

    const managerPayload = form.managerId
      ? { managerId: form.managerId }
      : editingSiteId
      ? { managerId: null }
      : {};

    try {
      setSubmitting(true);
      if (editingSiteId) {
        await apiClient.patch(`/sites/${editingSiteId}`, {
          ...basePayload,
          ...managerPayload
        });
      } else {
        await apiClient.post("/sites", {
          ...basePayload,
          ...(form.managerId ? { managerId: form.managerId } : {})
        });
      }
      resetForm();
      await refreshSites();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : editingSiteId
          ? "현장 수정 중 오류가 발생했습니다."
          : "현장 생성 중 오류가 발생했습니다."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (site: SiteResponse) => {
    setError(null);
    const nextStatus = !site.isActive;
    try {
      setSites((prev) =>
        prev.map((item) => (item.id === site.id ? { ...item, isActive: nextStatus } : item))
      );
      const updated = await apiClient.patch<SiteResponse>(`/sites/${site.id}`, {
        isActive: nextStatus
      });
      setSites((prev) => prev.map((item) => (item.id === site.id ? updated : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "현장 상태 변경에 실패했습니다.");
      setSites((prev) => prev.map((item) => (item.id === site.id ? site : item)));
    }
  };

  const handleManagerChange = async (site: SiteResponse, managerId: string) => {
    const currentManagerId = site.manager?.id ?? "";
    if (currentManagerId === managerId) {
      return;
    }
    setError(null);
    try {
      const updated = await apiClient.patch<SiteResponse>(`/sites/${site.id}`, {
        managerId: managerId ? managerId : null
      });
      setSites((prev) => prev.map((item) => (item.id === site.id ? updated : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "현장 소장 변경에 실패했습니다.");
    }
  };

  const handleEdit = (site: SiteResponse) => {
    setError(null);
    setEditingSiteId(site.id);
    setForm({
      code: site.code,
      name: site.name,
      region: site.region ?? "",
      address: site.address ?? "",
      managerId: site.manager?.id ?? ""
    });
  };

  const handleDelete = async (site: SiteResponse) => {
    setError(null);
    const confirmed =
      typeof window === "undefined" ? true : window.confirm("해당 현장을 삭제하시겠습니까?");
    if (!confirmed) return;
    try {
      await apiClient.delete(`/sites/${site.id}`);
      if (editingSiteId === site.id) {
        resetForm();
      }
      await refreshSites();
    } catch (err) {
      setError(err instanceof Error ? err.message : "현장 삭제에 실패했습니다.");
    }
  };

  return (
    <AppShell title="현장 관리">
      <Head>
        <title>IKJIN EMS · 현장 관리</title>
      </Head>
      <section className="space-y-6">
        {loading ? (
          <p className="text-sm text-[#3E4C59]">로딩 중...</p>
        ) : !isAuthorized ? (
          <p className="text-sm text-[#D64545]">현장 관리 권한이 필요합니다.</p>
        ) : (
          <>
            <div className="rounded-lg border border-[#E4E7EB] bg-white p-6 shadow-sm">
              <h1 className="text-lg font-semibold text-[#0F4C81]">현장 목록</h1>
              {error ? <p className="mt-2 text-sm text-[#D64545]">{error}</p> : null}
              {fetching ? (
                <p className="mt-4 text-sm text-[#3E4C59]">데이터를 불러오는 중입니다...</p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full text-left text-sm text-[#3E4C59]">
                    <thead className="bg-[#E4E7EB] text-xs uppercase text-[#3E4C59]">
                      <tr>
                        <th className="px-4 py-3">코드</th>
                        <th className="px-4 py-3">현장명</th>
                        <th className="px-4 py-3">주소</th>
                        <th className="px-4 py-3">현장 소장</th>
                        <th className="px-4 py-3">지역</th>
                        <th className="px-4 py-3">상태</th>
                        <th className="px-4 py-3">관리</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sites.map((site) => (
                        <tr key={site.id} className="border-t border-[#E4E7EB]">
                          <td className="px-4 py-3">{site.code}</td>
                          <td className="px-4 py-3">{site.name}</td>
                          <td className="px-4 py-3">{site.address ?? "-"}</td>
                          <td className="px-4 py-3">
                            <select
                              className="w-full min-w-[160px] rounded-md border border-[#E4E7EB] px-2 py-1 text-sm"
                              value={site.manager?.id ?? ""}
                              onChange={(event) => handleManagerChange(site, event.target.value)}
                            >
                              <option value="">-</option>
                              {managerOptions.map((manager) => (
                                <option key={manager.id} value={manager.id}>
                                  {manager.fullName}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3">{site.region ?? "-"}</td>
                          <td className="px-4 py-3">
                            <span className={site.isActive ? "text-[#0F4C81]" : "text-[#D64545]"}>
                              {site.isActive ? "사용 중" : "비활성"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              <button
                                className="rounded-md border border-[#E4E7EB] px-3 py-1 text-xs text-[#3E4C59] transition hover:bg-[#E4E7EB]"
                                onClick={() => handleEdit(site)}
                              >
                                수정
                              </button>
                              <button
                                className="rounded-md border border-[#E4E7EB] px-3 py-1 text-xs text-[#D64545] transition hover:bg-[#F5DBDB]"
                                onClick={() => handleDelete(site)}
                              >
                                삭제
                              </button>
                              <button
                                className="rounded-md border border-[#E4E7EB] px-3 py-1 text-xs text-[#3E4C59] transition hover:bg-[#E4E7EB]"
                                onClick={() => toggleActive(site)}
                              >
                                {site.isActive ? "비활성화" : "활성화"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {sites.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-6 text-center text-sm text-[#3E4C59]">
                            등록된 현장이 없습니다.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-[#E4E7EB] bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-[#0F4C81]">
                {editingSiteId ? "현장 정보 수정" : "새 현장 등록"}
              </h2>
              <form className="mt-4 grid gap-4 md:grid-cols-3" onSubmit={handleSubmit}>
                <label className="flex flex-col gap-1 text-sm text-[#3E4C59]">
                  <span>현장 코드</span>
                  <input
                    className="rounded-md border border-[#CBD2D9] px-3 py-2"
                    type="text"
                    value={form.code}
                    onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
                    placeholder="예: SITE010"
                    required
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-[#3E4C59]">
                  <span>현장명</span>
                  <input
                    className="rounded-md border border-[#CBD2D9] px-3 py-2"
                    type="text"
                    value={form.name}
                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="예: 서울-신규 프로젝트"
                    required
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-[#3E4C59]">
                  <span>지역 (선택)</span>
                  <input
                    className="rounded-md border border-[#CBD2D9] px-3 py-2"
                    type="text"
                    value={form.region}
                    onChange={(event) => setForm((prev) => ({ ...prev, region: event.target.value }))}
                    placeholder="예: 수도권"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-[#3E4C59] md:col-span-3">
                  <span>주소 (선택)</span>
                  <input
                    className="rounded-md border border-[#CBD2D9] px-3 py-2"
                    type="text"
                    value={form.address}
                    onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
                    placeholder="예: 서울특별시 강남구 테헤란로 123"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-[#3E4C59]">
                  <span>현장 소장 (선택)</span>
                  <select
                    className="rounded-md border border-[#CBD2D9] px-3 py-2"
                    value={form.managerId}
                    onChange={(event) => setForm((prev) => ({ ...prev, managerId: event.target.value }))}
                  >
                    <option value="">-</option>
                    {managerOptions.map((manager) => (
                      <option key={manager.id} value={manager.id}>
                        {manager.fullName} ({manager.email})
                      </option>
                    ))}
                  </select>
                </label>
                <div className="md:col-span-3 flex justify-end">
                  <button
                    type="submit"
                    className="rounded-md bg-[#0F4C81] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#0c3b64] disabled:cursor-not-allowed disabled:bg-[#9AA5B1]"
                    disabled={submitting}
                  >
                    {submitting
                      ? editingSiteId
                        ? "수정 중..."
                        : "등록 중..."
                      : editingSiteId
                      ? "수정 완료"
                      : "현장 등록"}
                  </button>
                  {editingSiteId ? (
                    <button
                      type="button"
                      className="ml-2 rounded-md border border-[#CBD2D9] px-4 py-2 text-sm text-[#3E4C59] transition hover:bg-[#E4E7EB]"
                      onClick={resetForm}
                      disabled={submitting}
                    >
                      취소
                    </button>
                  ) : null}
                </div>
              </form>
            </div>
          </>
        )}
      </section>
    </AppShell>
  );
};

export default AdminSitesPage;
