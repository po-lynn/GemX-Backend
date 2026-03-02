"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { UserRow } from "@/features/users/db/users";
import { deleteUserAction } from "@/features/users/actions/users";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/formatters";
import { Pencil, Trash2, ChevronUp } from "lucide-react";

const ELLIPSIS_PREV = -1;
const ELLIPSIS_NEXT = -2;

export type UserTableFilters = { country?: string; state?: string; city?: string };

function buildQueryString(page: number, filters: UserTableFilters): string {
  const sp = new URLSearchParams();
  sp.set("page", String(page));
  if (filters.country?.trim()) sp.set("country", filters.country.trim());
  if (filters.state?.trim()) sp.set("state", filters.state.trim());
  if (filters.city?.trim()) sp.set("city", filters.city.trim());
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
  users: UserRow[];
  page: number;
  totalPages: number;
  total: number;
  filters?: UserTableFilters;
};

export function UsersTable({ users, page, totalPages, total, filters = {} }: Props) {
  const router = useRouter();
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  function openDeleteDialog(id: string, name: string) {
    setDeleteTarget({ id, name });
  }

  function closeDeleteDialog() {
    if (!deleting) setDeleteTarget(null);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const form = new FormData();
    form.set("userId", deleteTarget.id);
    const result = await deleteUserAction(form);
    setDeleting(false);
    setDeleteTarget(null);
    if (result?.error) {
      alert(result.error);
    } else {
      router.refresh();
    }
  }

  const base = "/admin/users";
  const query = (p: number) => buildQueryString(p, filters);
  const pageNumbers = getPageNumbers(page, totalPages);

  return (
    <>
      <div className="overflow-x-auto rounded-none border border-border">
        <Table>
          <TableHeader>
            <TableRow className="border-0 hover:bg-transparent">
              <TableHead className="border-r border-white/20 bg-gray-800 px-3 py-3 text-center text-sm font-semibold text-white">
                <span className="inline-flex items-center gap-1">
                  ID
                  <ChevronUp className="size-3.5" aria-hidden />
                </span>
              </TableHead>
              <TableHead className="border-r border-white/20 bg-gray-800 px-3 py-3 text-center text-sm font-semibold text-white">
                Name
              </TableHead>
              <TableHead className="border-r border-white/20 bg-gray-800 px-3 py-3 text-center text-sm font-semibold text-white">
                Email
              </TableHead>
              <TableHead className="border-r border-white/20 bg-gray-800 px-3 py-3 text-center text-sm font-semibold text-white">
                Group
              </TableHead>
              <TableHead className="border-r border-white/20 bg-gray-800 px-3 py-3 text-center text-sm font-semibold text-white">
                Phone
              </TableHead>
              <TableHead className="border-r border-white/20 bg-gray-800 px-3 py-3 text-center text-sm font-semibold text-white">
                Country
              </TableHead>
              <TableHead className="border-r border-white/20 bg-gray-800 px-3 py-3 text-center text-sm font-semibold text-white">
                State / Province
              </TableHead>
              <TableHead className="border-r border-white/20 bg-gray-800 px-3 py-3 text-center text-sm font-semibold text-white">
                Customer Since
              </TableHead>
              <TableHead className="border-r border-white/20 bg-gray-800 px-3 py-3 text-center text-sm font-semibold text-white">
                Confirmed email
              </TableHead>
              <TableHead className="bg-gray-800 px-3 py-3 text-center text-sm font-semibold text-white">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={10}
                  className="text-muted-foreground py-8 text-center"
                >
                  No users yet.
                </TableCell>
              </TableRow>
            ) : (
              users.map((u, index) => (
                <TableRow
                  key={u.id}
                  className={`border-b border-border/50 ${index % 2 === 1 ? "bg-[#f5f5f5]" : ""}`}
                >
                  <TableCell className="border-r border-border/40 px-3 py-2.5 text-left text-sm">
                    {u.id.slice(0, 8)}
                  </TableCell>
                  <TableCell className="border-r border-border/40 px-3 py-2.5 text-left text-sm font-medium">
                    {u.name}
                  </TableCell>
                  <TableCell className="border-r border-border/40 px-3 py-2.5 text-left text-sm">
                    {u.email}
                  </TableCell>
                  <TableCell className="border-r border-border/40 px-3 py-2.5 text-left text-sm">
                    {u.role}
                  </TableCell>
                  <TableCell className="border-r border-border/40 px-3 py-2.5 text-left text-sm">
                    {u.phone ?? "—"}
                  </TableCell>
                  <TableCell className="border-r border-border/40 px-3 py-2.5 text-left text-sm">
                    {u.country ?? "—"}
                  </TableCell>
                  <TableCell className="border-r border-border/40 px-3 py-2.5 text-left text-sm">
                    {u.state ?? "—"}
                  </TableCell>
                  <TableCell className="border-r border-border/40 px-3 py-2.5 text-left text-sm text-muted-foreground">
                    {u.createdAt ? formatDate(u.createdAt) : "—"}
                  </TableCell>
                  <TableCell className="border-r border-border/40 px-3 py-2.5 text-left text-sm">
                    {u.emailVerified ? "Confirmed" : "Confirmation Not Required"}
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/admin/users/${u.id}/edit`}>
                          <Pencil className="size-4" />
                          <span className="sr-only">Edit</span>
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDeleteDialog(u.id, u.name)}
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

      {(totalPages >= 1 || users.length > 0) && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <p className="text-muted-foreground text-sm">
            Page {page} of {totalPages || 1}
            {total > 0 && (
              <span className="ml-2">
                (showing {users.length} of {total})
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
            <DialogTitle>Delete user</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the user &quot;{deleteTarget?.name}
              &quot;? This cannot be undone.
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
