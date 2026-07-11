"use client"

import type { HelpSupportContent } from "@/features/app-content/schemas/app-content"

type Props = {
  value: HelpSupportContent
  onChange: (value: HelpSupportContent) => void
}

export function HelpSupportTab({ value }: Props) {
  return (
    <div className="ac-card">
      <div className="ac-cardhead"><b>FAQs</b></div>
      <div className="ac-note">{value.faqs.length} FAQ(s) configured.</div>
    </div>
  )
}
