interface SummaryCardProps {
  label: string;
  value: string;
  helper?: string;
}

const SummaryCard = ({ label, value, helper }: SummaryCardProps) => {
  return (
    <div className="rounded-lg bg-white p-6 shadow-sm">
      <p className="text-sm text-[#3E4C59]">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-[#0F4C81]">{value}</p>
      {helper ? <p className="mt-1 text-xs text-[#3E4C59]">{helper}</p> : null}
    </div>
  );
};

export default SummaryCard;
