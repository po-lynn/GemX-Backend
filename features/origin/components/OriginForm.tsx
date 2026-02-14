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
  createOriginAction,
  updateOriginAction,
} from "@/features/origin/actions/origin";
import type { OriginForEdit } from "@/features/origin/db/origin";

const inputClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

const COUNTRIES = [
  "Afghanistan", "Australia", "Brazil", "Cambodia", "Colombia", "India",
  "Madagascar", "Malawi", "Mozambique", "Myanmar", "Pakistan", "Russia",
  "Sri Lanka", "Tanzania", "Thailand", "USA", "Vietnam", "Zambia", "Zimbabwe",
].sort();

type Props = {
  mode: "create" | "edit";
  origin?: OriginForEdit | null;
};

export function OriginForm({ mode, origin }: Props) {
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
        ? await updateOriginAction(formData)
        : await createOriginAction(formData);
      if (result?.error) {
        setError(result.error);
        setLoading(false);
        return;
      }
      router.push("/admin/origin");
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
        <CardTitle>{isEdit ? "Edit Origin" : "New Origin"}</CardTitle>
        <CardDescription>
          {isEdit ? "Update origin" : "Add a gem origin (e.g. Myanmar, Sri Lanka)"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {isEdit && origin && (
            <input type="hidden" name="originId" value={origin.id} />
          )}
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
              defaultValue={origin?.name ?? ""}
              placeholder="e.g. Mogok"
              className={inputClass}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="country" className="text-sm font-medium">
              Country *
            </label>
            <select
              id="country"
              name="country"
              required
              defaultValue={origin?.country ?? ""}
              className={inputClass}
            >
              <option value="">Select country</option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? "Saving…" : isEdit ? "Update" : "Create"}
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/admin/origin">Cancel</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
