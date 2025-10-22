import Head from "next/head";
import Image from "next/image";
import { FormEvent, useState } from "react";
import { useRouter } from "next/router";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/contexts/AuthContext";

interface LoginResponse {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshExpiresIn: number;
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
  };
}

const LoginPage = () => {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("admin@ikjin.co.kr");
  const [password, setPassword] = useState("P@ssw0rd!");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await apiClient.post<LoginResponse>("/auth/login", { email, password });
      login(response.accessToken, response.refreshToken);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그인에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>IKJIN EMS · 로그인</title>
      </Head>
      <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4">
        <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
          <div className="mb-6 flex justify-start">
            <Image alt="익진엔지니어링 로고" height={21} src="/images/ikjin-logo.png" width={129} priority />
          </div>
          <h1 className="text-xl font-semibold text-[#0F4C81]">IKJIN Expense Management</h1>
          <p className="mt-2 text-sm text-[#3E4C59]">이메일과 비밀번호를 입력해 주세요.</p>
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="text-sm text-[#3E4C59]" htmlFor="email">
                이메일
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                className="mt-1 w-full rounded-md border border-[#E4E7EB] px-3 py-2 focus:border-[#0F4C81] focus:outline-none"
                placeholder="name@ikjin.co.kr"
                required
              />
            </div>
            <div>
              <label className="text-sm text-[#3E4C59]" htmlFor="password">
                비밀번호
              </label>
              <div className="mt-1 flex items-center rounded-md border border-[#E4E7EB] focus-within:border-[#0F4C81]">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  className="w-full rounded-l-md px-3 py-2 focus:outline-none"
                  required
                />
                <button
                  type="button"
                  className="flex items-center justify-center rounded-r-md px-3 text-[#0F4C81] transition hover:text-[#0B365F]"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 표시"}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                        d="M3 3l18 18M17.94 17.94A10.94 10.94 0 0 1 12 20c-5.24 0-9.67-3.34-11-8 0-.34.05-.67.14-.99m3.4-3.4A10.94 10.94 0 0 1 12 4c5.24 0 9.67 3.34 11 8-.26.96-.66 1.86-1.18 2.68M10.58 10.58A2 2 0 0 0 13.42 13.42"
                      />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                        d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z"
                      />
                      <circle cx="12" cy="12" r="3" strokeWidth="1.5" stroke="currentColor" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            {error ? <p className="text-sm text-[#D64545]">{error}</p> : null}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-[#0F4C81] px-4 py-2 text-sm font-medium text-white hover:bg-[#0B365F] disabled:opacity-70"
            >
              {loading ? "로그인 중..." : "로그인"}
            </button>
          </form>
          <button type="button" className="mt-4 w-full text-sm text-[#0F4C81]">
            비밀번호를 잊으셨나요?
          </button>
          <section className="mt-6 rounded-md border border-[#E4E7EB] bg-[#F8FAFC] p-4 text-xs text-[#3E4C59]">
            <p className="font-medium text-[#0F4C81]">개발 환경 테스트 계정</p>
            <ul className="mt-2 space-y-1">
              <li>
                <span className="font-semibold">HQ Admin</span> · admin@ikjin.co.kr / <code>P@ssw0rd!</code>
              </li>
              <li>
                <span className="font-semibold">Site Manager</span> · manager@ikjin.co.kr / <code>P@ssw0rd!</code>
              </li>
              <li>
                <span className="font-semibold">Submitter</span> · worker@ikjin.co.kr / <code>P@ssw0rd!</code>
              </li>
            </ul>
          </section>
        </div>
      </main>
    </>
  );
};

export default LoginPage;
