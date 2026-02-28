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
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="w-20">Points</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Gender</TableHead>
              <TableHead className="w-20">Verified</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-muted-foreground text-center py-8"
                >
                  No users yet.
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{u.role}</Badge>
                  </TableCell>
                  <TableCell className="tabular-nums">{u.points}</TableCell>
                  <TableCell>{u.phone ?? "—"}</TableCell>
                  <TableCell>{u.gender ?? "—"}</TableCell>
                  <TableCell>
                    {u.role === "user" ? (
                      <Badge variant={u.verified ? "default" : "secondary"}>
                        {u.verified ? "Verified" : "—"}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
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
