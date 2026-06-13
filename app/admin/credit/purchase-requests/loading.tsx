import { SkBlock, SkRow } from "@/components/admin/motion/skeleton"

export default function PurchaseRequestsLoading() {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <SkBlock w={120} h={22} color="#f59e0b" opacity={0.18} rounded="md" />
        <SkBlock w={200} h={11} color="#f59e0b" opacity={0.10} rounded="sm" />
      </div>
      <div className="flex items-center gap-2">
        <SkBlock w={220} h={36} color="#f59e0b" opacity={0.10} rounded="lg" />
        <SkBlock w={88}  h={36} color="#f59e0b" opacity={0.10} rounded="lg" />
        <SkBlock w={88}  h={36} color="#f59e0b" opacity={0.10} rounded="lg" />
        <div className="ml-auto">
          <SkBlock w={110} h={36} color="#f59e0b" opacity={0.12} rounded="lg" />
        </div>
      </div>
      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-border/60">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="border-b border-border/40 last:border-b-0">
            <SkRow accentColor="#f59e0b" cols={5} />
          </div>
        ))}
      </div>
    </div>
  )
}
