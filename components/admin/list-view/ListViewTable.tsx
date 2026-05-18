"use client"

import { useRef, useEffect, useState, type ReactNode } from "react"
import { ChevronDown, ArrowUp, ArrowDown } from "lucide-react"
import type { ColumnDef, SortState, GroupOption, GroupRow } from "./types"

function SortDualIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
         strokeLinecap="round" strokeLinejoin="round" style={{width:12,height:12}}>
      <path d="m5 6 3-3 3 3M5 10l3 3 3-3" opacity="0.7"/>
    </svg>
  )
}

type Props<T extends { id: string }> = {
  rows: T[]
  columnDefs: ColumnDef<T>[]
  visibleColumns: Record<string, boolean>
  sortBy: SortState | null
  onSortBy: (sort: SortState | null) => void
  selected: Record<string, boolean>
  onSelected: (sel: Record<string, boolean>) => void
  groupBy: string | null
  groupOptions: GroupOption[]
  collapsedGroups: Record<string, boolean>
  onCollapsedGroups: (cg: Record<string, boolean>) => void
  onOpenRow: (row: T) => void
  rowActions: (row: T, disabled: boolean) => ReactNode
  emptyMessage?: string
  // pre-grouped rows (group headers interleaved with data rows)
  renderedRows: Array<T | GroupRow>
}

export function ListViewTable<T extends { id: string }>({
  rows,
  columnDefs,
  visibleColumns,
  sortBy,
  onSortBy,
  selected,
  onSelected,
  collapsedGroups,
  onCollapsedGroups,
  onOpenRow,
  rowActions,
  emptyMessage = "No records found.",
  renderedRows,
}: Props<T>) {
  const visibleCols = columnDefs.filter(
    (c) => visibleColumns[c.id] !== false
  )
  const dataIds = rows.map((r) => r.id)
  const allChecked =
    dataIds.length > 0 && dataIds.every((id) => selected[id])
  const someChecked = dataIds.some((id) => selected[id]) && !allChecked

  const headerChkRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (headerChkRef.current) headerChkRef.current.indeterminate = someChecked
  }, [someChecked])

  // Column widths (resizable)
  const [widths, setWidths] = useState<Record<string, number>>(() => {
    const w: Record<string, number> = {}
    columnDefs.forEach((c) => { w[c.id] = c.width ?? 140 })
    return w
  })
  const resizingRef = useRef<{ colId: string; startX: number; startW: number } | null>(null)

  function onResizeStart(e: React.MouseEvent, colId: string) {
    e.preventDefault()
    e.stopPropagation()
    resizingRef.current = { colId, startX: e.clientX, startW: widths[colId] ?? 140 }
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"

    function onMove(ev: MouseEvent) {
      const r = resizingRef.current
      if (!r) return
      const next = Math.max(72, r.startW + (ev.clientX - r.startX))
      setWidths((w) => ({ ...w, [r.colId]: next }))
    }
    function onUp() {
      resizingRef.current = null
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
  }

  function toggleAll() {
    if (allChecked) {
      const next = { ...selected }
      dataIds.forEach((id) => delete next[id])
      onSelected(next)
    } else {
      const next = { ...selected }
      dataIds.forEach((id) => { next[id] = true })
      onSelected(next)
    }
  }

  function handleSort(colId: string) {
    const col = columnDefs.find((c) => c.id === colId)
    if (!col || col.sortable === false) return
    const dir = sortBy?.id === colId && sortBy.dir === "asc" ? "desc" : "asc"
    onSortBy({ id: colId, dir })
  }

  return (
    <div className="lv-tablewrap">
      <table className="lv-table" style={{ tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: 44 }} />
          {visibleCols.map((c) => (
            <col key={c.id} style={{ width: widths[c.id] ?? c.width ?? 140 }} />
          ))}
          <col style={{ width: 200 }} />
        </colgroup>

        <thead>
          <tr>
            <th className="lv-col-chk">
              <input
                ref={headerChkRef}
                type="checkbox"
                className={`lv-chk${someChecked ? " lv-indeterminate" : ""}`}
                checked={allChecked}
                onChange={toggleAll}
                aria-label="Select all on page"
              />
            </th>
            {visibleCols.map((c) => {
              const isSorted = sortBy?.id === c.id
              return (
                <th
                  key={c.id}
                  data-sort={isSorted ? sortBy!.dir : undefined}
                  style={{ textAlign: c.align }}
                >
                  <span
                    className="lv-th-inner"
                    onClick={() => handleSort(c.id)}
                    style={{ cursor: c.sortable === false ? "default" : "pointer" }}
                  >
                    {c.label}
                    {c.sortable !== false && (
                      <span className="lv-sort-ico">
                        {isSorted
                          ? sortBy!.dir === "asc"
                            ? <ArrowUp style={{width:12,height:12}} />
                            : <ArrowDown style={{width:12,height:12}} />
                          : <SortDualIcon />}
                      </span>
                    )}
                  </span>
                  <span
                    className="lv-resize"
                    title="Drag to resize · Double-click to reset"
                    onMouseDown={(e) => onResizeStart(e, c.id)}
                    onDoubleClick={() =>
                      setWidths((w) => ({ ...w, [c.id]: c.width ?? 140 }))
                    }
                    onClick={(e) => e.stopPropagation()}
                  />
                </th>
              )
            })}
            <th className="lv-col-actions">Actions</th>
          </tr>
        </thead>

        <tbody>
          {renderedRows.length === 0 && (
            <tr>
              <td colSpan={visibleCols.length + 2} style={{ padding: 0 }}>
                <div className="lv-empty">
                  <span className="lv-empty-ico">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
                         strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                    </svg>
                  </span>
                  <h3 className="lv-empty-t">No results</h3>
                  <p className="lv-empty-s">{emptyMessage}</p>
                </div>
              </td>
            </tr>
          )}

          {renderedRows.map((r) => {
            if ("__group" in r && r.__group) {
              const collapsed = !!collapsedGroups[r.key]
              return (
                <tr
                  key={`g-${r.key}`}
                  className={`lv-grouprow${collapsed ? " lv-collapsed" : ""}`}
                >
                  <td colSpan={visibleCols.length + 2}>
                    <div
                      className="lv-grouprow-inner"
                      onClick={() =>
                        onCollapsedGroups({
                          ...collapsedGroups,
                          [r.key]: !collapsed,
                        })
                      }
                    >
                      <span className="lv-grouprow-caret">
                        <ChevronDown />
                      </span>
                      <span className="lv-grouprow-name">{r.label}</span>
                      <span className="lv-grouprow-count">{r.count}</span>
                      {r.aggs && r.aggs.length > 0 && (
                        <div className="lv-grouprow-aggs">
                          {r.aggs.map((a, i) => (
                            <span key={i}>
                              {a.label}: <strong>{a.value}</strong>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )
            }

            const row = r as T
            const isSel = !!selected[row.id]
            return (
              <tr
                key={row.id}
                className={isSel ? "lv-selected" : undefined}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest("button, input, a")) return
                  onOpenRow(row)
                }}
                style={{ cursor: "pointer" }}
              >
                <td
                  className="lv-col-chk"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    className="lv-chk"
                    checked={isSel}
                    onChange={() =>
                      onSelected({ ...selected, [row.id]: !isSel })
                    }
                    aria-label={`Select row ${row.id}`}
                  />
                </td>
                {visibleCols.map((c) => (
                  <td key={c.id} style={{ textAlign: c.align }}>
                    {c.render(row)}
                  </td>
                ))}
                <td
                  className="lv-col-actions"
                  style={{ overflow: "visible" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="lv-row-actions">
                    {rowActions(row, false)}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
