"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Save, Upload, User } from "lucide-react"
import DatePicker from "@/components/date-picker/date-picker"
import { COUNTRY_LOCATIONS } from "@/features/users/data/country-locations"
import { updatePortalProfileAction } from "@/features/users/actions/portal-profile"
import type { UserForEdit } from "@/features/users/db/users"

export default function PortalProfileForm({ user }: { user: UserForEdit }) {
  const router = useRouter()

  // Controlled state — fields that affect rendering or bypass native onInput
  const [image, setImage] = useState<string | null>(user.image ?? null)
  const [country, setCountry] = useState(user.country ?? "")
  const [stateRegion, setStateRegion] = useState(user.state ?? "")
  const [city, setCity] = useState(user.city ?? "")
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)

  // Cascading location data
  const countries = Object.keys(COUNTRY_LOCATIONS)
  const regions = country ? Object.keys(COUNTRY_LOCATIONS[country] ?? {}) : []
  const cities =
    country && stateRegion ? COUNTRY_LOCATIONS[country]?.[stateRegion] ?? [] : []

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""
    setUploadingImage(true)
    const fd = new FormData()
    fd.set("file", file)
    const xhr = new XMLHttpRequest()
    xhr.open("POST", "/api/profile/image")
    xhr.addEventListener("load", () => {
      try {
        const data = JSON.parse(xhr.responseText)
        if (data.url) {
          setImage(data.url)
          setDirty(true)
        } else {
          toast.error("Image upload failed")
        }
      } catch {
        toast.error("Image upload failed")
      }
      setUploadingImage(false)
    })
    xhr.addEventListener("error", () => {
      toast.error("Image upload failed")
      setUploadingImage(false)
    })
    xhr.send(fd)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const fd = new FormData(e.currentTarget)

    const input = {
      name: (fd.get("name") as string) || "",
      phone: (fd.get("phone") as string) || null,
      gender: (fd.get("gender") as string) || null,
      dateOfBirth: (fd.get("dateOfBirth") as string) || null,
      nrc: (fd.get("nrc") as string) || null,
      address: (fd.get("address") as string) || null,
      city: city || null,
      state: stateRegion || null,
      country: country || null,
      image: image || null,
    }

    const result = await updatePortalProfileAction(input)
    setLoading(false)

    if (!result.ok) {
      toast.error("Failed to save", { description: result.error })
      return
    }

    setDirty(false)
    toast.success("Profile saved")
    router.refresh()
  }

  const GENDERS = [
    { value: "", label: "Select gender" },
    { value: "male", label: "Male" },
    { value: "female", label: "Female" },
    { value: "other", label: "Other" },
    { value: "prefer_not_to_say", label: "Prefer not to say" },
  ]

  return (
    <div className="pd-host">
      {/* Save bar — outside form, targets by id */}
      <div
        className="pd-stickybar"
        style={{ top: "56px", background: "var(--background)", boxShadow: "0 -28px 0 0 var(--background)", paddingTop: "12px" }}
      >
        <div className="pd-savebar">
          {dirty ? (
            <span className="pd-savebar-dirty">
              <span className="pd-savebar-dirty-dot" />
              Unsaved changes
            </span>
          ) : (
            <span style={{ fontSize: 12, color: "var(--lv-text-3)" }}>Profile</span>
          )}
          <span style={{ flex: 1 }} />
          <button
            type="submit"
            form="portal-profile-form"
            className="pd-btn pd-btn-primary"
            disabled={loading || uploadingImage}
          >
            <Save size={13} />
            {loading ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      <form
        id="portal-profile-form"
        className="pd-main"
        onSubmit={handleSubmit}
        onInput={() => setDirty(true)}
      >
        {/* Profile photo */}
        <section className="pd-sec">
          <div className="pd-sec-head">
            <div className="pd-sec-icon" data-tone="slate">
              <User size={16} />
            </div>
            <div>
              <div className="pd-sec-title">Profile Photo</div>
              <div className="pd-sec-sub">Your public profile picture</div>
            </div>
          </div>
          <div className="pd-sec-body">
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: "50%",
                  overflow: "hidden",
                  background: "var(--muted)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={image}
                    alt="Profile"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <User size={32} style={{ color: "var(--muted-foreground)" }} />
                )}
              </div>
              <label style={{ cursor: "pointer" }}>
                <span className="pd-btn" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  {uploadingImage ? (
                    "Uploading…"
                  ) : (
                    <>
                      <Upload size={13} /> Upload photo
                    </>
                  )}
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="sr-only"
                  disabled={uploadingImage}
                  onChange={handleImageChange}
                />
              </label>
            </div>
          </div>
        </section>

        {/* Personal info */}
        <section className="pd-sec">
          <div className="pd-sec-head">
            <div className="pd-sec-icon" data-tone="blue">
              <User size={16} />
            </div>
            <div>
              <div className="pd-sec-title">Personal Info</div>
              <div className="pd-sec-sub">Your name, contact, and basic details</div>
            </div>
          </div>
          <div className="pd-sec-body">
            <div className="pd-field">
              <label className="pd-label" htmlFor="name">
                Full Name <span className="req">*</span>
              </label>
              <input
                id="name"
                name="name"
                className="pd-input"
                defaultValue={user.name}
                required
                maxLength={200}
              />
            </div>
            <div className="pd-field">
              <label className="pd-label" htmlFor="phone">
                Phone
              </label>
              <input
                id="phone"
                name="phone"
                className="pd-input"
                defaultValue={user.phone ?? ""}
                maxLength={50}
                placeholder="09..."
              />
            </div>
            <div className="pd-field">
              <label className="pd-label" htmlFor="gender">
                Gender
              </label>
              <select
                id="gender"
                name="gender"
                className="pd-select"
                defaultValue={user.gender ?? ""}
              >
                {GENDERS.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="pd-field">
              <label className="pd-label">Date of Birth</label>
              <DatePicker
                name="dateOfBirth"
                value={user.dateOfBirth ?? undefined}
                placeholder="Pick a date"
                onSelect={() => setDirty(true)}
              />
            </div>
          </div>
        </section>

        {/* Identity */}
        <section className="pd-sec">
          <div className="pd-sec-head">
            <div className="pd-sec-icon" data-tone="amber">
              <User size={16} />
            </div>
            <div>
              <div className="pd-sec-title">Identity</div>
              <div className="pd-sec-sub">National registration card</div>
            </div>
          </div>
          <div className="pd-sec-body">
            <div className="pd-field">
              <label className="pd-label" htmlFor="nrc">
                NRC
              </label>
              <input
                id="nrc"
                name="nrc"
                className="pd-input"
                defaultValue={user.nrc ?? ""}
                maxLength={100}
                placeholder="e.g. 12/MaKaNa(N)123456"
              />
            </div>
          </div>
        </section>

        {/* Location */}
        <section className="pd-sec">
          <div className="pd-sec-head">
            <div className="pd-sec-icon" data-tone="emer">
              <User size={16} />
            </div>
            <div>
              <div className="pd-sec-title">Location</div>
              <div className="pd-sec-sub">Your address and region</div>
            </div>
          </div>
          <div className="pd-sec-body">
            <div className="pd-field">
              <label className="pd-label" htmlFor="address">
                Address
              </label>
              <textarea
                id="address"
                name="address"
                className="pd-textarea"
                defaultValue={user.address ?? ""}
                maxLength={500}
                rows={3}
                placeholder="Street address"
              />
            </div>
            <div className="pd-field">
              <label className="pd-label" htmlFor="country">
                Country
              </label>
              <select
                id="country"
                className="pd-select"
                value={country}
                onChange={(e) => {
                  setCountry(e.target.value)
                  setStateRegion("")
                  setCity("")
                  setDirty(true)
                }}
              >
                <option value="">Select country</option>
                {countries.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="pd-field">
              <label className="pd-label" htmlFor="state">
                State / Region
              </label>
              <select
                id="state"
                className="pd-select"
                value={stateRegion}
                onChange={(e) => {
                  setStateRegion(e.target.value)
                  setCity("")
                  setDirty(true)
                }}
                disabled={!country}
              >
                <option value="">Select region</option>
                {regions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="pd-field">
              <label className="pd-label" htmlFor="city">
                City
              </label>
              {cities.length > 0 ? (
                <select
                  id="city"
                  className="pd-select"
                  value={city}
                  onChange={(e) => {
                    setCity(e.target.value)
                    setDirty(true)
                  }}
                  disabled={!stateRegion}
                >
                  <option value="">Select city</option>
                  {cities.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="city"
                  className="pd-input"
                  value={city}
                  onChange={(e) => {
                    setCity(e.target.value)
                    setDirty(true)
                  }}
                  placeholder="City"
                  maxLength={100}
                />
              )}
            </div>
          </div>
        </section>

        {/* Account info (read-only) */}
        <section className="pd-sec">
          <div className="pd-sec-head">
            <div className="pd-sec-icon" data-tone="purple">
              <User size={16} />
            </div>
            <div>
              <div className="pd-sec-title">Account</div>
              <div className="pd-sec-sub">Email, points, and membership details</div>
            </div>
          </div>
          <div className="pd-sec-body">
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", fontSize: "0.875rem" }}>
              <div>
                <div style={{ color: "var(--lv-text-3)", fontSize: "0.75rem", marginBottom: "0.125rem" }}>
                  Email
                </div>
                <div style={{ wordBreak: "break-all" }}>{user.email}</div>
              </div>
              <div>
                <div style={{ color: "var(--lv-text-3)", fontSize: "0.75rem", marginBottom: "0.125rem" }}>
                  Points
                </div>
                <div style={{ fontWeight: 600 }}>{user.points.toLocaleString()} pts</div>
              </div>
              <div>
                <div style={{ color: "var(--lv-text-3)", fontSize: "0.75rem", marginBottom: "0.125rem" }}>
                  Status
                </div>
                <div>
                  {user.verified ? (
                    <span style={{ color: "var(--chart-2)", fontWeight: 500 }}>Verified</span>
                  ) : (
                    <span style={{ color: "var(--lv-text-3)" }}>Unverified</span>
                  )}
                </div>
              </div>
              <div>
                <div style={{ color: "var(--lv-text-3)", fontSize: "0.75rem", marginBottom: "0.125rem" }}>
                  Member since
                </div>
                <div>
                  {new Date(user.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>
      </form>
    </div>
  )
}
