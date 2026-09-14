import { SkBlock, SkRow } from "@/components/admin/motion/skeleton"

export default function ProductShapeLoading() {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <SkBlock w={160} h={22} color="#14b8a6" opacity={0.18} rounded="md" />
        <SkBlock w={220} h={11} color="#14b8a6" opacity={0.1} rounded="sm" />
      </div>
      <div className="flex items-center gap-2">
        <SkBlock w={220} h={36} color="#14b8a6" opacity={0.1} rounded="lg" />
        <div className="ml-auto">
          <SkBlock w={110} h={36} color="#14b8a6" opacity={0.12} rounded="lg" />
        </div>
      </div>
      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-border/60">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="border-b border-border/40 last:border-b-0">
            <SkRow accentColor="#14b8a6" cols={3} />
          </div>
        ))}
      </div>
    </div>
  )
}
