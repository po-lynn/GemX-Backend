"use client"

import { useRef, useState } from "react"
import type { FollowUsContent, SocialPlatform } from "@/features/app-content/schemas/app-content"
import { SortableList } from "@/features/app-content/components/SortableList"
import { PlatformIcon } from "@/features/app-content/components/PlatformIcon"
import { uploadAppContentIconAction } from "@/features/app-content/actions/app-content-icon"

type Props = {
  value: FollowUsContent
  onChange: (value: FollowUsContent) => void
}

const BUILTIN_ICONS = ["facebook", "instagram", "telegram", "tiktok", "viber"] as const

function newPlatformId(): string {
  return crypto.randomUUID()
}

export function FollowUsTab({ value, onChange }: Props) {
  const [showAdd, setShowAdd] = useState(false)
  const [draftIconKey, setDraftIconKey] = useState<string>("facebook")
  const [draftCustomIconUrl, setDraftCustomIconUrl] = useState<string | null>(null)
  const [draftLabel, setDraftLabel] = useState("")
  const [draftValue, setDraftValue] = useState("")
  const [draftUrl, setDraftUrl] = useState("")
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function updatePlatform(id: string, patch: Partial<SocialPlatform>) {
    onChange({
      platforms: value.platforms.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    })
  }

  function removePlatform(id: string) {
    onChange({ platforms: value.platforms.filter((p) => p.id !== id) })
  }

  function reorderPlatforms(reordered: SocialPlatform[]) {
    const byId = new Map(reordered.map((p) => [p.id, p.sortOrder]))
    onChange({
      platforms: value.platforms.map((p) => ({ ...p, sortOrder: byId.get(p.id) ?? p.sortOrder })),
    })
  }

  async function handleIconUpload(file: File) {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.set("file", file)
      const result = await uploadAppContentIconAction(formData)
      if ("error" in result) throw new Error(result.error)
      setDraftCustomIconUrl(result.url)
      setDraftIconKey("custom")
    } catch {
      // The button re-enables and the field stays empty; the admin can retry.
    } finally {
      setUploading(false)
    }
  }

  function resetDraft() {
    setDraftIconKey("facebook")
    setDraftCustomIconUrl(null)
    setDraftLabel("")
    setDraftValue("")
    setDraftUrl("")
    setShowAdd(false)
  }

  function addPlatform() {
    if (!draftLabel.trim() || !draftValue.trim() || !draftUrl.trim()) return
    const nextSortOrder = value.platforms.length
      ? Math.max(...value.platforms.map((p) => p.sortOrder)) + 1
      : 0
    const platform: SocialPlatform = {
      id: newPlatformId(),
      iconKey: draftIconKey as SocialPlatform["iconKey"],
      customIconUrl: draftIconKey === "custom" ? draftCustomIconUrl : null,
      label: draftLabel.trim(),
      value: draftValue.trim(),
      url: draftUrl.trim(),
      isActive: true,
      sortOrder: nextSortOrder,
    }
    onChange({ platforms: [...value.platforms, platform] })
    resetDraft()
  }

  return (
    <div>
      <div className="ac-card">
        <div className="ac-cardhead">
          <div>
            <b>Social platforms</b>
            <div className="ac-note">Drag to reorder. Hidden platforms disappear from the app.</div>
          </div>
          <button className="ac-addbtn" onClick={() => setShowAdd((s) => !s)}>
            {showAdd ? "Cancel" : "+ Add platform"}
          </button>
        </div>

        <SortableList
          items={value.platforms}
          onReorder={reorderPlatforms}
          renderRow={(platform) => (
            <>
              <PlatformIcon iconKey={platform.iconKey} customIconUrl={platform.customIconUrl} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: "700 14px 'Plus Jakarta Sans', system-ui, sans-serif" }}>
                  {platform.label}
                </div>
                <input
                  className="ac-input"
                  style={{ border: "none", padding: "2px 0 0", margin: 0, background: "none" }}
                  value={platform.value}
                  onChange={(e) => updatePlatform(platform.id, { value: e.target.value })}
                />
              </div>
              <button
                onClick={() => removePlatform(platform.id)}
                className="ac-btn"
                style={{ padding: "6px 10px" }}
                aria-label={`Remove ${platform.label}`}
              >
                Delete
              </button>
              <div
                role="switch"
                aria-checked={platform.isActive}
                tabIndex={0}
                onClick={() => updatePlatform(platform.id, { isActive: !platform.isActive })}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") {
                    e.preventDefault()
                    updatePlatform(platform.id, { isActive: !platform.isActive })
                  }
                }}
                style={{
                  width: 38,
                  height: 22,
                  borderRadius: 999,
                  background: platform.isActive ? "var(--ac-green)" : "#d7ddd8",
                  position: "relative",
                  flexShrink: 0,
                  cursor: "pointer",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 2,
                    left: platform.isActive ? 18 : 2,
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: "#fff",
                    transition: "left .18s",
                  }}
                />
              </div>
            </>
          )}
        />
      </div>

      {showAdd && (
        <div className="ac-card" style={{ borderStyle: "dashed" }}>
          <div className="ac-cardhead"><b>Add platform</b></div>
          <div className="ac-label">Icon</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            {BUILTIN_ICONS.map((key) => (
              <button
                key={key}
                onClick={() => { setDraftIconKey(key); setDraftCustomIconUrl(null) }}
                style={{
                  border: draftIconKey === key ? "2px solid var(--ac-green)" : "2px solid transparent",
                  borderRadius: 11,
                  padding: 0,
                  background: "none",
                  cursor: "pointer",
                }}
                aria-label={key}
              >
                <PlatformIcon iconKey={key} />
              </button>
            ))}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="ac-btn"
              style={{ padding: "6px 10px" }}
            >
              {uploading ? "Uploading…" : draftIconKey === "custom" ? "Change custom icon" : "Upload custom icon"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleIconUpload(file)
              }}
            />
          </div>
          <div className="ac-label">Label</div>
          <input className="ac-input" value={draftLabel} onChange={(e) => setDraftLabel(e.target.value)} placeholder="e.g. Facebook" />
          <div className="ac-label">Display value</div>
          <input className="ac-input" value={draftValue} onChange={(e) => setDraftValue(e.target.value)} placeholder="e.g. facebook.com/gemx.app" />
          <div className="ac-label">Link URL</div>
          <input className="ac-input" value={draftUrl} onChange={(e) => setDraftUrl(e.target.value)} placeholder="https://…" />
          <button className="ac-btn ac-btn-primary" onClick={addPlatform}>Add</button>
        </div>
      )}
    </div>
  )
}
