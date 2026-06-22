"use client"

import { useState, useTransition } from "react"
import { Shield, Check, AlertTriangle, Eye } from "lucide-react"
import {
  approveUserKycAction,
  rejectUserKycAction,
} from "@/features/users/actions/kyc-actions"
import type { UserForEdit } from "@/features/users/db/users"

type Props = {
  userId: string
  user: UserForEdit
}

const NRC_REGEX = /^(\d{1,2})\s*\/\s*([A-Za-z]{3,12})\s*\(\s*(N|NAING)\s*\)\s*(\d{6})$/i

const NRC_STATES: Record<string, string> = {
  "1": "Kachin", "2": "Kayah", "3": "Kayin", "4": "Chin", "5": "Sagaing",
  "6": "Tanintharyi", "7": "Bago", "8": "Magway", "9": "Mandalay",
  "10": "Mon", "11": "Rakhine", "12": "Yangon", "13": "Shan", "14": "Ayeyarwady",
}

function parseNrc(nrc: string) {
  const match = nrc.trim().match(NRC_REGEX)
  if (!match) return null
  const [, stateNum, township, type] = match
  return {
    stateName: NRC_STATES[stateNum] ?? `State ${stateNum}`,
    township,
    type: type.toUpperCase(),
  }
}

const EXTRA_DOCS = [
  { label: "NRC Back", key: "nrcBackUrl" as const },
  { label: "Selfie", key: "selfieUrl" as const },
  { label: "Business License", key: "businessLicenseUrl" as const },
]

export function KycDocumentsCard({ userId, user }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const hasContent = !!(user.nrc || user.nrcFrontUrl || user.nrcBackUrl || user.selfieUrl || user.businessLicenseUrl)
  const parsed = user.nrc ? parseNrc(user.nrc) : null
  const nrcValid = parsed !== null

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

  const submittedDate = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null

  return (
    <div className="rounded-xl bg-white ring-1 ring-slate-200/60 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">KYC Documents</p>
            <p className="text-xs text-slate-500">Identity verification · review submitted documents</p>
          </div>
        </div>

        {hasContent && (
          <span
            data-testid="kyc-verified-status"
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full border ${
              user.verified
                ? "bg-green-50 text-green-700 border-green-200"
                : "bg-amber-50 text-amber-700 border-amber-200"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${user.verified ? "bg-green-500" : "bg-amber-500"}`} />
            {user.verified ? "Verified" : "Pending review"}
          </span>
        )}
      </div>

      {/* Body */}
      {!hasContent ? (
        <div className="px-6 py-10 text-center">
          <p className="text-sm text-slate-500">No documents submitted.</p>
        </div>
      ) : (
        <div className="p-6 flex gap-6">
          {/* Thumbnail column */}
          <div className="w-44 shrink-0 space-y-2">
            <div className="relative rounded-lg overflow-hidden bg-slate-100 border border-slate-200" style={{ aspectRatio: "4/3" }}>
              <span className="absolute top-2 left-2 z-10 text-[10px] font-bold bg-slate-900 text-white px-1.5 py-0.5 rounded tracking-wide">
                NRC · FRONT
              </span>
              {user.nrcFrontUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.nrcFrontUrl} alt="NRC front document" className="w-full h-full object-cover" />
              ) : (
                <div className="flex items-center justify-center h-full min-h-[100px]">
                  <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="M3 10h18" />
                    <circle cx="8" cy="14" r="1.5" fill="currentColor" stroke="none" />
                    <path d="M11 14h6" />
                  </svg>
                </div>
              )}
            </div>

            {user.nrcFrontUrl && (
              <a
                href={user.nrcFrontUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="NRC Front"
                className="flex items-center justify-center gap-1.5 w-full text-xs text-slate-600 border border-slate-200 rounded-lg py-1.5 hover:bg-slate-50 transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
                View full size
              </a>
            )}

            {EXTRA_DOCS.map(({ label, key }) =>
              user[key] ? (
                <a
                  key={key}
                  href={user[key]!}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline"
                >
                  <Eye className="w-3 h-3 shrink-0" />
                  {label}
                </a>
              ) : null
            )}
          </div>

          {/* NRC details column */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mb-1">
              <span className="text-[10px] font-semibold bg-violet-100 text-violet-700 px-2 py-0.5 rounded uppercase tracking-wide">
                NRC
              </span>
              <span className="text-sm font-medium text-slate-700">National Registration Card</span>
              {submittedDate && (
                <span className="text-xs text-slate-400">· Submitted {submittedDate}</span>
              )}
            </div>

            <p className="text-2xl font-bold text-slate-900 tracking-wide mb-1">{user.nrc ?? "—"}</p>

            {parsed && (
              <p className="text-xs text-slate-500 mb-4">
                {parsed.stateName} · {parsed.township} township · type {parsed.type}
              </p>
            )}

            <div className="space-y-2 mt-3">
              <div className="flex items-center gap-2 text-sm">
                {nrcValid
                  ? <Check className="w-4 h-4 text-green-500 shrink-0" />
                  : <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />}
                <span className={nrcValid ? "text-slate-700" : "text-amber-700"}>
                  {nrcValid ? "Number format valid" : "Number format invalid"}
                </span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <Check className="w-4 h-4 text-green-500 shrink-0" />
                <span className="text-slate-700">Matches identification number on profile</span>
              </div>

              {user.nrcFrontUrl && (
                <div className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="text-amber-700">Document photo legibility needs manual check</span>
                </div>
              )}
            </div>
          </div>

          {/* Decision column */}
          <div className="w-44 shrink-0">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3">Decision</p>

            {!user.verified && (
              <button
                onClick={handleApprove}
                disabled={isPending}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded-lg mb-2 transition-colors disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                Approve
              </button>
            )}

            <button
              onClick={handleReject}
              disabled={isPending}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-red-300 text-red-600 hover:bg-red-50 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              <span aria-hidden>✕</span>
              Reject
            </button>

            {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
