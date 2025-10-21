interface ActivityRow {
  id: string;
  status: string;
  site: string;
  amount: string;
  usageDate: string;
  updatedAt: string;
}

interface ActivityTableProps {
  rows: ActivityRow[];
}

const statusColorMap: Record<string, string> = {
  "소장승인대기": "bg-[#0F4C8110] text-[#0F4C81]",
  "본사승인대기": "bg-[#0F4C8110] text-[#0F4C81]",
  승인완료: "bg-[#2EBFA510] text-[#0F4C81]",
  반려됨: "bg-[#D6454510] text-[#D64545]",
  임시저장: "bg-[#E4E7EB] text-[#3E4C59]"
};

const ActivityTable = ({ rows }: ActivityTableProps) => {
  return (
    <div className="overflow-hidden rounded-lg border border-[#E4E7EB] bg-white">
      <table className="min-w-full text-left text-sm text-[#3E4C59]">
        <thead className="bg-[#E4E7EB] text-xs uppercase text-[#3E4C59]">
          <tr>
            <th className="px-4 py-3">상태</th>
            <th className="px-4 py-3">현장</th>
            <th className="px-4 py-3">금액</th>
            <th className="px-4 py-3">사용일</th>
            <th className="px-4 py-3">업데이트</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-[#E4E7EB]">
              <td className="px-4 py-3">
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                    statusColorMap[row.status] ?? "bg-[#E4E7EB] text-[#3E4C59]"
                  }`}
                >
                  {row.status}
                </span>
              </td>
              <td className="px-4 py-3">{row.site}</td>
              <td className="px-4 py-3">{row.amount}</td>
              <td className="px-4 py-3">{row.usageDate}</td>
              <td className="px-4 py-3">{row.updatedAt}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-[#3E4C59]">최근 활동이 없습니다.</div>
      ) : null}
    </div>
  );
};

export type { ActivityRow };
export default ActivityTable;
