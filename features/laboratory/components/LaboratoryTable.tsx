"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { LaboratoryOption } from "@/features/laboratory/db/laboratory";
import { deleteLaboratoryAction } from "@/features/laboratory/actions/laboratory";
import { Pencil, Trash2 } from "lucide-react";

type Props = {
  laboratories: LaboratoryOption[];
};

export function LaboratoryTable({ laboratories }: Props) {
  const router = useRouter();

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return;
    const form = new FormData();
    form.set("laboratoryId", id);
    const result = await deleteLaboratoryAction(form);
    if (result?.error) {
      alert(result.error);
    } else {
      router.refresh();
    }
  }

  return (
    <table className="w-full">
      <thead>
        <tr className="border-b">
          <th className="px-4 py-3 text-left text-sm font-medium">Name</th>
          <th className="px-4 py-3 text-left text-sm font-medium">Address</th>
          <th className="px-4 py-3 text-left text-sm font-medium">Phone</th>
          <th className="px-4 py-3 text-left text-sm font-medium">Precaution</th>
          <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
        </tr>
      </thead>
      <tbody>
        {laboratories.map((lab) => (
          <tr
            key={lab.id}
            className="border-b transition-colors hover:bg-muted/50"
          >
            <td className="px-4 py-3 font-medium">{lab.name}</td>
            <td className="px-4 py-3 text-muted-foreground text-sm max-w-[200px] truncate" title={lab.address}>
              {lab.address}
            </td>
            <td className="px-4 py-3 text-muted-foreground text-sm">
              {lab.phone}
            </td>
            <td className="px-4 py-3 text-muted-foreground text-sm max-w-[180px] truncate" title={lab.precaution ?? ""}>
              {lab.precaution || "—"}
            </td>
            <td className="px-4 py-3">
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="icon" asChild>
                  <Link href={`/admin/laboratory/${lab.id}/edit`}>
                    <Pencil className="size-4" />
                    <span className="sr-only">Edit</span>
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(lab.id, lab.name)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                  <span className="sr-only">Delete</span>
                </Button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
