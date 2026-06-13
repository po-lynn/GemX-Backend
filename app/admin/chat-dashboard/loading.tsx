import { SkBlock, SkRow } from "@/components/admin/motion/skeleton"

export default function ChatDashboardLoading() {
  return (
    <div className="flex h-[calc(100vh-80px)] gap-0 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-border/60">
      <div className="w-80 shrink-0 space-y-1 border-r border-border/60 p-3">
        <div className="mb-3">
          <SkBlock w="100%" h={36} color="#0ea5e9" opacity={0.10} rounded="lg" />
        </div>
        {Array.from({ length: 7 }).map((_, i) => (
          <SkRow key={i} accentColor="#0ea5e9" cols={3} />
        ))}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <SkBlock w="100%" h={48} color="#0ea5e9" opacity={0.07} rounded="lg" />
        <div className="flex-1">
          <SkBlock w="100%" h="100%" color="#0ea5e9" opacity={0.04} rounded="lg" />
        </div>
        <SkBlock w="100%" h={48} color="#0ea5e9" opacity={0.07} rounded="lg" />
      </div>
    </div>
  )
}
