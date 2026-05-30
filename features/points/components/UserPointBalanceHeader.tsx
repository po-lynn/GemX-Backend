import Link from "next/link"
import { Plus } from "lucide-react"

type Props = {
  available: number
  reserved: number
  lifetime: number
}

function fmtPts(n: number): string {
  return n.toLocaleString("en-US")
}

export function UserPointBalanceHeader({ available, reserved, lifetime }: Props) {
  return (
    <div className="pt-balance">
      <div className="pt-balance-main">
        <div className="pt-balance-eyebrow">Available Balance</div>
        <div className="pt-balance-amount">
          {fmtPts(available)}<span>pts</span>
        </div>
        <div className="pt-balance-meta">
          <span className="pt-balance-stat">
            Lifetime: <strong>{fmtPts(lifetime)} pts</strong>
          </span>
          {reserved > 0 && (
            <span className="pt-balance-stat">
              Reserved: <strong>{fmtPts(reserved)} pts</strong>
            </span>
          )}
        </div>
      </div>
      <Link href="/account/points/purchase" className="pt-topup-btn">
        <Plus /> Top up points
      </Link>
    </div>
  )
}
