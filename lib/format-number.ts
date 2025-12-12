/**
 * Formats a number for UI display:
 * - No thousands separators
 * - Max `decimals` decimals (default 2) using standard rounding
 * - Trims trailing zeros and trailing decimal point
 *   e.g. 1      -> "1"
 *        1.2    -> "1.2"
 *        1.234  -> "1.23"
 *        1.200  -> "1"
 */
export function formatNumber(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return String(value)
  const str = value.toFixed(decimals)
  if (!str.includes('.')) return str
  return str.replace(/\.?0+$/, '')
}

