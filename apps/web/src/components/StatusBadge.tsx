import { translateStatus } from "@/lib/expensePresenters";

const STATUS_COLOR_MAP: Record<string, string> = {
  DRAFT: "bg-[#E4E7EB] text-[#3E4C59]",
  PENDING_SITE: "bg-[#0F4C8110] text-[#0F4C81]",
  PENDING_HQ: "bg-[#0F4C8110] text-[#0F4C81]",
  REJECTED_SITE: "bg-[#D6454510] text-[#D64545]",
  REJECTED_HQ: "bg-[#D6454510] text-[#D64545]",
  APPROVED: "bg-[#2EBFA510] text-[#0F4C81]"
};

interface StatusBadgeProps {
  status: string;
  label?: string;
}

const StatusBadge = ({ status, label }: StatusBadgeProps) => {
  const classes = STATUS_COLOR_MAP[status] ?? "bg-[#E4E7EB] text-[#3E4C59]";
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${classes}`}>
      {label ?? translateStatus(status)}
    </span>
  );
};

export default StatusBadge;
