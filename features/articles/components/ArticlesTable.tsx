"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ArticleRow } from "@/features/articles/db/articles";
import { deleteArticleAction } from "@/features/articles/actions/articles";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pencil, Trash2 } from "lucide-react";

const ELLIPSIS_PREV = -1;
const ELLIPSIS_NEXT = -2;

function buildQueryString(page: number): string {
  const sp = new URLSearchParams();
  sp.set("page", String(page));
  return sp.toString();
}

function getPageNumbers(page: number, totalPages: number): number[] {
  if (totalPages <= 1) return [];
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages: number[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  if (start > 2) pages.push(ELLIPSIS_PREV);
  for (let i = start; i <= end; i++) if (!pages.includes(i)) pages.push(i);
  if (end < totalPages - 1) pages.push(ELLIPSIS_NEXT);
  pages.push(totalPages);
  return pages;
}

type Props = {
  articles: ArticleRow[];
  page: number;
  totalPages: number;
  total: number;
};

export function ArticlesTable({ articles: items, page, totalPages, total }: Props) {
  const router = useRouter();
  const base = "/admin/articles";
  const query = (p: number) => buildQueryString(p);
  const pageNumbers = getPageNumbers(page, totalPages);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  function openDeleteDialog(id: string, title: string) {
    setDeleteTarget({ id, title });
  }

  function closeDeleteDialog() {
    if (!deleting) setDeleteTarget(null);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const form = new FormData();
    form.set("articleId", deleteTarget.id);
    const result = await deleteArticleAction(form);
    setDeleting(false);
    setDeleteTarget(null);
    if (result?.error) {
      alert(result.error);
    } else {
      router.refresh();
    }
  }

  return (
    <>
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Author</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Publish date</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-muted-foreground text-center py-8"
                >
                  No articles yet. Create one to get started.
                </TableCell>
              </TableRow>
            ) : (
              items.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.title}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {row.author || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        row.status === "published" ? "default" : "secondary"
                      }
                    >
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {row.publishDate
                      ? new Date(row.publishDate).toLocaleString()
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/admin/articles/${row.id}/edit`}>
                          <Pencil className="size-4" />
                          <span className="sr-only">Edit</span>
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDeleteDialog(row.id, row.title)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {(totalPages >= 1 || items.length > 0) && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <p className="text-muted-foreground text-sm">
            Page {page} of {totalPages || 1}
            {total > 0 && (
              <span className="ml-2">
                (showing {items.length} of {total})
              </span>
            )}
          </p>
          <div className="flex items-center gap-2">
            {page <= 1 ? (
              <Button variant="outline" size="sm" disabled>
                Previous
              </Button>
            ) : (
              <Button variant="outline" size="sm" asChild>
                <Link href={`${base}?${query(page - 1)}`}>Previous</Link>
              </Button>
            )}
            {pageNumbers.map((p) =>
              p === ELLIPSIS_PREV || p === ELLIPSIS_NEXT ? (
                <span key={p} className="px-1 text-muted-foreground">
                  …
                </span>
              ) : (
                <Button
                  key={p}
                  variant={p === page ? "default" : "outline"}
                  size="sm"
                  asChild
                >
                  <Link href={`${base}?${query(p)}`}>{p}</Link>
                </Button>
              )
            )}
            {page >= totalPages ? (
              <Button variant="outline" size="sm" disabled>
                Next
              </Button>
            ) : (
              <Button variant="outline" size="sm" asChild>
                <Link href={`${base}?${query(page + 1)}`}>Next</Link>
              </Button>
            )}
          </div>
        </div>
      )}

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && closeDeleteDialog()}
      >
        <DialogContent showCloseButton={!deleting}>
          <DialogHeader>
            <DialogTitle>Delete article</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.title}&quot;?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeDeleteDialog}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
