import { SkBlock, SkCard } from "@/components/admin/motion/skeleton"

export default function AdminDashboardLoading() {
  return (
    <div className="space-y-8 py-2">
      <div className="space-y-2">
        <SkBlock w={140} h={24} color="#8b5cf6" opacity={0.16} rounded="md" />
        <SkBlock w={240} h={12} color="#8b5cf6" opacity={0.10} rounded="sm" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SkCard accentColor="#8b5cf6" />
        <SkCard accentColor="#3b82f6" />
        <SkCard accentColor="#f59e0b" />
        <SkCard accentColor="#22c55e" />
      </div>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border/40" />
        <SkBlock w={130} h={10} color="#9ca3af" opacity={0.14} rounded="sm" />
        <div className="h-px flex-1 bg-border/40" />
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
        {Array.from({ length: 11 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2.5 rounded-xl bg-card p-4 shadow-sm ring-1 ring-border/60">
            <SkBlock w={40} h={40} color="#9ca3af" opacity={0.13} rounded="lg" />
            <SkBlock w={48} h={10} color="#9ca3af" opacity={0.11} rounded="sm" />
          </div>
        ))}
      </div>
    </div>
  )
}
