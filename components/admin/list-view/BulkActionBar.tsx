"use client"

import type { ReactNode } from "react"
import { X } from "lucide-react"

type Props = {
  count: number
  onClear: () => void
  children: ReactNode
}

export function BulkActionBar({ count, onClear, children }: Props) {
  if (!count) return null

  return (
    <div className="lv-bulk" role="region" aria-label="Bulk actions">
      <span className="lv-bulk-count">
        <span className="lv-bulk-num">{count}</span>
        {count === 1 ? " selected" : " selected"}
      </span>
      <button className="lv-bulkbtn" onClick={onClear} aria-label="Clear selection">
        <X /> Clear
      </button>
      <span className="lv-bulk-sep" aria-hidden="true" />
      {children}
    </div>
  )
}
