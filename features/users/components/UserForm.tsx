"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  createUserAction,
  updateUserAction,
} from "@/features/users/actions/users";
import type { UserForEdit } from "@/features/users/db/users";
import DatePicker from "@/components/date-picker/date-picker";
import myanmarNrcTownships from "@/features/users/data/myanmar-nrc-townships.json";
import { cn } from "@/lib/utils";
import { Eye, EyeOff, Upload } from "lucide-react";

const inputClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

const ROLES = [
  { value: "", label: "Select role" },
  { value: "admin", label: "Admin" },
  { value: "seller", label: "Seller" },
  { value: "mobile", label: "Mobile" },
  { value: "user", label: "User" },
]
const GENDERS = [
  { value: "", label: "Select gender" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

const COUNTRIES = [
  "Afghanistan", "Australia", "Brazil", "Cambodia", "China", "Colombia",
  "India", "Indonesia", "Japan", "Madagascar", "Malawi", "Malaysia",
  "Mozambique", "Myanmar", "Pakistan", "Philippines", "Russia",
  "Singapore", "South Korea", "Sri Lanka", "Tanzania", "Thailand",
  "UK", "USA", "Vietnam", "Zambia", "Zimbabwe",
].sort();

type Props = {
  mode: "create" | "edit";
  user?: UserForEdit | null;
};

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_IMAGE_SIZE_MB = 5;

/** District can be 3-letter (e.g. AGY) or romanized township code (e.g. AhGaYa). */
const MYANMAR_NRC_REGEX = /^(\d{1,2})\s*\/\s*([A-Za-z]{3,12})\s*\(\s*(N|NAING)\s*\)\s*(\d{6})$/i;

/** Myanmar NRC state/region codes (1–14). */
const MYANMAR_NRC_STATES: { value: string; label: string }[] = [
  { value: "1", label: "1 - Kachin" },
  { value: "2", label: "2 - Kayah" },
  { value: "3", label: "3 - Kayin" },
  { value: "4", label: "4 - Chin" },
  { value: "5", label: "5 - Sagaing" },
  { value: "6", label: "6 - Tanintharyi" },
  { value: "7", label: "7 - Bago" },
  { value: "8", label: "8 - Magway" },
  { value: "9", label: "9 - Mandalay" },
  { value: "10", label: "10 - Mon" },
  { value: "11", label: "11 - Rakhine" },
  { value: "12", label: "12 - Yangon" },
  { value: "13", label: "13 - Shan" },
  { value: "14", label: "14 - Ayeyarwady" },
];

/** Township lists by state (from myanmar-nrc-townships.json). Run `node scripts/fetch-myanmar-nrc.js` to refresh from htetoozin/Myanmar-NRC. */
const MYANMAR_NRC_DISTRICTS_BY_STATE = myanmarNrcTownships as Record<string, { value: string; label: string }[]>;

function parseMyanmarNrc(nrc: string | null | undefined): { state: string; district: string; type: string; number: string } | null {
  if (!nrc?.trim()) return null;
  const m = nrc.trim().match(MYANMAR_NRC_REGEX);
  if (!m) return null;
  const district = m[2].length === 3 ? m[2].toUpperCase() : m[2];
  return { state: m[1], district, type: m[3].toUpperCase(), number: m[4] };
}

export function UserForm({ mode, user }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>(user?.image ?? "");
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [country, setCountry] = useState<string>(user?.country ?? "");
  const isMyanmar = country === "Myanmar";
  const parsedNrc = parseMyanmarNrc(user?.nrc ?? undefined);
  const [nrcState, setNrcState] = useState(parsedNrc?.state ?? "");
  const [nrcDistrict, setNrcDistrict] = useState(parsedNrc?.district ?? "");
  const [nrcType, setNrcType] = useState(parsedNrc?.type === "NAING" ? "NAING" : "N");
  const [nrcNumber, setNrcNumber] = useState(parsedNrc?.number ?? "");
  const isEdit = mode === "edit";

  const myanmarNrcValue =
    isMyanmar && (nrcState || nrcDistrict || nrcNumber)
      ? `${nrcState}/${nrcDistrict}(${nrcType})${nrcNumber}`
      : "";

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    setImageUploadError(null);
    const file = e.target.files?.[0];
    if (!file) {
      setImageUrl("");
      return;
    }
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setImageUploadError(`Allowed types: ${ALLOWED_IMAGE_TYPES.join(", ")}`);
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
      const res = await fetch("/api/upload/user-image", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setImageUploadError(data?.error ?? "Upload failed");
        e.target.value = "";
        return;
      }
      const url = data?.url;
      if (url) {
        setImageUrl(url);
      } else {
        setImageUploadError("Upload failed");
      }
      e.target.value = "";
    } catch {
      setImageUploadError("Upload failed");
      e.target.value = "";
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = e.currentTarget;
    const formData = new FormData(form);
    // Ensure profile image URL from state is sent (hidden input can be out of sync)
    if (imageUrl.trim()) {
      formData.set("image", imageUrl.trim());
    }
    try {
      const result = isEdit
        ? await updateUserAction(formData)
        : await createUserAction(formData);
      if (result?.error) {
        setError(result.error);
        setLoading(false);
        return;
      }
      await router.push("/admin/users");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const displayName = user?.name ?? user?.email ?? "User";

  return (
    <Card>
      <CardHeader>
        {isEdit && user && (
          <div className="mb-2 flex justify-center">
            <div className="relative flex h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-border bg-muted">
              {user.image ? (
                <Image
                  src={user.image}
                  alt=""
                  fill
                  className="object-cover"
                  referrerPolicy="no-referrer"
                  sizes="64px"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-2xl font-medium text-muted-foreground">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </div>
        )}
        <CardTitle>{isEdit ? "Edit User" : "New User"}</CardTitle>
        <CardDescription>
          {isEdit
            ? "Update user details"
            : "Create a new user with email and password"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {isEdit && user && (
            <input type="hidden" name="userId" value={user.id} />
          )}
          {isEdit && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">Profile image</span>
                <label
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg border border-(--form-input-border) bg-(--form-bg) px-3 py-1.5 text-sm font-medium text-(--form-foreground)",
                    uploadingImage
                      ? "cursor-not-allowed opacity-60 pointer-events-none"
                      : "cursor-pointer hover:bg-(--form-muted)"
                  )}
                >
                  <Upload className="h-4 w-4" />
                  {uploadingImage ? "Uploading…" : "Upload image"}
                  <input
                    type="file"
                    accept={ALLOWED_IMAGE_TYPES.join(",")}
                    className="sr-only"
                    disabled={uploadingImage}
                    onChange={handleImageChange}
                  />
                </label>
                {uploadingImage && (
                  <span className="text-sm text-muted-foreground">Uploading…</span>
                )}
              </div>
              {(imageUrl || user?.image) && (
                <div className="flex items-center gap-2">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full ring-1 ring-border">
                    <Image
                      src={imageUrl || user?.image || ""}
                      alt=""
                      fill
                      className="object-cover"
                      unoptimized={(imageUrl || user?.image || "").startsWith("blob:") || (imageUrl || user?.image || "").startsWith("data:")}
                      sizes="48px"
                    />
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {imageUrl && imageUrl !== (user?.image ?? "") ? "New image will be saved" : "Current profile photo"}
                  </span>
                </div>
              )}
              {imageUploadError && (
                <p className="text-destructive text-xs">{imageUploadError}</p>
              )}
              <input type="hidden" name="image" value={imageUrl ?? ""} />
            </div>
          )}
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                Full Name *
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                maxLength={200}
                defaultValue={user?.name ?? ""}
                placeholder="Full name"
                className={inputClass}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="phone" className="text-sm font-medium">
                Phone
              </label>
              <input
                id="phone"
                name="phone"
                type="text"
                maxLength={50}
                defaultValue={user?.phone ?? ""}
                placeholder="+95 9 123 456 789"
                className={inputClass}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <input
                id="email"
                name={isEdit ? undefined : "email"}
                type="email"
                maxLength={200}
                defaultValue={user?.email ?? ""}
                placeholder="user@example.com"
                className={inputClass}
                readOnly={isEdit}
              />
              {isEdit && (
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed.
                </p>
              )}
            </div>
            {!isEdit && (
              <>
                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium">
                    Password *
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={6}
                      maxLength={100}
                      placeholder="Min 6 characters"
                      className={inputClass + " pr-10"}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-9 w-9 shrink-0"
                      onClick={() => setShowPassword((p) => !p)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">Profile image</span>
                    <label
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg border border-(--form-input-border) bg-(--form-bg) px-3 py-1.5 text-sm font-medium text-(--form-foreground)",
                        uploadingImage
                          ? "cursor-not-allowed opacity-60 pointer-events-none"
                          : "cursor-pointer hover:bg-(--form-muted)"
                      )}
                    >
                      <Upload className="h-4 w-4" />
                      {uploadingImage ? "Uploading…" : "Upload image"}
                      <input
                        type="file"
                        accept={ALLOWED_IMAGE_TYPES.join(",")}
                        className="sr-only"
                        disabled={uploadingImage}
                        onChange={handleImageChange}
                      />
                    </label>
                    {uploadingImage && (
                      <span className="text-sm text-muted-foreground">Uploading…</span>
                    )}
                  </div>
                  {imageUrl && (
                    <div className="flex items-center gap-2">
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full ring-1 ring-border">
                        <Image
                          src={imageUrl}
                          alt=""
                          fill
                          className="object-cover"
                          unoptimized={imageUrl.startsWith("blob:") || imageUrl.startsWith("data:")}
                          sizes="48px"
                        />
                      </div>
                      <span className="text-muted-foreground text-xs">
                        Image will be used as profile photo
                      </span>
                    </div>
                  )}
                  {imageUploadError && (
                    <p className="text-destructive text-xs">{imageUploadError}</p>
                  )}
                  <input type="hidden" name="image" value={imageUrl ?? ""} />
                </div>
              </>
            )}
            <div className="space-y-2">
              <label htmlFor="role" className="text-sm font-medium">
                Role *
              </label>
              <select
                id="role"
                name="role"
                required
                defaultValue={user?.role ?? ""}
                className={inputClass}
              >
                {ROLES.map((r) => (
                  <option key={r.value || "empty"} value={r.value}>
                  {r.label}
                </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="gender" className="text-sm font-medium">
                Gender
              </label>
              <select
                id="gender"
                name="gender"
                defaultValue={user?.gender ?? ""}
                className={inputClass}
              >
                {GENDERS.map((g) => (
                  <option key={g.value || "empty"} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="block w-full space-y-2">
              <label htmlFor="dateOfBirth" className="text-sm font-medium">
                Date of birth
              </label>
              <DatePicker
                id="dateOfBirth"
                name="dateOfBirth"
                value={user?.dateOfBirth ?? ""}
                placeholder="Pick date of birth"
                className="w-full"
              />
            </div>
            {isEdit && (
              <>
                
                <div className="space-y-2">
                  <label htmlFor="points" className="text-sm font-medium">
                    Points
                  </label>
                  <input
                    id="points"
                    name="points"
                    type="number"
                    min={0}
                    step={1}
                    defaultValue={user?.points ?? 0}
                    className={inputClass}
                  />
                </div>
              </>
            )}
            <div className="space-y-2">
              <label htmlFor="address" className="text-sm font-medium">
                Address
              </label>
              <input
                id="address"
                name="address"
                type="text"
                maxLength={500}
                defaultValue={user?.address ?? ""}
                placeholder="Street, building"
                className={inputClass}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
                <label htmlFor="country" className="text-sm font-medium">
                  Country
                </label>
                <select
                  id="country"
                  name="country"
                  value={country ?? ""}
                  onChange={(e) => setCountry(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select country</option>
                  {user?.country &&
                    !COUNTRIES.includes(user.country) && (
                      <option value={user.country}>{user.country}</option>
                    )}
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor="city" className="text-sm font-medium">
                  City
                </label>
                <input
                  id="city"
                  name="city"
                  type="text"
                  maxLength={100}
                  defaultValue={user?.city ?? ""}
                  className={inputClass}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="state" className="text-sm font-medium">
                  State
                </label>
                <input
                  id="state"
                  name="state"
                  type="text"
                  maxLength={100}
                  defaultValue={user?.state ?? ""}
                  className={inputClass}
                />
              </div> 
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Identification number
              </label>
              {isMyanmar ? (
                <>
                  
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="space-y-1">
                      <label htmlFor="nrc-state" className="text-xs text-muted-foreground">State / Region</label>
                      <select
                        id="nrc-state"
                        value={nrcState ?? ""}
                        onChange={(e) => {
                          setNrcState(e.target.value);
                          setNrcDistrict("");
                        }}
                        className={inputClass}
                      >
                        <option value="">Select state</option>
                        {MYANMAR_NRC_STATES.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="nrc-district" className="text-xs text-muted-foreground">District / Township</label>
                      <select
                        id="nrc-district"
                        value={nrcDistrict ?? ""}
                        onChange={(e) => setNrcDistrict(e.target.value)}
                        className={inputClass}
                        disabled={!nrcState}
                      >
                        <option value="">Select district</option>
                        {(MYANMAR_NRC_DISTRICTS_BY_STATE[nrcState] ?? []).map((d) => (
                          <option key={d.value} value={d.value}>
                            {d.label}
                          </option>
                        ))}
                        {nrcDistrict &&
                          nrcState &&
                          !(MYANMAR_NRC_DISTRICTS_BY_STATE[nrcState] ?? []).some((d) => d.value === nrcDistrict) && (
                            <option value={nrcDistrict ?? ""}>{nrcDistrict}</option>
                          )}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="nrc-type" className="text-xs text-muted-foreground">Type</label>
                      <select
                        id="nrc-type"
                        value={nrcType ?? "N"}
                        onChange={(e) => setNrcType(e.target.value)}
                        className={inputClass}
                      >
                        <option value="N">N</option>
                        <option value="NAING">NAING</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="nrc-number" className="text-xs text-muted-foreground">Number (6 digits)</label>
                      <input
                        id="nrc-number"
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="123456"
                        value={nrcNumber ?? ""}
                        onChange={(e) => setNrcNumber(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        className={inputClass}
                      />
                    </div>
                    <input type="hidden" name="nrc" value={myanmarNrcValue ?? ""} />
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Format: State/District(Type)Number — e.g. 12/ABC(N)123456
                  </p>
                </>
              ) : (
                <>
                  <input
                    id="nrc"
                    name="nrc"
                    type="text"
                    maxLength={100}
                    defaultValue={user?.nrc ?? ""}
                    placeholder="e.g. ID number"
                    className={inputClass}
                  />
                </>
              )}
            </div>
            
            
            <div className="flex flex-wrap items-center gap-6">
              {((isEdit && user?.role === "user") || !isEdit) && (
                <div className="flex items-center gap-2">
                  <input
                    id="verified"
                    name="verified"
                    type="checkbox"
                    defaultChecked={user?.verified ?? false}
                    className="h-4 w-4 rounded border-input"
                  />
                  <label htmlFor="verified" className="text-sm font-medium">
                    Verified by admin
                  </label>
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  id="archived"
                  name="archived"
                  type="checkbox"
                  defaultChecked={user?.archived ?? false}
                  className="h-4 w-4 rounded border-input"
                />
                <label htmlFor="archived" className="text-sm font-medium">
                  Archive user
                </label>
              </div>
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? "Saving…" : isEdit ? "Update" : "Create"}
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/admin/users">Cancel</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
