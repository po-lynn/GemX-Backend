"use client"

import { AdminListError } from "@/components/admin/AdminListError"

export default function CollectorPieceShowRequestsError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <AdminListError {...props} label="collector requests" />
}
