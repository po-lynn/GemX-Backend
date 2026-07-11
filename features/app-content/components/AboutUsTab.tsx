"use client"

import type { AboutUsContent } from "@/features/app-content/schemas/app-content"

type Props = {
  value: AboutUsContent
  onChange: (value: AboutUsContent) => void
}

function todayIso(): string {
  return new Date().toISOString()
}

export function AboutUsTab({ value, onChange }: Props) {
  function set<K extends keyof AboutUsContent>(key: K, next: AboutUsContent[K]) {
    onChange({ ...value, [key]: next })
  }

  return (
    <div>
      <div className="ac-card">
        <div className="ac-cardhead"><b>Our story</b></div>
        <div className="ac-label">Section heading</div>
        <input
          className="ac-input"
          value={value.storyHeading}
          onChange={(e) => set("storyHeading", e.target.value)}
        />
        <div className="ac-label">Story</div>
        <textarea
          className="ac-textarea"
          style={{ height: 120 }}
          value={value.storyBody}
          onChange={(e) => set("storyBody", e.target.value)}
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
            onChange={(e) => onChange({ ...value, termsSlug: e.target.value, termsUpdatedAt: todayIso() })}
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
            onChange={(e) => onChange({ ...value, privacySlug: e.target.value, privacyUpdatedAt: todayIso() })}
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
              value={value.companyName}
              onChange={(e) => set("companyName", e.target.value)}
            />
          </div>
          <div>
            <div className="ac-label">App version</div>
            <input
              className="ac-input"
              value={value.appVersion}
              onChange={(e) => set("appVersion", e.target.value)}
              placeholder="e.g. v2.4.1"
            />
          </div>
        </div>
        <div className="ac-label">Contact address</div>
        <textarea
          className="ac-textarea"
          style={{ height: 56 }}
          value={value.contactAddress}
          onChange={(e) => set("contactAddress", e.target.value)}
        />
      </div>
    </div>
  )
}
