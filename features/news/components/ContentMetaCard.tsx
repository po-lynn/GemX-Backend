"use client";

import { useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { CONTENT_CATEGORIES } from "@/features/news/schemas/news";

const CATEGORY_LABELS: Record<(typeof CONTENT_CATEGORIES)[number], string> = {
  general: "General",
  market: "Market",
  gemology: "Gemology",
  guides: "Guides",
  product: "Product",
};

type Props = {
  initialCategory?: string | null;
  initialCoverImage?: string | null;
  initialIsFeatured?: boolean;
  onChange?: () => void;
};

/**
 * "Mobile display" side card shared by NewsForm and ArticleForm: category chip,
 * 16:9 cover image and featured-slot toggle shown on the mobile News & Articles screens.
 * Emits `category`, `coverImage` and `isFeatured` form fields.
 */
export function ContentMetaCard({
  initialCategory,
  initialCoverImage,
  initialIsFeatured,
  onChange,
}: Props) {
  const [category, setCategory] = useState(initialCategory ?? "general");
  const [coverImage, setCoverImage] = useState(initialCoverImage ?? "");
  const [isFeatured, setIsFeatured] = useState(initialIsFeatured ?? false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: session } = authClient.useSession();
  const token = (() => {
    if (!session) return undefined;
    const maybeToken = (session as unknown as { token?: string }).token;
    if (typeof maybeToken === "string") return maybeToken;
    const maybeNestedToken = (session as unknown as {
      session?: { token?: string };
    }).session?.token;
    return typeof maybeNestedToken === "string" ? maybeNestedToken : undefined;
  })();

  async function uploadCover(file: File) {
    setUploadError(null);
    if (!token) {
      setUploadError("Unauthorized. Please sign in and try again.");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("type", "image");
      formData.append("file", file);
      const res = await fetch("/api/upload/product-media", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const jsonUnknown: unknown = await res.json().catch(() => undefined);
      const data =
        jsonUnknown && typeof jsonUnknown === "object"
          ? (jsonUnknown as { urls?: string[]; url?: string; error?: string })
          : {};
      if (!res.ok) {
        setUploadError(data?.error ?? "Image upload failed");
        return;
      }
      const url = data?.urls?.[0] ?? data?.url;
      if (!url) {
        setUploadError("Upload succeeded but no URL returned.");
        return;
      }
      setCoverImage(url);
      onChange?.();
    } catch {
      setUploadError("Image upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="n-side-card">
      <div className="n-side-card-head">
        <span className="n-side-card-ico" data-tone="blue">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
            <path fillRule="evenodd" d="M2 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4Zm10.5 5.707-1.646-1.646a.5.5 0 0 0-.708 0L6.5 11.707l-1.146-1.146a.5.5 0 0 0-.708 0L3.5 11.707V12a.5.5 0 0 0 .5.5h8a.5.5 0 0 0 .5-.5v-2.293ZM6.5 6a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" clipRule="evenodd" />
          </svg>
        </span>
        <div>
          <div className="n-side-card-title">Mobile display</div>
          <div className="n-side-card-sub">Category, cover and featured slot.</div>
        </div>
      </div>
      <div className="n-side-card-body">
        <input type="hidden" name="category" value={category} />
        <input type="hidden" name="coverImage" value={coverImage} />
        <input type="hidden" name="isFeatured" value={isFeatured ? "true" : "false"} />

        <div className="n-field">
          <label className="n-label" htmlFor="content-category">Category</label>
          <select
            id="content-category"
            className="ud-select"
            style={{ width: "100%" }}
            value={category}
            onChange={(e) => { setCategory(e.target.value); onChange?.(); }}
          >
            {CONTENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>
          <span className="ud-help">Shown as the filter chip and badge in the app.</span>
        </div>

        <div className="n-field">
          <label className="n-label">Cover image</label>
          {coverImage ? (
            <div style={{ position: "relative" }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of a freshly uploaded Supabase URL */}
              <img
                src={coverImage}
                alt="Cover preview"
                style={{
                  width: "100%",
                  aspectRatio: "16 / 9",
                  objectFit: "cover",
                  borderRadius: 8,
                  border: "1px solid var(--lv-border)",
                  display: "block",
                }}
              />
              <button
                type="button"
                className="btn"
                style={{ position: "absolute", top: 6, right: 6, padding: "3px 8px", fontSize: 11.5 }}
                onClick={() => { setCoverImage(""); onChange?.(); }}
              >
                Remove
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn"
              style={{ justifyContent: "center", width: "100%", padding: "18px 12px", borderStyle: "dashed" }}
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? "Uploading…" : "Upload cover (16:9)"}
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadCover(file);
            }}
          />
          {uploadError && (
            <span className="ud-help" style={{ color: "#B91C1C" }}>{uploadError}</span>
          )}
          {!uploadError && (
            <span className="ud-help">Hero and list thumbnail in the app.</span>
          )}
        </div>

        <div className="n-field">
          <label className="n-label" htmlFor="content-featured" style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input
              id="content-featured"
              type="checkbox"
              checked={isFeatured}
              onChange={(e) => { setIsFeatured(e.target.checked); onChange?.(); }}
            />
            Featured
          </label>
          <span className="ud-help">Featured items fill the hero card at the top of the app feed.</span>
        </div>
      </div>
    </div>
  );
}
