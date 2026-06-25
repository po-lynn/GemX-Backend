import { SkBlock, SkFormField } from "@/components/admin/motion/skeleton"

export default function PrecautionTagNewLoading() {
  return (
    <div className="space-y-5 py-2">
      <SkBlock w={160} h={22} color="#f59e0b" opacity={0.15} rounded="md" />
      <div className="space-y-4">
        <SkFormField accentColor="#f59e0b" />
        <SkFormField accentColor="#f59e0b" />
        <SkFormField accentColor="#f59e0b" />
      </div>
    </div>
  )
}
