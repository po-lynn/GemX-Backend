"use client"

export default function ProductEditError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="container my-8 max-w-xl">
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 space-y-3">
        <h2 className="font-semibold text-red-800">Failed to load product</h2>
        <p className="text-sm text-red-700 font-mono break-all">{error.message}</p>
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
