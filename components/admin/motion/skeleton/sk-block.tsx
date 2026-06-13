function hexToRgb(hex: string): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!m) return "156,163,175"
  return `${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)}`
}

const roundedMap = { sm: "4px", md: "8px", lg: "12px", full: "9999px" } as const

export function SkBlock({
  w,
  h,
  color = "#9ca3af",
  opacity = 0.18,
  rounded = "md",
  className,
}: {
  w?: number | string
  h?: number | string
  color?: string
  opacity?: number
  rounded?: keyof typeof roundedMap
  className?: string
}) {
  const rgb = hexToRgb(color)
  const lo = opacity
  const hi = Math.min(1, opacity * 1.6)
  return (
    <div
      className={`sk-shimmer${className ? ` ${className}` : ""}`}
      style={{
        width:  typeof w === "number" ? `${w}px` : w,
        height: typeof h === "number" ? `${h}px` : h,
        borderRadius: roundedMap[rounded],
        backgroundImage: `linear-gradient(90deg, rgba(${rgb},${lo}) 25%, rgba(${rgb},${hi}) 50%, rgba(${rgb},${lo}) 75%)`,
      }}
    />
  )
}
