// Initials-only avatar, colored by hashing the participant id onto the
// palette from design_handoff_messages_triage/README.md. No shared <Avatar>
// component exists in this codebase yet (see AdminAllConversationsView.tsx
// for the closest precedent, which is image-based) — this one is scoped to
// the triage inbox since it needs the specific hash-to-color behavior.

const PALETTE = ["#e11d48", "#7c3aed", "#0ea5e9", "#d97706", "#4f46e5", "#0f766e", "#be185d", "#4a4956"]

function hashToColor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) % PALETTE.length
  return PALETTE[hash]
}

type Props = {
  id: string
  name: string
  size: number
  style?: React.CSSProperties
}

export function ParticipantAvatar({ id, name, size, style }: Props) {
  const initial = name.trim().charAt(0).toUpperCase() || "?"
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        display: "grid",
        placeItems: "center",
        fontSize: 12,
        fontWeight: 700,
        color: "#fff",
        background: hashToColor(id),
        flexShrink: 0,
        ...style,
      }}
    >
      {initial}
    </div>
  )
}
