/**
 * Escrow case prices are stored as integer minor units (never float — see the brief's
 * explicit requirement), unlike lib/formatters.ts's formatPrice/formatPriceWithCurrency,
 * which take major-unit floats straight into Intl.NumberFormat. Do NOT reuse those here
 * (off by 10x/100x) and do not let this minor-unit convention leak backward into them.
 */
const MINOR_UNIT_EXPONENT: Record<"USD" | "MMK", number> = {
  USD: 2,
  // MMK's "pya" subunit doesn't circulate in practice; treating it as 2 like USD would
  // silently misrepresent every MMK case price by 100x.
  MMK: 0,
}

const DISPLAY_LOCALE = "en-US"

export function minorToMajor(amountMinor: number, currency: "USD" | "MMK"): number {
  return amountMinor / 10 ** MINOR_UNIT_EXPONENT[currency]
}

/** Inverse of minorToMajor, for turning a form's major-unit input (e.g. "1500.00") into
 *  the integer minor units the API expects. Rounds to the nearest minor unit. */
export function majorToMinor(amountMajor: number, currency: "USD" | "MMK"): number {
  return Math.round(amountMajor * 10 ** MINOR_UNIT_EXPONENT[currency])
}

export function formatMoneyMinor(amountMinor: number, currency: "USD" | "MMK"): string {
  const major = minorToMajor(amountMinor, currency)
  if (currency === "MMK") {
    return `${new Intl.NumberFormat(DISPLAY_LOCALE, { maximumFractionDigits: 0 }).format(major)} MMK`
  }
  return new Intl.NumberFormat(DISPLAY_LOCALE, { style: "currency", currency: "USD" }).format(major)
}
