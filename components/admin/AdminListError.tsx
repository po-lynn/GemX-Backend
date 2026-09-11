"use client"

/** Shared error boundary body for admin list routes — Next's error.tsx convention requires each
 *  route to have its own default-exported component, so route files stay as thin wrappers around this. */
export function AdminListError({
  error,
  reset,
  label,
}: {
  error: Error & { digest?: string }
  reset: () => void
  label: string
}) {
  return (
    <div className="container my-8 max-w-xl">
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 space-y-3">
        <h2 className="font-semibold text-red-800">Failed to load {label}</h2>
        <p className="text-sm text-red-700">
          This is usually temporary — the database took too long to respond. Please retry.
        </p>
        {error.digest && (
          <p className="text-xs text-red-500">Digest: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="text-sm text-red-700 underline"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
