import { SkBlock } from "@/components/admin/motion/skeleton"

export default function PrecautionTagEditLoading() {
  return (
    <div className="animate-pulse space-y-5 py-2">
      <SkBlock w={180} h={22} color="#f59e0b" opacity={0.15} rounded="md" />
      <div className="h-64 rounded-xl bg-white ring-1 ring-slate-200/60" />
    </div>
  )
}
