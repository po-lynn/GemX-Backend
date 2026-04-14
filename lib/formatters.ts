export function formatPlural(
  count: number,
  { singular, plural }: { singular: string; plural: string },
  { includeCount = true } = {}
) {
  const word = count === 1 ? singular : plural

  return includeCount ? `${count} ${word}` : word
}

export function formatPrice(amount: number, { showZeroAsNumber = false } = {}) {
  const formatter = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  })

  if (amount === 0 && !showZeroAsNumber) return "Free"
  return formatter.format(amount)
}

export function formatPriceWithCurrency(
  amount: number,
  currency: "USD" | "MMK" = "USD"
) {
  const formatter = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  })
  return formatter.format(amount)
}

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
})

export function formatDate(date: Date) {
  return DATE_FORMATTER.format(date)
}

export function formatNumber(
  number: number,
  options?: Intl.NumberFormatOptions
) {
  const formatter = new Intl.NumberFormat(undefined, options)
  return formatter.format(number)
}

/**
 * Masks a price string — keeps the first digit of the integer part,
 * replaces the rest with 'x'. Strips decimals before masking.
 * e.g. "100000" → "1xxxxx", "100000.00" → "1xxxxx", "9" → "9"
 */
export function maskPrice(price: string): string {
  const intPart = price.split(".")[0]
  if (!intPart) return price
  return intPart[0] + "x".repeat(intPart.length - 1)
}
