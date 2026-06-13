import { SkBlock } from "./sk-block"

export function SkFormField({ accentColor = "#9ca3af" }: { accentColor?: string }) {
  return (
    <div className="space-y-2">
      <SkBlock w={80} h={10} color={accentColor} opacity={0.14} rounded="sm" />
      <SkBlock w="100%" h={38} color={accentColor} opacity={0.08} rounded="md" />
    </div>
  )
}
