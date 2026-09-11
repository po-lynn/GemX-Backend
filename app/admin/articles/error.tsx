"use client"

import { AdminListError } from "@/components/admin/AdminListError"

export default function ArticlesListError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <AdminListError {...props} label="articles" />
}
