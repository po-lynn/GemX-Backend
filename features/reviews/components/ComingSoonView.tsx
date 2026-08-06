import Link from "next/link"
import { ChevronRight } from "lucide-react"

type Props = {
  breadcrumbLabel: string
  title: string
  subhead: string
}

export function ComingSoonView({ breadcrumbLabel, title, subhead }: Props) {
  return (
    <div className="py-2">
      <div className="lv-pagehead">
        <div>
          <nav className="lv-breadcrumbs" aria-label="Breadcrumb">
            <Link href="/admin">Admin</Link>
            <ChevronRight />
            <Link href="/admin/reviews">Reviews</Link>
            <ChevronRight />
            <span className="lv-here">{breadcrumbLabel}</span>
          </nav>
          <h1 className="lv-h1">{title}</h1>
          <p className="lv-subhead">{subhead}</p>
        </div>
      </div>
      <div
        className="lv-card"
        style={{ padding: "48px 24px", textAlign: "center", color: "var(--lv-text-3, #71717a)" }}
      >
        Coming in a later phase.
      </div>
    </div>
  )
}
