"use client";

import { useState, useRef } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createNewsAction, updateNewsAction } from "@/features/news/actions/news";
import type { NewsRow } from "@/features/news/db/news";
import DatePicker from "@/components/date-picker/date-picker";

const BlockNoteEditor = dynamic(
  () => import("@/features/news/components/BlockNoteEditor").then((m) => m.BlockNoteEditor),
  { ssr: false, loading: () => <div className="min-h-[280px] animate-pulse rounded-lg bg-slate-100" /> }
);

type Status = "draft" | "published";

const STATUSES: { id: Status; label: string }[] = [
  { id: "draft", label: "Draft" },
  { id: "published", label: "Published" },
];

function fmtDate(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

type Props = {
  mode: "create" | "edit";
  news?: NewsRow | null;
};

export function NewsForm({ mode, news }: Props) {
  const router = useRouter();
  const isEdit = mode === "edit";
  const formRef = useRef<HTMLFormElement>(null);

  const [title, setTitle] = useState(news?.title ?? "");
  const [status, setStatus] = useState<Status>((news?.status as Status) ?? "draft");
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const publishDateValue = news?.publish ? new Date(news.publish).toISOString().slice(0, 10) : "";
  const articleId = news?.id ? news.id.slice(0, 8).toUpperCase() : null;
  const createdLabel = fmtDate(news?.createdAt);
  const updatedLabel = fmtDate(news?.updatedAt);

  async function submit(overrideStatus?: Status) {
    setError(null);
    setLoading(true);
    const formData = new FormData(formRef.current!);
    if (overrideStatus) formData.set("status", overrideStatus);
    try {
      const result = isEdit ? await updateNewsAction(formData) : await createNewsAction(formData);
      if (result?.error) { setError(result.error); return; }
      setDirty(false);
      if (overrideStatus === "published" || !isEdit) {
        router.push("/admin/news");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Breadcrumbs */}
      <div className="ud-topbar">
        <nav className="lv-breadcrumbs">
          <Link href="/admin">Admin</Link>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 10, height: 10, opacity: 0.5 }}>
            <path d="m6 3 5 5-5 5" />
          </svg>
          <Link href="/admin/news">News</Link>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 10, height: 10, opacity: 0.5 }}>
            <path d="m6 3 5 5-5 5" />
          </svg>
          <span className="lv-here">{isEdit ? `Edit · ${articleId ?? "…"}` : "New article"}</span>
        </nav>
      </div>

      {/* Sticky save bar */}
      <div className="n-savebar">
        <span className={`n-savebar-status${dirty ? " dirty" : isEdit ? " saved" : ""}`}>
          <span className="n-savebar-status-dot" />
          {dirty ? "Unsaved changes" : isEdit ? `Saved · ${updatedLabel}` : "New article"}
        </span>
        <span className="n-savebar-stage">
          <span className={`n-savebar-stage-step${status === "draft" ? " on" : " done"}`}>Draft</span>
          <span className="n-savebar-stage-sep">→</span>
          <span className={`n-savebar-stage-step${status === "published" ? " on" : ""}`}>Published</span>
        </span>
        <span style={{ flex: 1 }} />
        {error && <span style={{ fontSize: 12, color: "#B91C1C", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{error}</span>}
        <button type="button" className="btn" onClick={() => submit()} disabled={loading}>
          Save draft
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={loading}
          onClick={() => { setStatus("published"); submit("published"); }}
        >
          {loading ? "Saving…" : status === "published" ? "Update post" : "Publish now"}
        </button>
      </div>

      <form ref={formRef} onSubmit={e => { e.preventDefault(); submit(); }}>
        {isEdit && news && <input type="hidden" name="newsId" value={news.id} />}
        <input type="hidden" name="status" value={status} />

        <div className="n-editor-shell">
          {/* ─── Main article frame ─── */}
          <div className="n-editor-main">
            <div className="n-article-frame">

              {/* Status + article ID strip */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
                <span className={`lv-status ${status}`}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </span>
                {articleId && (
                  <span className="ud-head-id" style={{ fontSize: 11 }}>NWS-{articleId}</span>
                )}
                <span style={{ flex: 1 }} />
              </div>

              {/* Large title */}
              <input
                className="n-title-input"
                name="title"
                value={title}
                onChange={e => { setTitle(e.target.value); setDirty(true); }}
                placeholder="Announcement title…"
                required
                maxLength={500}
              />

              {/* Created / edited byline */}
              <div style={{
                display: "flex", alignItems: "center", gap: 10, marginTop: 14,
                paddingBottom: 16, borderBottom: "1px solid var(--lv-border)",
                fontSize: 12.5, color: "var(--lv-text-3)",
              }}>
                {createdLabel
                  ? <span>Created <strong style={{ color: "var(--lv-text)", fontWeight: 600 }}>{createdLabel}</strong></span>
                  : <span style={{ fontStyle: "italic" }}>Not yet saved</span>}
                {updatedLabel && createdLabel !== updatedLabel && (
                  <>
                    <span style={{ color: "var(--lv-text-4, #cbd5e1)" }}>·</span>
                    <span>Edited <strong style={{ color: "var(--lv-text)", fontWeight: 600 }}>{updatedLabel}</strong></span>
                  </>
                )}
              </div>

              {/* Body editor */}
              <div style={{ marginTop: 18 }}>
                <BlockNoteEditor name="content" initialContent={news?.content} />
              </div>

              {/* HR + footer row */}
              <hr className="n-hrule" />
              <div style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--lv-text-3)", fontSize: 11.5 }}>
                {news?.id && (
                  <span style={{ fontFamily: "var(--font-geist-mono, ui-monospace, monospace)", fontSize: 11, opacity: 0.6 }}>
                    {news.id}
                  </span>
                )}
                <span style={{ flex: 1 }} />
                <Link href="/admin/news" className="lv-tbtn" style={{ textDecoration: "none", fontSize: 12.5 }}>
                  ← Cancel
                </Link>
              </div>
            </div>
          </div>

          {/* ─── Side panel ─── */}
          <aside className="n-editor-side">

            {/* Publishing card */}
            <div className="n-side-card">
              <div className="n-side-card-head">
                <span className="n-side-card-ico">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
                    <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
                  </svg>
                </span>
                <div>
                  <div className="n-side-card-title">Publishing</div>
                  <div className="n-side-card-sub">Lifecycle and timing.</div>
                </div>
              </div>
              <div className="n-side-card-body">
                <div className="n-status-seg">
                  {STATUSES.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      data-id={s.id}
                      className={`n-status-opt${status === s.id ? " on" : ""}`}
                      onClick={() => { setStatus(s.id); setDirty(true); }}
                    >
                      <span className="dot" />
                      {s.label}
                    </button>
                  ))}
                </div>

                <div className="n-field">
                  <label className="n-label">Publish date</label>
                  <DatePicker
                    id="publish"
                    name="publish"
                    value={publishDateValue}
                    placeholder="Immediately on save"
                    className="w-full"
                  />
                  <span className="ud-help">Asia/Yangon (UTC+06:30).</span>
                </div>

                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ justifyContent: "center", padding: "9px 12px", width: "100%" }}
                  disabled={loading}
                  onClick={() => { setStatus("published"); submit("published"); }}
                >
                  {loading ? "Saving…" : status === "published" ? "Update post" : "Publish now"}
                </button>
              </div>
            </div>

            {/* Article info card (edit mode only) */}
            {isEdit && news && (
              <div className="n-side-card">
                <div className="n-side-card-head">
                  <span className="n-side-card-ico" data-tone="blue">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
                      <path fillRule="evenodd" d="M2 4.75C2 3.784 2.784 3 3.75 3h8.5c.966 0 1.75.784 1.75 1.75v6.5A1.75 1.75 0 0 1 12.25 13h-8.5A1.75 1.75 0 0 1 2 11.25v-6.5Zm1.75-.25a.25.25 0 0 0-.25.25v6.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25v-6.5a.25.25 0 0 0-.25-.25h-8.5ZM5.5 7.75A.75.75 0 0 1 6.25 7h3.5a.75.75 0 0 1 0 1.5h-3.5A.75.75 0 0 1 5.5 7.75Zm0 2.5A.75.75 0 0 1 6.25 9.5h1.5a.75.75 0 0 1 0 1.5h-1.5a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" />
                    </svg>
                  </span>
                  <div>
                    <div className="n-side-card-title">Article info</div>
                    <div className="n-side-card-sub">Metadata for this article.</div>
                  </div>
                </div>
                <div className="n-side-card-body">
                  {createdLabel && (
                    <div className="n-meta-row">
                      <span>Created</span>
                      <strong>{createdLabel}</strong>
                    </div>
                  )}
                  {updatedLabel && (
                    <div className="n-meta-row">
                      <span>Last edited</span>
                      <strong>{updatedLabel}</strong>
                    </div>
                  )}
                  {news.publish && (
                    <div className="n-meta-row">
                      <span>Publish date</span>
                      <strong>{fmtDate(news.publish)}</strong>
                    </div>
                  )}
                  <div className="n-meta-row">
                    <span>ID</span>
                    <strong style={{ fontFamily: "var(--font-geist-mono, ui-monospace, monospace)", fontSize: 11 }}>
                      {news.id.slice(0, 8)}…
                    </strong>
                  </div>
                </div>
              </div>
            )}

          </aside>
        </div>
      </form>
    </>
  );
}
