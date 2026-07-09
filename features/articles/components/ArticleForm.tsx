"use client";

import { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { createArticleAction, updateArticleAction } from "@/features/articles/actions/articles";
import { useAutoSave } from "@/features/articles/hooks/useAutoSave";
import { estimateReadingTime } from "@/lib/reading-time";
import type { ArticleRow } from "@/features/articles/db/articles";
import DatePicker from "@/components/date-picker/date-picker";
import { ContentMetaCard } from "@/features/news/components/ContentMetaCard";
import { ShareButtons } from "@/components/share/ShareButtons";
import { env } from "@/data/env/client";

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

function getSavebarStatusClass({
  autoSaveState,
  dirty,
  isEdit,
}: {
  autoSaveState: string;
  dirty: boolean;
  isEdit: boolean;
}): string {
  if (autoSaveState === "pending" || autoSaveState === "saving") return " dirty";
  if (autoSaveState === "saved") return " saved";
  if (autoSaveState === "error") return " dirty";
  return dirty ? " dirty" : isEdit ? " saved" : "";
}

function getSavebarLabel({
  autoSaveState,
  lastAutoSaved,
  dirty,
  isEdit,
  updatedLabel,
}: {
  autoSaveState: string;
  lastAutoSaved: Date | null;
  dirty: boolean;
  isEdit: boolean;
  updatedLabel: string | null;
}): string {
  if (autoSaveState === "pending") return "Saving in a moment…";
  if (autoSaveState === "saving") return "Saving…";
  if (autoSaveState === "saved" && lastAutoSaved) {
    const time = lastAutoSaved.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
    return `Auto-saved · ${time}`;
  }
  if (autoSaveState === "error") return "Couldn't auto-save";
  if (dirty) return "Unsaved changes";
  if (isEdit) return `Saved · ${updatedLabel}`;
  return "New article";
}

type Props = {
  mode: "create" | "edit";
  article?: ArticleRow | null;
  prevHref?: string | null;
  nextHref?: string | null;
  listPosition?: number | null;
  listTotal?: number | null;
};

export function ArticleForm({ mode, article, prevHref, nextHref, listPosition, listTotal }: Props) {
  const router = useRouter();
  const isEdit = mode === "edit";
  const formRef = useRef<HTMLFormElement>(null);

  const [title, setTitle] = useState(article?.title ?? "");
  const [author, setAuthor] = useState(article?.author ?? "");
  const [content, setContent] = useState(article?.content ?? "[]");
  const [status, setStatus] = useState<Status>((article?.status as Status) ?? "draft");
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { autoSaveState, lastAutoSaved } = useAutoSave({
    id: article?.id ?? "",
    title,
    author,
    content,
    enabled: isEdit,
  });

  useEffect(() => {
    if (autoSaveState === "saved") setDirty(false);
  }, [autoSaveState]);

  const publishDateValue = article?.publishDate
    ? new Date(article.publishDate).toISOString().slice(0, 10)
    : "";
  const articleId = article?.id ? article.id.slice(0, 8).toUpperCase() : null;
  const createdLabel = fmtDate(article?.createdAt);
  const updatedLabel = fmtDate(article?.updatedAt);
  const readingTime = estimateReadingTime(content);

  const shareUrl = article?.id && env.NEXT_PUBLIC_SERVER_URL
    ? `${env.NEXT_PUBLIC_SERVER_URL}/articles/${article.id}`
    : "";
  const shareDisabledReason = !env.NEXT_PUBLIC_SERVER_URL
    ? "Sharing unavailable"
    : !isEdit || !article?.id
      ? "Save first to share"
      : status !== "published"
        ? "Publish first to share"
        : undefined;

  async function submit(overrideStatus?: Status) {
    setError(null);
    setLoading(true);
    const formData = new FormData(formRef.current!);
    if (overrideStatus) formData.set("status", overrideStatus);
    try {
      const result = isEdit ? await updateArticleAction(formData) : await createArticleAction(formData);
      if (result?.error) { setError(result.error); return; }
      setDirty(false);
      if (overrideStatus === "published" || !isEdit) {
        router.push("/admin/articles");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="af-scope">
      {/* Sticky header: breadcrumbs + save bar */}
      <div className="ud-stickybar">
      <div className="ud-topbar">
        <nav className="lv-breadcrumbs">
          <Link href="/admin">Admin</Link>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 10, height: 10, opacity: 0.5 }}>
            <path d="m6 3 5 5-5 5" />
          </svg>
          <Link href="/admin/articles">Articles</Link>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 10, height: 10, opacity: 0.5 }}>
            <path d="m6 3 5 5-5 5" />
          </svg>
          <span className="lv-here">{isEdit ? `Edit · ${articleId ?? "…"}` : "New article"}</span>
        </nav>

        {(prevHref != null || nextHref != null || listPosition != null) && (
          <div className="pd-listnav">
            {prevHref ? (
              <Link href={prevHref} className="pd-listnav-btn" aria-label="Previous article">
                <ChevronLeft size={14} />
              </Link>
            ) : (
              <span className="pd-listnav-btn" style={{ opacity: 0.25 }} aria-hidden="true">
                <ChevronLeft size={14} />
              </span>
            )}
            {listPosition != null && listTotal != null && (
              <span className="pd-listnav-count">{listPosition} / {listTotal}</span>
            )}
            {nextHref ? (
              <Link href={nextHref} className="pd-listnav-btn" aria-label="Next article">
                <ChevronRight size={14} />
              </Link>
            ) : (
              <span className="pd-listnav-btn" style={{ opacity: 0.25 }} aria-hidden="true">
                <ChevronRight size={14} />
              </span>
            )}
          </div>
        )}

        <div className="ud-topbar-spacer" />

        {isEdit && (
          <Link href="/admin/articles/new" className="btn">
            <Plus size={13} /> New article
          </Link>
        )}
      </div>

      {/* Save bar */}
      <div className="n-savebar" style={{ position: "relative" }}>
        <span className={`n-savebar-status${getSavebarStatusClass({ autoSaveState, dirty, isEdit })}`}>
          <span className="n-savebar-status-dot" />
          {getSavebarLabel({ autoSaveState, lastAutoSaved, dirty, isEdit, updatedLabel })}
        </span>
        <span className="n-savebar-stage">
          <span className={`n-savebar-stage-step${status === "draft" ? " on" : " done"}`}>Draft</span>
          <span className="n-savebar-stage-sep">→</span>
          <span className={`n-savebar-stage-step${status === "published" ? " on" : ""}`}>Published</span>
        </span>
        <span style={{ flex: 1 }} />
        {error && (
          <span style={{ fontSize: 12, color: "#B91C1C", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {error}
          </span>
        )}
        {status !== "published" && (
          <button type="button" className="btn" onClick={() => submit()} disabled={loading}>
            Save draft
          </button>
        )}
        <button
          type="button"
          className="btn btn-primary"
          disabled={loading}
          onClick={() => { setStatus("published"); submit("published"); }}
        >
          {loading ? "Saving…" : status === "published" ? "Update article" : "Publish now"}
        </button>
      </div>
      </div>{/* end ud-stickybar */}

      <form ref={formRef} onSubmit={e => { e.preventDefault(); submit(); }}>
        {isEdit && article && <input type="hidden" name="articleId" value={article.id} />}
        <input type="hidden" name="status" value={status} />

        <div className="n-editor-shell">
          {/* ─── Main article frame ─── */}
          <div className="n-editor-main">
            <div className="n-article-frame">

              {/* Card header */}
              <div className="af-card-head">
                <span className="af-card-ico">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M4 7h16M4 12h10M4 17h7" />
                  </svg>
                </span>
                <div>
                  <div className="af-card-title">Article details</div>
                  <div className="af-card-sub">Headline, byline and reading time.</div>
                </div>
              </div>

              {/* Status + article ID strip */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
                <span className={`lv-status ${status}`}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </span>
                {articleId && (
                  <span className="ud-head-id" style={{ fontSize: 11 }}>ART-{articleId}</span>
                )}
                <span style={{ flex: 1 }} />
              </div>

              {/* Large title */}
              <label className="n-label" htmlFor="article-title" style={{ display: "block", marginBottom: 6 }}>Title</label>
              <input
                id="article-title"
                className="n-title-input"
                name="title"
                value={title}
                onChange={e => { setTitle(e.target.value); setDirty(true); }}
                placeholder="Article title…"
                required
                maxLength={500}
              />

              {/* Author + reading time */}
              <div className="af-two-col">
                <div>
                  <label className="n-label" htmlFor="article-author" style={{ display: "block", marginBottom: 8 }}>Author name</label>
                  <input
                    id="article-author"
                    className="af-input"
                    name="author"
                    value={author}
                    onChange={e => { setAuthor(e.target.value); setDirty(true); }}
                    placeholder="Author name"
                    maxLength={200}
                  />
                </div>
                <div>
                  <label className="n-label" style={{ display: "block", marginBottom: 8 }}>Reading time</label>
                  <div className="af-readingtime">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
                    </svg>
                    {readingTime.minutes} min read · {readingTime.words.toLocaleString()} words
                    <span className="af-readingtime-auto">AUTO</span>
                  </div>
                </div>
              </div>

              {/* Created / edited byline */}
              <div style={{
                display: "flex", alignItems: "center", gap: 10, marginTop: 18,
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
            </div>

            <div className="n-article-frame af-content-frame">
              {/* Card header */}
              <div className="af-card-head">
                <span className="af-card-ico" data-tone="green">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                </span>
                <div>
                  <div className="af-card-title">Content</div>
                  <div className="af-card-sub">The body of your article.</div>
                </div>
              </div>

              {/* Body editor */}
              <BlockNoteEditor
                name="content"
                initialContent={article?.content}
                onContentChange={(json) => {
                  setContent(json);
                  setDirty(true);
                }}
              />

              {/* HR + footer row */}
              <hr className="n-hrule" />
              <div style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--lv-text-3)", fontSize: 11.5 }}>
                {article?.id && (
                  <span style={{ fontFamily: "var(--font-geist-mono, ui-monospace, monospace)", fontSize: 11, opacity: 0.6 }}>
                    {article.id}
                  </span>
                )}
                <span style={{ flex: 1 }} />
                <Link href="/admin/articles" className="lv-tbtn" style={{ textDecoration: "none", fontSize: 12.5 }}>
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
                    id="publishDate"
                    name="publishDate"
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
                  {loading ? "Saving…" : status === "published" ? "Update article" : "Publish now"}
                </button>
              </div>
            </div>

            {/* Share card */}
            <div className="n-side-card">
              <div className="n-side-card-head">
                <span className="n-side-card-ico" data-tone="blue">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
                    <path fillRule="evenodd" d="M13 4.5a2.5 2.5 0 1 1-4.75 1.4l-3.5 2.1a2.5 2.5 0 0 1 0 1l3.5 2.1a2.5 2.5 0 1 1-.75 1.75l-3.5-2.1a2.5 2.5 0 1 1 0-3.5l3.5-2.1A2.5 2.5 0 0 1 13 4.5Z" clipRule="evenodd" />
                  </svg>
                </span>
                <div>
                  <div className="n-side-card-title">Share</div>
                  <div className="n-side-card-sub">Post the public link.</div>
                </div>
              </div>
              <div className="n-side-card-body">
                <ShareButtons
                  url={shareUrl}
                  title={title}
                  disabled={shareDisabledReason !== undefined}
                  disabledReason={shareDisabledReason}
                />
              </div>
            </div>

            {/* Mobile display card: category, cover, featured */}
            <ContentMetaCard
              initialCategory={article?.category}
              initialCoverImage={article?.coverImage}
              initialIsFeatured={article?.isFeatured}
              onChange={() => setDirty(true)}
            />

            {/* Article info card (edit mode only) */}
            {isEdit && article && (
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
                  {article.author && (
                    <div className="n-meta-row">
                      <span>Author</span>
                      <strong>{article.author}</strong>
                    </div>
                  )}
                  {article.slug && (
                    <div className="n-meta-row">
                      <span>Slug</span>
                      <strong style={{ fontFamily: "var(--font-geist-mono, ui-monospace, monospace)", fontSize: 11 }}>
                        {article.slug}
                      </strong>
                    </div>
                  )}
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
                  {article.publishDate && (
                    <div className="n-meta-row">
                      <span>Publish date</span>
                      <strong>{fmtDate(article.publishDate)}</strong>
                    </div>
                  )}
                  <div className="n-meta-row">
                    <span>ID</span>
                    <strong style={{ fontFamily: "var(--font-geist-mono, ui-monospace, monospace)", fontSize: 11 }}>
                      {article.id.slice(0, 8)}…
                    </strong>
                  </div>
                </div>
              </div>
            )}

          </aside>
        </div>
      </form>
    </div>
  );
}
