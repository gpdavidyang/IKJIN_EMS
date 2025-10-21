import { ReactNode, useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/contexts/AuthContext";

type UserRole = "submitter" | "site_manager" | "hq_admin" | "auditor";

const NAV_LINKS: Array<{ href: string; label: string; roles: UserRole[] }> = [
  { href: "/dashboard", label: "대시보드", roles: ["submitter", "site_manager", "hq_admin", "auditor"] },
  { href: "/expenses", label: "경비 내역", roles: ["submitter", "site_manager", "hq_admin", "auditor"] },
  { href: "/approvals", label: "승인 대기", roles: ["site_manager", "hq_admin"] },
  { href: "/account/password", label: "비밀번호 변경", roles: ["submitter", "site_manager", "hq_admin", "auditor"] },
  { href: "/admin/sites", label: "현장 관리", roles: ["hq_admin"] },
  { href: "/admin/users", label: "사용자 관리", roles: ["hq_admin"] }
];

interface AppShellProps {
  children: ReactNode;
  title?: string;
}

const AppShell = ({ children, title }: AppShellProps) => {
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login").catch(() => undefined);
    }
  }, [user, loading, router]);

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] text-[#1F2933]">
      <aside className="hidden w-64 flex-col border-r border-[#E4E7EB] bg-white lg:flex">
        <div className="border-b border-[#E4E7EB] px-6 py-4">
          <p className="text-sm font-medium text-[#0F4C81]">IKJIN EMS</p>
          <p className="mt-1 text-xs text-[#3E4C59]">익진엔지니어링 경비 관리</p>
        </div>
        <nav className="flex-1 px-4 py-6 text-sm">
          <ul className="space-y-2">
            {NAV_LINKS.filter((link) => (user ? link.roles.includes(user.role as UserRole) : true)).map((link) => (
              <li key={link.href}>
                <a
                  className="block rounded-md px-3 py-2 text-[#3E4C59] transition hover:bg-[#0F4C8110] hover:text-[#0F4C81]"
                  href={link.href}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-[#E4E7EB] bg-white px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold text-[#0F4C81]">{title ?? "IKJIN Expense"}</h1>
            <p className="text-xs text-[#3E4C59]">프론트엔드 구현이 진행 중입니다.</p>
          </div>
          <div className="flex items-center gap-3 text-sm text-[#3E4C59]">
            <span>
              {user ? `${user.fullName ?? user.email} · ${translateRole(user.role)}` : "로그인 정보 확인 중"}
            </span>
            <button
              className="rounded-md border border-[#E4E7EB] px-3 py-1 disabled:opacity-60"
              onClick={() => {
                logout();
                router.push("/login").catch(() => undefined);
              }}
              disabled={loading}
            >
              로그아웃
            </button>
          </div>
        </header>
        <main className="flex-1 bg-[#F8FAFC] px-6 py-6">{children}</main>
      </div>
    </div>
  );
};

export default AppShell;

function translateRole(role: string) {
  const map: Record<string, string> = {
    submitter: "Submitter",
    site_manager: "Site Manager",
    hq_admin: "HQ Admin",
    auditor: "Auditor"
  };
  return map[role] ?? role;
}
