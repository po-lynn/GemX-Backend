import { SkBlock } from "@/components/admin/motion/skeleton"

export default function ProductShapeEditLoading() {
  return (
    <div className="space-y-4 py-2">
      <SkBlock w={240} h={20} color="#14b8a6" opacity={0.15} rounded="md" />
      <SkBlock w="100%" h={220} color="#14b8a6" opacity={0.08} rounded="xl" />
    </div>
  )
}
