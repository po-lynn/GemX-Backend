"use client"

import { useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { saveAppContentAction } from "@/features/app-content/actions/app-content"
import type {
  AboutUsContent,
  BuyingGuideContent,
  FollowUsContent,
  HelpSupportContent,
  MultilangBlockNoteContent,
  PrivacyPolicyContent,
  SellingGuideContent,
  TermsConditionsContent,
} from "@/features/app-content/schemas/app-content"
import type { NewsLanguage } from "@/features/content/services/google-translate"
import { AboutUsTab } from "@/features/app-content/components/AboutUsTab"
import { FollowUsTab } from "@/features/app-content/components/FollowUsTab"
import { HelpSupportTab } from "@/features/app-content/components/HelpSupportTab"
import {
  LegalGuidesTab,
} from "@/features/app-content/components/LegalGuidesTab"
import { type LegalDocId } from "@/features/app-content/lib/legal-docs"

type TabId = "about" | "follow" | "help" | "legal"

export type AppContentClientProps = {
  initialTab: TabId
  initialLegalDoc: LegalDocId
  aboutUs: AboutUsContent
  followUs: FollowUsContent
  helpSupport: HelpSupportContent
  termsConditions: TermsConditionsContent
  buyingGuide: BuyingGuideContent
  sellingGuide: SellingGuideContent
  privacyPolicy: PrivacyPolicyContent
  lastEditedAt: string | null
  lastEditedBy: string | null
  currentUserName: string
}

function fmtRelative(iso: string | null): string {
  if (!iso) return "No edits yet"
  const diffSec = (Date.now() - new Date(iso).getTime()) / 1000
  if (diffSec < 60) return "just now"
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  return `${Math.floor(diffSec / 86400)}d ago`
}

export function AppContentClient(props: AppContentClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [tab, setTab] = useState<TabId>(props.initialTab)
  const [legalDoc, setLegalDoc] = useState<LegalDocId>(props.initialLegalDoc)
  const [aboutUs, setAboutUs] = useState(props.aboutUs)
  const [followUs, setFollowUs] = useState(props.followUs)
  const [helpSupport, setHelpSupport] = useState(props.helpSupport)
  const [termsConditions, setTermsConditions] = useState(props.termsConditions)
  const [buyingGuide, setBuyingGuide] = useState(props.buyingGuide)
  const [sellingGuide, setSellingGuide] = useState(props.sellingGuide)
  const [privacyPolicy, setPrivacyPolicy] = useState(props.privacyPolicy)
  const [savedAboutUs, setSavedAboutUs] = useState(props.aboutUs)
  const [savedFollowUs, setSavedFollowUs] = useState(props.followUs)
  const [savedHelpSupport, setSavedHelpSupport] = useState(props.helpSupport)
  const [savedTermsConditions, setSavedTermsConditions] = useState(props.termsConditions)
  const [savedBuyingGuide, setSavedBuyingGuide] = useState(props.buyingGuide)
  const [savedSellingGuide, setSavedSellingGuide] = useState(props.sellingGuide)
  const [savedPrivacyPolicy, setSavedPrivacyPolicy] = useState(props.privacyPolicy)
  const [lastEditedAt, setLastEditedAt] = useState(props.lastEditedAt)
  const [lastEditedBy, setLastEditedBy] = useState(props.lastEditedBy)
  const [saving, setSaving] = useState(false)
  const [legalEditLanguage, setLegalEditLanguage] = useState<NewsLanguage>("English")
  const [aboutEditLanguage, setAboutEditLanguage] = useState<NewsLanguage>("English")
  const [termsEditLanguage, setTermsEditLanguage] = useState<NewsLanguage>("English")
  const [buyingEditLanguage, setBuyingEditLanguage] = useState<NewsLanguage>("English")
  const [sellingEditLanguage, setSellingEditLanguage] = useState<NewsLanguage>("English")
  const [privacyEditLanguage, setPrivacyEditLanguage] = useState<NewsLanguage>("English")


  const dirty = useMemo(
    () => ({
      aboutUs: JSON.stringify(aboutUs) !== JSON.stringify(savedAboutUs),
      followUs: JSON.stringify(followUs) !== JSON.stringify(savedFollowUs),
      helpSupport: JSON.stringify(helpSupport) !== JSON.stringify(savedHelpSupport),
      termsConditions:
        JSON.stringify(termsConditions) !== JSON.stringify(savedTermsConditions),
      buyingGuide: JSON.stringify(buyingGuide) !== JSON.stringify(savedBuyingGuide),
      sellingGuide: JSON.stringify(sellingGuide) !== JSON.stringify(savedSellingGuide),
      privacyPolicy: JSON.stringify(privacyPolicy) !== JSON.stringify(savedPrivacyPolicy),
    }),
    [
      aboutUs,
      followUs,
      helpSupport,
      termsConditions,
      buyingGuide,
      sellingGuide,
      privacyPolicy,
      savedAboutUs,
      savedFollowUs,
      savedHelpSupport,
      savedTermsConditions,
      savedBuyingGuide,
      savedSellingGuide,
      savedPrivacyPolicy,
    ]
  )
  const isDirty =
    dirty.aboutUs ||
    dirty.followUs ||
    dirty.helpSupport ||
    dirty.termsConditions ||
    dirty.buyingGuide ||
    dirty.sellingGuide ||
    dirty.privacyPolicy

  const legalDirty =
    (legalDoc === "terms" && dirty.termsConditions) ||
    (legalDoc === "buying" && dirty.buyingGuide) ||
    (legalDoc === "selling" && dirty.sellingGuide) ||
    (legalDoc === "privacy" && dirty.privacyPolicy)

  const currentTabDirty =
    (tab === "about" && dirty.aboutUs) ||
    (tab === "follow" && dirty.followUs) ||
    (tab === "help" && dirty.helpSupport) ||
    (tab === "legal" && legalDirty)

  function syncUrl(nextTab: TabId, nextDoc: LegalDocId) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", nextTab)
    if (nextTab === "legal") params.set("doc", nextDoc)
    else params.delete("doc")
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  function switchTab(next: TabId) {
    setTab(next)
    syncUrl(next, legalDoc)
  }

  function switchLegalDoc(next: LegalDocId) {
    setLegalDoc(next)
    if (next === "terms") setTermsEditLanguage("English")
    else if (next === "buying") setBuyingEditLanguage("English")
    else if (next === "selling") setSellingEditLanguage("English")
    else setPrivacyEditLanguage("English")
    syncUrl("legal", next)
  }

  function legalValue(): MultilangBlockNoteContent {
    if (legalDoc === "terms") return termsConditions
    if (legalDoc === "buying") return buyingGuide
    if (legalDoc === "selling") return sellingGuide
    return privacyPolicy
  }

  function setLegalValue(next: MultilangBlockNoteContent) {
    if (legalDoc === "terms") setTermsConditions(next)
    else if (legalDoc === "buying") setBuyingGuide(next)
    else if (legalDoc === "selling") setSellingGuide(next)
    else setPrivacyPolicy(next)
  }

  const legalEditLanguage: NewsLanguage =
    legalDoc === "terms"
      ? termsEditLanguage
      : legalDoc === "buying"
        ? buyingEditLanguage
        : legalDoc === "selling"
          ? sellingEditLanguage
          : privacyEditLanguage

  function setLegalEditLanguage(next: NewsLanguage) {
    if (legalDoc === "terms") setTermsEditLanguage(next)
    else if (legalDoc === "buying") setBuyingEditLanguage(next)
    else if (legalDoc === "selling") setSellingEditLanguage(next)
    else setPrivacyEditLanguage(next)
  }

  function applySavedMultilang(
    next: MultilangBlockNoteContent,
    setValue: (v: MultilangBlockNoteContent) => void,
    setSaved: (v: MultilangBlockNoteContent) => void,
    label: string,
    translated: boolean,
  ) {
    setValue(next)
    setSaved(next)
    toast.success(
      translated && editLanguage === "English"
        ? `${label} saved · translated to Myanmar, Thai, Korean`
        : `${label} saved`,
    )
  }

  async function handleSave() {
    if (!currentTabDirty || saving) return
    setSaving(true)

    const editLanguageForSave =
      tab === "about" ? aboutEditLanguage : tab === "legal" ? legalEditLanguage : "English"
    const translate = editLanguageForSave === "English" ? true : undefined

    const payload =
      tab === "about"
        ? { aboutUs, translateFromEnglish: translate }
        : tab === "follow"
          ? { followUs }
          : tab === "help"
            ? { helpSupport }
            : legalDoc === "terms"
              ? { termsConditions, translateFromEnglish: translate }
              : legalDoc === "buying"
                ? { buyingGuide, translateFromEnglish: translate }
                : legalDoc === "selling"
                  ? { sellingGuide, translateFromEnglish: translate }
                  : { privacyPolicy, translateFromEnglish: translate }

    const result = await saveAppContentAction(payload)
    setSaving(false)
    if ("error" in result) {
      toast.error(result.error)
      return
    }

    if (tab === "about") {
      const next = result.aboutUs ?? aboutUs
      setAboutUs(next)
      setSavedAboutUs(next)
      toast.success(
        translate && aboutEditLanguage === "English"
          ? "About us saved · translated to Myanmar, Thai, Korean"
          : "About us saved",
      )
    } else if (tab === "follow") {
      setSavedFollowUs(followUs)
      toast.success("Follow us saved")
    } else if (tab === "help") {
      setSavedHelpSupport(helpSupport)
      toast.success("Help & Support saved")
    } else if (legalDoc === "terms") {
      applySavedMultilang(
        result.termsConditions ?? termsConditions,
        setTermsConditions,
        setSavedTermsConditions,
        "Terms & Conditions",
        termsEditLanguage,
        Boolean(result.termsConditions),
      )
    } else if (legalDoc === "buying") {
      applySavedMultilang(
        result.buyingGuide ?? buyingGuide,
        setBuyingGuide,
        setSavedBuyingGuide,
        "Buying Guide",
        buyingEditLanguage,
        Boolean(result.buyingGuide),
      )
    } else if (legalDoc === "selling") {
      applySavedMultilang(
        result.sellingGuide ?? sellingGuide,
        setSellingGuide,
        setSavedSellingGuide,
        "Selling Guide",
        sellingEditLanguage,
        Boolean(result.sellingGuide),
      )
    } else {
      applySavedMultilang(
        result.privacyPolicy ?? privacyPolicy,
        setPrivacyPolicy,
        setSavedPrivacyPolicy,
        "Privacy Policy",
        privacyEditLanguage,
        Boolean(result.privacyPolicy),
      )
    }

    setLastEditedAt(new Date().toISOString())
    setLastEditedBy(props.currentUserName)
  }

  return (
    <div className="ac-wrap">
      <div className="ac-topbar">
        <div className="ac-crumb">
          App <span>/</span> <b>About &amp; Support</b>
          {isDirty && (
            <span className="ac-unsaved-pill">
              <span className="ac-unsaved-dot" />
              Unsaved changes
            </span>
          )}
        </div>
        <div className="ac-topbar-actions">
          <span className="ac-note">
            {lastEditedAt
              ? `Edited ${fmtRelative(lastEditedAt)}${lastEditedBy ? ` · ${lastEditedBy}` : ""}`
              : "No edits yet"}
          </span>
          <button
            className="ac-btn ac-btn-primary"
            onClick={handleSave}
            disabled={!currentTabDirty || saving}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div className="ac-tabs">
        <button className={`ac-tab${tab === "about" ? " active" : ""}`} onClick={() => switchTab("about")}>
          About us
        </button>
        <button className={`ac-tab${tab === "follow" ? " active" : ""}`} onClick={() => switchTab("follow")}>
          Follow us
        </button>
        <button className={`ac-tab${tab === "help" ? " active" : ""}`} onClick={() => switchTab("help")}>
          Help &amp; Support
        </button>
        <button className={`ac-tab${tab === "legal" ? " active" : ""}`} onClick={() => switchTab("legal")}>
          Legal &amp; Guides
        </button>
      </div>

      {tab === "about" && (
        <AboutUsTab
          value={aboutUs}
          onChange={setAboutUs}
          editLanguage={aboutEditLanguage}
          onEditLanguageChange={setAboutEditLanguage}
        />
      )}
      {tab === "follow" && <FollowUsTab value={followUs} onChange={setFollowUs} />}
      {tab === "help" && <HelpSupportTab value={helpSupport} onChange={setHelpSupport} />}
      {tab === "legal" && (
        <LegalGuidesTab
          doc={legalDoc}
          onDocChange={switchLegalDoc}
          value={legalValue()}
          onChange={setLegalValue}
          editLanguage={legalEditLanguage}
          onEditLanguageChange={setLegalEditLanguage}
        />
      )}
    </div>
  )
}
