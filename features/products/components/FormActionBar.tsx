"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronRight, ChevronLeft, Save, Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export type BreadcrumbItem = { href: string; label: string }

export type FormActionBarPagination = {
  currentIndex: number
  total: number
  prevId: string | null
  nextId: string | null
}

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "archive", label: "Archive" },
  { value: "sold", label: "Sold" },
  { value: "hidden", label: "Hidden" },
] as const

type Props = {
  breadcrumbs: BreadcrumbItem[]
  currentStatus?: string
  onStatusChange?: (value: string) => void
  saveLabel?: string
  saveLoading?: boolean
  onSave?: () => void
  discardHref?: string
  pagination?: FormActionBarPagination | null
  formId?: string
}

export function FormActionBar({
  breadcrumbs,
  currentStatus = "active",
  onStatusChange,
  saveLabel = "Save",
  saveLoading = false,
  onSave,
  discardHref = "/admin/products",
  pagination,
  formId,
}: Props) {
  const router = useRouter()

  return (
    <div className="odoo-form odoo-header">
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
        {/* Left: Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
          {breadcrumbs.map((item, i) => (
            <span key={item.href} className="flex items-center gap-1.5">
              {i > 0 && (
                <ChevronRight className="size-4 shrink-0 text-[var(--form-muted-foreground)]" aria-hidden />
              )}
              <Link
                href={item.href}
                className={cn(
                  "font-medium transition-colors hover:underline",
                  i === breadcrumbs.length - 1
                    ? "text-[var(--form-foreground)]"
                    : "text-[var(--form-muted-foreground)] hover:text-[var(--form-foreground)]"
                )}
              >
                {item.label}
              </Link>
            </span>
          ))}
        </nav>

        {/* Right: Save, Discard, Settings (Status dropdown), Pagination */}
        <div className="flex flex-wrap items-center gap-3">
          {formId ? (
            <Button
              type="submit"
              form={formId}
              size="sm"
              className="odoo-btn-primary h-10 rounded-lg px-5 text-sm font-semibold shadow-sm"
              disabled={saveLoading}
            >
              <Save className="mr-2 size-4" />
              {saveLoading ? "Saving…" : saveLabel}
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              className="odoo-btn-primary h-10 rounded-lg px-5 text-sm font-semibold shadow-sm"
              disabled={saveLoading}
              onClick={onSave}
            >
              <Save className="mr-2 size-4" />
              {saveLoading ? "Saving…" : saveLabel}
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            className="h-10 rounded-lg border-[var(--form-border)] bg-[var(--form-bg)] px-4 text-sm font-medium text-[var(--form-foreground)] hover:bg-[var(--form-muted)]"
            asChild
          >
            <Link href={discardHref}>Discard</Link>
          </Button>

          {/* Settings: Status & Visibility dropdown */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--form-muted-foreground)] hover:bg-[var(--form-muted)] hover:text-[var(--form-foreground)]"
                aria-label="Status & Visibility"
              >
                <Settings2 className="size-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-2">
              <div className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--form-muted-foreground)]">
                Status & Visibility
              </div>
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onStatusChange?.(opt.value)
                  }}
                  className={cn(
                    "flex w-full items-center rounded-md px-2 py-2 text-sm font-medium transition-colors",
                    currentStatus === opt.value
                      ? "bg-[var(--form-primary)] text-[var(--form-primary-foreground)]"
                      : "text-[var(--form-foreground)] hover:bg-[var(--form-muted)]"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          {/* Pagination */}
          {pagination && pagination.total > 0 && (
            <div className="ml-1 flex items-center overflow-hidden rounded-lg border border-[var(--form-border)] bg-[var(--form-bg)]">
              <span className="px-3 py-2 text-sm font-medium text-[var(--form-foreground)]">
                {pagination.currentIndex}/{pagination.total}
              </span>
              <button
                type="button"
                disabled={!pagination.prevId}
                onClick={() => pagination.prevId && router.push(`/admin/products/${pagination.prevId}/edit`)}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center border-l border-[var(--form-border)] text-[var(--form-foreground)] hover:enabled:bg-[var(--form-muted)] disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Previous record"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                disabled={!pagination.nextId}
                onClick={() => pagination.nextId && router.push(`/admin/products/${pagination.nextId}/edit`)}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center border-l border-[var(--form-border)] text-[var(--form-foreground)] hover:enabled:bg-[var(--form-muted)] disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Next record"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
