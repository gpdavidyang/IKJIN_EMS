import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";

interface ActivityRow {
  id: string;
  submittedDate: string;
  userName: string;
  site: string;
  paymentMethod: string;
  category: string;
  vendor: string;
  amount: string;
  statusCode: string;
  statusLabel: string;
  memo: string;
  managerComment: string;
  hqComment: string;
  canEdit: boolean;
}

interface ActivityTableProps {
  rows: ActivityRow[];
}

const ActivityTable = ({ rows }: ActivityTableProps) => {
  return (
    <div className="overflow-x-auto rounded-lg border border-[#E4E7EB] bg-white">
      <table className="min-w-full table-fixed text-left text-sm text-[#3E4C59]">
        <thead className="bg-[#E4E7EB] text-xs uppercase text-[#3E4C59]">
          <tr>
            <th className="w-[8%] px-3 py-3 whitespace-nowrap">날짜(제출일)</th>
            <th className="w-[8%] px-3 py-3 whitespace-nowrap">작성자</th>
            <th className="w-[10%] px-3 py-3 whitespace-nowrap">현장</th>
            <th className="w-[8%] px-3 py-3 whitespace-nowrap">결제 수단</th>
            <th className="w-[12%] px-3 py-3 whitespace-nowrap">분류(계정)</th>
            <th className="w-[8%] px-3 py-3 whitespace-nowrap">상호명</th>
            <th className="w-[10%] px-3 py-3 text-right whitespace-nowrap">금액</th>
            <th className="w-[10%] px-3 py-3 whitespace-nowrap">상태</th>
            <th className="w-[16%] px-3 py-3 whitespace-nowrap">비고</th>
            <th className="w-[14%] px-3 py-3 whitespace-nowrap">소장 코멘트</th>
            <th className="w-[14%] px-3 py-3 whitespace-nowrap">본사 코멘트</th>
            <th className="w-[7%] px-3 py-3 text-center whitespace-nowrap">상세</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-[#E4E7EB]">
              <td className="px-3 py-3">{row.submittedDate}</td>
              <td className="px-3 py-3">{row.userName}</td>
              <td className="px-3 py-3">{row.site}</td>
              <td className="px-3 py-3">{row.paymentMethod}</td>
              <td className="px-3 py-3 whitespace-nowrap">{row.category}</td>
              <td className="px-3 py-3">{row.vendor}</td>
              <td className="px-3 py-3 text-right">{row.amount}</td>
              <td className="px-3 py-3 whitespace-nowrap">
                <StatusBadge status={row.statusCode} label={row.statusLabel} />
              </td>
              <td className="px-3 py-3">{row.memo}</td>
              <td className="px-3 py-3">{row.managerComment || "-"}</td>
              <td className="px-3 py-3">{row.hqComment || "-"}</td>
              <td className="px-3 py-3 text-center whitespace-nowrap">
                <div className="inline-flex items-center gap-2">
                  <Link
                    className="inline-flex items-center justify-center rounded-md border border-[#0F4C81] px-2 py-1 text-xs text-[#0F4C81] transition hover:bg-[#0F4C8110]"
                    href={`/expenses/${row.id}`}
                  >
                    보기
                  </Link>
                  {row.canEdit ? (
                    <Link
                      className="inline-flex items-center justify-center rounded-md border border-[#0F4C81] px-2 py-1 text-xs text-[#0F4C81] transition hover:bg-[#0F4C8110]"
                      href={`/expenses/${row.id}/edit`}
                    >
                      수정
                    </Link>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={12} className="px-4 py-6 text-center text-sm text-[#3E4C59]">
                최근 활동이 없습니다.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
};

export type { ActivityRow };
export default ActivityTable;
