"use client"

import { AdminListError } from "@/components/admin/AdminListError"

export default function TransactionsListError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <AdminListError {...props} label="transactions" />
}
