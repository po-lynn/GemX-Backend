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
  createLaboratoryAction,
  updateLaboratoryAction,
} from "@/features/laboratory/actions/laboratory";
import type { LaboratoryForEdit } from "@/features/laboratory/db/laboratory";

const inputClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

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

    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      const result = isEdit
        ? await updateLaboratoryAction(formData)
        : await createLaboratoryAction(formData);

      if (result?.error) {
        setError(result.error);
        setLoading(false);
        return;
      }

      router.push("/admin/laboratory");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEdit ? "Edit Laboratory" : "New Laboratory"}</CardTitle>
        <CardDescription>
          {isEdit
            ? "Update laboratory details"
            : "Add a certification laboratory (e.g. GIA, AGS)"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {isEdit && laboratory && (
            <input type="hidden" name="laboratoryId" value={laboratory.id} />
          )}

          <section className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                Name *
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                maxLength={200}
                defaultValue={laboratory?.name ?? ""}
                placeholder="e.g. GIA"
                className={inputClass}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="address" className="text-sm font-medium">
                Address *
              </label>
              <input
                id="address"
                name="address"
                type="text"
                required
                maxLength={500}
                defaultValue={laboratory?.address ?? ""}
                placeholder="e.g. 5345 Armada Dr, Carlsbad, CA 92008"
                className={inputClass}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="phone" className="text-sm font-medium">
                Phone *
              </label>
              <input
                id="phone"
                name="phone"
                type="text"
                required
                maxLength={100}
                defaultValue={laboratory?.phone ?? ""}
                placeholder="e.g. +1 760 603 4000"
                className={inputClass}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="precaution" className="text-sm font-medium">
                Precaution
              </label>
              <textarea
                id="precaution"
                name="precaution"
                rows={3}
                maxLength={2000}
                defaultValue={laboratory?.precaution ?? ""}
                placeholder="Safety or handling precautions (optional)"
                className={inputClass + " min-h-[80px] resize-y"}
              />
            </div>
          </section>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? "Saving…" : isEdit ? "Update" : "Create"}
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/admin/laboratory">Cancel</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
