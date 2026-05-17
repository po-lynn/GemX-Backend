export function DaysRing({
  daysLeft,
  totalDays,
}: {
  daysLeft: number
  totalDays: number
}) {
  const r = 10
  const circumference = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(1, daysLeft / Math.max(totalDays, 1)))
  const tone =
    daysLeft < 0 ? "lv-ring-danger" : daysLeft <= 14 ? "lv-ring-warn" : "lv-ring-good"

  return (
    <span className="lv-ring">
      <svg viewBox="0 0 26 26" aria-hidden="true">
        <circle
          cx="13" cy="13" r={r}
          className="lv-ring-bg"
          strokeWidth="2.5"
          fill="none"
        />
        <circle
          cx="13" cy="13" r={r}
          className={`lv-ring-fg ${tone}`}
          strokeWidth="2.5"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
          strokeLinecap="round"
          transform="rotate(-90 13 13)"
        />
      </svg>
      <span className="lv-ring-label">
        {daysLeft < 0 ? "—" : `${daysLeft}d`}
      </span>
    </span>
  )
}
