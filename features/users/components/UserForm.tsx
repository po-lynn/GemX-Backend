"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AdminFormError } from "@/components/admin/admin-ui";
import {
  createUserAction,
  updateUserAction,
  changeUserPasswordAction,
  deleteUserAction,
} from "@/features/users/actions/users";
import type { UserForEdit } from "@/features/users/db/users";
import DatePicker from "@/components/date-picker/date-picker";
import myanmarNrcTownships from "@/features/users/data/myanmar-nrc-townships.json";
import { COUNTRY_LOCATIONS } from "@/features/users/data/country-locations";
import { cn } from "@/lib/utils";
import {
  AlertTriangle, ArrowLeftRight, ChevronRight, Coins, Crown, Edit, Eye, EyeOff,
  FileText, FlaskConical, Gem, Globe, Info, KeyRound, MapPin, MessageSquare,
  MessagesSquare, Newspaper, Package, Receipt, Shield, ShieldHalf, Tag, Tags,
  Trash2, Upload, Users,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { FEATURE_GROUPS } from "@/features/rbac/feature-keys";
import { saveUserPermissionsAction } from "@/features/rbac/actions/permissions";

// ─── Constants ────────────────────────────────────────────────────────────────
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_IMAGE_SIZE_MB = 5;

const ROLES = [
  { value: "admin",    label: "Admin"    },
  { value: "internal", label: "Internal" },
  { value: "portal",   label: "Portal"   },
  { value: "user",     label: "User"     },
];

const GENDERS = [
  { value: "", label: "Select gender" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

const COUNTRIES = ["Myanmar", "Thailand", "South Korea"];

const MYANMAR_NRC_REGEX = /^(\d{1,2})\s*\/\s*([A-Za-z]{3,12})\s*\(\s*(N|NAING)\s*\)\s*(\d{6})$/i;
const MYANMAR_NRC_DISTRICTS_BY_STATE = myanmarNrcTownships as Record<string, { value: string; label: string }[]>;
const MYANMAR_NRC_STATES = [
  { value: "1",  label: "1 - Kachin"      },
  { value: "2",  label: "2 - Kayah"       },
  { value: "3",  label: "3 - Kayin"       },
  { value: "4",  label: "4 - Chin"        },
  { value: "5",  label: "5 - Sagaing"     },
  { value: "6",  label: "6 - Tanintharyi" },
  { value: "7",  label: "7 - Bago"        },
  { value: "8",  label: "8 - Magway"      },
  { value: "9",  label: "9 - Mandalay"    },
  { value: "10", label: "10 - Mon"        },
  { value: "11", label: "11 - Rakhine"    },
  { value: "12", label: "12 - Yangon"     },
  { value: "13", label: "13 - Shan"       },
  { value: "14", label: "14 - Ayeyarwady" },
];

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin", dealer: "Dealer", seller: "Seller", buyer: "Buyer", user: "User",
};

const FEATURE_ICONS: Record<string, React.ElementType> = {
  "users":                    Users,
  "products":                 Package,
  "origin":                   Globe,
  "laboratory":               FlaskConical,
  "collector_requests":       Eye,
  "credit.packages":          Coins,
  "credit.purchase_requests": Receipt,
  "credit.subscriptions":     Crown,
  "credit.transactions":      ArrowLeftRight,
  "messages":                 MessageSquare,
  "chat_dashboard":           MessagesSquare,
  "news":                     Newspaper,
  "articles":                 FileText,
  "settings.rating_tags":     Tags,
  "settings.escrow":          ShieldHalf,
};

// ─── Input styles (used by create form only) ──────────────────────────────────
const inputClass =
  "h-9 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 transition-colors focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60";

// ─── Types ────────────────────────────────────────────────────────────────────
type Props = {
  mode: "create" | "edit";
  user?: UserForEdit | null;
  permissions?: Record<string, boolean>;
  canAssignAdmin?: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function avatarHue(id: string): number {
  const digits = id.replace(/\D/g, "");
  return digits ? parseInt(digits.slice(-4)) % 7 : 0;
}

function userInitials(name: string): string {
  return name.trim().split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function userStatus(u: UserForEdit): "active" | "pending" | "archived" {
  if (u.archived) return "archived";
  if (!u.emailVerified) return "pending";
  return "active";
}

function userKyc(u: UserForEdit): "verified" | "submitted" | "unverified" {
  if (u.verified && u.emailVerified) return "verified";
  if (u.emailVerified) return "submitted";
  return "unverified";
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtRelative(d: Date | null | undefined): string {
  if (!d) return "—";
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return fmtDate(d);
}

function parseMyanmarNrc(nrc: string | null | undefined) {
  if (!nrc?.trim()) return null;
  const m = nrc.trim().match(MYANMAR_NRC_REGEX);
  if (!m) return null;
  return {
    state:    m[1],
    district: m[2].length === 3 ? m[2].toUpperCase() : m[2],
    type:     m[3].toUpperCase(),
    number:   m[4],
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function UserForm({ mode, user, permissions, canAssignAdmin = true }: Props) {
  if (mode === "edit" && user) return <UserEditForm user={user} initialPermissions={permissions ?? {}} canAssignAdmin={canAssignAdmin} />;
  return <UserCreateForm canAssignAdmin={canAssignAdmin} />;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EDIT FORM — premium detail layout
// ═══════════════════════════════════════════════════════════════════════════════
function UserEditForm({ user, initialPermissions, canAssignAdmin }: { user: UserForEdit; initialPermissions: Record<string, boolean>; canAssignAdmin: boolean }) {
  const router = useRouter();

  // ── State ──────────────────────────────────────────────────────────────────
  const [dirty,   setDirty]   = useState(false);
  const [tab,     setTab]     = useState<"profile" | "access" | "wallet" | "permissions" | "danger">("profile");

  // permissions (internal only)
  const [perms, setPerms] = useState<Record<string, boolean>>(initialPermissions);
  const [error,   setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // form fields
  const [name,      setName]      = useState(user.name);
  const [phone,     setPhone]     = useState(user.phone ?? "");
  const [role,      setRole]      = useState(user.role);
  const [gender,    setGender]    = useState(user.gender ?? "");
  const [dob,       setDob]       = useState(user.dateOfBirth ?? "");
  const [address,   setAddress]   = useState(user.address ?? "");
  const [country,   setCountry]   = useState(user.country ?? "");
  const [stateVal,  setStateVal]  = useState(user.state ?? "");
  const [city,      setCity]      = useState(user.city ?? "");
  const [verified,  setVerified]  = useState(user.verified);
  const [archived,  setArchived]  = useState(user.archived);
  const [points,    setPoints]    = useState(user.points);
  const [pointsDelta, setPointsDelta] = useState(100);

  // Myanmar NRC
  const parsedNrc  = parseMyanmarNrc(user.nrc);
  const [nrcText,     setNrcText]     = useState(user.nrc ?? "");
  const [nrcState,    setNrcState]    = useState(parsedNrc?.state    ?? "");
  const [nrcDistrict, setNrcDistrict] = useState(parsedNrc?.district ?? "");
  const [nrcType,     setNrcType]     = useState(parsedNrc?.type === "NAING" ? "NAING" : "N");
  const [nrcNumber,   setNrcNumber]   = useState(parsedNrc?.number   ?? "");
  const isMyanmar = country === "Myanmar";
  const availableStates = country ? Object.keys(COUNTRY_LOCATIONS[country] ?? {}) : [];
  const availableCities = country && stateVal
    ? (COUNTRY_LOCATIONS[country]?.[stateVal] ?? [])
    : [];
  const myanmarNrcValue = isMyanmar && (nrcState || nrcDistrict || nrcNumber)
    ? `${nrcState}/${nrcDistrict}(${nrcType})${nrcNumber}` : "";
  const nrcFinal = isMyanmar ? myanmarNrcValue : nrcText;

  // image
  const [imageUrl,        setImageUrl]        = useState(user.image ?? "");
  const [uploadingImage,  setUploadingImage]  = useState(false);
  const [imageUploadError,setImageUploadError]= useState<string | null>(null);

  // change password dialog
  const [pwOpen,    setPwOpen]    = useState(false);
  const [pwNew,     setPwNew]     = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [showPw,    setShowPw]    = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError,   setPwError]   = useState<string | null>(null);

  // delete dialog
  const [delOpen,    setDelOpen]    = useState(false);
  const [delLoading, setDelLoading] = useState(false);

  // ── Derived ────────────────────────────────────────────────────────────────
  const status      = userStatus(user);
  const kyc         = userKyc({ ...user, verified, archived });
  const hue         = avatarHue(user.id);
  const displayName = name || user.email || "User";
  const inits       = userInitials(displayName);
  const mark        = () => setDirty(true);

  // permissions helpers
  const allPermKeys  = FEATURE_GROUPS.flatMap(g => g.features.map(f => f.key));
  const totalPerms   = allPermKeys.length;
  const enabledCount = allPermKeys.filter(k => perms[k] ?? false).length;
  function enableAll() { setPerms(Object.fromEntries(allPermKeys.map(k => [k, true]))); mark(); }
  function clearAll()  { setPerms(Object.fromEntries(allPermKeys.map(k => [k, false]))); mark(); }
  function toggleGroup(group: typeof FEATURE_GROUPS[0], value: boolean) {
    setPerms(p => { const n = { ...p }; group.features.forEach(f => { n[f.key] = value; }); return n; });
    mark();
  }

  // ── Image upload ───────────────────────────────────────────────────────────
  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    setImageUploadError(null);
    const file = e.target.files?.[0];
    if (!file) { setImageUrl(""); return; }
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setImageUploadError(`Allowed: ${ALLOWED_IMAGE_TYPES.join(", ")}`);
      e.target.value = "";
      return;
    }
    if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
      setImageUploadError(`Max size: ${MAX_IMAGE_SIZE_MB} MB`);
      e.target.value = "";
      return;
    }
    const fd = new FormData();
    fd.set("file", file);
    setUploadingImage(true);
    try {
      const res = await fetch("/api/upload/user-image", { method: "POST", body: fd, credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setImageUploadError(data?.error ?? "Upload failed"); e.target.value = ""; return; }
      if (data?.url) { setImageUrl(data.url); mark(); }
      else setImageUploadError("Upload failed");
      e.target.value = "";
    } catch {
      setImageUploadError("Upload failed");
      e.target.value = "";
    } finally {
      setUploadingImage(false);
    }
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  async function handleSave() {
    setError(null);
    setLoading(true);
    const fd = new FormData();
    fd.set("userId",      user.id);
    fd.set("name",        name);
    fd.set("phone",       phone);
    fd.set("role",        role);
    fd.set("gender",      gender);
    fd.set("dateOfBirth", dob);
    fd.set("address",     address);
    fd.set("country",     country);
    fd.set("state",       stateVal);
    fd.set("city",        city);
    fd.set("nrc",         nrcFinal);
    fd.set("verified",    verified ? "on" : "");
    fd.set("archived",    archived ? "on" : "");
    fd.set("points",      String(points));
    if (imageUrl) fd.set("image", imageUrl);
    try {
      const result = await updateUserAction(fd);
      if (result?.error) { setError(result.error); return; }
      if (role === "internal") {
        const allKeys = FEATURE_GROUPS.flatMap((g) => g.features.map((f) => f.key));
        const completePerms = Object.fromEntries(allKeys.map((k) => [k, perms[k] ?? false]));
        const permsResult = await saveUserPermissionsAction(user.id, completePerms);
        if (!permsResult.ok) { setError(permsResult.error ?? "Failed to save permissions"); return; }
      }
      setDirty(false);
      router.push("/admin/users");
    } finally {
      setLoading(false);
    }
  }

  // ── Change password ────────────────────────────────────────────────────────
  async function handleChangePassword() {
    if (pwNew !== pwConfirm) { setPwError("Passwords do not match."); return; }
    setPwLoading(true);
    setPwError(null);
    const fd = new FormData();
    fd.set("userId", user.id);
    fd.set("newPassword", pwNew);
    try {
      const result = await changeUserPasswordAction(fd);
      if (result?.error) { setPwError(result.error); return; }
      setPwOpen(false);
    } finally {
      setPwLoading(false);
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function handleDelete() {
    setDelLoading(true);
    const fd = new FormData();
    fd.set("userId", user.id);
    try {
      const result = await deleteUserAction(fd);
      if (result?.error) { setError(result.error); setDelOpen(false); return; }
      router.push("/admin/users");
    } finally {
      setDelLoading(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Breadcrumb */}
      <div className="ud-topbar">
        <div className="lv-breadcrumbs">
          <Link href="/admin/users">Users</Link>
          <ChevronRight style={{ width: 11, height: 11, opacity: 0.45 }} />
          <span className="lv-here">{displayName}</span>
        </div>
        <div className="ud-topbar-spacer" />
      </div>

      {/* Sticky save bar */}
      <div className="ud-savebar">
        {dirty ? (
          <span className="ud-savebar-dirty">
            <span className="ud-savebar-dirty-dot" />
            Unsaved changes
          </span>
        ) : (
          <span style={{ fontSize: 12, color: "var(--lv-text-3)" }} suppressHydrationWarning>
            Saved · {fmtRelative(user.updatedAt)}
          </span>
        )}
        <span style={{ flex: 1 }} />
        {dirty && (
          <Button
            type="button" variant="ghost" size="sm"
            onClick={() => window.location.reload()}
          >
            Discard
          </Button>
        )}
        <Button type="button" size="sm" onClick={handleSave} disabled={loading}>
          {loading ? "Saving…" : "Save changes"}
        </Button>
        <Button variant="outline" size="sm" type="button" asChild>
          <Link href="/admin/users">Back</Link>
        </Button>
      </div>

      <div className="ud-grid">

        {/* ──────────── MAIN COLUMN ──────────── */}
        <div className="ud-main">

          {/* Hero card */}
          <div className="ud-headcard">
            <div className="ud-head-row">
              <div className="ud-hero-avatar" data-hue={hue}>
                {imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- preview may be a local blob URL
                  <img
                    src={imageUrl} alt=""
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }}
                  />
                ) : (
                  <span>{inits || "?"}</span>
                )}
                <span className={`ud-hero-status ${archived ? "archived" : !user.emailVerified ? "pending" : "active"}`} />
              </div>

              <div className="ud-head-text">
                <div className="ud-head-eyebrow">
                  <Users style={{ width: 11, height: 11 }} />
                  {ROLE_LABELS[role] || role}
                </div>
                <h1 className="ud-head-h">
                  {displayName}
                  <span className="ud-head-id">{user.id.slice(0, 10)}…</span>
                </h1>
                <div className="ud-head-pills">
                  <span className={`ud-head-pill ${status === "active" ? "active" : status === "pending" ? "warn" : ""}`}>
                    <span className="pill-dot" />
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </span>
                  <span className={`ud-head-pill ${kyc === "verified" ? "active" : kyc === "submitted" ? "warn" : ""}`}>
                    <Shield style={{ width: 9, height: 9 }} />
                    KYC · {kyc.charAt(0).toUpperCase() + kyc.slice(1)}
                  </span>
                  {points > 0 && (
                    <span className="ud-head-pill accent">
                      {points.toLocaleString()} pts
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="ud-head-stats">
              <div className="ud-head-stat">
                <span className="ud-head-stat-l">Points</span>
                <span className="ud-head-stat-v">{points.toLocaleString()}<small>pts</small></span>
                <span className="ud-head-stat-d">current wallet</span>
              </div>
              <div className="ud-head-stat">
                <span className="ud-head-stat-l">Joined</span>
                <span className="ud-head-stat-v" style={{ fontSize: 16, fontWeight: 600 }}>{fmtDate(user.createdAt)}</span>
                <span className="ud-head-stat-d">member since</span>
              </div>
              <div className="ud-head-stat">
                <span className="ud-head-stat-l">Last active</span>
                <span className="ud-head-stat-v" style={{ fontSize: 16, fontWeight: 600 }}>{fmtRelative(user.updatedAt)}</span>
                <span className="ud-head-stat-d">profile updated</span>
              </div>
              <div className="ud-head-stat">
                <span className="ud-head-stat-l">KYC</span>
                <span className="ud-head-stat-v" style={{ fontSize: 16, fontWeight: 600 }}>
                  {kyc.charAt(0).toUpperCase() + kyc.slice(1)}
                </span>
                <span className={`ud-head-stat-d ${kyc === "verified" ? "up" : kyc === "submitted" ? "" : "down"}`}>
                  {kyc === "verified" ? "Email + admin verified" : kyc === "submitted" ? "Admin review pending" : "Not yet verified"}
                </span>
              </div>
            </div>
          </div>

          {/* Sub-tabs */}
          <div className="ud-tabs">
            {(["profile", "access", "wallet", ...(role === "internal" ? ["permissions" as const] : []), "danger"] as const).map(t => (
              <button
                key={t} type="button"
                className={`ud-tab${tab === t ? " on" : ""}`}
                onClick={() => setTab(t)}
              >
                {t === "profile" ? "Profile"
                  : t === "access" ? "Access & security"
                  : t === "wallet" ? "Points wallet"
                  : t === "permissions" ? "Permissions"
                  : "Danger zone"}
              </button>
            ))}
          </div>

          {/* ── PROFILE TAB ── */}
          {tab === "profile" && (
            <>
              {/* Profile image */}
              <section className="ud-sec">
                <div className="ud-sec-head">
                  <div className="ud-sec-icon"><Users style={{ width: 16, height: 16 }} /></div>
                  <div>
                    <div className="ud-sec-title">Profile image</div>
                    <div className="ud-sec-sub">Square, at least 256×256. PNG, JPG, WebP or GIF, max {MAX_IMAGE_SIZE_MB} MB.</div>
                  </div>
                </div>
                <div className="ud-sec-body">
                  <div className="ud-upload">
                    <div className="ud-upload-avatar" data-hue={hue}>
                      {imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- preview may be a local blob URL
                        <img src={imageUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }} />
                      ) : (
                        inits || "?"
                      )}
                    </div>
                    <div className="ud-upload-meta">
                      <div className="ud-upload-title">
                        {imageUrl ? "Profile photo set" : "Drop an image here, or browse"}
                      </div>
                      <div className="ud-upload-sub">
                        {imageUrl
                          ? imageUrl !== (user.image ?? "")
                            ? "New image — save to apply"
                            : "Current profile photo"
                          : "Gradient avatar is auto-generated until a photo is uploaded"}
                      </div>
                    </div>
                    <div className="ud-upload-actions">
                      <label className={cn("btn", uploadingImage && "opacity-60 pointer-events-none")}>
                        <Upload style={{ width: 13, height: 13 }} />
                        {uploadingImage ? "Uploading…" : "Upload"}
                        <input type="file" accept={ALLOWED_IMAGE_TYPES.join(",")} className="sr-only" disabled={uploadingImage} onChange={handleImageChange} />
                      </label>
                      {imageUrl && (
                        <button type="button" className="btn" onClick={() => { setImageUrl(""); mark(); }}>
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                  {imageUploadError && (
                    <p style={{ fontSize: 11.5, color: "#B91C1C" }}>{imageUploadError}</p>
                  )}
                </div>
              </section>

              {/* Basic info */}
              <section className="ud-sec">
                <div className="ud-sec-head">
                  <div className="ud-sec-icon" data-tone="blue"><Edit style={{ width: 16, height: 16 }} /></div>
                  <div>
                    <div className="ud-sec-title">Basic information</div>
                    <div className="ud-sec-sub">Display name, contact, and account details</div>
                  </div>
                </div>
                <div className="ud-sec-body">
                  <div className="ud-field">
                    <label className="ud-label">
                      Full name <span className="req">*</span>
                      <span className="ud-label-hint">{name.length}/200</span>
                    </label>
                    <input
                      className="ud-input"
                      value={name}
                      maxLength={200}
                      onChange={e => { setName(e.target.value); mark(); }}
                    />
                  </div>

                  <div className="ud-row" style={{ "--cols": 2 } as React.CSSProperties}>
                    <div className="ud-field">
                      <label className="ud-label">Mobile</label>
                      <input
                        className="ud-input mono"
                        placeholder="+95 9 123 456 789"
                        value={phone}
                        maxLength={50}
                        onChange={e => { setPhone(e.target.value); mark(); }}
                      />
                    </div>
                    <div className="ud-field">
                      <label className="ud-label">Login</label>
                      <input className="ud-input mono" readOnly value={user.email} />
                      <span className="ud-help">Login credential — cannot be changed.</span>
                    </div>
                  </div>

                  <div className="ud-row" style={{ "--cols": 3 } as React.CSSProperties}>
                    <div className="ud-field">
                      <label className="ud-label">Role <span className="req">*</span></label>
                      {canAssignAdmin ? (
                        <select
                          className="ud-select"
                          value={role}
                          onChange={e => { setRole(e.target.value); mark(); }}
                        >
                          {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                      ) : (
                        <input className="ud-input" readOnly value={ROLES.find(r => r.value === role)?.label ?? role} />
                      )}
                    </div>
                    <div className="ud-field">
                      <label className="ud-label">Gender</label>
                      <select
                        className="ud-select"
                        value={gender}
                        onChange={e => { setGender(e.target.value); mark(); }}
                      >
                        {GENDERS.map(g => <option key={g.value || "empty"} value={g.value}>{g.label}</option>)}
                      </select>
                    </div>
                    <div className="ud-field">
                      <label className="ud-label">Date of birth</label>
                      <DatePicker
                        id="dateOfBirth"
                        name="dateOfBirth-unused"
                        value={dob}
                        placeholder="Pick date"
                        className="w-full"
                        onSelect={d => { setDob(d ? d.toISOString().slice(0, 10) : ""); mark(); }}
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Address */}
              <section className="ud-sec">
                <div className="ud-sec-head">
                  <div className="ud-sec-icon" data-tone="emer"><MapPin style={{ width: 16, height: 16 }} /></div>
                  <div>
                    <div className="ud-sec-title">Address &amp; location</div>
                    <div className="ud-sec-sub">Used for KYC verification and shipping</div>
                  </div>
                </div>
                <div className="ud-sec-body">
                  <div className="ud-field">
                    <label className="ud-label">Address</label>
                    <input
                      className="ud-input"
                      placeholder="Street, building"
                      value={address}
                      maxLength={500}
                      onChange={e => { setAddress(e.target.value); mark(); }}
                    />
                  </div>

                  <div className="ud-address-grid">
                    <div className="ud-field">
                      <label className="ud-label">Country</label>
                      <select
                        className="ud-select"
                        value={country}
                        onChange={e => { setCountry(e.target.value); setStateVal(""); setCity(""); mark(); }}
                      >
                        <option value="">Select country</option>
                        {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="ud-field">
                      <label className="ud-label">State / Region</label>
                      <select
                        className="ud-select"
                        value={stateVal}
                        disabled={!country || availableStates.length === 0}
                        onChange={e => { setStateVal(e.target.value); setCity(""); mark(); }}
                      >
                        <option value="">Select state / region</option>
                        {availableStates.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="ud-field">
                      <label className="ud-label">City</label>
                      <select
                        className="ud-select"
                        value={city}
                        disabled={!stateVal || availableCities.length === 0}
                        onChange={e => { setCity(e.target.value); mark(); }}
                      >
                        <option value="">Select city</option>
                        {availableCities.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="ud-field">
                    <label className="ud-label">Identification number</label>
                    {isMyanmar ? (
                      <>
                        <div className="ud-row" style={{ "--cols": 4 } as React.CSSProperties}>
                          <div className="ud-field">
                            <span style={{ fontSize: 10.5, color: "var(--lv-text-3)", fontWeight: 600 }}>State/Region</span>
                            <select className="ud-select" value={nrcState}
                              onChange={e => { setNrcState(e.target.value); setNrcDistrict(""); mark(); }}>
                              <option value="">State</option>
                              {MYANMAR_NRC_STATES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                          </div>
                          <div className="ud-field">
                            <span style={{ fontSize: 10.5, color: "var(--lv-text-3)", fontWeight: 600 }}>District</span>
                            <select className="ud-select" value={nrcDistrict} disabled={!nrcState}
                              onChange={e => { setNrcDistrict(e.target.value); mark(); }}>
                              <option value="">District</option>
                              {(MYANMAR_NRC_DISTRICTS_BY_STATE[nrcState] ?? []).map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                              {nrcDistrict && nrcState && !(MYANMAR_NRC_DISTRICTS_BY_STATE[nrcState] ?? []).some(d => d.value === nrcDistrict) && (
                                <option value={nrcDistrict}>{nrcDistrict}</option>
                              )}
                            </select>
                          </div>
                          <div className="ud-field">
                            <span style={{ fontSize: 10.5, color: "var(--lv-text-3)", fontWeight: 600 }}>Type</span>
                            <select className="ud-select" value={nrcType} onChange={e => { setNrcType(e.target.value); mark(); }}>
                              <option value="N">N</option>
                              <option value="NAING">NAING</option>
                            </select>
                          </div>
                          <div className="ud-field">
                            <span style={{ fontSize: 10.5, color: "var(--lv-text-3)", fontWeight: 600 }}>Number (6 digits)</span>
                            <input
                              className="ud-input mono"
                              type="text" inputMode="numeric" maxLength={6} placeholder="123456"
                              value={nrcNumber}
                              onChange={e => { setNrcNumber(e.target.value.replace(/\D/g, "").slice(0, 6)); mark(); }}
                            />
                          </div>
                        </div>
                        <span className="ud-help">Format: State/District(Type)Number — e.g. 12/ABC(N)123456</span>
                      </>
                    ) : (
                      <input
                        className="ud-input mono"
                        placeholder="e.g. ID number, NRC, passport"
                        value={nrcText}
                        maxLength={100}
                        onChange={e => { setNrcText(e.target.value); mark(); }}
                      />
                    )}
                    <span className="ud-help">Used for KYC review. Visible to admins only.</span>
                  </div>
                </div>
              </section>
            </>
          )}

          {/* ── ACCESS TAB ── */}
          {tab === "access" && (
            <>
              <section className="ud-sec">
                <div className="ud-sec-head">
                  <div className="ud-sec-icon" data-tone="rose"><Shield style={{ width: 16, height: 16 }} /></div>
                  <div>
                    <div className="ud-sec-title">Authentication</div>
                    <div className="ud-sec-sub">Sign-in credentials and password management</div>
                  </div>
                </div>
                <div className="ud-sec-body">
                  <div className="ud-row" style={{ "--cols": 2 } as React.CSSProperties}>
                    <div className="ud-field">
                      <label className="ud-label">Email address</label>
                      <input className="ud-input" readOnly value={user.email} />
                      <span className="ud-help warn">Email cannot be changed.</span>
                    </div>
                    <div className="ud-field">
                      <label className="ud-label">Account created</label>
                      <input className="ud-input mono" readOnly value={fmtDate(user.createdAt)} />
                    </div>
                  </div>
                  <div>
                    <button
                      type="button" className="btn"
                      onClick={() => { setPwOpen(true); setPwError(null); setPwNew(""); setPwConfirm(""); setShowPw(false); }}
                    >
                      <KeyRound style={{ width: 13, height: 13 }} /> Change password
                    </button>
                  </div>
                </div>
              </section>

              <section className="ud-sec">
                <div className="ud-sec-head">
                  <div className="ud-sec-icon" data-tone="blue"><Shield style={{ width: 16, height: 16 }} /></div>
                  <div>
                    <div className="ud-sec-title">Verification &amp; status</div>
                    <div className="ud-sec-sub">Control this user&apos;s access and trust level</div>
                  </div>
                </div>
                <div className="ud-sec-body">
                  {role === "user" && (
                    <div
                      className={`ud-toggle${verified ? " on" : ""}`}
                      onClick={() => { setVerified(v => !v); mark(); }}
                    >
                      <div className="ud-toggle-text">
                        <span className="ud-toggle-label">Verified by admin</span>
                        <span className="ud-toggle-sub">
                          {verified ? "Account is admin-verified — KYC trusted" : "Awaiting admin verification"}
                        </span>
                      </div>
                      <span className="ud-toggle-switch" />
                    </div>
                  )}
                  <div
                    className={`ud-toggle${archived ? " on danger" : ""}`}
                    onClick={() => { setArchived(v => !v); mark(); }}
                  >
                    <div className="ud-toggle-text">
                      <span className="ud-toggle-label">Archive user</span>
                      <span className="ud-toggle-sub">
                        {archived ? "User is archived — cannot sign in or transact" : "User can sign in and transact normally"}
                      </span>
                    </div>
                    <span className="ud-toggle-switch" />
                  </div>
                </div>
              </section>
            </>
          )}

          {/* ── WALLET TAB ── */}
          {tab === "wallet" && (
            <section className="ud-sec">
              <div className="ud-sec-head">
                <div className="ud-sec-icon"><Gem style={{ width: 16, height: 16 }} /></div>
                <div>
                  <div className="ud-sec-title">Points wallet</div>
                  <div className="ud-sec-sub">Manual balance adjustments — saved with the rest of the form</div>
                </div>
              </div>
              <div className="ud-sec-body">
                <div className="ud-points-adjust">
                  <div>
                    <div className="ud-points-adjust-l">Current balance</div>
                    <div className="ud-points-balance">
                      {points.toLocaleString()}<small>pts</small>
                    </div>
                  </div>
                  <div className="ud-points-actions">
                    <input
                      className="ud-input mono ud-points-input"
                      type="number" min={1}
                      value={pointsDelta}
                      onChange={e => setPointsDelta(Math.max(1, parseInt(e.target.value) || 1))}
                    />
                    <button type="button" className="btn"
                      onClick={() => { setPoints(p => Math.max(0, p - pointsDelta)); mark(); }}>
                      − Deduct
                    </button>
                    <button type="button" className="btn btn-primary"
                      onClick={() => { setPoints(p => p + pointsDelta); mark(); }}>
                      + Grant
                    </button>
                  </div>
                </div>

                <div className="ud-field">
                  <label className="ud-label">Set balance directly</label>
                  <div className="ud-input-suffix">
                    <input
                      className="ud-input mono"
                      type="number" min={0} step={1}
                      value={points}
                      onChange={e => { setPoints(Math.max(0, parseInt(e.target.value) || 0)); mark(); }}
                    />
                    <span className="suffix">pts</span>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ── PERMISSIONS TAB ── */}
          {tab === "permissions" && role === "internal" && (
            <section className="ud-sec">
              <div className="ud-sec-head" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div className="ud-sec-icon" data-tone="blue"><Shield style={{ width: 16, height: 16 }} /></div>
                  <div>
                    <div className="ud-sec-title">Feature permissions</div>
                    <div className="ud-sec-sub">Control which features this internal user can access</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--lv-text-2)", background: "#f6f7f9", border: "1px solid var(--lv-line)", borderRadius: 999, padding: "6px 13px", whiteSpace: "nowrap" }}>
                    <b style={{ color: "#7c5cff", fontWeight: 800 }}>{enabledCount}</b>
                    <span style={{ color: "var(--lv-text-3)" }}> / {totalPerms} enabled</span>
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button type="button" onClick={enableAll} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, color: "var(--lv-text-2)", padding: "4px 2px" }}>
                      Enable all
                    </button>
                    <span style={{ color: "#d4d7de" }}>·</span>
                    <button type="button" onClick={clearAll} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, color: "var(--lv-text-2)", padding: "4px 2px" }}>
                      Clear all
                    </button>
                  </div>
                </div>
              </div>
              <div className="ud-sec-body" style={{ paddingTop: 22 }}>
                <div style={{ columns: 2, columnGap: 52 }}>
                  {FEATURE_GROUPS.map((group) => {
                    const groupEnabled = group.features.filter(f => perms[f.key] ?? false).length;
                    const allGroupOn   = groupEnabled === group.features.length;
                    return (
                      <div key={group.label} style={{ breakInside: "avoid", marginBottom: 22 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "0 6px 9px", marginBottom: 4, borderBottom: "1px solid var(--lv-line)" }}>
                          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--lv-text-3)" }}>
                            {group.label}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleGroup(group, !allGroupOn)}
                            style={{ fontSize: 10.5, fontWeight: 800, color: "var(--lv-text-3)", background: "#f5f6f8", border: "1px solid transparent", borderRadius: 999, padding: "2px 8px", cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.02em" }}
                          >
                            {groupEnabled}/{group.features.length}
                          </button>
                        </div>
                        <div>
                          {group.features.map((feature) => {
                            const Icon = FEATURE_ICONS[feature.key] ?? Shield;
                            const isOn = perms[feature.key] ?? false;
                            return (
                              <label
                                key={feature.key}
                                style={{ display: "grid", gridTemplateColumns: "30px 1fr auto", alignItems: "center", gap: 13, padding: "8px 8px 8px 6px", borderRadius: 11, cursor: "pointer", userSelect: "none" }}
                              >
                                <input
                                  type="checkbox"
                                  className="sr-only"
                                  checked={isOn}
                                  onChange={(e) => { setPerms(p => ({ ...p, [feature.key]: e.target.checked })); mark(); }}
                                />
                                <span style={{ width: 30, height: 30, borderRadius: 9, background: isOn ? "#efeaff" : "#f3f4f6", color: isOn ? "#7c5cff" : "#9aa1ad", display: "grid", placeItems: "center", transition: "background .16s, color .16s", flexShrink: 0 }}>
                                  <Icon style={{ width: 16, height: 16 }} />
                                </span>
                                <span style={{ fontSize: 14, fontWeight: 600, color: isOn ? "#1d2333" : "#444b5c", transition: "color .16s" }}>
                                  {feature.label}
                                </span>
                                <span style={{ width: 42, height: 24, borderRadius: 999, background: isOn ? "linear-gradient(135deg,#7b61ff 0%,#9d5cff 100%)" : "#e2e5ea", position: "relative", display: "block", transition: "background .18s ease", flexShrink: 0 }}>
                                  <span style={{ position: "absolute", top: 3, left: 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 2px rgba(16,24,40,.28)", transition: "transform .18s ease", transform: isOn ? "translateX(18px)" : "translateX(0)" }} />
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          {/* ── DANGER ZONE TAB ── */}
          {tab === "danger" && (
            <section className="ud-sec">
              <div className="ud-sec-head">
                <div className="ud-sec-icon" data-tone="rose"><AlertTriangle style={{ width: 16, height: 16 }} /></div>
                <div>
                  <div className="ud-sec-title">Danger zone</div>
                  <div className="ud-sec-sub">Irreversible actions — confirm before applying</div>
                </div>
              </div>
              <div className="ud-sec-body">
                <div className={`ud-danger-row${archived ? " archived" : ""}`}>
                  <div className="ud-danger-meta">
                    <div className="ud-danger-title">Archive user</div>
                    <div className="ud-danger-sub">User keeps data but cannot sign in or transact. Reversible via Access tab.</div>
                  </div>
                  <div
                    className={`ud-toggle danger${archived ? " on" : ""}`}
                    style={{ border: 0, padding: 0, background: "transparent" }}
                    onClick={() => { setArchived(v => !v); mark(); }}
                  >
                    <span className="ud-toggle-switch" />
                  </div>
                </div>
                <div className="ud-danger-row fatal">
                  <div className="ud-danger-meta">
                    <div className="ud-danger-title">Delete permanently</div>
                    <div className="ud-danger-sub">Removes all data, listings, and points. Cannot be undone.</div>
                  </div>
                  <button
                    type="button" className="btn"
                    style={{ color: "#B91C1C", borderColor: "rgba(185,28,28,0.3)" }}
                    onClick={() => setDelOpen(true)}
                  >
                    <Trash2 style={{ width: 13, height: 13 }} /> Delete user
                  </button>
                </div>
              </div>
            </section>
          )}
        </div>

        {/* ──────────── SIDEBAR ──────────── */}
        <div className="ud-side">

          {/* Snapshot */}
          <div className="ud-sidecard">
            <div className="ud-sidecard-head">
              <div className="ud-sidecard-icon"><Info style={{ width: 13, height: 13 }} /></div>
              <div>
                <div className="ud-sidecard-title">Snapshot</div>
                <div className="ud-sidecard-sub">At-a-glance account state</div>
              </div>
            </div>
            <div className="ud-sidecard-body">
              <div className="ud-kv">
                <span className="ud-kv-l">User ID</span>
                <span className="ud-kv-v mono">{user.id.slice(0, 14)}…</span>
              </div>
              <div className="ud-kv">
                <span className="ud-kv-l">Role</span>
                <span className="ud-kv-v">
                  <span className={`u-role ${role}`}>
                    <span className="u-role-dot" /> {ROLE_LABELS[role] || role}
                  </span>
                </span>
              </div>
              <div className="ud-kv">
                <span className="ud-kv-l">Status</span>
                <span className="ud-kv-v">
                  <span className={`u-avatar-status ${archived ? "archived" : !user.emailVerified ? "pending" : "active"}`}
                    style={{ position: "static", width: 8, height: 8, borderRadius: "50%", display: "inline-block", marginRight: 5, border: "none" }} />
                  {archived ? "Archived" : !user.emailVerified ? "Pending" : "Active"}
                </span>
              </div>
              <div className="ud-kv">
                <span className="ud-kv-l">KYC</span>
                <span className="ud-kv-v">
                  <span className={`u-kyc ${kyc}`}>
                    <span className="u-kyc-dot" />
                    {kyc.charAt(0).toUpperCase() + kyc.slice(1)}
                  </span>
                </span>
              </div>
              <div className="ud-kv">
                <span className="ud-kv-l">Joined</span>
                <span className="ud-kv-v">{fmtDate(user.createdAt)}</span>
              </div>
              <div className="ud-kv">
                <span className="ud-kv-l">Last active</span>
                <span className="ud-kv-v">{fmtRelative(user.updatedAt)}</span>
              </div>
              <div className="ud-kv">
                <span className="ud-kv-l">Points</span>
                <span className="ud-kv-v">
                  <span className={`u-points${points === 0 ? " zero" : ""}`}>
                    {points.toLocaleString()}
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Segments */}
          <div className="ud-sidecard">
            <div className="ud-sidecard-head">
              <div className="ud-sidecard-icon" style={{ background: "#FEF3C7", color: "#B45309" }}>
                <Tag style={{ width: 13, height: 13 }} />
              </div>
              <div>
                <div className="ud-sidecard-title">Segments</div>
                <div className="ud-sidecard-sub">Auto-assigned tags</div>
              </div>
            </div>
            <div className="ud-sidecard-body" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(() => {
                const tags: { l: string; c: string }[] = [];
                if (role === "admin")         tags.push({ l: "Internal",    c: "" });
                if (kyc === "verified")       tags.push({ l: "KYC verified",c: "active" });
                if (country === "Myanmar")    tags.push({ l: "Myanmar",     c: "accent" });
                if (points > 1000)            tags.push({ l: "High points", c: "accent" });
                if (!user.emailVerified)      tags.push({ l: "Pending",     c: "warn" });
                if (archived)                 tags.push({ l: "Archived",    c: "danger" });
                if (!tags.length)             tags.push({ l: "No segments", c: "" });
                return tags.map((t, i) => (
                  <span key={i} className={`ud-head-pill${t.c ? ` ${t.c}` : ""}`}>{t.l}</span>
                ));
              })()}
            </div>
          </div>
        </div>
      </div>

      {error && <AdminFormError error={error} />}

      {/* Change password dialog */}
      <Dialog open={pwOpen} onOpenChange={open => { setPwOpen(open); if (!open) { setPwError(null); setPwLoading(false); } }}>
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>Change password</DialogTitle>
            <DialogDescription>Set a new password for {displayName}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="cpw-new" className="text-sm font-medium">New password *</label>
              <div className="relative">
                <input
                  id="cpw-new"
                  type={showPw ? "text" : "password"}
                  value={pwNew}
                  onChange={e => setPwNew(e.target.value)}
                  placeholder="Enter new password"
                  className={inputClass + " pr-10"}
                  autoComplete="new-password"
                />
                <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-9 w-9"
                  onClick={() => setShowPw(s => !s)} aria-label={showPw ? "Hide" : "Show"}>
                  {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="cpw-confirm" className="text-sm font-medium">Confirm password *</label>
              <input
                id="cpw-confirm"
                type="password"
                value={pwConfirm}
                onChange={e => setPwConfirm(e.target.value)}
                placeholder="Re-enter new password"
                className={inputClass}
                autoComplete="new-password"
              />
            </div>
            {pwError && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200/60">{pwError}</p>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setPwOpen(false)}>Cancel</Button>
            <Button type="button" onClick={handleChangePassword}
              disabled={pwLoading || !pwNew.trim() || !pwConfirm.trim()}>
              {pwLoading ? "Saving…" : "Change password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={delOpen} onOpenChange={setDelOpen}>
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>Delete user permanently?</DialogTitle>
            <DialogDescription>
              This removes all data for <strong>{displayName}</strong>, including listings and points. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setDelOpen(false)}>Cancel</Button>
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={delLoading}>
              {delLoading ? "Deleting…" : "Delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CREATE FORM — premium detail layout
// ═══════════════════════════════════════════════════════════════════════════════
function UserCreateForm({ canAssignAdmin }: { canAssignAdmin: boolean }) {
  const router = useRouter();

  // ── State ──────────────────────────────────────────────────────────────────
  const [error,   setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // form fields
  const [name,     setName]     = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [role,     setRole]     = useState("user");
  const [phone,    setPhone]    = useState("");
  const [gender,   setGender]   = useState("");
  const [dob,      setDob]      = useState("");
  const [address,  setAddress]  = useState("");
  const [country,  setCountry]  = useState("Myanmar");
  const [stateVal, setStateVal] = useState("");
  const [city,     setCity]     = useState("");
  const [archived, setArchived] = useState(false);

  // Myanmar NRC
  const [nrcText,     setNrcText]     = useState("");
  const [nrcState,    setNrcState]    = useState("");
  const [nrcDistrict, setNrcDistrict] = useState("");
  const [nrcType,     setNrcType]     = useState("N");
  const [nrcNumber,   setNrcNumber]   = useState("");
  const isMyanmar = country === "Myanmar";
  const availableStates = country ? Object.keys(COUNTRY_LOCATIONS[country] ?? {}) : [];
  const availableCities = country && stateVal
    ? (COUNTRY_LOCATIONS[country]?.[stateVal] ?? [])
    : [];
  const myanmarNrcValue = isMyanmar && (nrcState || nrcDistrict || nrcNumber)
    ? `${nrcState}/${nrcDistrict}(${nrcType})${nrcNumber}` : "";
  const nrcFinal = isMyanmar ? myanmarNrcValue : nrcText;

  // image
  const [imageUrl,         setImageUrl]         = useState("");
  const [uploadingImage,   setUploadingImage]   = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);

  // ── Derived ────────────────────────────────────────────────────────────────
  const displayName = name.trim() || "New User";
  const inits       = name.trim() ? userInitials(name) : "";

  // ── Image upload ───────────────────────────────────────────────────────────
  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    setImageUploadError(null);
    const file = e.target.files?.[0];
    if (!file) { setImageUrl(""); return; }
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setImageUploadError(`Allowed: ${ALLOWED_IMAGE_TYPES.join(", ")}`);
      e.target.value = "";
      return;
    }
    if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
      setImageUploadError(`Max size: ${MAX_IMAGE_SIZE_MB} MB`);
      e.target.value = "";
      return;
    }
    const fd = new FormData();
    fd.set("file", file);
    setUploadingImage(true);
    try {
      const res = await fetch("/api/upload/user-image", { method: "POST", body: fd, credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setImageUploadError(data?.error ?? "Upload failed"); e.target.value = ""; return; }
      if (data?.url) setImageUrl(data.url);
      else setImageUploadError("Upload failed");
      e.target.value = "";
    } catch {
      setImageUploadError("Upload failed");
      e.target.value = "";
    } finally {
      setUploadingImage(false);
    }
  }

  // ── Create ─────────────────────────────────────────────────────────────────
  async function handleCreate() {
    setError(null);
    setLoading(true);
    const fd = new FormData();
    fd.set("name",        name.trim());
    fd.set("email",       email.trim());
    fd.set("password",    password);
    fd.set("role",        role);
    fd.set("phone",       phone);
    fd.set("gender",      gender);
    fd.set("dateOfBirth", dob);
    fd.set("address",     address);
    fd.set("country",     country);
    fd.set("state",       stateVal);
    fd.set("city",        city);
    fd.set("nrc",         nrcFinal);
    fd.set("archived",    archived ? "on" : "");
    if (imageUrl) fd.set("image", imageUrl);
    try {
      const result = await createUserAction(fd);
      if (result?.error) { setError(result.error); return; }
      // Reset all fields before navigating so the router cache stores an empty form
      setName(""); setEmail(""); setPassword(""); setShowPw(false);
      setRole("user"); setPhone(""); setGender(""); setDob("");
      setAddress(""); setCountry("Myanmar"); setStateVal(""); setCity("");
      setArchived(false);
      setNrcText(""); setNrcState(""); setNrcDistrict(""); setNrcType("N"); setNrcNumber("");
      setImageUrl(""); setImageUploadError(null);
      router.push("/admin/users");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Breadcrumb */}
      <div className="ud-topbar">
        <div className="lv-breadcrumbs">
          <Link href="/admin/users">Users</Link>
          <ChevronRight style={{ width: 11, height: 11, opacity: 0.45 }} />
          <span className="lv-here">New user</span>
        </div>
        <div className="ud-topbar-spacer" />
      </div>

      {/* Sticky save bar */}
      <div className="ud-savebar">
        <span style={{ fontSize: 12, color: "var(--lv-text-3)" }}>
          New user — fill required fields
        </span>
        <span style={{ flex: 1 }} />
        {error && (
          <span style={{ fontSize: 12, color: "#B91C1C", maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {error}
          </span>
        )}
        <Button type="button" size="sm" onClick={handleCreate} disabled={loading}>
          {loading ? "Creating…" : "Create user"}
        </Button>
        <Button variant="outline" size="sm" type="button" asChild>
          <Link href="/admin/users">Cancel</Link>
        </Button>
      </div>

      <div className="ud-grid" style={{ "--ud-cols": 1 } as React.CSSProperties}>
        <div className="ud-main">

          {/* Hero card */}
          <div className="ud-headcard">
            <div className="ud-head-row">
              <div className="ud-hero-avatar" data-hue={4}>
                {imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- preview may be a local blob URL
                  <img
                    src={imageUrl} alt=""
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }}
                  />
                ) : (
                  <span>{inits || "?"}</span>
                )}
                <span className="ud-hero-status pending" />
              </div>

              <div className="ud-head-text">
                <div className="ud-head-eyebrow">
                  <Users style={{ width: 11, height: 11 }} />
                  {ROLE_LABELS[role] || role}
                </div>
                <h1 className="ud-head-h">{displayName}</h1>
                <div className="ud-head-pills">
                  <span className="ud-head-pill warn">
                    <span className="pill-dot" />
                    New
                  </span>
                  <span className="ud-head-pill">
                    <Shield style={{ width: 9, height: 9 }} />
                    KYC · Unverified
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Account section ── */}
          <section className="ud-sec">
            <div className="ud-sec-head">
              <div className="ud-sec-icon" data-tone="blue"><Edit style={{ width: 16, height: 16 }} /></div>
              <div>
                <div className="ud-sec-title">Account</div>
                <div className="ud-sec-sub">Name, email, password, and role</div>
              </div>
            </div>
            <div className="ud-sec-body">
              <div className="ud-field">
                <label className="ud-label">
                  Full name <span className="req">*</span>
                  <span className="ud-label-hint">{name.length}/200</span>
                </label>
                <input
                  className="ud-input"
                  value={name}
                  maxLength={200}
                  placeholder="Full name"
                  onChange={e => setName(e.target.value)}
                />
              </div>

              <div className="ud-row" style={{ "--cols": 2 } as React.CSSProperties}>
                <div className="ud-field">
                  <label className="ud-label">Email or phone <span className="req">*</span></label>
                  <input
                    className="ud-input mono"
                    type="text"
                    value={email}
                    maxLength={200}
                    placeholder="user@example.com or 09xxxxxxx"
                    onChange={e => setEmail(e.target.value)}
                  />
                  <span className="ud-help">Enter an email address or a Myanmar phone number (09... or +959...)</span>
                </div>
                <div className="ud-field">
                  <label className="ud-label">Role <span className="req">*</span></label>
                  <select
                    className="ud-select"
                    value={role}
                    onChange={e => setRole(e.target.value)}
                  >
                    {ROLES.filter(r => canAssignAdmin || r.value === "user").map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="ud-field">
                <label className="ud-label">Password <span className="req">*</span></label>
                <div style={{ position: "relative" }}>
                  <input
                    className="ud-input mono"
                    type={showPw ? "text" : "password"}
                    value={password}
                    minLength={6}
                    maxLength={100}
                    placeholder="Min 6 characters"
                    style={{ paddingRight: 40 }}
                    onChange={e => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    aria-label={showPw ? "Hide password" : "Show password"}
                    onClick={() => setShowPw(p => !p)}
                    style={{ position: "absolute", right: 0, top: 0, height: "100%", width: 36, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", color: "var(--lv-text-3)" }}
                  >
                    {showPw ? <EyeOff style={{ width: 14, height: 14 }} /> : <Eye style={{ width: 14, height: 14 }} />}
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* ── Profile section ── */}
          <section className="ud-sec">
            <div className="ud-sec-head">
              <div className="ud-sec-icon"><Users style={{ width: 16, height: 16 }} /></div>
              <div>
                <div className="ud-sec-title">Profile</div>
                <div className="ud-sec-sub">Contact info, demographics, and photo</div>
              </div>
            </div>
            <div className="ud-sec-body">
              <div className="ud-row" style={{ "--cols": 3 } as React.CSSProperties}>
                <div className="ud-field">
                  <label className="ud-label">Mobile</label>
                  <input
                    className="ud-input mono"
                    placeholder="+95 9 123 456 789"
                    value={phone}
                    maxLength={50}
                    onChange={e => setPhone(e.target.value)}
                  />
                </div>
                <div className="ud-field">
                  <label className="ud-label">Gender</label>
                  <select
                    className="ud-select"
                    value={gender}
                    onChange={e => setGender(e.target.value)}
                  >
                    {GENDERS.map(g => <option key={g.value || "empty"} value={g.value}>{g.label}</option>)}
                  </select>
                </div>
                <div className="ud-field">
                  <label className="ud-label">Date of birth</label>
                  <DatePicker
                    id="c-dateOfBirth"
                    name="c-dateOfBirth-unused"
                    value={dob}
                    placeholder="Pick date"
                    className="w-full"
                    onSelect={d => setDob(d ? d.toISOString().slice(0, 10) : "")}
                  />
                </div>
              </div>

              {/* Image upload */}
              <div className="ud-upload">
                <div className="ud-upload-avatar" data-hue={4}>
                  {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- preview may be a local blob URL
                    <img src={imageUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }} />
                  ) : (
                    inits || "?"
                  )}
                </div>
                <div className="ud-upload-meta">
                  <div className="ud-upload-title">
                    {imageUrl ? "Profile photo set" : "Drop an image here, or browse"}
                  </div>
                  <div className="ud-upload-sub">
                    {imageUrl ? "New image — save to apply" : "Square, at least 256×256. PNG, JPG, WebP or GIF, max 5 MB."}
                  </div>
                </div>
                <div className="ud-upload-actions">
                  <label className={cn("btn", uploadingImage && "opacity-60 pointer-events-none")}>
                    <Upload style={{ width: 13, height: 13 }} />
                    {uploadingImage ? "Uploading…" : "Upload"}
                    <input type="file" accept={ALLOWED_IMAGE_TYPES.join(",")} className="sr-only" disabled={uploadingImage} onChange={handleImageChange} />
                  </label>
                  {imageUrl && (
                    <button type="button" className="btn" onClick={() => setImageUrl("")}>
                      Remove
                    </button>
                  )}
                </div>
              </div>
              {imageUploadError && (
                <p style={{ fontSize: 11.5, color: "#B91C1C" }}>{imageUploadError}</p>
              )}
            </div>
          </section>

          {/* ── Address section ── */}
          <section className="ud-sec">
            <div className="ud-sec-head">
              <div className="ud-sec-icon" data-tone="emer"><MapPin style={{ width: 16, height: 16 }} /></div>
              <div>
                <div className="ud-sec-title">Address &amp; location</div>
                <div className="ud-sec-sub">Used for KYC verification and shipping</div>
              </div>
            </div>
            <div className="ud-sec-body">
              <div className="ud-field">
                <label className="ud-label">Address</label>
                <input
                  className="ud-input"
                  placeholder="Street, building"
                  value={address}
                  maxLength={500}
                  onChange={e => setAddress(e.target.value)}
                />
              </div>

              <div className="ud-address-grid">
                <div className="ud-field">
                  <label className="ud-label">Country</label>
                  <select
                    className="ud-select"
                    value={country}
                    onChange={e => { setCountry(e.target.value); setStateVal(""); setCity(""); }}
                  >
                    <option value="">Select country</option>
                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="ud-field">
                  <label className="ud-label">State / Region</label>
                  <select
                    className="ud-select"
                    value={stateVal}
                    disabled={!country || availableStates.length === 0}
                    onChange={e => { setStateVal(e.target.value); setCity(""); }}
                  >
                    <option value="">Select state / region</option>
                    {availableStates.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="ud-field">
                  <label className="ud-label">City</label>
                  <select
                    className="ud-select"
                    value={city}
                    disabled={!stateVal || availableCities.length === 0}
                    onChange={e => setCity(e.target.value)}
                  >
                    <option value="">Select city</option>
                    {availableCities.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="ud-field">
                <label className="ud-label">Identification number</label>
                {isMyanmar ? (
                  <>
                    <div className="ud-row" style={{ "--cols": 4 } as React.CSSProperties}>
                      <div className="ud-field">
                        <span style={{ fontSize: 10.5, color: "var(--lv-text-3)", fontWeight: 600 }}>State/Region</span>
                        <select className="ud-select" value={nrcState}
                          onChange={e => { setNrcState(e.target.value); setNrcDistrict(""); }}>
                          <option value="">State</option>
                          {MYANMAR_NRC_STATES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </div>
                      <div className="ud-field">
                        <span style={{ fontSize: 10.5, color: "var(--lv-text-3)", fontWeight: 600 }}>District</span>
                        <select className="ud-select" value={nrcDistrict} disabled={!nrcState}
                          onChange={e => setNrcDistrict(e.target.value)}>
                          <option value="">District</option>
                          {(MYANMAR_NRC_DISTRICTS_BY_STATE[nrcState] ?? []).map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                        </select>
                      </div>
                      <div className="ud-field">
                        <span style={{ fontSize: 10.5, color: "var(--lv-text-3)", fontWeight: 600 }}>Type</span>
                        <select className="ud-select" value={nrcType} onChange={e => setNrcType(e.target.value)}>
                          <option value="N">N</option>
                          <option value="NAING">NAING</option>
                        </select>
                      </div>
                      <div className="ud-field">
                        <span style={{ fontSize: 10.5, color: "var(--lv-text-3)", fontWeight: 600 }}>Number (6 digits)</span>
                        <input
                          className="ud-input mono"
                          type="text" inputMode="numeric" maxLength={6} placeholder="123456"
                          value={nrcNumber}
                          onChange={e => setNrcNumber(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        />
                      </div>
                    </div>
                    <span className="ud-help">Format: State/District(Type)Number — e.g. 12/ABC(N)123456</span>
                  </>
                ) : (
                  <input
                    className="ud-input mono"
                    placeholder="e.g. ID number, NRC, passport"
                    value={nrcText}
                    maxLength={100}
                    onChange={e => setNrcText(e.target.value)}
                  />
                )}
                <span className="ud-help">Used for KYC review. Visible to admins only.</span>
              </div>
            </div>
          </section>

          {/* ── Access section ── */}
          <section className="ud-sec">
            <div className="ud-sec-head">
              <div className="ud-sec-icon" data-tone="rose"><Shield style={{ width: 16, height: 16 }} /></div>
              <div>
                <div className="ud-sec-title">Access</div>
                <div className="ud-sec-sub">Initial account state</div>
              </div>
            </div>
            <div className="ud-sec-body">
              <div
                className={`ud-toggle${archived ? " on danger" : ""}`}
                onClick={() => setArchived(v => !v)}
              >
                <div className="ud-toggle-text">
                  <span className="ud-toggle-label">Archive user</span>
                  <span className="ud-toggle-sub">
                    {archived ? "User will be archived — cannot sign in or transact" : "User can sign in and transact normally"}
                  </span>
                </div>
                <span className="ud-toggle-switch" />
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
