"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import type { CategoryTreeNode } from "@/features/categories/db/categories"
import { deleteCategoryAction } from "@/features/categories/actions/categories"
import { Pencil, Trash2 } from "lucide-react"

type Props = {
  categories: CategoryTreeNode[]
}

function CategoryRow({
  router,
  node,
  depth,
}: {
  router: ReturnType<typeof useRouter>
  node: CategoryTreeNode
  depth: number
}) {
  async function handleDelete() {
    if (!confirm(`Delete "${node.name}" and all subcategories?`)) return
    const form = new FormData()
    form.set("categoryId", node.id)
    const result = await deleteCategoryAction(form)
    if (result?.error) {
      alert(result.error)
    } else {
      router.refresh()
    }
  }

  return (
    <>
      <tr className="border-b transition-colors hover:bg-muted/50">
        <td className="px-4 py-3" style={{ paddingLeft: `${depth * 20 + 16}px` }}>
          <span className="font-medium">{node.name}</span>
          <span className="ml-2 text-muted-foreground text-sm">
            /{node.slug}
          </span>
        </td>
        <td className="px-4 py-3 text-muted-foreground text-sm">
          {node.isLeaf ? "Leaf" : `${node.children.length} subcategories`}
        </td>
        <td className="px-4 py-3">
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" asChild>
              <Link href={`/admin/categories/${node.id}/edit`}>
                <Pencil className="size-4" />
                <span className="sr-only">Edit</span>
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDelete}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="size-4" />
              <span className="sr-only">Delete</span>
            </Button>
          </div>
        </td>
      </tr>
      {node.children.map((child) => (
        <CategoryRow
          key={child.id}
          router={router}
          node={child}
          depth={depth + 1}
        />
      ))}
    </>
  )
}

export function CategoriesTable({ categories }: Props) {
  const router = useRouter()
  return (
    <table className="w-full">
      <thead>
        <tr className="border-b">
          <th className="px-4 py-3 text-left text-sm font-medium">Category</th>
          <th className="px-4 py-3 text-left text-sm font-medium">Type</th>
          <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
        </tr>
      </thead>
      <tbody>
        {categories.map((node) => (
          <CategoryRow key={node.id} router={router} node={node} depth={0} />
        ))}
      </tbody>
    </table>
  )
}
