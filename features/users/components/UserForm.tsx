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
import { Eye, EyeOff } from "lucide-react";

const inputClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

const ROLES = ["admin", "seller", "mobile", "user"];
const GENDERS = [
  { value: "", label: "Select gender" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

type Props = {
  mode: "create" | "edit";
  user?: UserForEdit | null;
};

export function UserForm({ mode, user }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const isEdit = mode === "edit";

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
      router.push("/admin/users");
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
            )}
            <div className="space-y-2">
              <label htmlFor="role" className="text-sm font-medium">
                Role *
              </label>
              <select
                id="role"
                name="role"
                required
                defaultValue={user?.role ?? "user"}
                className={inputClass}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
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
            {isEdit && (
              <>
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
                    <input
                      id="country"
                      name="country"
                      type="text"
                      maxLength={100}
                      defaultValue={user?.country ?? ""}
                      className={inputClass}
                    />
                  </div>
                </div>
              </>
            )}
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
