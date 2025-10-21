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
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const AdminSitesPage = () => {
  const { user, loading } = useAuth();
  const isAuthorized = useMemo(() => user?.role === "hq_admin", [user]);

  const [sites, setSites] = useState<SiteResponse[]>([]);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ code: "", name: "", region: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isAuthorized) return;
    const load = async () => {
      setFetching(true);
      setError(null);
      try {
        const data = await apiClient.get<SiteResponse[]>("/sites");
        setSites(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "현장 정보를 불러오지 못했습니다.");
      } finally {
        setFetching(false);
      }
    };
    void load();
  }, [isAuthorized]);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.code.trim() || !form.name.trim()) {
      setError("현장 코드와 이름을 입력해 주세요.");
      return;
    }
    setError(null);
    try {
      setSubmitting(true);
      await apiClient.post("/sites", {
        code: form.code.trim(),
        name: form.name.trim(),
        region: form.region.trim() || undefined
      });
      setForm({ code: "", name: "", region: "" });
      const data = await apiClient.get<SiteResponse[]>("/sites");
      setSites(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "현장 생성 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (site: SiteResponse) => {
    setError(null);
    try {
      setSites((prev) =>
        prev.map((item) => (item.id === site.id ? { ...item, isActive: !site.isActive } : item))
      );
      await apiClient.patch(`/sites/${site.id}`, { isActive: !site.isActive });
    } catch (err) {
      setError(err instanceof Error ? err.message : "현장 상태 변경에 실패했습니다.");
      setSites((prev) => prev.map((item) => (item.id === site.id ? site : item)));
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
                        <th className="px-4 py-3">이름</th>
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
                          <td className="px-4 py-3">{site.region ?? "-"}</td>
                          <td className="px-4 py-3">
                            <span className={site.isActive ? "text-[#0F4C81]" : "text-[#D64545]"}>
                              {site.isActive ? "사용 중" : "비활성"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              className="rounded-md border border-[#E4E7EB] px-3 py-1 text-xs text-[#3E4C59] transition hover:bg-[#E4E7EB]"
                              onClick={() => toggleActive(site)}
                            >
                              {site.isActive ? "비활성화" : "활성화"}
                            </button>
                          </td>
                        </tr>
                      ))}
                      {sites.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-sm text-[#3E4C59]">
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
              <h2 className="text-base font-semibold text-[#0F4C81]">새 현장 등록</h2>
              <form className="mt-4 grid gap-4 md:grid-cols-3" onSubmit={handleCreate}>
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
                  <span>현장 이름</span>
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
                <div className="md:col-span-3 flex justify-end">
                  <button
                    type="submit"
                    className="rounded-md bg-[#0F4C81] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#0c3b64] disabled:cursor-not-allowed disabled:bg-[#9AA5B1]"
                    disabled={submitting}
                  >
                    {submitting ? "등록 중..." : "현장 등록"}
                  </button>
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
