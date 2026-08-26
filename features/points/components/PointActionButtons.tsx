"use client"

import { useState, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Search, Minus, X, ArrowDownToLine, CalendarClock, Users, UserPlus, Info } from "lucide-react"
import {
  adminTopUpUserPointsAction,
  adminDeductUserPointsAction,
} from "@/features/points/actions/points"
import { searchUsersForPickerAction } from "@/features/users/actions/users"
import { MonthlyBonusSettingsDialog } from "@/features/points/components/MonthlyBonusSettingsDialog"

type Mode = "topup" | "deduct"
type RecipientMode = "all" | "single"

type MonthlyBonusSettings = {
  enabled: boolean
  amount: number
  cycles: 1 | 3 | 6 | 12
  startDate: string | null
}

type UserOption = {
  id: string
  name: string
  email: string
  phone: string | null
  points: number
  role: string
}

type Props = {
  monthlyBonus: MonthlyBonusSettings
  monthlyBonusEligibleCount: number
}

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("")
}
function getHue(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 6
  return h + 1
}

type CampaignProgress = {
  id: string
  name: string
  pointsPerUser: number
  totalUsers: number
  processedUsers: number
  successCount: number
  failedCount: number
  status: string
}

const MODE_CONFIG: Record<Mode, { label: string; color: string; bg: string; border: string; Icon: React.ElementType }> = {
  topup:  { label: "Top-up", color: "#047857", bg: "#ecfdf5", border: "var(--lv-good)",   Icon: ArrowDownToLine },
  deduct: { label: "Deduct", color: "#b91c1c", bg: "#fef2f2", border: "var(--lv-danger)", Icon: Minus },
}

const RECIPIENT_GREEN = "#5DAC72"

// ─── Drawer ────────────────────────────────────────────────

function PointActionDrawer({
  mode,
  activeUserCount,
  onClose,
}: {
  mode: Mode
  activeUserCount: number
  onClose: () => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [recipientMode, setRecipientMode] = useState<RecipientMode>("all")
  const [query, setQuery]           = useState("")
  const [selectedUser, setSelected] = useState<UserOption | null>(null)
  const [showList, setShowList]     = useState(false)
  const [searchResults, setSearchResults] = useState<UserOption[]>([])
  const [searching, setSearching]   = useState(false)
  const [amount, setAmount]         = useState("")
  const [campaignName, setCampaignName] = useState("")
  const [note, setNote]             = useState("")
  const [campaignProgress, setCampaignProgress] = useState<CampaignProgress | null>(null)

  const cfg = MODE_CONFIG[mode]

  useEffect(() => {
    if (!campaignProgress || campaignProgress.status === "completed" || campaignProgress.status === "failed") {
      return
    }
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/admin/points/surprise-bonus/${campaignProgress.id}`)
        if (!res.ok) return
        const data = (await res.json()) as CampaignProgress
        setCampaignProgress(data)
        if (data.status === "completed") {
          toast.success(
            `Campaign "${data.name}" completed — ${data.successCount.toLocaleString()} credited, ${data.failedCount.toLocaleString()} failed`,
          )
          router.refresh()
        }
      } catch {
        // ignore poll errors
      }
    }, 3000)
    return () => clearInterval(timer)
  }, [campaignProgress, router])

  useEffect(() => {
    if (!showList || !query.trim()) {
      const timer = setTimeout(() => {
        setSearchResults([])
        setSearching(false)
      }, 0)
      return () => clearTimeout(timer)
    }
    const timer = setTimeout(async () => {
      setSearching(true)
      const result = await searchUsersForPickerAction(query)
      if (result.users) setSearchResults(result.users as UserOption[])
      setSearching(false)
    }, 200)
    return () => clearTimeout(timer)
  }, [query, showList])

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

  const recipientReady =
    mode === "deduct"
      ? !!selectedUser
      : recipientMode === "all" || !!selectedUser

  const canSubmit =
    recipientReady &&
    (mode !== "topup" || recipientMode !== "all" || activeUserCount > 0) &&
    (mode !== "topup" || recipientMode !== "all" || campaignName.trim().length > 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!recipientReady) return
    const n = Math.floor(Number(amount))
    if (!n || n <= 0) { toast.error("Enter a valid amount"); return }
    if (mode === "topup" && recipientMode === "all" && !campaignName.trim()) {
      toast.error("Enter a campaign name")
      return
    }

    startTransition(async () => {
      try {
        if (mode === "topup" && recipientMode === "all") {
          const res = await fetch("/api/admin/points/surprise-bonus", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              campaignName: campaignName.trim(),
              pointsPerUser: n,
              note: note.trim() || undefined,
            }),
          })
          const result = (await res.json()) as
            | {
                success: true
                campaignId: string
                totalUsers: number
                pointsPerUser: number
                campaignName: string
              }
            | { error: string }
          if (!res.ok || "error" in result) {
            toast.error("error" in result ? result.error : "Failed to start surprise bonus")
            return
          }
          toast.success(
            `Surprise bonus "${result.campaignName}" queued for ${result.totalUsers.toLocaleString()} users — processing in the background`,
          )
          setCampaignProgress({
            id: result.campaignId,
            name: result.campaignName,
            pointsPerUser: result.pointsPerUser,
            totalUsers: result.totalUsers,
            processedUsers: 0,
            successCount: 0,
            failedCount: 0,
            status: "processing",
          })
          setAmount("")
          setCampaignName("")
          setNote("")
          router.refresh()
          return
        } else {
          if (!selectedUser) return
          const result = mode === "topup"
            ? await adminTopUpUserPointsAction(selectedUser.id, n, note)
            : await adminDeductUserPointsAction(selectedUser.id, n, note)

          if ("error" in result) { toast.error(result.error); return }

          const msgs: Record<Mode, string> = {
            topup:  `Topped up ${n.toLocaleString()} pts — ${selectedUser.name} now has ${result.updatedPoints.toLocaleString()} pts`,
            deduct: `Deducted ${n.toLocaleString()} pts — ${selectedUser.name} now has ${result.updatedPoints.toLocaleString()} pts`,
          }
          toast.success(msgs[mode])
        }

        setRecipientMode("all")
        setSelected(null)
        setQuery("")
        setAmount("")
        setCampaignName("")
        setNote("")
        onClose()
        router.refresh()
      } catch (err) {
        console.error("[PointActionDrawer] submit failed:", err)
        toast.error("Top-up failed unexpectedly. Check the server console.")
      }
    })
  }

  const preview = previewBalance()
  const amountLabel = `Points to ${mode === "topup" ? "add" : "deduct"}`
  const amountNum = Math.floor(Number(amount))
  const showAllUsersAmountHint =
    mode === "topup" && recipientMode === "all" && amountNum > 0 && activeUserCount > 0

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
            {/* Step 1 — recipient (top-up) or user search (deduct) */}
            {mode === "topup" ? (
              <>
                <h3
                  className="lv-drawer-section-h"
                  style={{ marginBottom: 10, color: RECIPIENT_GREEN, letterSpacing: "0.06em" }}
                >
                  1. Select recipient
                </h3>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                  <button
                    type="button"
                    onClick={() => { setRecipientMode("all"); setSelected(null); setQuery("") }}
                    style={recipientCardStyle(recipientMode === "all")}
                  >
                    <span style={recipientIconWrapStyle(recipientMode === "all")}>
                      <Users style={{ width: 18, height: 18 }} />
                    </span>
                    <span>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--lv-text)" }}>All Users</div>
                      <div style={{ fontSize: 11.5, color: "var(--lv-text-3)", marginTop: 2 }}>
                        Top-up points for all users
                      </div>
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRecipientMode("single")}
                    style={recipientCardStyle(recipientMode === "single")}
                  >
                    <span style={recipientIconWrapStyle(recipientMode === "single")}>
                      <UserPlus style={{ width: 18, height: 18 }} />
                    </span>
                    <span>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--lv-text)" }}>Select User</div>
                      <div style={{ fontSize: 11.5, color: "var(--lv-text-3)", marginTop: 2 }}>
                        Top-up points for a specific user
                      </div>
                    </span>
                  </button>
                </div>

                {recipientMode === "all" ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                    <div style={greenInfoBannerStyle}>
                      <Info style={{ width: 16, height: 16, flexShrink: 0, marginTop: 1, color: RECIPIENT_GREEN }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#166534", marginBottom: 2 }}>
                          Top-up for All Users
                        </div>
                        <div style={{ fontSize: 12.5, color: "#15803d", lineHeight: 1.45 }}>
                          The points will be queued as a Surprise Bonus campaign and credited to all active users in the background. Each user receives an in-app notification.
                        </div>
                      </div>
                    </div>

                    <div style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "14px 16px", borderRadius: 10,
                      background: "#fff", border: "1px solid var(--lv-border)",
                    }}>
                      <div>
                        <div style={{ fontSize: 12, color: "var(--lv-text-3)", marginBottom: 4 }}>Active Users</div>
                        <div style={{ fontSize: 22, fontWeight: 700, color: "var(--lv-text)", fontVariantNumeric: "tabular-nums" }}>
                          {activeUserCount.toLocaleString()} users
                        </div>
                      </div>
                      <span style={{
                        display: "flex", alignItems: "center", justifyContent: "center",
                        width: 40, height: 40, borderRadius: 10,
                        background: "#ecfdf5", color: RECIPIENT_GREEN,
                      }}>
                        <Users style={{ width: 20, height: 20 }} />
                      </span>
                    </div>

                    <div style={blueInfoBannerStyle}>
                      <Info style={{ width: 16, height: 16, flexShrink: 0, marginTop: 1, color: "#2563eb" }} />
                      <div style={{ fontSize: 12.5, color: "#1d4ed8", lineHeight: 1.45 }}>
                        Each active user will receive the same amount of points.
                      </div>
                    </div>

                    {campaignProgress && (
                      <div style={{
                        padding: "12px 14px",
                        borderRadius: 10,
                        background: "var(--lv-panel-2)",
                        border: "1px solid var(--lv-border)",
                      }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--lv-text)", marginBottom: 6 }}>
                          Campaign: {campaignProgress.name}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--lv-text-2)", lineHeight: 1.5 }}>
                          Status: <strong>{campaignProgress.status}</strong>
                          <br />
                          Processed: {campaignProgress.processedUsers.toLocaleString()} / {campaignProgress.totalUsers.toLocaleString()}
                          <br />
                          Success: {campaignProgress.successCount.toLocaleString()} · Failed: {campaignProgress.failedCount.toLocaleString()}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <UserSearchSection
                    query={query}
                    setQuery={setQuery}
                    showList={showList}
                    setShowList={setShowList}
                    searching={searching}
                    searchResults={searchResults}
                    selectedUser={selectedUser}
                    setSelected={setSelected}
                    selectUser={selectUser}
                    marginBottom={20}
                  />
                )}
              </>
            ) : (
              <>
                <h3 className="lv-drawer-section-h" style={{ marginBottom: 10 }}>1. Select user</h3>
                <UserSearchSection
                  query={query}
                  setQuery={setQuery}
                  showList={showList}
                  setShowList={setShowList}
                  searching={searching}
                  searchResults={searchResults}
                  selectedUser={selectedUser}
                  setSelected={setSelected}
                  selectUser={selectUser}
                  marginBottom={20}
                />
              </>
            )}

            {/* Amount / new balance */}
            <h3 className="lv-drawer-section-h" style={{ marginBottom: 10 }}>2. Amount &amp; note</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
              {mode === "topup" && recipientMode === "all" && (
                <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--lv-text-2)" }}>
                    Campaign name <span style={{ color: "var(--lv-danger)" }}>*</span>
                  </span>
                  <input
                    type="text"
                    required
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    placeholder="e.g. New Year Promo 2026"
                    style={inputStyle}
                  />
                </label>
              )}

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
                {preview !== null && (mode === "deduct" || recipientMode === "single") && (
                  <span style={{ fontSize: 12, color: "var(--lv-text-3)" }}>
                    New balance: <strong style={{ color: "var(--lv-text)" }}>{preview.toLocaleString()} pts</strong>
                    {selectedUser && (
                      <span style={{ marginLeft: 6, color: mode === "topup" ? "#047857" : "#b91c1c" }}>
                        ({mode === "topup" ? "+" : "−"}{amountNum.toLocaleString()})
                      </span>
                    )}
                  </span>
                )}
                {showAllUsersAmountHint && (
                  <span style={{ fontSize: 12, color: "var(--lv-text-3)" }}>
                    Total distribution:{" "}
                    <strong style={{ color: "var(--lv-text)" }}>
                      {(amountNum * activeUserCount).toLocaleString()} pts
                    </strong>
                    <span style={{ marginLeft: 6, color: "#047857" }}>
                      ({amountNum.toLocaleString()} × {activeUserCount.toLocaleString()} users)
                    </span>
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
                disabled={isPending || !canSubmit}
                style={{
                  padding: "9px 20px", borderRadius: 8, border: "none", cursor: "pointer",
                  fontWeight: 600, fontSize: 13, opacity: isPending || !canSubmit ? 0.5 : 1,
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

function UserSearchSection({
  query,
  setQuery,
  showList,
  setShowList,
  searching,
  searchResults,
  selectedUser,
  setSelected,
  selectUser,
  marginBottom,
}: {
  query: string
  setQuery: (v: string) => void
  showList: boolean
  setShowList: (v: boolean) => void
  searching: boolean
  searchResults: UserOption[]
  selectedUser: UserOption | null
  setSelected: (u: UserOption | null) => void
  selectUser: (u: UserOption) => void
  marginBottom: number
}) {
  return (
    <>
      <div style={{ position: "relative", marginBottom: selectedUser ? 12 : marginBottom }}>
        <div style={{ position: "relative" }}>
          <Search style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "var(--lv-text-3)" }} />
          <input
            type="text"
            placeholder="Search by name, email or phone…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setShowList(true); setSelected(null) }}
            onFocus={() => setShowList(true)}
            onBlur={() => setTimeout(() => setShowList(false), 150)}
            style={{ ...inputStyle, paddingLeft: 34, paddingRight: 32 }}
            autoComplete="off"
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(""); setSelected(null) }}
              aria-label="Clear search"
              style={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform: "translateY(-50%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 20,
                height: 20,
                padding: 0,
                border: "none",
                background: "transparent",
                color: "var(--lv-text-3)",
                cursor: "pointer",
              }}
            >
              <X style={{ width: 13, height: 13 }} />
            </button>
          )}
        </div>

        {showList && (searching || searchResults.length > 0) && (
          <div style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 50,
            background: "#fff", border: "1px solid var(--lv-border)", borderRadius: 10,
            boxShadow: "var(--lv-shadow-pop)", overflow: "hidden",
          }}>
            {searching ? (
              <div style={{ padding: "10px 14px", fontSize: 13, color: "var(--lv-text-3)" }}>Searching…</div>
            ) : searchResults.map((u) => (
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

      {selectedUser && (
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "12px 14px", borderRadius: 10, marginBottom,
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
    </>
  )
}

// ─── Main export ───────────────────────────────────────────

export function PointActionButtons({ monthlyBonus, monthlyBonusEligibleCount }: Props) {
  const [openMode, setOpenMode] = useState<Mode | null>(null)
  const [monthlyBonusOpen, setMonthlyBonusOpen] = useState(false)

  return (
    <>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button
          type="button"
          onClick={() => setMonthlyBonusOpen(true)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "7px 14px", borderRadius: 8,
            border: "1.5px solid #ddd6fe",
            background: "#f5f3ff", color: "#6d28d9",
            fontWeight: 600, fontSize: 13, cursor: "pointer",
            transition: "opacity .15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
        >
          <CalendarClock style={{ width: 14, height: 14 }} />
          Monthly Bonus Points
        </button>
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
          key={openMode}
          mode={openMode}
          activeUserCount={monthlyBonusEligibleCount}
          onClose={() => setOpenMode(null)}
        />
      )}

      <MonthlyBonusSettingsDialog
        open={monthlyBonusOpen}
        onOpenChange={setMonthlyBonusOpen}
        initial={monthlyBonus}
        eligibleUserCount={monthlyBonusEligibleCount}
      />
    </>
  )
}

const inputStyle: React.CSSProperties = {
  fontSize: 13, padding: "9px 12px",
  border: "1px solid var(--lv-border)", borderRadius: 8,
  outline: "none", width: "100%", background: "#fff", color: "var(--lv-text)",
}

function recipientCardStyle(selected: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: "12px 14px",
    borderRadius: 10,
    border: selected ? `2px solid ${RECIPIENT_GREEN}` : "1px solid var(--lv-border)",
    background: selected ? "#f0fdf4" : "#fff",
    cursor: "pointer",
    textAlign: "left",
    transition: "border-color .15s, background .15s",
  }
}

function recipientIconWrapStyle(selected: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 36,
    height: 36,
    borderRadius: 8,
    flexShrink: 0,
    background: selected ? "#dcfce7" : "var(--lv-panel-2)",
    color: selected ? RECIPIENT_GREEN : "var(--lv-text-3)",
  }
}

const greenInfoBannerStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  padding: "12px 14px",
  borderRadius: 10,
  background: "#f0fdf4",
  border: "1px solid #bbf7d0",
}

const blueInfoBannerStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  padding: "12px 14px",
  borderRadius: 10,
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
}
