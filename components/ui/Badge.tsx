import type { ListingStatus } from "@/types";

const STATUS_STYLES: Record<ListingStatus, string> = {
  pending: "bg-slate-100 text-slate-600",
  processing: "bg-amber-100 text-amber-700",
  complete: "bg-emerald-100 text-emerald-700",
  error: "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<ListingStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  complete: "Complete",
  error: "Error",
};

export default function StatusBadge({ status }: { status: ListingStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {STATUS_LABELS[status]}
    </span>
  );
}
