import Head from "next/head";
import { FormEvent, useEffect, useMemo, useState } from "react";
import AppShell from "@/layout/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/apiClient";

interface UserResponse {
  id: string;
  email: string;
  fullName: string;
  status: "ACTIVE" | "INACTIVE";
  role: {
    id: number;
    name: string;
  };
  site?: {
    id: string;
    code: string;
    name: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

interface SiteOption {
  id: string;
  code: string;
  name: string;
}

const ROLE_OPTIONS = [
  { value: "submitter", label: "Submitter" },
  { value: "site_manager", label: "Site Manager" },
  { value: "hq_admin", label: "HQ Admin" },
  { value: "auditor", label: "Auditor" }
];

const AdminUsersPage = () => {
  const { user, loading } = useAuth();
  const isAuthorized = useMemo(() => user?.role === "hq_admin", [user]);

  const [users, setUsers] = useState<UserResponse[]>([]);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: "",
    fullName: "",
    password: "",
    role: "submitter",
    siteId: ""
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isAuthorized) return;

    const load = async () => {
      setFetching(true);
      setError(null);
      try {
        const [userData, siteData] = await Promise.all([
          apiClient.get<UserResponse[]>("/users"),
          apiClient.get<SiteOption[]>("/sites")
        ]);
        setUsers(userData);
        setSites(siteData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "사용자 정보를 불러오지 못했습니다.");
      } finally {
        setFetching(false);
      }
    };

    void load();
  }, [isAuthorized]);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.email.trim() || !form.fullName.trim() || !form.password.trim()) {
      setError("이메일, 이름, 비밀번호를 모두 입력해 주세요.");
      return;
    }
    setError(null);
    try {
      setSubmitting(true);
      await apiClient.post("/users", {
        email: form.email.trim(),
        fullName: form.fullName.trim(),
        password: form.password.trim(),
        role: form.role,
        siteId: form.siteId || undefined
      });
      setForm({ email: "", fullName: "", password: "", role: "submitter", siteId: "" });
      const userData = await apiClient.get<UserResponse[]>("/users");
      setUsers(userData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "사용자 생성 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (target: UserResponse) => {
    setError(null);
    const nextStatus = target.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      setUsers((prev) =>
        prev.map((item) => (item.id === target.id ? { ...item, status: nextStatus } : item))
      );
      await apiClient.patch(`/users/${target.id}`, { status: nextStatus });
    } catch (err) {
      setError(err instanceof Error ? err.message : "사용자 상태 변경에 실패했습니다.");
      setUsers((prev) => prev.map((item) => (item.id === target.id ? target : item)));
    }
  };

  const updateRole = async (target: UserResponse, role: string) => {
    setError(null);
    try {
      setUsers((prev) =>
        prev.map((item) =>
          item.id === target.id
            ? {
                ...item,
                role: {
                  ...item.role,
                  name: role
                }
              }
            : item
        )
      );
      await apiClient.patch(`/users/${target.id}`, { role });
    } catch (err) {
      setError(err instanceof Error ? err.message : "역할 변경에 실패했습니다.");
      setUsers((prev) => prev.map((item) => (item.id === target.id ? target : item)));
    }
  };

  const updateSite = async (target: UserResponse, siteId: string | null) => {
    setError(null);
    try {
      setUsers((prev) =>
        prev.map((item) =>
          item.id === target.id
            ? {
                ...item,
                site: siteId
                  ? sites.find((site) => site.id === siteId) ?? null
                  : null
              }
            : item
        )
      );
      await apiClient.patch(`/users/${target.id}`, { siteId: siteId ?? null });
    } catch (err) {
      setError(err instanceof Error ? err.message : "현장 변경에 실패했습니다.");
      setUsers((prev) => prev.map((item) => (item.id === target.id ? target : item)));
    }
  };

  return (
    <AppShell title="사용자 관리">
      <Head>
        <title>IKJIN EMS · 사용자 관리</title>
      </Head>
      <section className="space-y-6">
        {loading ? (
          <p className="text-sm text-[#3E4C59]">로딩 중...</p>
        ) : !isAuthorized ? (
          <p className="text-sm text-[#D64545]">사용자 관리 권한이 필요합니다.</p>
        ) : (
          <>
            <div className="rounded-lg border border-[#E4E7EB] bg-white p-6 shadow-sm">
              <h1 className="text-lg font-semibold text-[#0F4C81]">사용자 목록</h1>
              {error ? <p className="mt-2 text-sm text-[#D64545]">{error}</p> : null}
              {fetching ? (
                <p className="mt-4 text-sm text-[#3E4C59]">데이터를 불러오는 중입니다...</p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full text-left text-sm text-[#3E4C59]">
                    <thead className="bg-[#E4E7EB] text-xs uppercase text-[#3E4C59]">
                      <tr>
                        <th className="px-4 py-3">이름</th>
                        <th className="px-4 py-3">이메일</th>
                        <th className="px-4 py-3">역할</th>
                        <th className="px-4 py-3">현장</th>
                        <th className="px-4 py-3">상태</th>
                        <th className="px-4 py-3">관리</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((record) => (
                        <tr key={record.id} className="border-t border-[#E4E7EB]">
                          <td className="px-4 py-3">{record.fullName}</td>
                          <td className="px-4 py-3">{record.email}</td>
                          <td className="px-4 py-3">
                            <select
                              className="rounded-md border border-[#E4E7EB] px-2 py-1 text-sm"
                              value={record.role.name}
                              onChange={(event) => updateRole(record, event.target.value)}
                            >
                              {ROLE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <select
                              className="rounded-md border border-[#E4E7EB] px-2 py-1 text-sm"
                              value={record.site?.id ?? ""}
                              onChange={(event) =>
                                updateSite(record, event.target.value ? event.target.value : null)
                              }
                            >
                              <option value="">-</option>
                              {sites.map((site) => (
                                <option key={site.id} value={site.id}>
                                  {site.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <span className={record.status === "ACTIVE" ? "text-[#0F4C81]" : "text-[#D64545]"}>
                              {record.status === "ACTIVE" ? "활성" : "비활성"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              className="rounded-md border border-[#E4E7EB] px-3 py-1 text-xs text-[#3E4C59] transition hover:bg-[#E4E7EB]"
                              onClick={() => toggleStatus(record)}
                            >
                              {record.status === "ACTIVE" ? "비활성화" : "활성화"}
                            </button>
                          </td>
                        </tr>
                      ))}
                      {users.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-6 text-center text-sm text-[#3E4C59]">
                            등록된 사용자가 없습니다.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-[#E4E7EB] bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-[#0F4C81]">사용자 추가</h2>
              <form className="mt-4 grid gap-4 md:grid-cols-3" onSubmit={handleCreate}>
                <label className="flex flex-col gap-1 text-sm text-[#3E4C59]">
                  <span>이메일</span>
                  <input
                    className="rounded-md border border-[#CBD2D9] px-3 py-2"
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                    required
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-[#3E4C59]">
                  <span>이름</span>
                  <input
                    className="rounded-md border border-[#CBD2D9] px-3 py-2"
                    type="text"
                    value={form.fullName}
                    onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))}
                    required
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-[#3E4C59]">
                  <span>임시 비밀번호</span>
                  <input
                    className="rounded-md border border-[#CBD2D9] px-3 py-2"
                    type="password"
                    value={form.password}
                    onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                    required
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-[#3E4C59]">
                  <span>역할</span>
                  <select
                    className="rounded-md border border-[#CBD2D9] px-3 py-2"
                    value={form.role}
                    onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value }))}
                  >
                    {ROLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm text-[#3E4C59]">
                  <span>현장 (선택)</span>
                  <select
                    className="rounded-md border border-[#CBD2D9] px-3 py-2"
                    value={form.siteId}
                    onChange={(event) => setForm((prev) => ({ ...prev, siteId: event.target.value }))}
                  >
                    <option value="">-</option>
                    {sites.map((site) => (
                      <option key={site.id} value={site.id}>
                        {site.name}
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
                    {submitting ? "등록 중..." : "사용자 등록"}
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

export default AdminUsersPage;
