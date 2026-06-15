"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Pencil, Trash2, Loader2 } from "lucide-react"
import { deletePortalProductAction } from "@/features/products/actions/portal-products"

export default function PortalProductActions({ productId }: { productId: string }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirm("Delete this product? This cannot be undone.")) return
    setDeleting(true)
    try {
      const result = await deletePortalProductAction(productId)
      if (result.ok) router.refresh()
      else alert(result.error ?? "Failed to delete product")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0">
        <Link href={`/portal/products/${productId}/edit`}>
          <Pencil className="h-3.5 w-3.5" />
          <span className="sr-only">Edit</span>
        </Link>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
        onClick={handleDelete}
        disabled={deleting}
      >
        {deleting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Trash2 className="h-3.5 w-3.5" />
        )}
        <span className="sr-only">Delete</span>
      </Button>
    </div>
  )
}
