import Link from "next/link"
import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { SpeciesForm } from "@/features/species/components"
import { getCachedSpeciesById } from "@/features/species/db/cache/species"
import { ChevronLeft } from "lucide-react"

type Props = {
  params: Promise<{ id: string }>
}

export default async function AdminSpeciesEditPage({ params }: Props) {
  const { id } = await params
  const species = await getCachedSpeciesById(id)

  if (!species) notFound()

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
          <h1 className="text-2xl font-semibold tracking-tight">
            Edit Species
          </h1>
          <p className="text-muted-foreground text-sm">
            Update {species.name}
          </p>
        </div>
      </div>

      <SpeciesForm mode="edit" species={species} />
    </div>
  )
}
