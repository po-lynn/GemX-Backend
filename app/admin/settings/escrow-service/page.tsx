import { redirect } from "next/navigation"

export default function AdminEscrowServiceSettingsPage() {
  redirect("/admin/settings?tab=escrow")
}
