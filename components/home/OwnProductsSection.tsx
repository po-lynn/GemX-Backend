import Link from "next/link"
import Image from "next/image"
import type { HomepageFeaturedProduct } from "@/features/products/db/products"

const GemIcon = () => (
  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" opacity="0.4">
    <path d="M6 3h12l4 6-10 13L2 9Z"/><path d="M11 3 8 9l4 13 4-13-3-6"/><path d="M2 9h20"/>
  </svg>
)

const PhoneIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="2" width="14" height="20" rx="3"/><path d="M12 18h.01"/>
  </svg>
)

const PLACEHOLDER_GRADIENTS = [
  "linear-gradient(150deg,#ece8fb,#a896ee)",
  "linear-gradient(150deg,#fde8f0,#e07aab)",
  "linear-gradient(150deg,#e8f4fb,#7ab6e0)",
]

function formatPrice(price: string, currency: "USD" | "MMK") {
  const n = Number(price)
  if (currency === "USD") return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
  return `${n.toLocaleString("en-US", { maximumFractionDigits: 0 })} MMK`
}

function productSub(p: HomepageFeaturedProduct): string {
  const parts: string[] = []
  if (p.certLabName) parts.push(p.certLabName + " certified")
  if (p.origin) parts.push(p.origin)
  if (p.weightCarat) parts.push(`${Number(p.weightCarat).toFixed(2)} ct`)
  if (p.categoryName) parts.push(p.categoryName)
  return parts.slice(0, 3).join(" · ") || "Certified · Premium quality"
}

interface Props {
  products: HomepageFeaturedProduct[]
}

export function OwnProductsSection({ products }: Props) {
  const display = products.slice(0, 3)

  return (
    <section style={{ padding: "84px 7vw 0" }}>
      <div style={{
        display: "flex", alignItems: "flex-end", justifyContent: "space-between",
        marginBottom: 28, gap: 16, flexWrap: "wrap",
      }}>
        <div>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            fontSize: "12px", fontWeight: 700, color: "#6d5ce7",
            background: "#efeafe", padding: "6px 13px", borderRadius: 20, marginBottom: 10,
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 3h12l4 6-10 13L2 9Z"/>
            </svg>
            Privilege Assist
          </div>
          <h2 style={{ margin: 0, fontSize: 34, fontWeight: 800, letterSpacing: "-0.025em", color: "#191525" }}>
            Our own picks
          </h2>
          <p style={{ margin: "8px 0 0", fontSize: 15, color: "#8a8799" }}>
            A taste of what&apos;s inside the GemX app — certified stones and fine jewellery, with full details and live pricing in-app.
          </p>
        </div>
        <Link href="#app" style={{ fontSize: 14, fontWeight: 700, color: "#6d5ce7", textDecoration: "none" }}>
          View all in the app →
        </Link>
      </div>

      <div className="home-featured-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 24 }}>
        {display.length > 0 ? display.map((item, i) => {
          const gradient = PLACEHOLDER_GRADIENTS[i % PLACEHOLDER_GRADIENTS.length]
          const sub = productSub(item)
          return (
            <Link
              key={item.id}
              href="#app"
              className="home-card-hover"
              style={{
                border: "1px solid #ededf2", borderRadius: 18, overflow: "hidden",
                background: "#fff", boxShadow: "0 1px 3px rgba(20,15,40,0.04)", display: "block",
                textDecoration: "none",
              }}
            >
              <div style={{
                aspectRatio: "1/1", background: gradient,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", position: "relative", overflow: "hidden",
              }}>
                {item.imageUrl ? (
                  <Image
                    src={item.imageUrl}
                    alt={item.title}
                    fill
                    style={{ objectFit: "cover" }}
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                ) : (
                  <GemIcon />
                )}
                <span style={{
                  position: "absolute", top: 14, left: 14, fontSize: 11, fontWeight: 700,
                  color: "#6d5ce7", background: "rgba(255,255,255,0.95)", padding: "4px 10px",
                  borderRadius: 20, zIndex: 1,
                }}>Own Pick</span>
                {item.isVerified && (
                  <span style={{
                    position: "absolute",
                    top: item.isPrivilegeAssist ? 44 : 14,
                    left: 14,
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#0f766e",
                    background: "rgba(255,255,255,0.95)",
                    padding: "4px 10px",
                    borderRadius: 20,
                    zIndex: 1,
                  }}>GemX Verified</span>
                )}
              </div>
              <div style={{ padding: "18px 18px 20px" }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#191525", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.title}</div>
                <div style={{ fontSize: "12.5px", color: "#8a8799", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16 }}>
                  <span style={{ fontSize: "14px", fontWeight: 700, color: "#191525" }}>{formatPrice(item.price, item.currency)}</span>
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    fontSize: 12, fontWeight: 700, color: "#6d5ce7",
                    background: "#efeafe", padding: "7px 13px", borderRadius: 9,
                  }}>
                    <PhoneIcon />View in app
                  </span>
                </div>
              </div>
            </Link>
          )
        }) : (
          [0, 1, 2].map((i) => (
            <div key={i} style={{
              border: "1px solid #ededf2", borderRadius: 18, overflow: "hidden",
              background: "#fff", boxShadow: "0 1px 3px rgba(20,15,40,0.04)",
            }}>
              <div style={{ aspectRatio: "1/1", background: PLACEHOLDER_GRADIENTS[i], opacity: 0.5 }} />
              <div style={{ padding: "18px 18px 20px" }}>
                <div style={{ height: 20, width: "70%", borderRadius: 6, background: "#ededf2", marginBottom: 8 }} />
                <div style={{ height: 14, width: "50%", borderRadius: 4, background: "#f3f2f7" }} />
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
