"use client"

import type { FollowUsContent } from "@/features/app-content/schemas/app-content"

type Props = {
  value: FollowUsContent
  onChange: (value: FollowUsContent) => void
}

export function FollowUsTab({ value }: Props) {
  return (
    <div className="ac-card">
      <div className="ac-cardhead"><b>Social platforms</b></div>
      <div className="ac-note">{value.platforms.length} platform(s) configured.</div>
    </div>
  )
}
