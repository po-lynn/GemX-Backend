"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { ELLIPSIS_NEXT, ELLIPSIS_PREV, getPageNumbers } from "@/lib/pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImageViewer } from "@/components/shared/ImageViewer";
import { cn } from "@/lib/utils";
import type {
  AdminConversationListItem,
  AdminConversationParticipant,
} from "@/features/chat/db/admin-all-conversations";

type ThreadMessage = {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  fileUrl: string | null;
  imageUrls: string[] | null;
  messageType: string;
  createdAt: string;
};

type Props = {
  conversations: AdminConversationListItem[];
  page: number;
  pageSize: number;
  total: number;
};

function initials(name: string) {
  const p = name.trim().split(/\s+/);
  if (p.length >= 2) return (p[0]![0]! + p[1]![0]!).toUpperCase();
  return name.slice(0, 2).toUpperCase() || "?";
}

function relativeTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min`;
  if (hrs < 24) return `${hrs}h ago`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

function formatMessageTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function Avatar({ p, size }: { p: AdminConversationParticipant; size: number }) {
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-full bg-primary/15 ring-1 ring-border"
      style={{ width: size, height: size }}
    >
      {p.image ? (
        <Image
          src={p.image}
          alt=""
          fill
          className="object-cover"
          sizes={`${size}px`}
          unoptimized={p.image.startsWith("blob:") || p.image.startsWith("data:")}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-primary">
          {initials(p.name)}
        </div>
      )}
    </div>
  );
}

function messagePreview(m: ThreadMessage): string {
  const imgs = m.imageUrls ?? [];
  if (m.messageType === "image" || imgs.length > 0) return imgs.length > 1 ? `${imgs.length} photos` : "Photo";
  if (m.messageType === "audio") return "Voice message";
  if (m.fileUrl) return "Attachment";
  return m.content || "";
}

export function AdminAllConversationsView({ conversations, page, pageSize, total }: Props) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AdminConversationListItem | null>(null);
  const [thread, setThread] = useState<ThreadMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ images: string[]; index: number } | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const pageNumbers = getPageNumbers(page, totalPages);
  const pageLink = (p: number) => `/admin/chat-dashboard?page=${p}`;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((item) => {
      const [a, b] = item.participants;
      return a.name.toLowerCase().includes(q) || b.name.toLowerCase().includes(q);
    });
  }, [conversations, search]);

  async function selectConversation(item: AdminConversationListItem) {
    setSelected(item);
    setThread([]);
    setError(null);
    setLoading(true);
    try {
      const [userA, userB] = item.participants;
      const params = new URLSearchParams({ userA: userA.id, userB: userB.id, page: "1", limit: "200" });
      const res = await fetch(`/api/admin/chat/all-conversations/messages?${params}`, {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Failed to load messages");
      setThread(Array.isArray((data as { messages?: ThreadMessage[] }).messages) ? (data as { messages: ThreadMessage[] }).messages : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load messages");
    } finally {
      setLoading(false);
    }
  }

  const participantById = useMemo(() => {
    const map = new Map<string, AdminConversationParticipant>();
    if (selected) {
      map.set(selected.participants[0].id, selected.participants[0]);
      map.set(selected.participants[1].id, selected.participants[1]);
    }
    return map;
  }, [selected]);

  return (
    <div className="flex h-[calc(100vh-9rem)] max-h-[720px] min-h-[480px] overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {/* Left: all conversations */}
      <div className="flex w-full max-w-[360px] shrink-0 flex-col border-r border-border bg-muted/30">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold tracking-tight">All conversations</h2>
          <span className="text-xs text-muted-foreground">{total}</span>
        </div>
        <div className="border-b border-border px-3 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search this page…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 rounded-lg border-border bg-background pl-9 pr-8 text-sm"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {filtered.map((row, idx) => {
            const [a, b] = row.participants;
            const isSelected =
              selected &&
              selected.participants[0].id === a.id &&
              selected.participants[1].id === b.id;
            return (
              <button
                key={`${a.id}:${b.id}:${idx}`}
                type="button"
                onClick={() => void selectConversation(row)}
                className={cn(
                  "mb-1 flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                  isSelected ? "bg-[#e8e8e8]" : "hover:bg-muted/80"
                )}
              >
                <div className="relative h-11 w-11 shrink-0">
                  <Avatar p={a} size={44} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="truncate font-medium leading-tight">
                      {a.name} <span className="font-normal text-muted-foreground">↔</span> {b.name}
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {relativeTime(row.lastMessageTime)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {row.lastMessage || "—"}
                  </p>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No conversations match your search.
            </p>
          )}
        </div>
        {totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-center gap-1 border-t border-border px-2 py-2">
            {page <= 1 ? (
              <Button variant="outline" size="sm" disabled>
                Prev
              </Button>
            ) : (
              <Button variant="outline" size="sm" asChild>
                <Link href={pageLink(page - 1)} scroll={false}>
                  Prev
                </Link>
              </Button>
            )}
            {pageNumbers.map((pNum) =>
              pNum === ELLIPSIS_PREV || pNum === ELLIPSIS_NEXT ? (
                <span key={pNum} className="px-1 text-xs text-muted-foreground">
                  …
                </span>
              ) : (
                <Button key={pNum} variant={pNum === page ? "default" : "outline"} size="sm" asChild>
                  <Link href={pageLink(pNum)} scroll={false}>
                    {pNum}
                  </Link>
                </Button>
              )
            )}
            {page >= totalPages ? (
              <Button variant="outline" size="sm" disabled>
                Next
              </Button>
            ) : (
              <Button variant="outline" size="sm" asChild>
                <Link href={pageLink(page + 1)} scroll={false}>
                  Next
                </Link>
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Right: read-only thread */}
      <div className="flex min-w-0 flex-1 flex-col bg-background">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          {selected ? (
            <>
              <div className="flex -space-x-2">
                <Avatar p={selected.participants[0]} size={32} />
                <Avatar p={selected.participants[1]} size={32} />
              </div>
              <div className="min-w-0">
                <div className="truncate font-semibold leading-tight">
                  {selected.participants[0].name} ↔ {selected.participants[1].name}
                </div>
                <div className="text-xs text-muted-foreground">Read-only — oversight view</div>
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">Select a conversation to view its messages</div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {loading && <p className="text-center text-sm text-muted-foreground">Loading messages…</p>}
          {error && <p className="text-center text-sm text-destructive">{error}</p>}
          {!loading && !error && selected && thread.length === 0 && (
            <p className="text-center text-sm text-muted-foreground">No messages in this conversation.</p>
          )}
          <div className="space-y-4">
            {thread.map((m) => {
              const sender = participantById.get(m.senderId);
              const alignRight = selected && m.senderId === selected.participants[1].id;
              return (
                <div key={m.id} className={cn("flex gap-2", alignRight ? "flex-row-reverse" : "flex-row")}>
                  {sender ? <Avatar p={sender} size={28} /> : null}
                  <div className={cn("flex max-w-[70%] flex-col gap-1", alignRight ? "items-end" : "items-start")}>
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {sender?.name ?? "Unknown user"}
                    </span>
                    <div
                      className={cn(
                        "rounded-2xl px-3 py-2 text-sm",
                        alignRight ? "bg-primary/10" : "bg-muted"
                      )}
                    >
                      {(() => {
                        const images =
                          m.imageUrls && m.imageUrls.length > 0
                            ? m.imageUrls
                            : m.messageType === "image" && m.fileUrl
                              ? [m.fileUrl]
                              : null
                        if (images) {
                          return (
                            <div className="mb-1 flex flex-wrap gap-1">
                              {images.map((url, i) => (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  key={url}
                                  src={url}
                                  alt=""
                                  onClick={() => setViewer({ images, index: i })}
                                  className="h-24 w-24 cursor-zoom-in rounded-lg object-cover"
                                />
                              ))}
                            </div>
                          )
                        }
                        if (m.messageType === "audio" && m.fileUrl) {
                          return <audio controls src={m.fileUrl} className="max-w-full" />
                        }
                        if (m.fileUrl && !m.content) {
                          return (
                            <a href={m.fileUrl} target="_blank" rel="noreferrer" className="underline">
                              Attachment
                            </a>
                          )
                        }
                        return null
                      })()}
                      {m.content && <p className="whitespace-pre-wrap">{m.content}</p>}
                      {!m.content && !m.fileUrl && (!m.imageUrls || m.imageUrls.length === 0) && (
                        <p className="text-muted-foreground">{messagePreview(m)}</p>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground">{formatMessageTime(m.createdAt)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {viewer && (
        <ImageViewer images={viewer.images} initialIndex={viewer.index} onClose={() => setViewer(null)} />
      )}
    </div>
  );
}
