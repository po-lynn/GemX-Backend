import { connection } from "next/server"
import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { getAppContentSections } from "@/features/app-content/db/app-content"
import { AppContentClient } from "@/features/app-content/components/AppContentClient"
import "./app-content.css"

type TabId = "about" | "follow" | "help"
const TABS: TabId[] = ["about", "follow", "help"]

type Props = {
  searchParams: Promise<{ tab?: string }>
}

export default async function AppContentAdminPage({ searchParams }: Props) {
  await connection()
  const session = await requireFeatureAccess(FEATURE_KEYS.SETTINGS_APP_CONTENT)
  const params = await searchParams
  const tab: TabId = (TABS as readonly string[]).includes(params.tab ?? "")
    ? (params.tab as TabId)
    : "about"

  const sections = await getAppContentSections()

  const candidates: Array<{ at: Date | null; by: string | null }> = [
    { at: sections.aboutUs.updatedAt, by: sections.aboutUs.updatedByName },
    { at: sections.followUs.updatedAt, by: sections.followUs.updatedByName },
    { at: sections.helpSupport.updatedAt, by: sections.helpSupport.updatedByName },
  ]
  const latest = candidates
    .filter((c): c is { at: Date; by: string | null } => c.at !== null)
    .sort((a, b) => b.at.getTime() - a.at.getTime())[0]

  return (
    <AppContentClient
      initialTab={tab}
      aboutUs={sections.aboutUs.draftContent}
      followUs={sections.followUs.draftContent}
      helpSupport={sections.helpSupport.draftContent}
      pendingPublish={{
        aboutUs: sections.aboutUs.hasUnpublishedChanges,
        followUs: sections.followUs.hasUnpublishedChanges,
        helpSupport: sections.helpSupport.hasUnpublishedChanges,
      }}
      lastEditedAt={latest ? latest.at.toISOString() : null}
      lastEditedBy={latest?.by ?? null}
      currentUserName={session?.user.name ?? session?.user.email ?? "Admin"}
    />
  )
}
