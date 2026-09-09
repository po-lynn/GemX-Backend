"use client"

import { AdminListError } from "@/components/admin/AdminListError"

export default function ProductsListError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <AdminListError {...props} label="products" />
}
