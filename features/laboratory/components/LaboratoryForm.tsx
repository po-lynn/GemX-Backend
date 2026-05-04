"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  AdminFormSection,
  AdminFormError,
  adminInput,
  adminTextarea,
  adminLabel,
  adminFieldClass,
} from "@/components/admin/admin-ui";
import {
  createLaboratoryAction,
  updateLaboratoryAction,
} from "@/features/laboratory/actions/laboratory";
import type { LaboratoryForEdit } from "@/features/laboratory/db/laboratory";

type Props = {
  mode: "create" | "edit";
  laboratory?: LaboratoryForEdit | null;
};

export function LaboratoryForm({ mode, laboratory }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isEdit = mode === "edit";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    try {
      const result = isEdit
        ? await updateLaboratoryAction(formData)
        : await createLaboratoryAction(formData);
      if (result?.error) { setError(result.error); return; }
      router.push("/admin/laboratory");
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
        {isEdit && laboratory && (
          <input type="hidden" name="laboratoryId" value={laboratory.id} />
        )}
        <AdminFormSection
          title={isEdit ? "Edit laboratory" : "New laboratory"}
          description={isEdit ? "Update laboratory details" : "Add a certification laboratory (e.g. GIA, AGS)"}
        >
          <div className="space-y-4">
            <div className={adminFieldClass}>
              <label htmlFor="name" className={adminLabel}>Name *</label>
              <input
                id="name" name="name" type="text" required maxLength={200}
                defaultValue={laboratory?.name ?? ""}
                placeholder="e.g. GIA"
                className={adminInput}
              />
            </div>
            <div className={adminFieldClass}>
              <label htmlFor="address" className={adminLabel}>Address *</label>
              <input
                id="address" name="address" type="text" required maxLength={500}
                defaultValue={laboratory?.address ?? ""}
                placeholder="e.g. 5345 Armada Dr, Carlsbad, CA 92008"
                className={adminInput}
              />
            </div>
            <div className={adminFieldClass}>
              <label htmlFor="phone" className={adminLabel}>Phone *</label>
              <input
                id="phone" name="phone" type="text" required maxLength={100}
                defaultValue={laboratory?.phone ?? ""}
                placeholder="e.g. +1 760 603 4000"
                className={adminInput}
              />
            </div>
            <div className={adminFieldClass}>
              <label htmlFor="precaution" className={adminLabel}>Precaution</label>
              <textarea
                id="precaution" name="precaution" rows={3} maxLength={2000}
                defaultValue={laboratory?.precaution ?? ""}
                placeholder="Safety or handling precautions (optional)"
                className={adminTextarea}
              />
            </div>
          </div>
        </AdminFormSection>

        <AdminFormError error={error} />

        <div className="mt-5 flex gap-2">
          <Button type="submit" disabled={loading}>
            {loading ? "Saving…" : isEdit ? "Update" : "Create"}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/admin/laboratory">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
