"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Image from "next/image";
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
import { Input } from "../../../components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";

const ELLIPSIS_PREV = -1;
const ELLIPSIS_NEXT = -2;

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

function UserPhotoCell({ imageUrl }: { imageUrl: string | null | undefined }) {
  const [loadError, setLoadError] = useState(false);
  const showImg = imageUrl && !loadError;
  return (
    <div className="flex justify-center">
      {showImg ? (
        <Image
          src={imageUrl}
          alt=""
          width={44}
          height={44}
          className="h-11 w-11 shrink-0 rounded-lg object-cover ring-1 ring-border/50"
          onError={() => setLoadError(true)}
        />
      ) : (
        <span
          className="text-muted-foreground flex items-center justify-center h-11 w-11 shrink-0 rounded-lg object-cover ring-1 ring-border/50"
          aria-hidden
        >
          —
        </span>
      )}
    </div>
  );
}

const TRUNCATE_TOKEN_LEN = 24;
const SUGGEST_DEBOUNCE_MS = 300;

type Props = {
  users: UserRow[];
  page: number;
  totalPages: number;
  total: number;
  /** Current search query from URL (for initial input and pagination links). */
  searchQuery?: string;
  /** Push device tokens per user id (from getPushTokensByUserIds). */
  pushTokensByUserId?: Record<string, { token: string; platform: string | null }[]>;
};

export function UsersTable({
  users,
  page,
  totalPages,
  total,
  searchQuery = "",
  pushTokensByUserId = {},
}: Props) {
  const router = useRouter();
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [inputValue, setInputValue] = useState(searchQuery);
  const [suggestions, setSuggestions] = useState<UserRow[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const suggestAbortRef = useRef<AbortController | null>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    const q = inputValue.trim();
    if (!q) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const t = setTimeout(() => {
      suggestAbortRef.current?.abort();
      suggestAbortRef.current = new AbortController();
      setSuggestLoading(true);
      fetch(`/api/admin/users/suggest?q=${encodeURIComponent(q)}`, {
        signal: suggestAbortRef.current.signal,
      })
        .then((r) => r.json())
        .then((data: { users?: UserRow[] }) => {
          setSuggestions(data.users ?? []);
          setShowSuggestions(true);
        })
        .catch(() => {
          setSuggestions([]);
        })
        .finally(() => setSuggestLoading(false));
    }, SUGGEST_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [inputValue]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const base = "/admin/users";
  const pageLink = useCallback(
    (p: number) => {
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      params.set("page", String(p));
      return `${base}?${params.toString()}`;
    },
    [searchQuery]
  );

  function handleSearchSubmit() {
    const q = inputValue.trim();
    router.push(q ? `${base}?search=${encodeURIComponent(q)}&page=1` : base);
    setShowSuggestions(false);
  }

  function handleSuggestionClick(u: UserRow) {
    const q = [u.name, u.email, u.phone, u.country].filter(Boolean).join(" ").trim() || u.name;
    setInputValue(q);
    router.push(`${base}?search=${encodeURIComponent(q)}&page=1`);
    setShowSuggestions(false);
  }

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

  const pageNumbers = getPageNumbers(page, totalPages);

  return (
    <>
      <div ref={searchWrapRef} className="relative mb-4 flex flex-wrap items-center gap-2">
        <Input
          type="search"
          placeholder="Search by name, email, phone, country"
          value={inputValue}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setInputValue(e.target.value)
          }
          onFocus={() =>
            inputValue.trim() && setShowSuggestions(suggestions.length > 0)
          }
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) =>
            e.key === "Enter" && handleSearchSubmit()
          }
          className="max-w-sm"
        />
        <Button type="button" onClick={handleSearchSubmit}>
          Search
        </Button>
        {showSuggestions && (suggestions.length > 0 || suggestLoading) && (
          <ul
            className="absolute left-0 top-full z-10 mt-1 max-h-60 w-full max-w-sm overflow-auto rounded-md border border-border bg-popover py-1 text-popover-foreground shadow-md"
            role="listbox"
          >
            {suggestLoading ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">Loading…</li>
            ) : (
              suggestions.map((u) => (
                <li
                  key={u.id}
                  role="option"
                  aria-selected={false}
                  className="cursor-pointer px-3 py-2 text-sm hover:bg-accent"
                  onMouseDown={(e: React.MouseEvent<HTMLLIElement>) => {
                    e.preventDefault();
                    handleSuggestionClick(u);
                  }}
                >
                  <span className="font-medium">{u.name}</span>
                  {u.email && (
                    <span className="text-muted-foreground ml-2">{u.email}</span>
                  )}
                  {u.phone && (
                    <span className="text-muted-foreground ml-2">{u.phone}</span>
                  )}
                  {u.country && (
                    <span className="text-muted-foreground ml-2">{u.country}</span>
                  )}
                </li>
              ))
            )}
          </ul>
        )}
      </div>
      <div className="overflow-x-auto rounded-none border border-border">
        <Table>
          <TableHeader>
            <TableRow className="border-0 hover:bg-transparent">
              <TableHead className="border-r border-white/20 bg-gray-800 px-3 py-3 text-center text-sm font-semibold text-white">
                Photo
              </TableHead>
              <TableHead className="border-r border-white/20 bg-gray-800 px-3 py-3 text-center text-sm font-semibold text-white">
                Name
              </TableHead>
              <TableHead className="border-r border-white/20 bg-gray-800 px-3 py-3 text-center text-sm font-semibold text-white">
                Email
              </TableHead>
              <TableHead className="border-r border-white/20 bg-gray-800 px-3 py-3 text-center text-sm font-semibold text-white">
                Role
              </TableHead>
              <TableHead className="border-r border-white/20 bg-gray-800 px-3 py-3 text-center text-sm font-semibold text-white">
                Phone
              </TableHead>
              <TableHead className="border-r border-white/20 bg-gray-800 px-3 py-3 text-center text-sm font-semibold text-white">
                Country
              </TableHead>
              <TableHead className="bg-gray-800 px-3 py-3 text-center text-sm font-semibold text-white">
                Push token
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
                  colSpan={8}
                  className="text-muted-foreground py-8 text-center"
                >
                  No users yet.
                </TableCell>
              </TableRow>
            ) : (
              users.map((u, index) => (
                <TableRow
                  key={u.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push(`${base}/${u.id}/edit`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(`${base}/${u.id}/edit`);
                    }
                  }}
                  className={`cursor-pointer border-b border-border/50 transition-colors last:border-0 hover:bg-muted/50 ${
                    index % 2 === 1 ? "bg-[#f5f5f5]" : ""
                  }`}
                >
                  <TableCell className="border-r border-border/40 px-3 py-2.5">
                    <UserPhotoCell imageUrl={u.image} />
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
                  <TableCell className="border-r border-border/40 px-3 py-2.5 text-left text-sm font-mono text-muted-foreground">
                    {(() => {
                      const tokens = pushTokensByUserId[u.id];
                      if (!tokens?.length) return "—";
                      const first = tokens[0];
                      const truncated =
                        first.token.length > TRUNCATE_TOKEN_LEN
                          ? `${first.token.slice(0, TRUNCATE_TOKEN_LEN)}…`
                          : first.token;
                      return tokens.length === 1 ? (
                        <span title={first.token}>{truncated}</span>
                      ) : (
                        <span title={tokens.map((t) => t.token).join("\n")}>
                          {truncated} (+{tokens.length - 1})
                        </span>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={(e) => {
                          // Prevent row navigation when clicking delete.
                          e.stopPropagation();
                          openDeleteDialog(u.id, u.name);
                        }}
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
                <Link href={pageLink(page - 1)}>Previous</Link>
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
                  <Link href={pageLink(p)}>{p}</Link>
                </Button>
              )
            )}
            {page >= totalPages ? (
              <Button variant="outline" size="sm" disabled>
                Next
              </Button>
            ) : (
              <Button variant="outline" size="sm" asChild>
                <Link href={pageLink(page + 1)}>Next</Link>
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
