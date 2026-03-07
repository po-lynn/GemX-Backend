"use client";

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

export function UserForm({ mode, user }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>(user?.image ?? "");
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const isEdit = mode === "edit";

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
            <div className="flex h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-border bg-muted">
              {user.image ? (
                <img
                  src={user.image}
                  alt=""
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
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
                  <img
                    src={imageUrl || user?.image || ""}
                    alt=""
                    className="h-12 w-12 rounded-full object-cover ring-1 ring-border"
                  />
                  <span className="text-muted-foreground text-xs">
                    {imageUrl && imageUrl !== (user?.image ?? "") ? "New image will be saved" : "Current profile photo"}
                  </span>
                </div>
              )}
              {imageUploadError && (
                <p className="text-destructive text-xs">{imageUploadError}</p>
              )}
              <input type="hidden" name="image" value={imageUrl} />
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
                      <img
                        src={imageUrl}
                        alt=""
                        className="h-12 w-12 rounded-full object-cover ring-1 ring-border"
                      />
                      <span className="text-muted-foreground text-xs">
                        Image will be used as profile photo
                      </span>
                    </div>
                  )}
                  {imageUploadError && (
                    <p className="text-destructive text-xs">{imageUploadError}</p>
                  )}
                  <input type="hidden" name="image" value={imageUrl} />
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
              <label htmlFor="nrc" className="text-sm font-medium">
                Identification number
              </label>
              <input
                id="nrc"
                name="nrc"
                type="text"
                maxLength={100}
                defaultValue={user?.nrc ?? ""}
                placeholder="e.g. NRC number"
                className={inputClass}
              />
            </div>
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
              <div className="space-y-2">
                <label htmlFor="country" className="text-sm font-medium">
                  Country
                </label>
                <select
                  id="country"
                  name="country"
                  defaultValue={user?.country ?? ""}
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
              {user?.role === "user" && (
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
