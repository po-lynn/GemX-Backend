"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import type { SpeciesOption } from "@/features/species/db/species"
import { deleteSpeciesAction } from "@/features/species/actions/species"
import { Pencil, Trash2 } from "lucide-react"

type Props = {
  species: SpeciesOption[]
}

export function SpeciesTable({ species }: Props) {
  const router = useRouter()

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? Products using this species will have it cleared.`))
      return
    const form = new FormData()
    form.set("speciesId", id)
    const result = await deleteSpeciesAction(form)
    if (result?.error) {
      alert(result.error)
    } else {
      router.refresh()
    }
  }

  return (
    <table className="w-full">
      <thead>
        <tr className="border-b">
          <th className="px-4 py-3 text-left text-sm font-medium">Name</th>
          <th className="px-4 py-3 text-left text-sm font-medium">Slug</th>
          <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
        </tr>
      </thead>
      <tbody>
        {species.map((s) => (
          <tr key={s.id} className="border-b transition-colors hover:bg-muted/50">
            <td className="px-4 py-3 font-medium">{s.name}</td>
            <td className="px-4 py-3 text-muted-foreground text-sm">/{s.slug}</td>
            <td className="px-4 py-3">
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="icon" asChild>
                  <Link href={`/admin/species/${s.id}/edit`}>
                    <Pencil className="size-4" />
                    <span className="sr-only">Edit</span>
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(s.id, s.name)}
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
  )
}
