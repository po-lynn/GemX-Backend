"use client"

import type { AboutUsContent } from "@/features/app-content/schemas/app-content"
import {
  CONTENT_LANGUAGES,
  type ContentLanguage,
} from "@/features/content/services/google-translate"

type Props = {
  value: AboutUsContent
  onChange: (value: AboutUsContent) => void
  editLanguage: ContentLanguage
  onEditLanguageChange: (lang: ContentLanguage) => void
}

type LocaleSuffix = "En" | "My" | "Th" | "Ko"

function localeSuffix(lang: ContentLanguage): LocaleSuffix {
  if (lang === "English") return "En"
  if (lang === "Myanmar") return "My"
  if (lang === "Thai") return "Th"
  return "Ko"
}

type LocalizedField =
  | "storyHeading"
  | "storyBody"
  | "companyName"
  | "contactAddress"

function fieldKey(field: LocalizedField, lang: ContentLanguage): keyof AboutUsContent {
  return `${field}${localeSuffix(lang)}` as keyof AboutUsContent
}

function todayIso(): string {
  return new Date().toISOString()
}

export function AboutUsTab({
  value,
  onChange,
  editLanguage,
  onEditLanguageChange,
}: Props) {
  function setLocalized(field: LocalizedField, next: string) {
    onChange({ ...value, [fieldKey(field, editLanguage)]: next })
  }

  function setMeta<K extends "termsSlug" | "privacySlug" | "appVersion">(
    key: K,
    next: AboutUsContent[K],
  ) {
    onChange({ ...value, [key]: next })
  }

  const storyHeading = String(value[fieldKey("storyHeading", editLanguage)] ?? "")
  const storyBody = String(value[fieldKey("storyBody", editLanguage)] ?? "")
  const companyName = String(value[fieldKey("companyName", editLanguage)] ?? "")
  const contactAddress = String(value[fieldKey("contactAddress", editLanguage)] ?? "")

  return (
    <div>
      <div className="ac-card">
        <div className="ac-cardhead">
          <div>
            <b>Our story</b>
            <div className="ac-note">
              Edit section heading, story, company name, and contact address.{" "}
              <b>Save</b> while on English auto-translates into Myanmar, Thai, and Korean
              (requires <code>GOOGLE_TRANSLATE_API_KEY</code>).
            </div>
          </div>
          <label className="ac-note" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            Language
            <select
              className="ac-input"
              style={{ width: "auto", minWidth: 140 }}
              value={editLanguage}
              onChange={(e) => onEditLanguageChange(e.target.value as ContentLanguage)}
            >
              {CONTENT_LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="ac-label">Section heading</div>
        <input
          className="ac-input"
          value={storyHeading}
          onChange={(e) => setLocalized("storyHeading", e.target.value)}
        />
        <div className="ac-label">Story</div>
        <textarea
          className="ac-textarea"
          style={{ height: 120 }}
          value={storyBody}
          onChange={(e) => setLocalized("storyBody", e.target.value)}
        />
      </div>

      <div className="ac-2col">
        <div className="ac-card">
          <div className="ac-cardhead">
            <b>Terms of Service</b>
            <span className="ac-note">
              {value.termsUpdatedAt ? `Updated ${new Date(value.termsUpdatedAt).toLocaleDateString()}` : "Not set"}
            </span>
          </div>
          <div className="ac-label">Slug (gemx.app/…)</div>
          <input
            className="ac-input"
            value={value.termsSlug}
            onChange={(e) =>
              onChange({ ...value, termsSlug: e.target.value, termsUpdatedAt: todayIso() })
            }
          />
        </div>
        <div className="ac-card">
          <div className="ac-cardhead">
            <b>Privacy Policy</b>
            <span className="ac-note">
              {value.privacyUpdatedAt ? `Updated ${new Date(value.privacyUpdatedAt).toLocaleDateString()}` : "Not set"}
            </span>
          </div>
          <div className="ac-label">Slug (gemx.app/…)</div>
          <input
            className="ac-input"
            value={value.privacySlug}
            onChange={(e) =>
              onChange({ ...value, privacySlug: e.target.value, privacyUpdatedAt: todayIso() })
            }
          />
        </div>
      </div>

      <div className="ac-card">
        <div className="ac-cardhead"><b>Company &amp; version</b></div>
        <div className="ac-2col">
          <div>
            <div className="ac-label">Company name</div>
            <input
              className="ac-input"
              value={companyName}
              onChange={(e) => setLocalized("companyName", e.target.value)}
            />
          </div>
          <div>
            <div className="ac-label">App version</div>
            <input
              className="ac-input"
              value={value.appVersion}
              onChange={(e) => setMeta("appVersion", e.target.value)}
              placeholder="e.g. v2.4.1"
            />
          </div>
        </div>
        <div className="ac-label">Contact address</div>
        <textarea
          className="ac-textarea"
          style={{ height: 56 }}
          value={contactAddress}
          onChange={(e) => setLocalized("contactAddress", e.target.value)}
        />
      </div>
    </div>
  )
}
