"use client"

import { useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { EscrowCannedResponse } from "@/features/escrow-cases/types"

const inputClass =
  "h-9 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-100"
const textareaClass = `${inputClass} h-24 resize-none`

type FormState = { title: string; bodyEn: string; bodyMy: string; sortOrder: string }
const emptyForm: FormState = { title: "", bodyEn: "", bodyMy: "", sortOrder: "0" }

type Props = { initialResponses: EscrowCannedResponse[] }

/**
 * Admin config for escrow canned responses — a self-contained list + dialog, matching
 * this feature's other dialogs (NewEscrowCaseDialog, ReassignCaseDialog) rather than
 * the heavier ListViewTable/separate-page-per-action pattern other admin CRUD screens
 * use; the entity here is small and low-traffic (a handful of reply templates).
 */
export function CannedResponsesAdminPage({ initialResponses }: Props) {
  const [responses, setResponses] = useState(initialResponses)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [submitting, setSubmitting] = useState(false)

  async function refresh() {
    const res = await fetch("/api/admin/escrow-canned-responses?activeOnly=false", { credentials: "include" })
    const data = await res.json().catch(() => ({}))
    if (res.ok) setResponses((data as { responses?: EscrowCannedResponse[] }).responses ?? [])
  }

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEdit(r: EscrowCannedResponse) {
    setEditingId(r.id)
    setForm({ title: r.title, bodyEn: r.bodyEn, bodyMy: r.bodyMy, sortOrder: String(r.sortOrder) })
    setDialogOpen(true)
  }

  async function handleSubmit() {
    if (!form.title.trim() || !form.bodyEn.trim() || !form.bodyMy.trim()) {
      toast.error("Title, English body, and Burmese body are all required")
      return
    }
    setSubmitting(true)
    try {
      const body = {
        title: form.title.trim(),
        bodyEn: form.bodyEn.trim(),
        bodyMy: form.bodyMy.trim(),
        sortOrder: Number(form.sortOrder) || 0,
      }
      const res = editingId
        ? await fetch(`/api/admin/escrow-canned-responses/${editingId}`, {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch("/api/admin/escrow-canned-responses", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Failed to save canned response")
      toast.success(editingId ? "Canned response updated" : "Canned response created")
      setDialogOpen(false)
      await refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save canned response")
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleActive(r: EscrowCannedResponse) {
    try {
      const res = await fetch(`/api/admin/escrow-canned-responses/${r.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !r.isActive }),
      })
      if (!res.ok) throw new Error("Failed to update")
      await refresh()
    } catch {
      toast.error("Failed to update canned response")
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/admin/escrow-canned-responses/${id}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!res.ok) throw new Error("Failed to delete")
      toast.success("Canned response deleted")
      await refresh()
    } catch {
      toast.error("Failed to delete canned response")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/admin/messages/escrow"
            className="mb-1 flex items-center gap-1 text-[13px] font-semibold text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft className="size-3.5" /> Back to Escrow Cases
          </Link>
          <h1 className="text-[19px] font-extrabold tracking-[-0.02em] text-[#17161c]">Canned Responses</h1>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-1.5 size-4" /> New Response
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">English</th>
              <th className="px-4 py-3">Burmese</th>
              <th className="px-4 py-3">Active</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {responses.map((r) => (
              <tr key={r.id} className={r.isActive ? "" : "opacity-50"}>
                <td className="px-4 py-3 font-semibold text-slate-800">{r.title}</td>
                <td className="max-w-[280px] truncate px-4 py-3 text-slate-600">{r.bodyEn}</td>
                <td className="max-w-[280px] truncate px-4 py-3 text-slate-600">{r.bodyMy}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleActive(r)}
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                      r.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {r.isActive ? "Active" : "Disabled"}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => openEdit(r)} aria-label="Edit" className="text-slate-500 hover:text-violet-600">
                      <Pencil className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(r.id)}
                      aria-label="Delete"
                      className="text-slate-500 hover:text-rose-600"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {responses.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No canned responses yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit canned response" : "New canned response"}</DialogTitle>
            <DialogDescription>
              English is used in the reply picker today; Burmese is stored for when a
              buyer/seller-facing surface can send these directly.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">Title</label>
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className={inputClass}
                placeholder="e.g. Handover reminder"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">Body (English)</label>
              <textarea
                value={form.bodyEn}
                onChange={(e) => setForm((f) => ({ ...f, bodyEn: e.target.value }))}
                className={textareaClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">Body (Burmese)</label>
              <textarea
                value={form.bodyMy}
                onChange={(e) => setForm((f) => ({ ...f, bodyMy: e.target.value }))}
                className={textareaClass}
              />
            </div>
            <div className="w-32">
              <label className="mb-1 block text-xs font-bold text-slate-500">Sort order</label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
                className={inputClass}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
