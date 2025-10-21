import { useEffect } from "react";
import { useRouter } from "next/router";

const HomePage = () => {
  const router = useRouter();

  useEffect(() => {
    router.replace("/login").catch(() => undefined);
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC]">
      <p className="text-sm text-[#3E4C59]">로그인 화면으로 이동 중...</p>
    </main>
  );
};

export default HomePage;
