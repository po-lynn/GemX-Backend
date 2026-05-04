import Link from "next/link"
import { connection } from "next/server"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getCachedOrigins } from "@/features/origin/db/cache/origin"
import { OriginTable } from "@/features/origin/components"

export default async function AdminOriginPage() {
  await connection()
  const origins = await getCachedOrigins()

  return (
    <div className="space-y-5 py-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Origin</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Manage gem origins — Myanmar, Sri Lanka, Colombia, and more
          </p>
        </div>
        <Button asChild size="sm" className="shrink-0 shadow-sm">
          <Link href="/admin/origin/new">
            <Plus className="mr-1.5 size-4" />
            New Origin
          </Link>
        </Button>
      </div>

      <OriginTable origins={origins} />
    </div>
  )
}
