type Props = {
  iconKey: string
  customIconUrl?: string | null
  size?: number
}

const ICON_BG: Record<string, string> = {
  facebook: "#1877f2",
  instagram: "linear-gradient(45deg,#f9ce34,#ee2a7b,#6228d7)",
  telegram: "#29a9eb",
  tiktok: "#000000",
  viber: "#7360f2",
  custom: "#78847c",
}

const ICON_GLYPH: Record<string, string> = {
  facebook: "f",
  instagram: "IG",
  telegram: "TG",
  tiktok: "TT",
  viber: "V",
}

export function PlatformIcon({ iconKey, customIconUrl, size = 38 }: Props) {
  if (iconKey === "custom" && customIconUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, not a static asset
    return (
      <img
        src={customIconUrl}
        alt=""
        width={size}
        height={size}
        style={{ borderRadius: 10, objectFit: "cover", flexShrink: 0 }}
      />
    )
  }
  return (
    <span
      className="ac-icon"
      style={{ width: size, height: size, background: ICON_BG[iconKey] ?? ICON_BG.custom }}
    >
      {ICON_GLYPH[iconKey] ?? "?"}
    </span>
  )
}
