"use client"

import { useState, useTransition, useMemo } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Search, Minus, X, ArrowDownToLine } from "lucide-react"
import {
  adminTopUpUserPointsAction,
  adminDeductUserPointsAction,
} from "@/features/points/actions/points"

type Mode = "topup" | "deduct"

type UserOption = {
  id: string
  name: string
  email: string
  phone: string | null
  points: number
  role: string
}

type Props = {
  users: UserOption[]
}

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("")
}
function getHue(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 6
  return h + 1
}

const MODE_CONFIG: Record<Mode, { label: string; color: string; bg: string; border: string; Icon: React.ElementType }> = {
  topup:  { label: "Top-up", color: "#047857", bg: "#ecfdf5", border: "var(--lv-good)",   Icon: ArrowDownToLine },
  deduct: { label: "Deduct", color: "#b91c1c", bg: "#fef2f2", border: "var(--lv-danger)", Icon: Minus },
}

// ─── Drawer ────────────────────────────────────────────────

function PointActionDrawer({
  mode,
  users,
  onClose,
}: {
  mode: Mode
  users: UserOption[]
  onClose: () => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [query, setQuery]           = useState("")
  const [selectedUser, setSelected] = useState<UserOption | null>(null)
  const [showList, setShowList]     = useState(false)
  const [amount, setAmount]         = useState("")
  const [note, setNote]             = useState("")

  const cfg = MODE_CONFIG[mode]

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return users.slice(0, 8)
    return users
      .filter((u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.phone ?? "").includes(q)
      )
      .slice(0, 8)
  }, [query, users])

  function selectUser(u: UserOption) {
    setSelected(u)
    setQuery(u.name)
    setShowList(false)
  }

  function previewBalance(): number | null {
    if (!selectedUser || !amount) return null
    const n = Math.floor(Number(amount))
    if (isNaN(n) || n <= 0) return null
    if (mode === "topup")  return selectedUser.points + n
    if (mode === "deduct") return Math.max(0, selectedUser.points - n)
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedUser) return
    const n = Math.floor(Number(amount))
    if (!n || n <= 0) { toast.error("Enter a valid amount"); return }

    startTransition(async () => {
      const result = mode === "topup"
        ? await adminTopUpUserPointsAction(selectedUser.id, n, note)
        : await adminDeductUserPointsAction(selectedUser.id, n, note)

      if ("error" in result) { toast.error(result.error); return }

      const msgs: Record<Mode, string> = {
        topup:  `Topped up ${n.toLocaleString()} pts — ${selectedUser.name} now has ${result.updatedPoints.toLocaleString()} pts`,
        deduct: `Deducted ${n.toLocaleString()} pts — ${selectedUser.name} now has ${result.updatedPoints.toLocaleString()} pts`,
      }
      toast.success(msgs[mode])
      setSelected(null)
      setQuery("")
      setAmount("")
      setNote("")
      router.refresh()
      onClose()
    })
  }

  const preview = previewBalance()
  const amountLabel = `Points to ${mode === "topup" ? "add" : "deduct"}`

  return (
    <>
      <div className="lv-drawer-backdrop" onClick={onClose} />
      <aside className="lv-drawer" role="dialog" aria-label={`${cfg.label} points`}>
        <header className="lv-drawer-head">
          <div className="rt-head-icon" style={{ background: cfg.bg, color: cfg.color, border: `1.5px solid ${cfg.border}` }}>
            <cfg.Icon style={{ width: 20, height: 20 }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="lv-drawer-title">{cfg.label} Points</div>
            <div className="lv-drawer-sub">
              {mode === "topup"  && "Credit points as a top-up purchase"}
              {mode === "deduct" && "Deduct points from user balance"}
            </div>
          </div>
          <button className="lv-drawer-close" onClick={onClose} aria-label="Close">
            <X style={{ width: 16, height: 16 }} />
          </button>
        </header>

        <div className="lv-drawer-body">
          <form onSubmit={handleSubmit}>
            {/* User search */}
            <h3 className="lv-drawer-section-h" style={{ marginBottom: 10 }}>1. Select user</h3>
            <div style={{ position: "relative", marginBottom: 20 }}>
              <div style={{ position: "relative" }}>
                <Search style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "var(--lv-text-3)" }} />
                <input
                  type="text"
                  placeholder="Search by name, email or phone…"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setShowList(true); setSelected(null) }}
                  onFocus={() => setShowList(true)}
                  onBlur={() => setTimeout(() => setShowList(false), 150)}
                  style={{ ...inputStyle, paddingLeft: 34 }}
                  autoComplete="off"
                />
              </div>

              {showList && filtered.length > 0 && (
                <div style={{
                  position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 50,
                  background: "#fff", border: "1px solid var(--lv-border)", borderRadius: 10,
                  boxShadow: "var(--lv-shadow-pop)", overflow: "hidden",
                }}>
                  {filtered.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onMouseDown={() => selectUser(u)}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", gap: 10,
                        padding: "9px 12px", background: "none", border: "none",
                        cursor: "pointer", textAlign: "left", transition: "background .1s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--lv-panel-2)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                    >
                      <span className="lv-avatar" data-hue={getHue(u.id)} style={{ width: 30, height: 30, fontSize: 11, flexShrink: 0 }}>
                        {getInitials(u.name)}
                      </span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--lv-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {u.name}
                        </div>
                        <div style={{ fontSize: 11.5, color: "var(--lv-text-3)" }}>{u.phone ?? u.email}</div>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--lv-text-2)", fontWeight: 600, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                        {u.points.toLocaleString()} pts
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected user card */}
            {selectedUser && (
              <div style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 14px", borderRadius: 10, marginBottom: 20,
                background: "var(--lv-panel-2)", border: "1px solid var(--lv-border)",
              }}>
                <span className="lv-avatar" data-hue={getHue(selectedUser.id)} style={{ width: 36, height: 36, fontSize: 13, flexShrink: 0 }}>
                  {getInitials(selectedUser.name)}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--lv-text)" }}>{selectedUser.name}</div>
                  <div style={{ fontSize: 11.5, color: "var(--lv-text-3)" }}>
                    {selectedUser.phone ?? selectedUser.email}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: "var(--lv-text-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Current balance</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--lv-text)", fontVariantNumeric: "tabular-nums" }}>
                    {selectedUser.points.toLocaleString()} pts
                  </div>
                </div>
              </div>
            )}

            {/* Amount / new balance */}
            <h3 className="lv-drawer-section-h" style={{ marginBottom: 10 }}>2. Amount &amp; note</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--lv-text-2)" }}>
                  {amountLabel} <span style={{ color: "var(--lv-danger)" }}>*</span>
                </span>
                <input
                  type="number"
                  required
                  min={1}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 1000"
                  style={inputStyle}
                />
                {preview !== null && (
                  <span style={{ fontSize: 12, color: "var(--lv-text-3)" }}>
                    New balance: <strong style={{ color: "var(--lv-text)" }}>{preview.toLocaleString()} pts</strong>
                    {selectedUser && (
                      <span style={{ marginLeft: 6, color: mode === "topup" ? "#047857" : "#b91c1c" }}>
                        ({mode === "topup" ? "+" : "−"}{Math.floor(Number(amount)).toLocaleString()})
                      </span>
                    )}
                  </span>
                )}
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--lv-text-2)" }}>Note (optional)</span>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Reason for this operation"
                  style={inputStyle}
                />
              </label>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button
                type="submit"
                disabled={isPending || !selectedUser}
                style={{
                  padding: "9px 20px", borderRadius: 8, border: "none", cursor: "pointer",
                  fontWeight: 600, fontSize: 13, opacity: isPending || !selectedUser ? 0.5 : 1,
                  background: cfg.color, color: "#fff",
                  display: "flex", alignItems: "center", gap: 7,
                }}
              >
                <cfg.Icon style={{ width: 14, height: 14 }} />
                {isPending ? "Processing…" : cfg.label}
              </button>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: "9px 16px", borderRadius: 8, border: "1px solid var(--lv-border)",
                  background: "none", color: "var(--lv-text-2)", fontWeight: 500, fontSize: 13, cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </aside>
    </>
  )
}

// ─── Main export ───────────────────────────────────────────

export function PointActionButtons({ users }: Props) {
  const [openMode, setOpenMode] = useState<Mode | null>(null)

  return (
    <>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {(["topup", "deduct"] as Mode[]).map((mode) => {
          const cfg = MODE_CONFIG[mode]
          return (
            <button
              key={mode}
              onClick={() => setOpenMode(mode)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "7px 14px", borderRadius: 8,
                border: `1.5px solid ${cfg.border}`,
                background: cfg.bg, color: cfg.color,
                fontWeight: 600, fontSize: 13, cursor: "pointer",
                transition: "opacity .15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              <cfg.Icon style={{ width: 14, height: 14 }} />
              {cfg.label}
            </button>
          )
        })}
      </div>

      {openMode && (
        <PointActionDrawer
          mode={openMode}
          users={users}
          onClose={() => setOpenMode(null)}
        />
      )}
    </>
  )
}

const inputStyle: React.CSSProperties = {
  fontSize: 13, padding: "9px 12px",
  border: "1px solid var(--lv-border)", borderRadius: 8,
  outline: "none", width: "100%", background: "#fff", color: "var(--lv-text)",
}
