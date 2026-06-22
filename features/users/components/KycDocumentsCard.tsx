"use client"

import { useState, useTransition } from "react"
import {
  approveUserKycAction,
  rejectUserKycAction,
} from "@/features/users/actions/kyc-actions"
import type { UserForEdit } from "@/features/users/db/users"

type Props = {
  userId: string
  user: UserForEdit
}

const DOC_LINKS = [
  { label: "NRC Front", key: "nrcFrontUrl" },
  { label: "NRC Back", key: "nrcBackUrl" },
  { label: "Selfie", key: "selfieUrl" },
  { label: "Business License", key: "businessLicenseUrl" },
] as const

export function KycDocumentsCard({ userId, user }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const hasContent = user.nrc || DOC_LINKS.some((d) => user[d.key])

  function handleApprove() {
    setError(null)
    startTransition(async () => {
      const result = await approveUserKycAction(userId)
      if (!result.ok) setError(result.error ?? "Failed to approve")
    })
  }

  function handleReject() {
    setError(null)
    startTransition(async () => {
      const result = await rejectUserKycAction(userId)
      if (!result.ok) setError(result.error ?? "Failed to reject")
    })
  }

  return (
    <div className="rounded-xl bg-white p-6 ring-1 ring-slate-200/60 space-y-4">
      <h3 className="text-sm font-semibold text-slate-900">KYC Documents</h3>

      {!hasContent ? (
        <p className="text-sm text-slate-500">No documents submitted.</p>
      ) : (
        <div className="space-y-3">
          {user.nrc && (
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-slate-600 w-28">NRC</span>
              <span className="text-slate-900">{user.nrc}</span>
            </div>
          )}

          {DOC_LINKS.map(({ label, key }) =>
            user[key] ? (
              <div key={key} className="flex items-center gap-2 text-sm">
                <span className="font-medium text-slate-600 w-28">{label}</span>
                <a
                  href={user[key]!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline hover:text-blue-800 truncate max-w-xs"
                >
                  {label}
                </a>
              </div>
            ) : null
          )}

          <div className="flex items-center gap-3 pt-2">
            <span
              data-testid="kyc-verified-status"
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                user.verified
                  ? "bg-green-100 text-green-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {user.verified ? "Verified" : "Not verified"}
            </span>

            {!user.verified ? (
              <button
                onClick={handleApprove}
                disabled={isPending}
                className="text-xs px-3 py-1 rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
              >
                Approve
              </button>
            ) : (
              <button
                onClick={handleReject}
                disabled={isPending}
                className="text-xs px-3 py-1 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                Reject
              </button>
            )}
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      )}
    </div>
  )
}
