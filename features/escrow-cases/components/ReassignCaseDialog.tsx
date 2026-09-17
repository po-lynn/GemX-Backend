"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { getEscrowAgentOptionsAction } from "@/features/escrow-cases/actions/escrow-cases"

const inputClass =
  "h-9 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-100"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  caseId: string
  currentAgentId: string | null
  onReassigned: () => void
}

/** Supervisor/admin-only (see EscrowCaseThreadView's canReassign prop, sourced from
 *  requireEscrowCaseAccess's scope) — a plain agent can't hand their case to someone else. */
export function ReassignCaseDialog({ open, onOpenChange, caseId, currentAgentId, onReassigned }: Props) {
  const [agents, setAgents] = useState<Array<{ userId: string; name: string; email: string }>>([])
  const [agentId, setAgentId] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) void getEscrowAgentOptionsAction().then(setAgents)
  }, [open])

  const eligibleAgents = agents.filter((a) => a.userId !== currentAgentId)
  const canSubmit = agentId !== ""

  async function handleSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/escrow-cases/${caseId}/assign`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Failed to reassign case")
      toast.success("Case reassigned")
      onOpenChange(false)
      setAgentId("")
      onReassigned()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to reassign case")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{currentAgentId ? "Reassign case" : "Assign case"}</DialogTitle>
          <DialogDescription>
            Hands the case thread to a different escrow agent. Posts a system message and keeps the full history.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <label className="mb-1 block text-xs font-bold text-slate-500">Agent</label>
          <select value={agentId} onChange={(e) => setAgentId(e.target.value)} className={inputClass}>
            <option value="">Select an agent…</option>
            {eligibleAgents.map((a) => (
              <option key={a.userId} value={a.userId}>
                {a.name} ({a.email})
              </option>
            ))}
          </select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || submitting}>
            {submitting ? "Saving…" : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
