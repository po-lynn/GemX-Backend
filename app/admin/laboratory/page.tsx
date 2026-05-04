import Link from "next/link"
import { connection } from "next/server"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getCachedLaboratories } from "@/features/laboratory/db/cache/laboratory"
import { LaboratoryTable } from "@/features/laboratory/components"

export default async function AdminLaboratoryPage() {
  await connection()
  const laboratories = await getCachedLaboratories()

  return (
    <div className="space-y-5 py-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Laboratory</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Manage certification laboratories — GIA, AGS, and others
          </p>
        </div>
        <Button asChild size="sm" className="shrink-0 shadow-sm">
          <Link href="/admin/laboratory/new">
            <Plus className="mr-1.5 size-4" />
            New Laboratory
          </Link>
        </Button>
      </div>

      <LaboratoryTable laboratories={laboratories} />
    </div>
  )
}
