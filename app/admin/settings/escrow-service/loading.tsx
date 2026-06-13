import { SkBlock, SkFormField } from "@/components/admin/motion/skeleton"

export default function EscrowServiceLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <SkBlock w={160} h={22} color="#f43f5e" opacity={0.18} rounded="md" />
        <SkBlock w={240} h={11} color="#f43f5e" opacity={0.10} rounded="sm" />
      </div>
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-border/60 space-y-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkFormField key={i} accentColor="#f43f5e" />
        ))}
        <div className="flex justify-end pt-2">
          <SkBlock w={110} h={38} color="#f43f5e" opacity={0.18} rounded="lg" />
        </div>
      </div>
    </div>
  )
}
