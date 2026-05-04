"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  AdminFormSection,
  AdminFormError,
  adminInput,
  adminSelect,
  adminLabel,
  adminFieldClass,
} from "@/components/admin/admin-ui";
import {
  createOriginAction,
  updateOriginAction,
} from "@/features/origin/actions/origin";
import type { OriginForEdit } from "@/features/origin/db/origin";

const LOCATION_OPTIONS = [
  { value: "", label: "Select location" },
  { value: "Myanmar", label: "Myanmar" },
  { value: "Other", label: "Other" },
] as const;

const MYANMAR_ORIGINS = [
  { value: "", label: "Select origin" },
  { value: "Mogok", label: "Mogok" },
  { value: "Mong Hsu", label: "Mong Hsu" },
  { value: "Nant Yar", label: "Nant Yar" },
] as const;

type Props = {
  mode: "create" | "edit";
  origin?: OriginForEdit | null;
};

function getInitialLocation(origin: OriginForEdit | null | undefined): "" | "Myanmar" | "Other" {
  if (!origin?.country) return "";
  return origin.country === "Myanmar" ? "Myanmar" : "Other";
}

export function OriginForm({ mode, origin }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<"" | "Myanmar" | "Other">(() =>
    getInitialLocation(origin)
  );
  const isEdit = mode === "edit";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    try {
      const result = isEdit
        ? await updateOriginAction(formData)
        : await createOriginAction(formData);
      if (result?.error) { setError(result.error); return; }
      router.push("/admin/origin");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-5">
      <form onSubmit={handleSubmit}>
        {isEdit && origin && (
          <input type="hidden" name="originId" value={origin.id} />
        )}
        <AdminFormSection
          title={isEdit ? "Edit origin" : "New origin"}
          description={isEdit ? "Update origin details" : "Add a gem origin (Myanmar or Other)"}
        >
          <div className="space-y-4">
            <div className={adminFieldClass}>
              <label htmlFor="country" className={adminLabel}>Location *</label>
              <select
                id="country" name="country" required
                value={location}
                onChange={(e) => setLocation((e.target.value || "") as "" | "Myanmar" | "Other")}
                className={adminSelect}
              >
                {LOCATION_OPTIONS.map((opt) => (
                  <option key={opt.value || "empty"} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {location === "Myanmar" && (
              <div className={adminFieldClass}>
                <label htmlFor="name" className={adminLabel}>Origin name *</label>
                <select
                  id="name" name="name" required
                  defaultValue={origin?.country === "Myanmar" ? origin.name : ""}
                  className={adminSelect}
                >
                  {MYANMAR_ORIGINS.map((opt) => (
                    <option key={opt.value || "empty"} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            )}

            {location === "Other" && (
              <div className={adminFieldClass}>
                <label htmlFor="name" className={adminLabel}>Origin name *</label>
                <input
                  id="name" name="name" type="text" required maxLength={200}
                  defaultValue={origin?.country !== "Myanmar" ? origin?.name ?? "" : ""}
                  placeholder="e.g. Sri Lanka, Madagascar"
                  className={adminInput}
                />
              </div>
            )}
          </div>
        </AdminFormSection>

        <AdminFormError error={error} />

        <div className="mt-5 flex gap-2">
          <Button type="submit" disabled={loading || !location}>
            {loading ? "Saving…" : isEdit ? "Update" : "Create"}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/admin/origin">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
