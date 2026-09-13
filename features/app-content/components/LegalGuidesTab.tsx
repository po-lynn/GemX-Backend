"use client"

import type { MultilangBlockNoteContent } from "@/features/app-content/schemas/app-content"
import type { ContentLanguage } from "@/features/content/services/google-translate"
import { MultilangBlockNoteTab } from "@/features/app-content/components/MultilangBlockNoteTab"
import {
  LEGAL_DOC_OPTIONS,
  type LegalDocId,
} from "@/features/app-content/lib/legal-docs"

export type { LegalDocId }
export { LEGAL_DOC_OPTIONS }

type Props = {
  doc: LegalDocId
  onDocChange: (doc: LegalDocId) => void
  value: MultilangBlockNoteContent
  onChange: (value: MultilangBlockNoteContent) => void
  editLanguage: ContentLanguage
  onEditLanguageChange: (lang: ContentLanguage) => void
}

function titleFor(doc: LegalDocId): string {
  return LEGAL_DOC_OPTIONS.find((o) => o.id === doc)?.label ?? "Legal & Guides"
}

function editorNameFor(doc: LegalDocId): string {
  if (doc === "terms") return "termsContentEditor"
  if (doc === "buying") return "buyingGuideContentEditor"
  if (doc === "selling") return "sellingGuideContentEditor"
  return "privacyPolicyContentEditor"
}

export function LegalGuidesTab({
  doc,
  onDocChange,
  value,
  onChange,
  editLanguage,
  onEditLanguageChange,
}: Props) {
  return (
    <div>
      <div className="ac-card" style={{ marginBottom: 14 }}>
        <div className="ac-cardhead">
          <div>
            <b>Legal &amp; Guides</b>
            <div className="ac-note">
              Choose a document, edit in BlockNote, then Save. English auto-translates to
              Myanmar, Thai, and Korean.
            </div>
          </div>
          <label className="ac-note" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            Document
            <select
              className="ac-input"
              style={{ width: "auto", minWidth: 200 }}
              value={doc}
              onChange={(e) => onDocChange(e.target.value as LegalDocId)}
            >
              {LEGAL_DOC_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <MultilangBlockNoteTab
        key={doc}
        title={titleFor(doc)}
        editorName={editorNameFor(doc)}
        value={value}
        onChange={onChange}
        editLanguage={editLanguage}
        onEditLanguageChange={onEditLanguageChange}
      />
    </div>
  )
}
