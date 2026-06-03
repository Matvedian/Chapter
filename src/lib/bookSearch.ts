import { searchGoogleBooks } from './googleBooks'
import { searchBooks as searchOpenLibrary, coverUrl } from './openLibrary'

export type { BookResult } from './googleBooks'

export async function searchBooks(query: string): Promise<import('./googleBooks').BookResult[]> {
  const google = await searchGoogleBooks(query)
  if (google.length > 0) return google
  const ol = await searchOpenLibrary(query)
  return ol.map(b => ({
    source: 'open_library' as const,
    external_id: b.key,
    title: b.title,
    author: b.author_name?.[0] ?? '',
    cover_url: b.cover_i ? coverUrl(b.cover_i) : null,
  }))
}
