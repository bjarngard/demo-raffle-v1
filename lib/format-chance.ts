export function formatChancePercent(value: number): string {
  if (Number.isNaN(value)) return ''
  const clamped = Math.max(0, Math.min(100, value))

  if (Math.abs(clamped - Math.round(clamped)) < 0.05) {
    return `${Math.round(clamped)}%`
  }

  if (clamped >= 10) {
    return `${clamped.toFixed(1)}%`
  }

  if (clamped >= 0.01) {
    return `${clamped.toFixed(2)}%`
  }

  return '<0.01%'
}

