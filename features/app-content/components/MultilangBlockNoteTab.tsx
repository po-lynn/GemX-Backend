"use client"

import dynamic from "next/dynamic"
import { useState } from "react"
import type { MultilangBlockNoteContent } from "@/features/app-content/schemas/app-content"
import {
  NEWS_LANGUAGES,
  type NewsLanguage,
} from "@/features/content/services/google-translate"

const BlockNoteEditor = dynamic(
  () =>
    import("@/features/content/components/BlockNoteEditor").then((m) => m.BlockNoteEditor),
  {
    ssr: false,
    loading: () => (
      <div className="ac-note" style={{ padding: 16 }}>
        Loading editor…
      </div>
    ),
  },
)

type Props = {
  title: string
  editorName: string
  value: MultilangBlockNoteContent
  onChange: (value: MultilangBlockNoteContent) => void
  editLanguage: NewsLanguage
  onEditLanguageChange: (lang: NewsLanguage) => void
}

function contentKey(lang: NewsLanguage): keyof MultilangBlockNoteContent {
  if (lang === "English") return "contentEn"
  if (lang === "Myanmar") return "contentMy"
  if (lang === "Thai") return "contentTh"
  return "contentKo"
}

export function MultilangBlockNoteTab({
  title,
  editorName,
  value,
  onChange,
  editLanguage,
  onEditLanguageChange,
}: Props) {
  const [langSwitchKey, setLangSwitchKey] = useState(0)
  const activeKey = contentKey(editLanguage)
  const initialContent = value[activeKey] || "[]"

  function switchLanguage(next: NewsLanguage) {
    if (next === editLanguage) return
    onEditLanguageChange(next)
    setLangSwitchKey((k) => k + 1)
  }

  function handleContentChange(json: string) {
    onChange({ ...value, [activeKey]: json })
  }

  return (
    <div>
      <div className="ac-card">
        <div className="ac-cardhead">
          <div>
            <b>{title}</b>
            <div className="ac-note">
              Edit in BlockNote. <b>Save</b> while on English auto-translates into Myanmar,
              Thai, and Korean (requires <code>GOOGLE_TRANSLATE_API_KEY</code>).
            </div>
          </div>
          <label className="ac-note" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            Language
            <select
              className="ac-input"
              style={{ width: "auto", minWidth: 140 }}
              value={editLanguage}
              onChange={(e) => switchLanguage(e.target.value as NewsLanguage)}
            >
              {NEWS_LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </label>
        </div>

        <BlockNoteEditor
          key={`${editorName}-${editLanguage}-${langSwitchKey}`}
          name={editorName}
          initialContent={initialContent}
          onContentChange={handleContentChange}
        />
      </div>
    </div>
  )
}
