import { redirect } from "next/navigation"

// Chat Dashboard has been merged into the Messages triage inbox
// (app/admin/messages/page.tsx) per design_handoff_messages_triage/README.md.
// Both the admin oversight view and the internal-staff personal inbox
// (previously branched by role in this file) now point here — see
// docs/technical/messages-triage.md for the reply-composer gap this
// introduces for internal staff until that feature is designed and built.
export default function AdminChatDashboardPage() {
  redirect("/admin/messages?mode=conversations")
}
