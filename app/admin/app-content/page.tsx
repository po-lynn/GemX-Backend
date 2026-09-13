import { connection } from "next/server"
import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { getAppContentSections } from "@/features/app-content/db/app-content"
import { AppContentClient } from "@/features/app-content/components/AppContentClient"
import { isLegalDocId, type LegalDocId } from "@/features/app-content/lib/legal-docs"
import "./app-content.css"

type TabId = "about" | "follow" | "help" | "legal"
const TABS: TabId[] = ["about", "follow", "help", "legal"]

/** Map legacy ?tab=terms|buying|selling to Legal & Guides + doc. */
const LEGACY_TAB_TO_DOC: Record<string, LegalDocId> = {
  terms: "terms",
  buying: "buying",
  selling: "selling",
  privacy: "privacy",
}

type Props = {
  searchParams: Promise<{ tab?: string; doc?: string }>
}

export default async function AppContentAdminPage({ searchParams }: Props) {
  await connection()
  const session = await requireFeatureAccess(FEATURE_KEYS.SETTINGS_APP_CONTENT)
  const params = await searchParams

  let tab: TabId = "about"
  let legalDoc: LegalDocId = "terms"

  const rawTab = params.tab ?? ""
  if ((TABS as readonly string[]).includes(rawTab)) {
    tab = rawTab as TabId
  } else if (LEGACY_TAB_TO_DOC[rawTab]) {
    tab = "legal"
    legalDoc = LEGACY_TAB_TO_DOC[rawTab]
  }

  if (params.doc && isLegalDocId(params.doc)) {
    legalDoc = params.doc
    if (tab !== "legal") tab = "legal"
  }

  const sections = await getAppContentSections()

  const candidates: Array<{ at: Date | null; by: string | null }> = [
    { at: sections.aboutUs.updatedAt, by: sections.aboutUs.updatedByName },
    { at: sections.followUs.updatedAt, by: sections.followUs.updatedByName },
    { at: sections.helpSupport.updatedAt, by: sections.helpSupport.updatedByName },
    { at: sections.termsConditions.updatedAt, by: sections.termsConditions.updatedByName },
    { at: sections.buyingGuide.updatedAt, by: sections.buyingGuide.updatedByName },
    { at: sections.sellingGuide.updatedAt, by: sections.sellingGuide.updatedByName },
    { at: sections.privacyPolicy.updatedAt, by: sections.privacyPolicy.updatedByName },
  ]
  const latest = candidates
    .filter((c): c is { at: Date; by: string | null } => c.at !== null)
    .sort((a, b) => b.at.getTime() - a.at.getTime())[0]

  return (
    <AppContentClient
      initialTab={tab}
      initialLegalDoc={legalDoc}
      aboutUs={sections.aboutUs.draftContent}
      followUs={sections.followUs.draftContent}
      helpSupport={sections.helpSupport.draftContent}
      termsConditions={sections.termsConditions.draftContent}
      buyingGuide={sections.buyingGuide.draftContent}
      sellingGuide={sections.sellingGuide.draftContent}
      privacyPolicy={sections.privacyPolicy.draftContent}
      lastEditedAt={latest ? latest.at.toISOString() : null}
      lastEditedBy={latest?.by ?? null}
      currentUserName={session?.user.name ?? session?.user.email ?? "Admin"}
    />
  )
}
