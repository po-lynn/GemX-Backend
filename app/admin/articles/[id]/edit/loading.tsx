import { SkBlock, SkFormField } from "@/components/admin/motion/skeleton"

export default function ArticleEditLoading() {
  return (
    <div className="container my-4 w-full max-w-screen-2xl space-y-6 md:my-6">
      <div className="space-y-1.5">
        <SkBlock w={72} h={11} color="#64748b" opacity={0.14} rounded="sm" />
        <SkBlock w={160} h={24} color="#64748b" opacity={0.18} rounded="md" />
      </div>
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-border/60 space-y-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkFormField key={i} accentColor="#64748b" />
        ))}
        <div className="flex justify-end pt-2">
          <SkBlock w={110} h={38} color="#64748b" opacity={0.18} rounded="lg" />
        </div>
      </div>
    </div>
  )
}
