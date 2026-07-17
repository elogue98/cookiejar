function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const parts: string[] = []

  if (hours > 0) {
    parts.push(`${hours} hr`)
  }

  if (minutes > 0 || parts.length === 0) {
    parts.push(`${minutes} min`)
  }

  return parts.join(' ')
}

export function parseIsoDurationMinutes(value: string): number | null {
  const trimmed = value.trim()
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?$/i.exec(trimmed)

  if (!match || (!match[1] && !match[2])) {
    return null
  }

  const hours = match[1] ? Number.parseInt(match[1], 10) : 0
  const minutes = match[2] ? Number.parseInt(match[2], 10) : 0

  return hours * 60 + minutes
}

export function formatRecipeTime(value: string): string {
  if (!value) return value

  const trimmed = value.trim()
  const isoMinutes = parseIsoDurationMinutes(trimmed)

  if (isoMinutes !== null) {
    return formatMinutes(isoMinutes)
  }

  return trimmed
    .replace(/\bhours?\b/gi, 'hr')
    .replace(/\bmins?\b/gi, 'min')
    .replace(/\bminutes?\b/gi, 'min')
    .replace(/\s+/g, ' ')
    .trim()
}
