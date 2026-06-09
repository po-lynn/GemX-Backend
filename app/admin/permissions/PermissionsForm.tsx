"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { FEATURE_GROUPS, type FeatureKey } from "@/features/rbac/feature-keys"
import { savePermissions } from "./actions"

type Props = {
  initial: Record<string, boolean>
}

export function PermissionsForm({ initial }: Props) {
  const [perms, setPerms] = useState<Record<string, boolean>>(initial)
  const [isPending, startTransition] = useTransition()

  function toggle(key: FeatureKey) {
    setPerms((p) => ({ ...p, [key]: !p[key] }))
  }

  function save() {
    startTransition(async () => {
      const result = await savePermissions(perms)
      if (result.ok) {
        toast.success("Supervisor permissions saved")
      } else {
        toast.error(result.error ?? "Failed to save permissions")
      }
    })
  }

  return (
    <div className="space-y-8">
      {FEATURE_GROUPS.map((group) => (
        <div key={group.label} className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {group.label}
          </h2>
          <div className="space-y-4">
            {group.features.map((feature) => (
              <div key={feature.key} className="flex items-center justify-between">
                <Label htmlFor={feature.key} className="text-sm font-medium">
                  {feature.label}
                </Label>
                <Switch
                  id={feature.key}
                  checked={perms[feature.key] ?? false}
                  onCheckedChange={() => toggle(feature.key)}
                  disabled={isPending}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="flex justify-end">
        <Button onClick={save} disabled={isPending}>
          {isPending ? "Saving…" : "Save Permissions"}
        </Button>
      </div>
    </div>
  )
}
