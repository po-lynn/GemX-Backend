import { SkBlock } from "./sk-block"

export function SkCard({
  accentColor,
  className,
}: {
  accentColor: string
  className?: string
}) {
  return (
    <div
      className={`rounded-2xl bg-card p-5 shadow-sm ring-1 ring-border/60${className ? ` ${className}` : ""}`}
    >
      <SkBlock w={44} h={44} color={accentColor} opacity={0.12} rounded="lg" />
      <div className="mt-4 space-y-2">
        <SkBlock w={56} h={22} color={accentColor} opacity={0.18} rounded="md" />
        <SkBlock w={80} h={10} color={accentColor} opacity={0.10} rounded="sm" />
      </div>
    </div>
  )
}
