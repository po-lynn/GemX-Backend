import { SkBlock } from "./sk-block"

export function SkRow({
  cols = 5,
  accentColor = "#9ca3af",
}: {
  cols?: number
  accentColor?: string
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-3">
      <SkBlock w={32} h={32} color={accentColor} opacity={0.12} rounded="lg" />
      <SkBlock w={120} h={10} color={accentColor} opacity={0.15} rounded="md" />
      {Array.from({ length: Math.max(0, cols - 2) }).map((_, i) => (
        <SkBlock key={i} w={72} h={10} color="#9ca3af" opacity={0.12} rounded="md" />
      ))}
    </div>
  )
}
