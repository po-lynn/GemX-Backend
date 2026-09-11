"use client"

import { AdminListError } from "@/components/admin/AdminListError"

export default function PurchaseRequestsError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <AdminListError {...props} label="payment transactions" />
}
