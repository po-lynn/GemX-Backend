"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { OriginOption } from "@/features/origin/db/origin";
import { deleteOriginAction } from "@/features/origin/actions/origin";
import { Pencil, Trash2 } from "lucide-react";

type Props = {
  origins: OriginOption[];
};

export function OriginTable({ origins }: Props) {
  const router = useRouter();

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return;
    const form = new FormData();
    form.set("originId", id);
    const result = await deleteOriginAction(form);
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
          <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
        </tr>
      </thead>
      <tbody>
        {origins.map((o) => (
          <tr key={o.id} className="border-b transition-colors hover:bg-muted/50">
            <td className="px-4 py-3 font-medium">{o.name}</td>
            <td className="px-4 py-3">
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="icon" asChild>
                  <Link href={`/admin/origin/${o.id}/edit`}>
                    <Pencil className="size-4" />
                    <span className="sr-only">Edit</span>
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(o.id, o.name)}
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
