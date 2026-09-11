"use client"

import { AdminListError } from "@/components/admin/AdminListError"

export default function PremiumDealerSubscriptionsError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <AdminListError {...props} label="dealer subscriptions" />
}
