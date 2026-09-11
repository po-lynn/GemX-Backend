const STATUS_LABELS: Record<string, string> = {
  active:     "Active",
  expired:    "Expired",
  cancelled:  "Cancelled",
  pending:    "Pending",
  processing: "Processing",
  completed:  "Completed",
  failed:     "Failed",
}

export function StatusPill({ status }: { status: string }) {
  return (
    <span className={`lv-status ${status}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}
