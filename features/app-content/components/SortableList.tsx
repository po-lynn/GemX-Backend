"use client"

import type { ReactNode } from "react"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { reorderBySortOrder } from "@/features/app-content/lib/reorder"

export type SortableItem = { id: string; sortOrder: number }

type Props<T extends SortableItem> = {
  items: T[]
  onReorder: (items: T[]) => void
  renderRow: (item: T, index: number) => ReactNode
}

export function SortableList<T extends SortableItem>({ items, onReorder, renderRow }: Props<T>) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder)

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return
    const moved = reorderBySortOrder(sorted, String(active.id), String(over.id))
    if (moved !== sorted) onReorder(moved)
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={sorted.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        {sorted.map((item, index) => (
          <SortableRow key={item.id} id={item.id}>
            {renderRow(item, index)}
          </SortableRow>
        ))}
      </SortableContext>
    </DndContext>
  )
}

function SortableRow({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? undefined,
    opacity: isDragging ? 0.5 : 1,
  }
  return (
    <div ref={setNodeRef} style={style} className="ac-row">
      <span className="ac-draghandle" {...attributes} {...listeners}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="6" r="1.5" />
          <circle cx="9" cy="12" r="1.5" />
          <circle cx="9" cy="18" r="1.5" />
          <circle cx="15" cy="6" r="1.5" />
          <circle cx="15" cy="12" r="1.5" />
          <circle cx="15" cy="18" r="1.5" />
        </svg>
      </span>
      {children}
    </div>
  )
}
