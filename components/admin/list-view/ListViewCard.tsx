"use client"

import {
  useState,
  useMemo,
  useRef,
  useEffect,
  Fragment,
  type ReactNode,
  type RefObject,
} from "react"
import Link from "next/link"
import {
  Search,
  Filter,
  Group,
  ArrowUpDown,
  Columns3,
  RefreshCw,
  Download,
  ChevronDown,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Ban,
} from "lucide-react"
import { ListViewTable } from "./ListViewTable"
import type {
  ColumnDef,
  ViewTab,
  FilterDef,
  FilterCurrencyDef,
  SortState,
  GroupOption,
  ActiveFilters,
  GroupRow,
} from "./types"

// ─── Popover hook ─────────────────────────────────────────
function usePopover(ref: RefObject<HTMLDivElement | null>) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function esc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", close)
    document.addEventListener("keydown", esc)
    return () => {
      document.removeEventListener("mousedown", close)
      document.removeEventListener("keydown", esc)
    }
  }, [open, ref])
  return { open, setOpen }
}

// ─── Date range helpers ────────────────────────────────────
function drFrom(vals: string[]): string {
  return vals.find((v) => v.startsWith("from:"))?.substring(5) ?? ""
}
function drTo(vals: string[]): string {
  return vals.find((v) => v.startsWith("to:"))?.substring(3) ?? ""
}
function drFmt(iso: string): string {
  if (!iso) return ""
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  })
}

// ─── Numrange helpers ──────────────────────────────────────
function nrMin(vals: string[]): string {
  return vals.find((v) => v.startsWith("min:"))?.substring(4) ?? ""
}
function nrMax(vals: string[]): string {
  return vals.find((v) => v.startsWith("max:"))?.substring(4) ?? ""
}
function nrFmt(val: string): string {
  if (!val) return ""
  return Number(val).toLocaleString()
}
function getCurMin(vals: string[], key: string): string {
  const p = `${key}Min:`
  return vals.find((v) => v.startsWith(p))?.slice(p.length) ?? ""
}
function getCurMax(vals: string[], key: string): string {
  const p = `${key}Max:`
  return vals.find((v) => v.startsWith(p))?.slice(p.length) ?? ""
}

// ─── DateRangePaneContent ──────────────────────────────────
function DateRangePaneContent({
  value,
  onChange,
}: {
  value: string[] | undefined
  onChange: (v: string[]) => void
}) {
  const vals = value ?? []
  const from = drFrom(vals)
  const to   = drTo(vals)

  function setFrom(d: string) {
    const next = vals.filter((v) => !v.startsWith("from:"))
    onChange(d ? [...next, `from:${d}`] : next)
  }
  function setTo(d: string) {
    const next = vals.filter((v) => !v.startsWith("to:"))
    onChange(d ? [...next, `to:${d}`] : next)
  }

  return (
    <div className="lv-daterange" style={{ padding: "4px 14px 10px" }}>
      <div className="lv-daterange-row">
        <label className="lv-daterange-label">From</label>
        <input
          type="date"
          className="lv-daterange-input"
          value={from}
          max={to || undefined}
          onChange={(e) => setFrom(e.target.value)}
        />
      </div>
      <div className="lv-daterange-row">
        <label className="lv-daterange-label">To</label>
        <input
          type="date"
          className="lv-daterange-input"
          value={to}
          min={from || undefined}
          onChange={(e) => setTo(e.target.value)}
        />
      </div>
    </div>
  )
}

// ─── RangeSlider — dual-handle slider ─────────────────────
function RangeSlider({ domain, step, lo, hi, onChange }: {
  domain: [number, number]
  step: number
  lo: number
  hi: number
  onChange: (lo: number, hi: number) => void
}) {
  const [dMin, dMax] = domain
  const trackRef = useRef<HTMLDivElement>(null)
  const valRef = useRef({ lo, hi })
  valRef.current = { lo, hi }

  const pct = (v: number) => ((v - dMin) / (dMax - dMin)) * 100

  const valFromClient = (clientX: number): number => {
    if (!trackRef.current) return dMin
    const r = trackRef.current.getBoundingClientRect()
    let f = (clientX - r.left) / r.width
    f = Math.max(0, Math.min(1, f))
    let v = dMin + f * (dMax - dMin)
    v = Math.round(v / step) * step
    return Math.max(dMin, Math.min(dMax, v))
  }

  const startDrag = (which: "lo" | "hi", e: React.PointerEvent) => {
    e.preventDefault()
    const move = (ev: PointerEvent) => {
      const v = valFromClient(ev.clientX)
      const { lo: clo, hi: chi } = valRef.current
      if (which === "lo") onChange(Math.min(v, chi), chi)
      else onChange(clo, Math.max(v, clo))
    }
    const up = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
    move(e.nativeEvent)
  }

  const onTrackDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).dataset.handle) return
    const v = valFromClient(e.clientX)
    const which = Math.abs(v - lo) <= Math.abs(v - hi) ? "lo" : "hi"
    startDrag(which, e)
  }

  return (
    <div className="lv-numrange-slider">
      <div ref={trackRef} className="lv-numrange-track" onPointerDown={onTrackDown}>
        <div className="lv-numrange-fill" style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }} />
        <div data-handle="lo" role="slider" tabIndex={0}
          aria-valuemin={dMin} aria-valuemax={dMax} aria-valuenow={lo}
          className="lv-numrange-handle" style={{ left: `${pct(lo)}%` }}
          onPointerDown={(e) => startDrag("lo", e)}
          onKeyDown={(e) => {
            const d = e.key === "ArrowRight" ? step : e.key === "ArrowLeft" ? -step : 0
            if (d) { e.preventDefault(); onChange(Math.max(dMin, Math.min(lo + d, hi)), hi) }
          }} />
        <div data-handle="hi" role="slider" tabIndex={0}
          aria-valuemin={dMin} aria-valuemax={dMax} aria-valuenow={hi}
          className="lv-numrange-handle" style={{ left: `${pct(hi)}%` }}
          onPointerDown={(e) => startDrag("hi", e)}
          onKeyDown={(e) => {
            const d = e.key === "ArrowRight" ? step : e.key === "ArrowLeft" ? -step : 0
            if (d) { e.preventDefault(); onChange(lo, Math.min(dMax, Math.max(hi + d, lo))) }
          }} />
      </div>
    </div>
  )
}

// ─── PriceField — labelled input with currency prefix ─────
function PriceField({ label, prefix, value, onCommit }: {
  label: string
  prefix: string
  value: number
  onCommit: (n: number) => void
}) {
  const [text, setText] = useState(value.toLocaleString("en-US"))
  useEffect(() => { setText(value.toLocaleString("en-US")) }, [value])

  const commit = () => {
    const n = parseInt(text.replace(/[^0-9]/g, ""), 10)
    onCommit(isNaN(n) ? 0 : n)
  }
  return (
    <label className="lv-numrange-field">
      <span className="lv-numrange-field-label">{label}</span>
      <span className="lv-numrange-field-wrap">
        {prefix && <span className="lv-numrange-field-prefix">{prefix}</span>}
        <input
          className={`lv-numrange-field-input${prefix.length > 1 ? " long-prefix" : ""}`}
          value={text}
          inputMode="numeric"
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
        />
      </span>
    </label>
  )
}

// ─── NumRangeBlock — one currency's slider + inputs ────────
function NumRangeBlock({ cur, vals, onChange }: {
  cur: FilterCurrencyDef
  vals: string[]
  onChange: (v: string[]) => void
}) {
  const [dMin, dMax] = cur.domain
  const minStr = getCurMin(vals, cur.key)
  const maxStr = getCurMax(vals, cur.key)
  const lo = minStr ? Math.max(dMin, parseFloat(minStr)) : dMin
  const hi = maxStr ? Math.min(dMax, parseFloat(maxStr)) : dMax
  const isFull = lo <= dMin && hi >= dMax
  const fmtN = (n: number) => n.toLocaleString("en-US")
  const liveLabel = isFull ? "Any price" : `${cur.sym}${fmtN(lo)} – ${cur.sym}${fmtN(hi)}`

  function encode(newLo: number, newHi: number) {
    const next = vals.filter((v) => !v.startsWith(`${cur.key}Min:`) && !v.startsWith(`${cur.key}Max:`))
    if (newLo > dMin) next.push(`${cur.key}Min:${newLo}`)
    if (newHi < dMax) next.push(`${cur.key}Max:${newHi}`)
    onChange(next)
  }

  return (
    <div className="lv-numrange-block">
      <div className="lv-numrange-curhead">
        <span className="lv-numrange-curtag-wrap">
          <span className="lv-numrange-curtag">{cur.sym}</span>
          <span className="lv-numrange-curcode">{cur.code}</span>
        </span>
        <span className={`lv-numrange-live${isFull ? " muted" : ""}`}>{liveLabel}</span>
      </div>
      <RangeSlider domain={cur.domain} step={cur.step} lo={lo} hi={hi} onChange={encode} />
      <div className="lv-numrange-fields">
        <PriceField label="MIN" prefix={cur.sym} value={lo}
          onCommit={(n) => encode(Math.min(Math.max(dMin, n), hi), hi)} />
        <span className="lv-numrange-sep">—</span>
        <PriceField label="MAX" prefix={cur.sym} value={hi}
          onCommit={(n) => encode(lo, Math.max(Math.min(dMax, n), lo))} />
      </div>
    </div>
  )
}

// ─── NumRangePaneContent ───────────────────────────────────
function NumRangePaneContent({
  value,
  onChange,
  showClear,
  onClear,
  def,
}: {
  value: string[] | undefined
  onChange: (v: string[]) => void
  showClear: boolean
  onClear: () => void
  def: Extract<FilterDef, { type: "numrange" }>
}) {
  const vals = value ?? []

  // Multi-currency variant (e.g. Price with USD + MMK blocks)
  if (def.currencies && def.currencies.length > 0) {
    return (
      <div className="lv-numrange">
        <div className="lv-numrange-head">
          <h3 className="lv-numrange-title">{def.label}</h3>
          {showClear && <button className="lv-numrange-clear" onClick={onClear}>Clear</button>}
        </div>
        {def.currencies.map((cur, i) => (
          <Fragment key={cur.key}>
            {i > 0 && <div className="lv-numrange-divider" />}
            <NumRangeBlock cur={cur} vals={vals} onChange={onChange} />
          </Fragment>
        ))}
      </div>
    )
  }

  // Single plain range (legacy — no currency tag, no slider)
  const min = nrMin(vals)
  const max = nrMax(vals)
  function setMin(n: string) {
    const next = vals.filter((v) => !v.startsWith("min:"))
    onChange(n ? [...next, `min:${n}`] : next)
  }
  function setMax(n: string) {
    const next = vals.filter((v) => !v.startsWith("max:"))
    onChange(n ? [...next, `max:${n}`] : next)
  }
  return (
    <div className="lv-daterange" style={{ padding: "4px 14px 10px" }}>
      <div className="lv-daterange-row">
        <label className="lv-daterange-label">Min</label>
        <input type="number" className="lv-daterange-input" value={min} min={0}
          placeholder={def.placeholders?.min ?? "0"} onChange={(e) => setMin(e.target.value)} />
      </div>
      <div className="lv-daterange-row">
        <label className="lv-daterange-label">Max</label>
        <input type="number" className="lv-daterange-input" value={max} min={0}
          placeholder={def.placeholders?.max ?? "∞"} onChange={(e) => setMax(e.target.value)} />
      </div>
    </div>
  )
}

// ─── FilterPanel (two-pane) ────────────────────────────────
function FilterPanel({
  filterDefs,
  filters,
  setFilters,
  onClose,
}: {
  filterDefs: FilterDef[]
  filters: ActiveFilters
  setFilters: (v: ActiveFilters) => void
  onClose: () => void
}) {
  const [activeId, setActiveId] = useState(filterDefs.find((d) => d.type !== "toggle")?.id ?? "")
  const def = filterDefs.find((d) => d.id === activeId)

  // All interactions update local draft — committed to real state only on "Filter" click
  const [draft, setDraft] = useState<ActiveFilters>(() => ({ ...filters }))

  function handleFilterClick() {
    setFilters(draft)
    onClose()
  }

  const totalSelected = Object.entries(draft).reduce((sum, [defId, v]) => {
    if (!v || v.length === 0) return sum
    const fd = filterDefs.find((d) => d.id === defId)
    if (fd?.type === "numrange" && fd.currencies) {
      return sum + fd.currencies.filter((c) => getCurMin(v, c.key) || getCurMax(v, c.key)).length
    }
    const isDR = v.some(
      (x) => x.startsWith("from:") || x.startsWith("to:") || x.startsWith("min:") || x.startsWith("max:")
    )
    return sum + (isDR ? 1 : v.length)
  }, 0)

  function toggleOption(defId: string, value: string) {
    const cur = draft[defId] ?? []
    setDraft({
      ...draft,
      [defId]: cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value],
    })
  }

  function selectAll() {
    if (!def || def.type !== "multi") return
    setDraft({ ...draft, [def.id]: def.options.map((o) => o.value) })
  }

  function clearDef(defId: string) {
    const next = { ...draft }
    delete next[defId]
    setDraft(next)
  }

  function toggleDef(defId: string) {
    const isOn = draft[defId]?.includes("true")
    if (isOn) {
      const next = { ...draft }
      delete next[defId]
      setDraft(next)
    } else {
      setDraft({ ...draft, [defId]: ["true"] })
    }
  }

  function defCount(defId: string) {
    const vals = draft[defId]
    if (!vals || vals.length === 0) return 0
    const fd = filterDefs.find((d) => d.id === defId)
    if (fd?.type === "numrange" && fd.currencies) {
      return fd.currencies.filter((c) => getCurMin(vals, c.key) || getCurMax(vals, c.key)).length
    }
    return vals.some(
      (x) => x.startsWith("from:") || x.startsWith("to:") || x.startsWith("min:") || x.startsWith("max:")
    ) ? 1 : vals.length
  }

  const nonToggleDefs = filterDefs.filter((d) => d.type !== "toggle")
  const toggleDefs = filterDefs.filter((d) => d.type === "toggle")

  return (
    <div className="lv-filter-panel">
      <nav className="lv-filter-nav" aria-label="Filter categories">
        <div className="lv-filter-nav-head">Filter by</div>
        {toggleDefs.length > 0 && (
          <>
            {toggleDefs.map((d) => {
              const isOn = draft[d.id]?.includes("true")
              return (
                <button
                  key={d.id}
                  className={`lv-filter-nav-item lv-filter-nav-toggle${isOn ? " active" : ""}`}
                  onClick={() => toggleDef(d.id)}
                >
                  <span className={`lv-filter-check${isOn ? " lv-filter-on" : ""}`}>
                    {isOn && <span className="lv-filter-check-ico"><Check /></span>}
                  </span>
                  <span className="lv-filter-nav-label">{d.label}</span>
                </button>
              )
            })}
            {nonToggleDefs.length > 0 && <div className="lv-filter-nav-sep" />}
          </>
        )}
        {nonToggleDefs.map((d) => {
          const count = defCount(d.id)
          return (
            <button
              key={d.id}
              className={`lv-filter-nav-item${activeId === d.id ? " active" : ""}`}
              onClick={() => setActiveId(d.id)}
            >
              <span className="lv-filter-nav-label">{d.label}</span>
              {count > 0 && <span className="lv-filter-nav-badge">{count}</span>}
              <ChevronRight className="lv-filter-nav-arrow" />
            </button>
          )
        })}
      </nav>

      <div className="lv-filter-pane">
        {def && def.type === "daterange" ? (
          <>
            <div className="lv-filter-pane-head">
              <span className="lv-filter-pane-title">{def.label}</span>
              {defCount(def.id) > 0 && (
                <div className="lv-filter-pane-actions">
                  <button onClick={() => clearDef(def.id)}>Clear</button>
                </div>
              )}
            </div>
            <DateRangePaneContent
              value={draft[def.id]}
              onChange={(v) => setDraft({ ...draft, [def.id]: v })}
            />
          </>
        ) : def && def.type === "numrange" ? (
          <NumRangePaneContent
            value={draft[def.id]}
            onChange={(v) => setDraft({ ...draft, [def.id]: v })}
            showClear={defCount(def.id) > 0}
            onClear={() => clearDef(def.id)}
            def={def}
          />
        ) : def && def.type === "multi" ? (
          <>
            <div className="lv-filter-pane-head">
              <span className="lv-filter-pane-title">
                {def.label}
                {(draft[def.id]?.length ?? 0) > 0 && (
                  <span className="lv-filter-pane-sel">
                    {draft[def.id]!.length}/{def.options.length} selected
                  </span>
                )}
              </span>
              <div className="lv-filter-pane-actions">
                <button onClick={selectAll}>Select all</button>
                {(draft[def.id]?.length ?? 0) > 0 && (
                  <>
                    <span className="lv-filter-pane-sep" />
                    <button onClick={() => clearDef(def.id)}>Clear</button>
                  </>
                )}
              </div>
            </div>
            {def.options.map((o) => {
              const on = (draft[def.id] ?? []).includes(o.value)
              return (
                <button
                  key={o.value}
                  className="lv-filter-option"
                  onClick={() => toggleOption(def.id, o.value)}
                >
                  <span className={`lv-filter-check${on ? " lv-filter-on" : ""}`}>
                    {on && <span className="lv-filter-check-ico"><Check /></span>}
                  </span>
                  {o.label}
                  {typeof o.count === "number" && (
                    <span className="lv-filter-option-count">{o.count}</span>
                  )}
                </button>
              )
            })}
          </>
        ) : null}
      </div>

      <div className="lv-filter-foot">
        <span className="lv-filter-foot-status">
          {totalSelected > 0
            ? `${totalSelected} filter${totalSelected !== 1 ? "s" : ""} applied`
            : "No filters applied"}
        </span>
        <button className="lv-filter-done-btn" onClick={handleFilterClick}>
          Filter
        </button>
      </div>
    </div>
  )
}

// ─── Toolbar ──────────────────────────────────────────────
function Toolbar<T>({
  query,
  setQuery,
  filterDefs,
  filters,
  setFilters,
  groupBy,
  setGroupBy,
  groupOptions,
  sortBy,
  setSortBy,
  columnDefs,
  visibleColumns,
  setVisibleColumns,
  onRefresh,
  onExport,
  onSearch,
}: {
  query: string
  setQuery: (v: string) => void
  filterDefs: FilterDef[]
  filters: ActiveFilters
  setFilters: (v: ActiveFilters) => void
  groupBy: string | null
  setGroupBy: (v: string | null) => void
  groupOptions: GroupOption[]
  sortBy: SortState | null
  setSortBy: (v: SortState | null) => void
  columnDefs: ColumnDef<T>[]
  visibleColumns: Record<string, boolean>
  setVisibleColumns: (v: Record<string, boolean>) => void
  onRefresh?: () => void
  onExport?: (format: string) => void
  onSearch?: (q: string) => void
}) {
  const filterRef = useRef<HTMLDivElement>(null)
  const groupRef = useRef<HTMLDivElement>(null)
  const sortRef = useRef<HTMLDivElement>(null)
  const colRef = useRef<HTMLDivElement>(null)
  const exportRef = useRef<HTMLDivElement>(null)
  const filterPop = usePopover(filterRef)
  const groupPop = usePopover(groupRef)
  const sortPop = usePopover(sortRef)
  const colPop = usePopover(colRef)
  const exportPop = usePopover(exportRef)

  const filterCount = Object.values(filters).filter(
    (v) => Array.isArray(v) && v.length > 0
  ).length

  const sortableCols = columnDefs.filter((c) => c.sortable !== false)
  const toggleableCols = columnDefs.filter((c) => c.toggleable !== false)

  return (
    <div className="lv-toolbar">
      {/* Search */}
      <div className="lv-search">
        <span className="lv-search-ico">
          <Search />
        </span>
        <input
          placeholder="Search…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); onSearch?.(e.target.value) }}
          aria-label="Search"
        />
        <span className="lv-search-kbd">⌘K</span>
      </div>

      <span className="lv-divider" aria-hidden="true" />

      {/* Filter */}
      <div style={{ position: "relative" }} ref={filterRef}>
        <button
          className={`lv-tbtn${filterCount ? " active" : ""}`}
          onClick={() => filterPop.setOpen((v) => !v)}
        >
          <Filter /> Filter
          {filterCount > 0 && (
            <span className="lv-tbtn-dot">{filterCount}</span>
          )}
          <ChevronDown />
        </button>
        {filterPop.open && filterDefs.length > 0 && (
          <div className="lv-popover lv-pop-left lv-pop-filter" role="menu">
            <FilterPanel
              filterDefs={filterDefs}
              filters={filters}
              setFilters={setFilters}
              onClose={() => filterPop.setOpen(false)}
            />
          </div>
        )}
      </div>

      {/* Group by */}
      {groupOptions.length > 0 && (
        <div style={{ position: "relative" }} ref={groupRef}>
          <button
            className={`lv-tbtn${groupBy ? " active" : ""}`}
            onClick={() => groupPop.setOpen((v) => !v)}
          >
            <Group />
            {groupBy
              ? `Group: ${groupOptions.find((o) => o.id === groupBy)?.label ?? ""}`
              : "Group"}
            <ChevronDown />
          </button>
          {groupPop.open && (
            <div className="lv-popover lv-pop-left" role="menu">
              <div className="lv-popover-head">Group by</div>
              <button
                className={`lv-popover-item${!groupBy ? " lv-pop-on" : ""}`}
                onClick={() => {
                  setGroupBy(null)
                  groupPop.setOpen(false)
                }}
              >
                <Ban /> None
                <Check className="lv-popover-check" />
              </button>
              {groupOptions.map((o) => (
                <button
                  key={o.id}
                  className={`lv-popover-item${groupBy === o.id ? " lv-pop-on" : ""}`}
                  onClick={() => {
                    setGroupBy(o.id)
                    groupPop.setOpen(false)
                  }}
                >
                  <Group /> {o.label}
                  <Check className="lv-popover-check" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sort */}
      <div style={{ position: "relative" }} ref={sortRef}>
        <button
          className={`lv-tbtn${sortBy ? " active" : ""}`}
          onClick={() => sortPop.setOpen((v) => !v)}
        >
          <ArrowUpDown />
          {sortBy
            ? `Sort: ${sortableCols.find((c) => c.id === sortBy.id)?.label ?? ""}`
            : "Sort"}
          <ChevronDown />
        </button>
        {sortPop.open && (
          <div className="lv-popover lv-pop-left" role="menu">
            <div className="lv-popover-head">Sort by</div>
            {sortableCols.map((c) => (
              <button
                key={c.id}
                className={`lv-popover-item${sortBy?.id === c.id ? " lv-pop-on" : ""}`}
                onClick={() => {
                  const dir =
                    sortBy?.id === c.id && sortBy.dir === "asc" ? "desc" : "asc"
                  setSortBy({ id: c.id, dir })
                  sortPop.setOpen(false)
                }}
              >
                <ArrowUpDown /> {c.label}
                {sortBy?.id === c.id && (
                  <span style={{ marginLeft: "auto", fontSize: 10.5, color: "var(--lv-accent)", fontWeight: 700 }}>
                    {sortBy.dir === "asc" ? "A → Z" : "Z → A"}
                  </span>
                )}
              </button>
            ))}
            <div className="lv-popover-sep" />
            <button
              className="lv-popover-item"
              onClick={() => {
                setSortBy(null)
                sortPop.setOpen(false)
              }}
            >
              <X /> Clear sort
            </button>
          </div>
        )}
      </div>

      <span className="lv-toolbar-spacer" />

      {/* Columns */}
      <div style={{ position: "relative" }} ref={colRef}>
        <button
          className="lv-tbtn"
          onClick={() => colPop.setOpen((v) => !v)}
        >
          <Columns3 /> Columns
        </button>
        {colPop.open && (
          <div className="lv-popover lv-pop-right" role="menu">
            <div className="lv-popover-head">Visible columns</div>
            {toggleableCols.map((c) => {
              const on = visibleColumns[c.id] !== false
              return (
                <button
                  key={c.id}
                  className={`lv-popover-item${on ? " lv-pop-on" : ""}`}
                  onClick={() =>
                    setVisibleColumns({ ...visibleColumns, [c.id]: !on })
                  }
                >
                  <span className={`lv-filter-check${on ? " lv-filter-on" : ""}`}>
                    {on && (
                      <span className="lv-filter-check-ico">
                        <Check />
                      </span>
                    )}
                  </span>
                  {c.label}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Refresh */}
      {onRefresh && (
        <button className="lv-tbtn" onClick={onRefresh} title="Refresh">
          <RefreshCw />
        </button>
      )}

      {/* Export */}
      <div style={{ position: "relative" }} ref={exportRef}>
        <button
          className="lv-tbtn"
          onClick={() => exportPop.setOpen((v) => !v)}
          title="Export"
        >
          <Download /> Export <ChevronDown />
        </button>
        {exportPop.open && (
          <div className="lv-popover lv-pop-right" role="menu">
            <div className="lv-popover-head">Export current view</div>
            {(["xlsx", "csv", "pdf"] as const).map((fmt) => (
              <button
                key={fmt}
                className="lv-popover-item"
                onClick={() => {
                  onExport?.(fmt)
                  exportPop.setOpen(false)
                }}
              >
                <Download />
                Export to {fmt === "pdf" ? "PDF" : fmt.toUpperCase()}
                <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono,monospace)", fontSize: 10.5, color: "var(--lv-text-3)" }}>
                  .{fmt}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Pagination ───────────────────────────────────────────
function LvPagination({
  total,
  page,
  pageSize,
  buildHref,
}: {
  total: number
  page: number
  pageSize: number
  buildHref: (page: number) => string
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  const nums: Array<number | "…"> = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) nums.push(i)
  } else {
    nums.push(1)
    if (page > 4) nums.push("…")
    const start = Math.max(2, page - 1)
    const end = Math.min(totalPages - 1, page + 1)
    for (let i = start; i <= end; i++) nums.push(i)
    if (page < totalPages - 3) nums.push("…")
    nums.push(totalPages)
  }

  return (
    <div className="lv-pagination">
      <div className="lv-pagination-left">
        <span className="lv-pagination-info">
          Showing{" "}
          <strong>
            {from.toLocaleString()}–{to.toLocaleString()}
          </strong>{" "}
          of <strong>{total.toLocaleString()}</strong>
        </span>
      </div>
      <div className="lv-pages">
        {page > 1 ? (
          <Link href={buildHref(page - 1)} className="lv-page">
            <ChevronLeft /> Prev
          </Link>
        ) : (
          <button className="lv-page" disabled>
            <ChevronLeft /> Prev
          </button>
        )}

        {nums.map((n, i) =>
          n === "…" ? (
            <span key={`e${i}`} className="lv-page-ellipsis">
              …
            </span>
          ) : (
            <Link
              key={n}
              href={buildHref(n)}
              className={`lv-page${n === page ? " lv-page-on" : ""}`}
            >
              {n}
            </Link>
          )
        )}

        {page < totalPages ? (
          <Link href={buildHref(page + 1)} className="lv-page">
            Next <ChevronRight />
          </Link>
        ) : (
          <button className="lv-page" disabled>
            Next <ChevronRight />
          </button>
        )}
      </div>
    </div>
  )
}

// ─── ListViewCard ─────────────────────────────────────────

type ListViewCardProps<T extends { id: string }> = {
  // Data
  rows: T[]
  columnDefs: ColumnDef<T>[]

  // Views/tabs (URL-controlled by parent)
  views?: ViewTab[]
  activeView?: string
  buildViewHref?: (view: string) => string

  // Filter / group / sort config
  filterDefs?: FilterDef[]
  groupOptions?: GroupOption[]
  defaultSort?: SortState
  /** fn that returns a sort key for a row given the sort column id */
  getSortValue?: (row: T, colId: string) => string | number
  /** override filter matching for a specific filter id; return null to fall back to default string match */
  filterRow?: (row: T, filterId: string, selectedValues: string[]) => boolean | null
  /** override group key for a specific groupBy id; return null to fall back to default string lookup */
  getGroupKey?: (row: T, groupBy: string) => string | null
  /** compute aggregate pills shown in the group header row */
  getGroupAggs?: (rows: T[], groupBy: string) => Array<{ label: string; value: string }>

  // Row actions (rendered in the hover actions column)
  rowActions?: (row: T, disabled: boolean) => ReactNode
  // Called when a row is clicked (use instead of renderDrawer for navigation)
  onRowClick?: (row: T) => void
  // Slide-out drawer (rendered when a row is clicked)
  renderDrawer?: (row: T, onClose: () => void) => ReactNode
  // Bulk actions bar content (receives selected rows)
  renderBulkActions?: (rows: T[], onClear: () => void) => ReactNode

  // URL-based pagination
  page?: number
  pageSize?: number
  total?: number
  buildPageHref?: (page: number) => string

  // URL-based search (when provided, search input drives URL navigation)
  defaultSearch?: string
  onSearch?: (q: string) => void

  // Misc
  onRefresh?: () => void
  onExport?: (format: string) => void
  emptyMessage?: string
  /** Pre-populate filter state on mount (use for server-driven filter restoration). */
  defaultFilters?: ActiveFilters
  /**
   * Called when a filter value changes. Return `true` to handle the change
   * externally (skips internal state update — use for server-driven filters).
   */
  onFilterChange?: (filterId: string, values: string[]) => boolean | void
}

export function ListViewCard<T extends { id: string }>({
  rows,
  columnDefs,
  views,
  activeView,
  buildViewHref,
  filterDefs = [],
  groupOptions = [],
  defaultSort,
  getSortValue,
  filterRow,
  getGroupKey,
  getGroupAggs,
  rowActions,
  onRowClick,
  renderDrawer,
  renderBulkActions,
  page = 1,
  pageSize = 20,
  total,
  buildPageHref,
  defaultSearch,
  onSearch,
  onRefresh,
  onExport,
  emptyMessage,
  defaultFilters,
  onFilterChange,
}: ListViewCardProps<T>) {
  const [query, setQuery] = useState(defaultSearch ?? "")
  const [filters, setFilters] = useState<ActiveFilters>(defaultFilters ?? {})

  function handleSetFilters(next: ActiveFilters) {
    if (onFilterChange) {
      for (const [id, vals] of Object.entries(next)) {
        const prev = filters[id] ?? []
        const newVals = vals ?? []
        const changed =
          newVals.length !== prev.length ||
          newVals.some((v) => !prev.includes(v))
        if (changed) {
          const handled = onFilterChange(id, newVals)
          if (handled) { setFilters(next); return }
        }
      }
      for (const id of Object.keys(filters)) {
        if (!(id in next) || (next[id] ?? []).length === 0) {
          const prev = filters[id] ?? []
          if (prev.length > 0) {
            const handled = onFilterChange(id, [])
            if (handled) { setFilters(next); return }
          }
        }
      }
    }
    setFilters(next)
  }
  const [groupBy, setGroupBy] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<SortState | null>(defaultSort ?? null)
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({})
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [openRow, setOpenRow] = useState<T | null>(null)

  // Client-side filter + sort on the loaded rows
  const filtered = useMemo(() => {
    let result = rows
    if (query) {
      const q = query.toLowerCase()
      result = result.filter((r) =>
        Object.values(r).some((v) =>
          typeof v === "string" ? v.toLowerCase().includes(q) : false
        )
      )
    }
    for (const [key, vals] of Object.entries(filters)) {
      if (!vals || vals.length === 0) continue
      result = result.filter((r) => {
        if (filterRow) {
          const custom = filterRow(r, key, vals)
          if (custom !== null) return custom
        }
        const rv = (r as Record<string, unknown>)[key]
        return typeof rv === "string" && vals.includes(rv)
      })
    }
    return result
  }, [rows, query, filters, filterRow])

  const sorted = useMemo(() => {
    if (!sortBy) return filtered
    const dir = sortBy.dir === "asc" ? 1 : -1
    return [...filtered].sort((a, b) => {
      const av = getSortValue ? getSortValue(a, sortBy.id) : ""
      const bv = getSortValue ? getSortValue(b, sortBy.id) : ""
      if (av < bv) return -1 * dir
      if (av > bv) return 1 * dir
      return 0
    })
  }, [filtered, sortBy, getSortValue])

  // Group rows: interleave group headers
  const renderedRows = useMemo((): Array<T | GroupRow> => {
    if (!groupBy) return sorted
    const groups = new Map<string, T[]>()
    sorted.forEach((r) => {
      const custom = getGroupKey?.(r, groupBy)
      const key = custom !== null && custom !== undefined
        ? custom
        : String((r as Record<string, unknown>)[groupBy] ?? "other")
      const bucket = groups.get(key) ?? []
      bucket.push(r)
      groups.set(key, bucket)
    })
    const out: Array<T | GroupRow> = []
    for (const [key, items] of groups) {
      out.push({
        __group: true,
        key,
        label: key,
        count: items.length,
        aggs: getGroupAggs ? getGroupAggs(items, groupBy) : undefined,
      } satisfies GroupRow)
      if (!collapsedGroups[key]) out.push(...items)
    }
    return out
  }, [sorted, groupBy, collapsedGroups, getGroupKey, getGroupAggs])

  // Active filter chips
  const activeChips: Array<{ defId: string; value: string; defLabel: string; valueLabel: string }> = []
  for (const [defId, vals] of Object.entries(filters)) {
    if (!vals || vals.length === 0) continue
    const def = filterDefs.find((d) => d.id === defId)
    if (!def) continue
    if (def.type === "daterange") {
      const from = drFrom(vals)
      const to   = drTo(vals)
      if (!from && !to) continue
      const label = from && to
        ? `${drFmt(from)} – ${drFmt(to)}`
        : from ? `From ${drFmt(from)}` : `Until ${drFmt(to)}`
      activeChips.push({ defId, value: "__daterange__", defLabel: def.label, valueLabel: label })
    } else if (def.type === "numrange") {
      if (def.currencies) {
        for (const cur of def.currencies) {
          const minStr = getCurMin(vals, cur.key)
          const maxStr = getCurMax(vals, cur.key)
          if (!minStr && !maxStr) continue
          const [dMin, dMax] = cur.domain
          const lo = minStr ? parseFloat(minStr) : dMin
          const hi = maxStr ? parseFloat(maxStr) : dMax
          const fmtN = (n: number) => n.toLocaleString("en-US")
          const label = `${cur.code} ${cur.sym}${fmtN(lo)} – ${cur.sym}${fmtN(hi)}`
          activeChips.push({ defId, value: `__numrange_${cur.key}`, defLabel: def.label, valueLabel: label })
        }
      } else {
        const min = nrMin(vals)
        const max = nrMax(vals)
        if (!min && !max) continue
        const label =
          min && max
            ? `${nrFmt(min)} – ${nrFmt(max)}`
            : min
              ? `≥ ${nrFmt(min)}`
              : `≤ ${nrFmt(max)}`
        activeChips.push({ defId, value: "__numrange__", defLabel: def.label, valueLabel: label })
      }
    } else if (def.type === "toggle") {
      if (vals.includes("true")) {
        activeChips.push({ defId, value: "true", defLabel: def.label, valueLabel: def.label })
      }
    } else if (def.type === "multi") {
      for (const v of vals) {
        const opt = def.options.find((o) => o.value === v)
        activeChips.push({ defId, value: v, defLabel: def.label, valueLabel: opt?.label ?? v })
      }
    }
  }
  const hasActive = activeChips.length > 0 || !!groupBy || !!sortBy

  function removeChip(defId: string, value: string) {
    const next = { ...filters }
    if (value === "__daterange__" || value === "__numrange__") {
      delete next[defId]
    } else if (value.startsWith("__numrange_")) {
      const key = value.slice("__numrange_".length)
      const filtered = (next[defId] ?? []).filter(
        (v) => !v.startsWith(`${key}Min:`) && !v.startsWith(`${key}Max:`)
      )
      if (filtered.length === 0) delete next[defId]
      else next[defId] = filtered
    } else {
      next[defId] = (next[defId] ?? []).filter((v) => v !== value)
    }
    handleSetFilters(next)
  }

  function clearAll() {
    handleSetFilters({})
    setGroupBy(null)
    setSortBy(null)
  }

  const selectedRows = rows.filter((r) => selected[r.id])
  const selectedCount = selectedRows.length

  return (
    <>
      <div className="lv-card">
        {/* Views / tabs */}
        {views && views.length > 0 && (
          <div className="lv-views" role="tablist">
            {views.map((v) => (
              buildViewHref ? (
                <Link
                  key={v.id}
                  href={buildViewHref(v.id)}
                  className={`lv-view lv-view-${v.id}${activeView === v.id ? " on" : ""}`}
                  role="tab"
                  aria-selected={activeView === v.id}
                >
                  {v.label}
                  {typeof v.count === "number" && (
                    <span className="lv-view-count">{v.count}</span>
                  )}
                </Link>
              ) : (
                <button
                  key={v.id}
                  className={`lv-view lv-view-${v.id}${activeView === v.id ? " on" : ""}`}
                  role="tab"
                  aria-selected={activeView === v.id}
                >
                  {v.label}
                  {typeof v.count === "number" && (
                    <span className="lv-view-count">{v.count}</span>
                  )}
                </button>
              )
            ))}
          </div>
        )}

        {/* Toolbar */}
        <Toolbar
          query={query}
          setQuery={(v) => setQuery(v)}
          filterDefs={filterDefs}
          filters={filters}
          setFilters={handleSetFilters}
          groupBy={groupBy}
          setGroupBy={setGroupBy}
          groupOptions={groupOptions}
          sortBy={sortBy}
          setSortBy={setSortBy}
          columnDefs={columnDefs}
          visibleColumns={visibleColumns}
          setVisibleColumns={setVisibleColumns}
          onRefresh={onRefresh}
          onExport={onExport}
          onSearch={onSearch}
        />

        {/* Active filter chips */}
        {hasActive && (
          <div className="lv-activebar" role="region" aria-label="Active filters">
            <span className="lv-activebar-label">Active</span>
            {groupBy && (
              <span className="lv-chip">
                <span className="lv-chip-key">Group</span>
                <span className="lv-chip-op">is</span>
                <span className="lv-chip-val">
                  {groupOptions.find((g) => g.id === groupBy)?.label ?? groupBy}
                </span>
                <button className="lv-chip-x" onClick={() => setGroupBy(null)} aria-label="Remove group by">
                  <X />
                </button>
              </span>
            )}
            {sortBy && (
              <span className="lv-chip">
                <span className="lv-chip-key">Sort</span>
                <span className="lv-chip-op">by</span>
                <span className="lv-chip-val">
                  {columnDefs.find((c) => c.id === sortBy.id)?.label ?? sortBy.id}
                  {" · "}
                  {sortBy.dir === "asc" ? "ascending" : "descending"}
                </span>
                <button className="lv-chip-x" onClick={() => setSortBy(null)} aria-label="Remove sort">
                  <X />
                </button>
              </span>
            )}
            {activeChips.map((c, i) => (
              <span key={i} className="lv-chip">
                <span className="lv-chip-key">{c.defLabel}</span>
                <span className="lv-chip-op">is</span>
                <span className="lv-chip-val">{c.valueLabel}</span>
                <button
                  className="lv-chip-x"
                  onClick={() => removeChip(c.defId, c.value)}
                  aria-label={`Remove filter ${c.defLabel} = ${c.valueLabel}`}
                >
                  <X />
                </button>
              </span>
            ))}
            <button className="lv-clear-all" onClick={clearAll}>
              Clear all
            </button>
          </div>
        )}

        {/* Table */}
        <ListViewTable
          rows={sorted}
          columnDefs={columnDefs}
          visibleColumns={visibleColumns}
          sortBy={sortBy}
          onSortBy={setSortBy}
          selected={selected}
          onSelected={setSelected}
          groupBy={groupBy}
          groupOptions={groupOptions}
          collapsedGroups={collapsedGroups}
          onCollapsedGroups={setCollapsedGroups}
          onOpenRow={onRowClick ?? setOpenRow}
          rowActions={rowActions}
          emptyMessage={emptyMessage}
          renderedRows={renderedRows}
        />

        {/* Pagination */}
        {buildPageHref && total !== undefined && (
          <LvPagination
            total={total}
            page={page}
            pageSize={pageSize}
            buildHref={buildPageHref}
          />
        )}
      </div>

      {/* Bulk action bar */}
      {renderBulkActions && selectedCount > 0 && (
        <div className="lv-bulk" role="region" aria-label="Bulk actions">
          <span className="lv-bulk-count">
            <span className="lv-bulk-num">{selectedCount}</span> selected
          </span>
          <button
            className="lv-bulkbtn"
            onClick={() => setSelected({})}
            aria-label="Clear selection"
          >
            <X /> Clear
          </button>
          <span className="lv-bulk-sep" aria-hidden="true" />
          {renderBulkActions(selectedRows, () => setSelected({}))}
        </div>
      )}

      {/* Detail drawer */}
      {openRow && renderDrawer && renderDrawer(openRow, () => setOpenRow(null))}
    </>
  )
}
