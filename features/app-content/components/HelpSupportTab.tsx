"use client"

import { useState } from "react"
import type { FaqItem, HelpSupportContent } from "@/features/app-content/schemas/app-content"
import { SortableList } from "@/features/app-content/components/SortableList"

type Props = {
  value: HelpSupportContent
  onChange: (value: HelpSupportContent) => void
}

function newFaqId(): string {
  return crypto.randomUUID()
}

export function HelpSupportTab({ value, onChange }: Props) {
  const [newCategory, setNewCategory] = useState("")
  const [showAddFaq, setShowAddFaq] = useState(false)
  const [draftQuestion, setDraftQuestion] = useState("")
  const [draftAnswer, setDraftAnswer] = useState("")

  function set<K extends keyof HelpSupportContent>(key: K, next: HelpSupportContent[K]) {
    onChange({ ...value, [key]: next })
  }

  function updateFaq(id: string, patch: Partial<FaqItem>) {
    onChange({ ...value, faqs: value.faqs.map((f) => (f.id === id ? { ...f, ...patch } : f)) })
  }

  function removeFaq(id: string) {
    onChange({ ...value, faqs: value.faqs.filter((f) => f.id !== id) })
  }

  function reorderFaqs(reordered: FaqItem[]) {
    const byId = new Map(reordered.map((f) => [f.id, f.sortOrder]))
    onChange({ ...value, faqs: value.faqs.map((f) => ({ ...f, sortOrder: byId.get(f.id) ?? f.sortOrder })) })
  }

  function addFaq() {
    if (!draftQuestion.trim() || !draftAnswer.trim()) return
    const nextSortOrder = value.faqs.length ? Math.max(...value.faqs.map((f) => f.sortOrder)) + 1 : 0
    const faq: FaqItem = {
      id: newFaqId(),
      question: draftQuestion.trim(),
      answer: draftAnswer.trim(),
      isActive: true,
      sortOrder: nextSortOrder,
    }
    onChange({ ...value, faqs: [...value.faqs, faq] })
    setDraftQuestion("")
    setDraftAnswer("")
    setShowAddFaq(false)
  }

  function addCategory() {
    const trimmed = newCategory.trim()
    if (!trimmed || value.reportCategories.includes(trimmed)) return
    set("reportCategories", [...value.reportCategories, trimmed])
    setNewCategory("")
  }

  function removeCategory(cat: string) {
    set("reportCategories", value.reportCategories.filter((c) => c !== cat))
  }

  return (
    <div>
      <div className="ac-card">
        <div className="ac-cardhead">
          <div>
            <b>FAQs</b>
            <div className="ac-note">Drag to reorder · toggle to show or hide.</div>
          </div>
          <button className="ac-addbtn" onClick={() => setShowAddFaq((s) => !s)}>
            {showAddFaq ? "Cancel" : "+ Add FAQ"}
          </button>
        </div>

        {showAddFaq && (
          <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid var(--ac-bd)" }}>
            <input
              className="ac-input"
              placeholder="Question"
              value={draftQuestion}
              onChange={(e) => setDraftQuestion(e.target.value)}
            />
            <textarea
              className="ac-textarea"
              style={{ height: 70 }}
              placeholder="Answer"
              value={draftAnswer}
              onChange={(e) => setDraftAnswer(e.target.value)}
            />
            <button className="ac-btn ac-btn-primary" onClick={addFaq}>Add FAQ</button>
          </div>
        )}

        <SortableList
          items={value.faqs}
          onReorder={reorderFaqs}
          renderRow={(faq) => (
            <>
              <div style={{ flex: 1, minWidth: 0 }}>
                <input
                  className="ac-input"
                  style={{ marginBottom: 6, fontWeight: 700 }}
                  value={faq.question}
                  onChange={(e) => updateFaq(faq.id, { question: e.target.value })}
                />
                <textarea
                  className="ac-textarea"
                  style={{ height: 50, marginBottom: 0 }}
                  value={faq.answer}
                  onChange={(e) => updateFaq(faq.id, { answer: e.target.value })}
                />
              </div>
              <button
                onClick={() => removeFaq(faq.id)}
                className="ac-btn"
                style={{ padding: "6px 10px" }}
                aria-label="Delete FAQ"
              >
                Delete
              </button>
              <div
                role="switch"
                aria-checked={faq.isActive}
                tabIndex={0}
                onClick={() => updateFaq(faq.id, { isActive: !faq.isActive })}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") {
                    e.preventDefault()
                    updateFaq(faq.id, { isActive: !faq.isActive })
                  }
                }}
                style={{
                  width: 38,
                  height: 22,
                  borderRadius: 999,
                  background: faq.isActive ? "var(--ac-green)" : "#d7ddd8",
                  position: "relative",
                  flexShrink: 0,
                  cursor: "pointer",
                  alignSelf: "flex-start",
                  marginTop: 8,
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 2,
                    left: faq.isActive ? 18 : 2,
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

      <div className="ac-2col">
        <div className="ac-card">
          <div className="ac-cardhead"><b>Contact channels</b></div>
          <div className="ac-label">Support email</div>
          <input className="ac-input" value={value.supportEmail} onChange={(e) => set("supportEmail", e.target.value)} />
          <div className="ac-label">Phone</div>
          <input className="ac-input" value={value.supportPhone} onChange={(e) => set("supportPhone", e.target.value)} />
          <div className="ac-label">Live chat (Telegram)</div>
          <input className="ac-input" value={value.liveChatTelegram} onChange={(e) => set("liveChatTelegram", e.target.value)} />
        </div>

        <div>
          <div className="ac-card">
            <div className="ac-cardhead"><b>Operating hours</b></div>
            <div className="ac-label">Mon – Fri</div>
            <input className="ac-input" value={value.weekdayHours} onChange={(e) => set("weekdayHours", e.target.value)} />
            <div className="ac-label">Saturday</div>
            <input className="ac-input" value={value.saturdayHours} onChange={(e) => set("saturdayHours", e.target.value)} />
            <div className="ac-label">Sunday</div>
            <input className="ac-input" value={value.sundayHours} onChange={(e) => set("sundayHours", e.target.value)} />
            <div className="ac-label">Timezone</div>
            <input className="ac-input" value={value.timezone} onChange={(e) => set("timezone", e.target.value)} />
          </div>

          <div className="ac-card">
            <div className="ac-cardhead">
              <b>Report a problem</b>
              <div
                role="switch"
                aria-checked={value.reportFormEnabled}
                tabIndex={0}
                onClick={() => set("reportFormEnabled", !value.reportFormEnabled)}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") {
                    e.preventDefault()
                    set("reportFormEnabled", !value.reportFormEnabled)
                  }
                }}
                style={{
                  width: 38,
                  height: 22,
                  borderRadius: 999,
                  background: value.reportFormEnabled ? "var(--ac-green)" : "#d7ddd8",
                  position: "relative",
                  cursor: "pointer",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 2,
                    left: value.reportFormEnabled ? 18 : 2,
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: "#fff",
                    transition: "left .18s",
                  }}
                />
              </div>
            </div>
            <div className="ac-label">Categories</div>
            <div style={{ marginBottom: 10 }}>
              {value.reportCategories.map((cat) => (
                <span key={cat} className="ac-chip">
                  {cat}
                  <button onClick={() => removeCategory(cat)} aria-label={`Remove ${cat}`}>×</button>
                </span>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="ac-input"
                style={{ marginBottom: 0 }}
                placeholder="New category"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addCategory() }}
              />
              <button className="ac-btn" onClick={addCategory}>Add</button>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
              <span style={{ font: "600 13px 'Plus Jakarta Sans', system-ui, sans-serif" }}>
                Allow screenshot attachments
              </span>
              <div
                role="switch"
                aria-checked={value.allowScreenshotAttachments}
                tabIndex={0}
                onClick={() => set("allowScreenshotAttachments", !value.allowScreenshotAttachments)}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") {
                    e.preventDefault()
                    set("allowScreenshotAttachments", !value.allowScreenshotAttachments)
                  }
                }}
                style={{
                  width: 38,
                  height: 22,
                  borderRadius: 999,
                  background: value.allowScreenshotAttachments ? "var(--ac-green)" : "#d7ddd8",
                  position: "relative",
                  cursor: "pointer",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 2,
                    left: value.allowScreenshotAttachments ? 18 : 2,
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: "#fff",
                    transition: "left .18s",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
