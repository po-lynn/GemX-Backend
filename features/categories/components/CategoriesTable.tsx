"use client"

import Link from "next/link"
import type { CategoryRow } from "@/features/categories/db/categories"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Pencil } from "lucide-react"

type Props = {
  categories: CategoryRow[]
}

export function CategoriesTable({ categories }: Props) {
  const loose = categories.filter((c) => c.type === "loose_stone")
  const jewellery = categories.filter((c) => c.type === "jewellery")

  return (
    <div className="rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead className="w-24">Order</TableHead>
            <TableHead className="w-20" >Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loose.length === 0 && jewellery.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground text-center py-8">
                No categories yet. Add one to use in products.
              </TableCell>
            </TableRow>
          ) : (
            <>
              {loose.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">Loose stone</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-sm">{c.slug}</TableCell>
                  <TableCell>{c.sortOrder}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" asChild>
                      <Link href={`/admin/categories/${c.id}/edit`}>
                        <Pencil className="size-4" />
                        <span className="sr-only">Edit</span>
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {jewellery.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">Jewellery</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-sm">{c.slug}</TableCell>
                  <TableCell>{c.sortOrder}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" asChild>
                      <Link href={`/admin/categories/${c.id}/edit`}>
                        <Pencil className="size-4" />
                        <span className="sr-only">Edit</span>
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
