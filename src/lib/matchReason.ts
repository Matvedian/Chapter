export function formatMatchReason(sharedBooks: number, sharedGenres: number): string | null {
  const parts: string[] = []
  if (sharedBooks > 0) {
    parts.push(`${sharedBooks} book${sharedBooks === 1 ? '' : 's'}`)
  }
  if (sharedGenres > 0) {
    parts.push(`${sharedGenres} genre${sharedGenres === 1 ? '' : 's'}`)
  }
  if (parts.length === 0) return null
  return `${parts.join(' · ')} in common`
}
