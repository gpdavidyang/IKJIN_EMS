import Head from "next/head";

const HomePage = () => {
  return (
    <>
      <Head>
        <title>IKJIN EMS · Dashboard</title>
      </Head>
      <main className="min-h-screen bg-[#F8FAFC]">
        <div className="mx-auto max-w-6xl px-8 py-12">
          <section className="rounded-lg bg-white p-8 shadow-md">
            <h1 className="text-2xl font-semibold text-[#0F4C81]">IKJIN Expense Management System</h1>
            <p className="mt-3 text-[#3E4C59]">
              프로젝트 초기 설정이 완료되었습니다. 인증과 대시보드 기능을 여기에 추가해 주세요.
            </p>
          </section>
        </div>
      </main>
    </>
  );
};

export default HomePage;
