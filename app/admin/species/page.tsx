import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getCachedSpecies } from "@/features/categories/db/cache/categories"
import { SpeciesTable } from "@/features/species/components"
import { ChevronLeft, Plus } from "lucide-react"

export default async function AdminSpeciesPage() {
  const species = await getCachedSpecies()

  return (
    <div className="container my-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin">
              <ChevronLeft className="size-4" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Species</h1>
            <p className="text-muted-foreground text-sm">
              Manage gem species (Ruby, Sapphire, etc.)
            </p>
          </div>
        </div>
        <Button asChild>
          <Link href="/admin/species/new">
            <Plus className="mr-2 size-4" />
            New Species
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Species</CardTitle>
          <CardDescription>
            Link species to categories in the Categories admin to control which
            species appear when creating products in each category.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {species.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No species yet. Create one or run{" "}
              <code className="rounded bg-muted px-1">npm run seed:species</code>.
            </p>
          ) : (
            <SpeciesTable species={species} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
