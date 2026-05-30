"use client"

import { useState, useTransition, useMemo } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Search, Plus, Minus, User } from "lucide-react"
import {
  adminCreditUserPointsAction,
  adminDeductUserPointsAction,
} from "@/features/points/actions/points"

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

export function AdminCreditPointsForm({ users }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [query, setQuery]           = useState("")
  const [selectedUser, setSelected] = useState<UserOption | null>(null)
  const [showList, setShowList]     = useState(false)
  const [mode, setMode]             = useState<"credit" | "deduct">("credit")
  const [amount, setAmount]         = useState("")
  const [note, setNote]             = useState("")

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedUser) return
    const n = Math.floor(Number(amount))
    if (!n || n <= 0) { toast.error("Enter a valid amount"); return }

    startTransition(async () => {
      const result = mode === "credit"
        ? await adminCreditUserPointsAction(selectedUser.id, n, note)
        : await adminDeductUserPointsAction(selectedUser.id, n, note)

      if ("error" in result) {
        toast.error(result.error)
        return
      }

      toast.success(
        `${mode === "credit" ? "Credited" : "Deducted"} ${n.toLocaleString()} pts — ${selectedUser.name} now has ${result.updatedPoints.toLocaleString()} pts`
      )
      setSelected(null)
      setQuery("")
      setAmount("")
      setNote("")
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 540 }}>
      {/* User search */}
      <div className="lv-drawer-section-h" style={{ marginBottom: 10 }}>1. Select user</div>
      <div style={{ position: "relative", marginBottom: 20 }}>
        <div style={{ position: "relative" }}>
          <Search style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "var(--lv-text-3)" }} />
          <input
            type="text"
            placeholder="Search by name, email or phone…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setShowList(true); setSelected(null) }}
            onFocus={() => setShowList(true)}
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
                  <div style={{ fontSize: 11.5, color: "var(--lv-text-3)" }}>{u.email}</div>
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
            <div style={{ fontSize: 11.5, color: "var(--lv-text-3)" }}>{selectedUser.email}{selectedUser.phone ? ` · ${selectedUser.phone}` : ""}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "var(--lv-text-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Current balance</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--lv-text)", fontVariantNumeric: "tabular-nums" }}>
              {selectedUser.points.toLocaleString()} pts
            </div>
          </div>
        </div>
      )}

      {/* Credit / Deduct toggle */}
      <div className="lv-drawer-section-h" style={{ marginBottom: 10 }}>2. Operation</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button
          type="button"
          onClick={() => setMode("credit")}
          style={{
            flex: 1, padding: "9px 0", borderRadius: 8, border: `2px solid ${mode === "credit" ? "var(--lv-good)" : "var(--lv-border)"}`,
            background: mode === "credit" ? "#ecfdf5" : "#fff",
            color: mode === "credit" ? "#047857" : "var(--lv-text-2)",
            fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}
        >
          <Plus style={{ width: 14, height: 14 }} /> Add Points
        </button>
        <button
          type="button"
          onClick={() => setMode("deduct")}
          style={{
            flex: 1, padding: "9px 0", borderRadius: 8, border: `2px solid ${mode === "deduct" ? "var(--lv-danger)" : "var(--lv-border)"}`,
            background: mode === "deduct" ? "#fef2f2" : "#fff",
            color: mode === "deduct" ? "#b91c1c" : "var(--lv-text-2)",
            fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}
        >
          <Minus style={{ width: 14, height: 14 }} /> Deduct Points
        </button>
      </div>

      {/* Amount */}
      <div className="lv-drawer-section-h" style={{ marginBottom: 10 }}>3. Amount & note</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--lv-text-2)" }}>
            Points to {mode === "credit" ? "add" : "deduct"} <span style={{ color: "var(--lv-danger)" }}>*</span>
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
          {selectedUser && amount && Number(amount) > 0 && (
            <span style={{ fontSize: 12, color: "var(--lv-text-3)" }}>
              New balance: <strong style={{ color: "var(--lv-text)" }}>
                {(mode === "credit"
                  ? selectedUser.points + Math.floor(Number(amount))
                  : Math.max(0, selectedUser.points - Math.floor(Number(amount)))
                ).toLocaleString()} pts
              </strong>
            </span>
          )}
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--lv-text-2)" }}>Note (optional)</span>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Reason for this adjustment"
            style={inputStyle}
          />
        </label>
      </div>

      <div style={{ marginTop: 20, display: "flex", gap: 10, alignItems: "center" }}>
        <button
          type="submit"
          disabled={isPending || !selectedUser}
          style={{
            padding: "9px 20px", borderRadius: 8, border: "none", cursor: "pointer",
            fontWeight: 600, fontSize: 13, opacity: isPending || !selectedUser ? 0.5 : 1,
            background: mode === "credit" ? "var(--lv-good)" : "var(--lv-danger)",
            color: "#fff", display: "flex", alignItems: "center", gap: 7,
          }}
        >
          {mode === "credit" ? <Plus style={{ width: 14, height: 14 }} /> : <Minus style={{ width: 14, height: 14 }} />}
          {isPending ? "Processing…" : `${mode === "credit" ? "Add" : "Deduct"} points`}
        </button>
      </div>
    </form>
  )
}

const inputStyle: React.CSSProperties = {
  fontSize: 13, padding: "9px 12px",
  border: "1px solid var(--lv-border)", borderRadius: 8,
  outline: "none", width: "100%", background: "#fff", color: "var(--lv-text)",
}
