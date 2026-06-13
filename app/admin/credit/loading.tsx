import { SkBlock, SkCard } from "@/components/admin/motion/skeleton"

export default function CreditLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <SkBlock w={140} h={22} color="#8b5cf6" opacity={0.18} rounded="md" />
        <SkBlock w={220} h={11} color="#8b5cf6" opacity={0.10} rounded="sm" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SkCard accentColor="#8b5cf6" />
        <SkCard accentColor="#8b5cf6" />
        <SkCard accentColor="#8b5cf6" />
      </div>
      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-border/60">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-border/40 px-4 py-3 last:border-b-0">
            <SkBlock w={32} h={32} color="#8b5cf6" opacity={0.12} rounded="lg" />
            <SkBlock w={140} h={11} color="#8b5cf6" opacity={0.15} rounded="md" />
            <div className="ml-auto flex gap-2">
              <SkBlock w={72} h={28} color="#8b5cf6" opacity={0.12} rounded="md" />
              <SkBlock w={72} h={28} color="#8b5cf6" opacity={0.12} rounded="md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
