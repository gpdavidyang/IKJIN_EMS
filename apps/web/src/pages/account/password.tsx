import Head from "next/head";
import { FormEvent, useState } from "react";
import { useRouter } from "next/router";
import AppShell from "@/layout/AppShell";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/contexts/AuthContext";

const PasswordPage = () => {
  const router = useRouter();
  const { loading: authLoading, user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!authLoading && !user) {
    router.replace("/login").catch(() => undefined);
  }

  const validate = () => {
    if (!currentPassword.trim()) {
      setError("현재 비밀번호를 입력해 주세요.");
      return false;
    }
    if (newPassword.length < 8) {
      setError("새 비밀번호는 8자 이상이어야 합니다.");
      return false;
    }
    if (!/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setError("새 비밀번호는 영문과 숫자를 각각 최소 1개 이상 포함해야 합니다.");
      return false;
    }
    if (newPassword !== confirmPassword) {
      setError("새 비밀번호가 일치하지 않습니다.");
      return false;
    }
    return true;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!validate()) {
      return;
    }

    try {
      setSubmitting(true);
      await apiClient.post("/auth/change-password", {
        currentPassword,
        newPassword
      });
      setSuccess("비밀번호가 성공적으로 변경되었습니다.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "비밀번호 변경 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell title="비밀번호 변경">
      <Head>
        <title>IKJIN EMS · 비밀번호 변경</title>
      </Head>
      <form className="mx-auto max-w-xl space-y-6" onSubmit={handleSubmit}>
        <section className="space-y-4 rounded-lg border border-[#E4E7EB] bg-white p-6 shadow-sm">
          <header>
            <h2 className="text-base font-semibold text-[#0F4C81]">비밀번호 관리</h2>
            <p className="mt-1 text-sm text-[#52606D]">보안을 위해 주기적으로 비밀번호를 변경해 주세요.</p>
          </header>
          <div className="space-y-4">
            <label className="flex flex-col gap-1 text-sm text-[#3E4C59]">
              <span>현재 비밀번호</span>
              <input
                type="password"
                className="rounded-md border border-[#CBD2D9] px-3 py-2"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-[#3E4C59]">
              <span>새 비밀번호</span>
              <input
                type="password"
                className="rounded-md border border-[#CBD2D9] px-3 py-2"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-[#3E4C59]">
              <span>새 비밀번호 확인</span>
              <input
                type="password"
                className="rounded-md border border-[#CBD2D9] px-3 py-2"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                required
              />
            </label>
            <p className="text-xs text-[#52606D]">8자 이상, 영문과 숫자를 모두 포함해야 합니다.</p>
          </div>
        </section>

        {error ? <p className="text-sm text-[#D64545]">{error}</p> : null}
        {success ? <p className="text-sm text-[#0F4C81]">{success}</p> : null}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            className="rounded-md border border-[#E4E7EB] px-4 py-2 text-sm text-[#3E4C59] transition hover:bg-[#E4E7EB]"
            onClick={() => {
              setCurrentPassword("");
              setNewPassword("");
              setConfirmPassword("");
              setError(null);
              setSuccess(null);
            }}
            disabled={submitting}
          >
            초기화
          </button>
          <button
            type="submit"
            className="rounded-md bg-[#0F4C81] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#0c3b64] disabled:cursor-not-allowed disabled:bg-[#9AA5B1]"
            disabled={submitting}
          >
            {submitting ? "변경 중..." : "비밀번호 변경"}
          </button>
        </div>
      </form>
    </AppShell>
  );
};

export default PasswordPage;
