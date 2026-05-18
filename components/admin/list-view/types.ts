import type { ReactNode } from "react"

export type ColumnDef<T> = {
  id: string
  label: string
  width?: number
  sortable?: boolean
  align?: "left" | "right" | "center"
  toggleable?: boolean
  render: (row: T) => ReactNode
}

export type ViewTab = {
  id: string
  label: string
  count?: number
}

export type FilterOption = {
  value: string
  label: string
  count?: number
}

export type FilterDef =
  | { id: string; label: string; type: "multi"; options: FilterOption[] }
  | { id: string; label: string; type: "daterange" }

export type SortState = {
  id: string
  dir: "asc" | "desc"
}

export type GroupOption = {
  id: string
  label: string
}

export type ActiveFilters = Record<string, string[]>

export type GroupRow = {
  __group: true
  key: string
  label: string
  count: number
  aggs?: Array<{ label: string; value: string }>
}
