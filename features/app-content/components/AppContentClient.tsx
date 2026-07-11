"use client"

import { useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import {
  saveAppContentAction,
  publishAppContentAction,
} from "@/features/app-content/actions/app-content"
import type {
  AboutUsContent,
  FollowUsContent,
  HelpSupportContent,
} from "@/features/app-content/schemas/app-content"
import { AboutUsTab } from "@/features/app-content/components/AboutUsTab"
import { FollowUsTab } from "@/features/app-content/components/FollowUsTab"
import { HelpSupportTab } from "@/features/app-content/components/HelpSupportTab"

type TabId = "about" | "follow" | "help"

export type AppContentClientProps = {
  initialTab: TabId
  aboutUs: AboutUsContent
  followUs: FollowUsContent
  helpSupport: HelpSupportContent
  pendingPublish: { aboutUs: boolean; followUs: boolean; helpSupport: boolean }
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
  const [savedAboutUs, setSavedAboutUs] = useState(props.aboutUs)
  const [savedFollowUs, setSavedFollowUs] = useState(props.followUs)
  const [savedHelpSupport, setSavedHelpSupport] = useState(props.helpSupport)
  const [pendingPublish, setPendingPublish] = useState(props.pendingPublish)
  const [lastEditedAt, setLastEditedAt] = useState(props.lastEditedAt)
  const [lastEditedBy, setLastEditedBy] = useState(props.lastEditedBy)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)

  const dirty = useMemo(
    () => ({
      aboutUs: JSON.stringify(aboutUs) !== JSON.stringify(savedAboutUs),
      followUs: JSON.stringify(followUs) !== JSON.stringify(savedFollowUs),
      helpSupport: JSON.stringify(helpSupport) !== JSON.stringify(savedHelpSupport),
    }),
    [aboutUs, followUs, helpSupport, savedAboutUs, savedFollowUs, savedHelpSupport]
  )
  const isDirty = dirty.aboutUs || dirty.followUs || dirty.helpSupport
  const canPublish = pendingPublish.aboutUs || pendingPublish.followUs || pendingPublish.helpSupport

  function switchTab(next: TabId) {
    setTab(next)
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", next)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  async function handleSave() {
    if (!isDirty || saving) return
    setSaving(true)
    const result = await saveAppContentAction({
      aboutUs: dirty.aboutUs ? aboutUs : undefined,
      followUs: dirty.followUs ? followUs : undefined,
      helpSupport: dirty.helpSupport ? helpSupport : undefined,
    })
    setSaving(false)
    if ("error" in result) {
      toast.error(result.error)
      return
    }
    if (dirty.aboutUs) {
      setSavedAboutUs(aboutUs)
      setPendingPublish((p) => ({ ...p, aboutUs: true }))
    }
    if (dirty.followUs) {
      setSavedFollowUs(followUs)
      setPendingPublish((p) => ({ ...p, followUs: true }))
    }
    if (dirty.helpSupport) {
      setSavedHelpSupport(helpSupport)
      setPendingPublish((p) => ({ ...p, helpSupport: true }))
    }
    setLastEditedAt(new Date().toISOString())
    setLastEditedBy(props.currentUserName)
    toast.success("Draft saved")
  }

  async function handlePublish() {
    if (!canPublish || publishing) return
    setPublishing(true)
    const result = await publishAppContentAction()
    setPublishing(false)
    if ("error" in result) {
      toast.error(result.error)
      return
    }
    setPendingPublish({ aboutUs: false, followUs: false, helpSupport: false })
    toast.success("Published to app")
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
          <button className="ac-btn" onClick={handleSave} disabled={!isDirty || saving}>
            {saving ? "Saving…" : "Save draft"}
          </button>
          <button
            className="ac-btn ac-btn-primary"
            onClick={handlePublish}
            disabled={!canPublish || publishing}
          >
            {publishing ? "Publishing…" : "Publish to app"}
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
      </div>

      {tab === "about" && <AboutUsTab value={aboutUs} onChange={setAboutUs} />}
      {tab === "follow" && <FollowUsTab value={followUs} onChange={setFollowUs} />}
      {tab === "help" && <HelpSupportTab value={helpSupport} onChange={setHelpSupport} />}
    </div>
  )
}
