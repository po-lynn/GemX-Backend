import Link from "next/link"
import { Button } from "@/components/ui/button"
import { SpeciesForm } from "@/features/species/components"
import { ChevronLeft } from "lucide-react"

export default function AdminSpeciesNewPage() {
  return (
    <div className="container my-6 space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/species">
            <ChevronLeft className="size-4" />
            <span className="sr-only">Back</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New Species</h1>
          <p className="text-muted-foreground text-sm">
            Add a new gem species
          </p>
        </div>
      </div>

      <SpeciesForm mode="create" />
    </div>
  )
}
