"use client";

import Image from "next/image";
import { format, parseISO, startOfDay, endOfDay, isValid } from "date-fns";
import { ArrowRight, Check, Flag, Loader2, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ELLIPSIS_NEXT,
  ELLIPSIS_PREV,
  getPageNumbers,
} from "@/lib/pagination";
import DatePicker from "@/components/date-picker/date-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  deleteMessageAction,
  setMessageStarredAction,
} from "@/features/messages/actions/messages";
import type { MessageRow } from "@/features/messages/db/messages";
import { cn } from "@/lib/utils";

type TabKey = "all" | "active" | "flagged" | "deleted";

type ParticipantOption = { id: string; name: string };

type Props = {
  messages: MessageRow[];
  participants: ParticipantOption[];
  page: number;
  pageSize: number;
};

function displayName(name: string | null | undefined) {
  const n = name?.trim();
  return n || "Unknown user";
}

function userHandle(m: {
  displayUsername: string | null;
  username: string | null;
}) {
  const h = m.displayUsername?.trim() || m.username?.trim();
  return h ? `@${h}` : "@user";
}

function messagePreview(m: MessageRow): string {
  if (m.messageType === "image")
    return m.content?.trim() ? m.content.trim().slice(0, 100) : "Photo";
  if (m.messageType === "audio") return "Voice message";
  if (m.messageType === "file") return "Attachment";
  const t = (m.content || "").trim();
  return t ? t.slice(0, 120) : "—";
}

function parseDayStart(isoDate: string): Date | undefined {
  if (!isoDate.trim()) return undefined;
  try {
    const d = startOfDay(parseISO(isoDate.trim()));
    return isValid(d) ? d : undefined;
  } catch {
    return undefined;
  }
}

function parseDayEnd(isoDate: string): Date | undefined {
  if (!isoDate.trim()) return undefined;
  try {
    const d = endOfDay(parseISO(isoDate.trim()));
    return isValid(d) ? d : undefined;
  } catch {
    return undefined;
  }
}

function tabFilter(m: MessageRow, tab: TabKey): boolean {
  if (tab === "all") return true;
  if (tab === "active") return !m.starred;
  if (tab === "flagged") return Boolean(m.starred);
  if (tab === "deleted") return false;
  return true;
}

export function MessagesAdminPanel({
  messages,
  participants,
  page,
  pageSize,
}: Props) {
  const router = useRouter();
  const basePath = "/admin/messages";

  const goPageOne = useCallback(() => {
    router.replace(`${basePath}?page=1`, { scroll: false });
  }, [router]);
  const [tab, setTab] = useState<TabKey>("all");
  const [draftSearch, setDraftSearch] = useState("");
  const [draftFrom, setDraftFrom] = useState("");
  const [draftTo, setDraftTo] = useState("");
  const [draftStatus, setDraftStatus] = useState<TabKey | "">("");
  const [draftUserId, setDraftUserId] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [appliedFrom, setAppliedFrom] = useState("");
  const [appliedTo, setAppliedTo] = useState("");
  const [appliedUserId, setAppliedUserId] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const n = messages.length;
    const starred = messages.filter((m) => m.starred).length;
    const active = messages.filter((m) => !m.starred).length;
    return { all: n, active, flagged: starred, deleted: 0 };
  }, [messages]);

  const filtered = useMemo(() => {
    const fromD = parseDayStart(appliedFrom);
    const toD = parseDayEnd(appliedTo);
    return messages.filter((m) => {
      if (!tabFilter(m, tab)) return false;
      if (appliedSearch.trim()) {
        const q = appliedSearch.trim().toLowerCase();
        if (!m.content.toLowerCase().includes(q)) return false;
      }
      const created = new Date(m.createdAt).getTime();
      if (fromD && created < fromD.getTime()) return false;
      if (toD && created > toD.getTime()) return false;
      if (appliedUserId && m.senderId !== appliedUserId && m.recipientId !== appliedUserId)
        return false;
      return true;
    });
  }, [messages, tab, appliedSearch, appliedFrom, appliedTo, appliedUserId]);

  const totalFiltered = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize) || 1);
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );
  const pageNumbers = getPageNumbers(safePage, totalPages);

  useEffect(() => {
    if (page !== safePage) {
      router.replace(`${basePath}?page=${safePage}`, { scroll: false });
    }
  }, [page, safePage, router]);

  const pageLink = useCallback(
    (p: number) => `${basePath}?page=${p}`,
    []
  );

  const applyFilters = useCallback(() => {
    setAppliedSearch(draftSearch);
    setAppliedFrom(draftFrom);
    setAppliedTo(draftTo);
    setAppliedUserId(draftUserId);
    if (draftStatus && draftStatus !== "") setTab(draftStatus as TabKey);
    goPageOne();
  }, [draftSearch, draftFrom, draftTo, draftUserId, draftStatus, goPageOne]);

  const clearFilters = useCallback(() => {
    setDraftSearch("");
    setDraftFrom("");
    setDraftTo("");
    setDraftStatus("");
    setDraftUserId("");
    setAppliedSearch("");
    setAppliedFrom("");
    setAppliedTo("");
    setAppliedUserId("");
    setTab("all");
    goPageOne();
  }, [goPageOne]);

  async function toggleStar(id: string, nextStarred: boolean) {
    setBusyId(id);
    const form = new FormData();
    form.set("id", id);
    form.set("starred", nextStarred ? "true" : "false");
    const res = await setMessageStarredAction(form);
    setBusyId(null);
    if (res?.error) alert(res.error);
    else router.refresh();
  }

  async function removeMessage(id: string) {
    if (!confirm("Permanently delete this message?")) return;
    setBusyId(id);
    const form = new FormData();
    form.set("id", id);
    const res = await deleteMessageAction(form);
    setBusyId(null);
    if (res?.error) alert(res.error);
    else router.refresh();
  }

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: "all", label: "All Messages", count: counts.all },
    { key: "active", label: "Active", count: counts.active },
    { key: "flagged", label: "Flagged", count: counts.flagged },
    { key: "deleted", label: "Deleted", count: counts.deleted },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_min(100%,320px)] lg:items-start">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap gap-1 border-b border-border">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setTab(t.key);
                setDraftStatus(t.key === "deleted" ? "" : t.key);
                goPageOne();
              }}
              className={cn(
                "relative -mb-px px-4 py-2.5 text-sm font-medium transition-colors",
                tab === t.key
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}{" "}
              <span className="tabular-nums text-muted-foreground">({t.count})</span>
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="h-11 px-4 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Sender
                  </th>
                  <th className="h-11 w-10 px-0 text-center text-muted-foreground" aria-hidden />
                  <th className="h-11 px-4 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Receiver
                  </th>
                  <th className="h-11 px-4 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Message
                  </th>
                  <th className="h-11 px-4 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Date &amp; time
                  </th>
                  <th className="h-11 px-4 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Status
                  </th>
                  <th className="h-11 px-4 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {tab === "deleted" ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                      No soft-deleted messages. Removed messages leave this list permanently.
                    </td>
                  </tr>
                ) : totalFiltered === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                      No messages match the current filters.
                    </td>
                  </tr>
                ) : (
                  pageRows.map((m) => {
                    const starred = Boolean(m.starred);
                    const busy = busyId === m.id;
                    const created = new Date(m.createdAt);
                    return (
                      <tr
                        key={m.id}
                        role="link"
                        tabIndex={0}
                        className="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        onClick={() => router.push(`/admin/messages/${m.id}/edit`)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            router.push(`/admin/messages/${m.id}/edit`);
                          }
                        }}
                      >
                        <td className="px-4 py-3 align-middle">
                          <div className="flex items-center gap-3">
                            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted">
                              {m.senderImage ? (
                                <Image
                                  src={m.senderImage}
                                  alt=""
                                  fill
                                  className="object-cover"
                                  sizes="40px"
                                  unoptimized={
                                    m.senderImage.startsWith("blob:") ||
                                    m.senderImage.startsWith("data:")
                                  }
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-xs font-medium text-muted-foreground">
                                  {displayName(m.senderName).slice(0, 1)}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate font-medium leading-tight">
                                {displayName(m.senderName)}
                              </div>
                              <div className="truncate text-xs text-muted-foreground">
                                {userHandle({
                                  displayUsername: m.senderDisplayUsername,
                                  username: m.senderUsername,
                                })}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-0 py-3 text-center align-middle text-muted-foreground">
                          <ArrowRight className="mx-auto size-4" aria-hidden />
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <div className="flex items-center gap-3">
                            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted">
                              {m.recipientImage ? (
                                <Image
                                  src={m.recipientImage}
                                  alt=""
                                  fill
                                  className="object-cover"
                                  sizes="40px"
                                  unoptimized={
                                    m.recipientImage.startsWith("blob:") ||
                                    m.recipientImage.startsWith("data:")
                                  }
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-xs font-medium text-muted-foreground">
                                  {displayName(m.recipientName).slice(0, 1)}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate font-medium leading-tight">
                                {displayName(m.recipientName)}
                              </div>
                              <div className="truncate text-xs text-muted-foreground">
                                {userHandle({
                                  displayUsername: m.recipientDisplayUsername,
                                  username: m.recipientUsername,
                                })}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="max-w-[240px] px-4 py-3 align-middle">
                          <p className="line-clamp-2 text-muted-foreground">{messagePreview(m)}</p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 align-middle text-muted-foreground">
                          <div className="text-xs leading-tight">
                            {format(created, "MMM d, yyyy")}
                          </div>
                          <div className="text-xs leading-tight">
                            {format(created, "h:mm a")}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-middle">
                          {starred ? (
                            <Badge className="border-0 bg-amber-500/15 text-amber-800 hover:bg-amber-500/20 dark:text-amber-200">
                              Flagged
                            </Badge>
                          ) : (
                            <Badge className="border-0 bg-emerald-500/15 text-emerald-800 hover:bg-emerald-500/20 dark:text-emerald-200">
                              Active
                            </Badge>
                          )}
                        </td>
                        <td
                          className="px-4 py-3 text-right align-middle"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-0.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9"
                              disabled={busy}
                              title={starred ? "Clear flag" : "Flag for review"}
                              onClick={(e) => {
                                e.stopPropagation();
                                void toggleStar(m.id, !starred);
                              }}
                            >
                              {busy ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : starred ? (
                                <Check className="size-4 text-emerald-600" />
                              ) : (
                                <Flag className="size-4 text-amber-600" />
                              )}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 text-destructive hover:text-destructive"
                              disabled={busy}
                              title="Delete"
                              onClick={(e) => {
                                e.stopPropagation();
                                void removeMessage(m.id);
                              }}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {totalFiltered > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Page {safePage} of {totalPages}
              <span className="ml-2">
                (showing {pageRows.length} of {totalFiltered})
              </span>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {safePage <= 1 ? (
                <Button variant="outline" size="sm" disabled>
                  Previous
                </Button>
              ) : (
                <Button variant="outline" size="sm" asChild>
                  <Link href={pageLink(safePage - 1)} scroll={false}>
                    Previous
                  </Link>
                </Button>
              )}
              {pageNumbers.map((pNum) =>
                pNum === ELLIPSIS_PREV || pNum === ELLIPSIS_NEXT ? (
                  <span key={pNum} className="px-1 text-muted-foreground">
                    …
                  </span>
                ) : (
                  <Button
                    key={pNum}
                    variant={pNum === safePage ? "default" : "outline"}
                    size="sm"
                    asChild
                  >
                    <Link href={pageLink(pNum)} scroll={false}>
                      {pNum}
                    </Link>
                  </Button>
                )
              )}
              {safePage >= totalPages ? (
                <Button variant="outline" size="sm" disabled>
                  Next
                </Button>
              ) : (
                <Button variant="outline" size="sm" asChild>
                  <Link href={pageLink(safePage + 1)} scroll={false}>
                    Next
                  </Link>
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Search &amp; filter</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="msg-search">
                Search messages
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="msg-search"
                  value={draftSearch}
                  onChange={(e) => setDraftSearch(e.target.value)}
                  placeholder="Search…"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <div className="space-y-2">
                <span className="text-xs font-medium text-muted-foreground">From date</span>
                <DatePicker
                  value={draftFrom}
                  onSelect={(d) => setDraftFrom(d ? format(d, "yyyy-MM-dd") : "")}
                  placeholder="Pick date"
                  className="w-full max-w-full"
                />
              </div>
              <div className="space-y-2">
                <span className="text-xs font-medium text-muted-foreground">To date</span>
                <DatePicker
                  value={draftTo}
                  onSelect={(d) => setDraftTo(d ? format(d, "yyyy-MM-dd") : "")}
                  placeholder="Pick date"
                  className="w-full max-w-full"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="msg-status">
                Status
              </label>
              <select
                id="msg-status"
                value={draftStatus || ""}
                onChange={(e) => setDraftStatus(e.target.value as TabKey | "")}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">All status</option>
                <option value="all">All messages</option>
                <option value="active">Active</option>
                <option value="flagged">Flagged</option>
                <option value="deleted">Deleted</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="msg-user">
                Users
              </label>
              <select
                id="msg-user"
                value={draftUserId}
                onChange={(e) => setDraftUserId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">All users</option>
                {participants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <Button type="button" className="w-full" onClick={applyFilters}>
              Apply filters
            </Button>
            <Button type="button" variant="outline" className="w-full" onClick={clearFilters}>
              Clear filters
            </Button>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
