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
  SellingGuideContent,
  TermsConditionsContent,
} from "@/features/app-content/schemas/app-content"
import type { ContentLanguage } from "@/features/content/services/google-translate"
import { AboutUsTab } from "@/features/app-content/components/AboutUsTab"
import { FollowUsTab } from "@/features/app-content/components/FollowUsTab"
import { HelpSupportTab } from "@/features/app-content/components/HelpSupportTab"
import { TermsConditionsTab } from "@/features/app-content/components/TermsConditionsTab"
import { BuyingGuideTab } from "@/features/app-content/components/BuyingGuideTab"
import { SellingGuideTab } from "@/features/app-content/components/SellingGuideTab"

type TabId = "about" | "follow" | "help" | "terms" | "buying" | "selling"

export type AppContentClientProps = {
  initialTab: TabId
  aboutUs: AboutUsContent
  followUs: FollowUsContent
  helpSupport: HelpSupportContent
  termsConditions: TermsConditionsContent
  buyingGuide: BuyingGuideContent
  sellingGuide: SellingGuideContent
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
  const [aboutUs, setAboutUs] = useState(props.aboutUs)
  const [followUs, setFollowUs] = useState(props.followUs)
  const [helpSupport, setHelpSupport] = useState(props.helpSupport)
  const [termsConditions, setTermsConditions] = useState(props.termsConditions)
  const [buyingGuide, setBuyingGuide] = useState(props.buyingGuide)
  const [sellingGuide, setSellingGuide] = useState(props.sellingGuide)
  const [savedAboutUs, setSavedAboutUs] = useState(props.aboutUs)
  const [savedFollowUs, setSavedFollowUs] = useState(props.followUs)
  const [savedHelpSupport, setSavedHelpSupport] = useState(props.helpSupport)
  const [savedTermsConditions, setSavedTermsConditions] = useState(props.termsConditions)
  const [savedBuyingGuide, setSavedBuyingGuide] = useState(props.buyingGuide)
  const [savedSellingGuide, setSavedSellingGuide] = useState(props.sellingGuide)
  const [lastEditedAt, setLastEditedAt] = useState(props.lastEditedAt)
  const [lastEditedBy, setLastEditedBy] = useState(props.lastEditedBy)
  const [saving, setSaving] = useState(false)
  const [termsEditLanguage, setTermsEditLanguage] = useState<ContentLanguage>("English")
  const [buyingEditLanguage, setBuyingEditLanguage] = useState<ContentLanguage>("English")
  const [sellingEditLanguage, setSellingEditLanguage] = useState<ContentLanguage>("English")

  const dirty = useMemo(
    () => ({
      aboutUs: JSON.stringify(aboutUs) !== JSON.stringify(savedAboutUs),
      followUs: JSON.stringify(followUs) !== JSON.stringify(savedFollowUs),
      helpSupport: JSON.stringify(helpSupport) !== JSON.stringify(savedHelpSupport),
      termsConditions:
        JSON.stringify(termsConditions) !== JSON.stringify(savedTermsConditions),
      buyingGuide: JSON.stringify(buyingGuide) !== JSON.stringify(savedBuyingGuide),
      sellingGuide: JSON.stringify(sellingGuide) !== JSON.stringify(savedSellingGuide),
    }),
    [
      aboutUs,
      followUs,
      helpSupport,
      termsConditions,
      buyingGuide,
      sellingGuide,
      savedAboutUs,
      savedFollowUs,
      savedHelpSupport,
      savedTermsConditions,
      savedBuyingGuide,
      savedSellingGuide,
    ]
  )
  const isDirty =
    dirty.aboutUs ||
    dirty.followUs ||
    dirty.helpSupport ||
    dirty.termsConditions ||
    dirty.buyingGuide ||
    dirty.sellingGuide
  const currentTabDirty =
    (tab === "about" && dirty.aboutUs) ||
    (tab === "follow" && dirty.followUs) ||
    (tab === "help" && dirty.helpSupport) ||
    (tab === "terms" && dirty.termsConditions) ||
    (tab === "buying" && dirty.buyingGuide) ||
    (tab === "selling" && dirty.sellingGuide)

  function switchTab(next: TabId) {
    setTab(next)
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", next)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  function applySavedMultilang(
    next: MultilangBlockNoteContent,
    setValue: (v: MultilangBlockNoteContent) => void,
    setSaved: (v: MultilangBlockNoteContent) => void,
    label: string,
    editLanguage: ContentLanguage,
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

    const payload =
      tab === "about"
        ? { aboutUs }
        : tab === "follow"
          ? { followUs }
          : tab === "help"
            ? { helpSupport }
            : tab === "terms"
              ? {
                  termsConditions,
                  translateFromEnglish: termsEditLanguage === "English" ? true : undefined,
                }
              : tab === "buying"
                ? {
                    buyingGuide,
                    translateFromEnglish: buyingEditLanguage === "English" ? true : undefined,
                  }
                : {
                    sellingGuide,
                    translateFromEnglish: sellingEditLanguage === "English" ? true : undefined,
                  }

    const result = await saveAppContentAction(payload)
    setSaving(false)
    if ("error" in result) {
      toast.error(result.error)
      return
    }

    if (tab === "about") {
      setSavedAboutUs(aboutUs)
      toast.success("About us saved")
    } else if (tab === "follow") {
      setSavedFollowUs(followUs)
      toast.success("Follow us saved")
    } else if (tab === "help") {
      setSavedHelpSupport(helpSupport)
      toast.success("Help & Support saved")
    } else if (tab === "terms") {
      applySavedMultilang(
        result.termsConditions ?? termsConditions,
        setTermsConditions,
        setSavedTermsConditions,
        "Terms & Conditions",
        termsEditLanguage,
        Boolean(result.termsConditions),
      )
    } else if (tab === "buying") {
      applySavedMultilang(
        result.buyingGuide ?? buyingGuide,
        setBuyingGuide,
        setSavedBuyingGuide,
        "Buying Guide",
        buyingEditLanguage,
        Boolean(result.buyingGuide),
      )
    } else {
      applySavedMultilang(
        result.sellingGuide ?? sellingGuide,
        setSellingGuide,
        setSavedSellingGuide,
        "Selling Guide",
        sellingEditLanguage,
        Boolean(result.sellingGuide),
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
        <button className={`ac-tab${tab === "terms" ? " active" : ""}`} onClick={() => switchTab("terms")}>
          Terms &amp; Conditions
        </button>
        <button className={`ac-tab${tab === "buying" ? " active" : ""}`} onClick={() => switchTab("buying")}>
          Buying Guide
        </button>
        <button className={`ac-tab${tab === "selling" ? " active" : ""}`} onClick={() => switchTab("selling")}>
          Selling Guide
        </button>
      </div>

      {tab === "about" && <AboutUsTab value={aboutUs} onChange={setAboutUs} />}
      {tab === "follow" && <FollowUsTab value={followUs} onChange={setFollowUs} />}
      {tab === "help" && <HelpSupportTab value={helpSupport} onChange={setHelpSupport} />}
      {tab === "terms" && (
        <TermsConditionsTab
          value={termsConditions}
          onChange={setTermsConditions}
          editLanguage={termsEditLanguage}
          onEditLanguageChange={setTermsEditLanguage}
        />
      )}
      {tab === "buying" && (
        <BuyingGuideTab
          value={buyingGuide}
          onChange={setBuyingGuide}
          editLanguage={buyingEditLanguage}
          onEditLanguageChange={setBuyingEditLanguage}
        />
      )}
      {tab === "selling" && (
        <SellingGuideTab
          value={sellingGuide}
          onChange={setSellingGuide}
          editLanguage={sellingEditLanguage}
          onEditLanguageChange={setSellingEditLanguage}
        />
      )}
    </div>
  )
}
