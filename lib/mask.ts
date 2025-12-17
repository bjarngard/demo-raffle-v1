export function maskSuffix(value: unknown): string {
  if (value === null || value === undefined) return 'missing'
  const str = String(value)
  if (str.length <= 4) return `...${str}`
  return `...${str.slice(-4)}`
}

