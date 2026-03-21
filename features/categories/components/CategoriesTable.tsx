"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { CategoryRow } from "@/features/categories/db/categories"
import { deleteCategoryAction } from "@/features/categories/actions/categories"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Pencil, Trash2 } from "lucide-react"

type Props = {
  categories: CategoryRow[]
}

export function CategoriesTable({ categories }: Props) {
  const router = useRouter()
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const loose = categories.filter((c) => c.type === "loose_stone")
  const jewellery = categories.filter((c) => c.type === "jewellery")

  function openDeleteDialog(id: string, name: string) {
    setDeleteTarget({ id, name })
  }

  function closeDeleteDialog() {
    if (!deleting) setDeleteTarget(null)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const form = new FormData()
    form.set("id", deleteTarget.id)
    const result = await deleteCategoryAction(form)
    setDeleting(false)
    setDeleteTarget(null)
    if (result?.error) {
      alert(result.error)
    } else {
      router.refresh()
    }
  }

  return (
    <>
      <div className="gem-theme rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="h-11 px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Name
                </th>
                <th className="h-11 px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Short Code
                </th>
                <th className="h-11 px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Type
                </th>
                <th className="h-11 px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-24">
                  Order
                </th>
                <th className="h-11 px-4 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground w-20">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loose.length === 0 && jewellery.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="h-28 px-4 text-center text-muted-foreground"
                  >
                    No categories yet. Add one to use in products.
                  </td>
                </tr>
              ) : (
                [...loose, ...jewellery].map((c) => (
                  <tr
                    key={c.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => router.push(`/admin/categories/${c.id}/edit`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        router.push(`/admin/categories/${c.id}/edit`)
                      }
                    }}
                    className="gem-table-row-hover cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-muted/50"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{c.name}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-muted-foreground font-mono text-xs">
                        {c.shortCode ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {c.type === "loose_stone" ? (
                        <Badge variant="secondary">Loose stone</Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          style={{ backgroundColor: "#EEEEEE" }}
                        >
                          Jewellery
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="tabular-nums">{c.sortOrder}</span>
                    </td>
                    <td
                      className="px-4 py-3 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" asChild>
                          <Link
                            href={`/admin/categories/${c.id}/edit`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Pencil className="size-4" />
                            <span className="sr-only">Edit</span>
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation()
                            openDeleteDialog(c.id, c.name)
                          }}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="size-4" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && closeDeleteDialog()}>
        <DialogContent showCloseButton={!deleting}>
          <DialogHeader>
            <DialogTitle>Delete category</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the category &quot;{deleteTarget?.name}&quot;?
              Products using it will have their category cleared.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={closeDeleteDialog} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
