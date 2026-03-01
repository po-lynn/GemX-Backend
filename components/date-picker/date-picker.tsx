"use client"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import { format, parseISO } from "date-fns"
import { CalendarIcon } from "lucide-react"
import * as React from "react"

function parseDateValue(value: string | undefined): Date | undefined {
  if (!value || value.trim() === "") return undefined
  try {
    const d = parseISO(value.trim())
    return Number.isNaN(d.getTime()) ? undefined : d
  } catch {
    return undefined
  }
}

type DatePickerProps = {
  value?: string
  name?: string
  id?: string
  placeholder?: string
  onSelect?: (date: Date | undefined) => void
  className?: string
}

export default function DatePicker({
  value,
  name,
  id,
  placeholder = "Pick a date",
  onSelect,
  className,
}: DatePickerProps) {
  const initialDate = parseDateValue(value)
  const [date, setDate] = React.useState<Date | undefined>(initialDate)

  React.useEffect(() => {
    setDate(parseDateValue(value))
  }, [value])

  function handleSelect(selected: Date | undefined) {
    setDate(selected)
    onSelect?.(selected)
  }

  const dateString = date ? format(date, "yyyy-MM-dd") : ""

  return (
    <>
      {name && (
        <input type="hidden" name={name} value={dateString} readOnly />
      )}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            className={cn(
              "w-[240px] justify-start text-left font-normal",
              !date && "text-muted-foreground",
              className
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, "PPP") : <span>{placeholder}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleSelect}
            autoFocus
          />
        </PopoverContent>
      </Popover>
    </>
  )
}
