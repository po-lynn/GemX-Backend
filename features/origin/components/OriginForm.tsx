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

  const isMyanmar = location === "Myanmar";
  const isOther = location === "Other";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEdit ? "Edit Origin" : "New Origin"}</CardTitle>
        <CardDescription>
          {isEdit ? "Update origin" : "Add a gem origin (Myanmar or Other)"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {isEdit && origin && (
            <input type="hidden" name="originId" value={origin.id} />
          )}

          <div className="space-y-2">
            <label htmlFor="country" className="text-sm font-medium">
              Location *
            </label>
            <select
              id="country"
              name="country"
              required
              value={location}
              onChange={(e) =>
                setLocation((e.target.value || "") as "" | "Myanmar" | "Other")
              }
              className={inputClass}
            >
              {LOCATION_OPTIONS.map((opt) => (
                <option key={opt.value || "empty"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {isMyanmar && (
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                Origin name *
              </label>
              <select
                id="name"
                name="name"
                required
                defaultValue={
                  origin?.country === "Myanmar" ? origin.name : ""
                }
                className={inputClass}
              >
                {MYANMAR_ORIGINS.map((opt) => (
                  <option key={opt.value || "empty"} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {isOther && (
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                Origin name *
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                maxLength={200}
                defaultValue={origin?.country !== "Myanmar" ? origin?.name ?? "" : ""}
                placeholder="e.g. Sri Lanka, Madagascar"
                className={inputClass}
              />
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={loading || !location}>
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
