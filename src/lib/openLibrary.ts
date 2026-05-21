export interface OLBook {
  key: string
  title: string
  author_name?: string[]
  cover_i?: number
  first_publish_year?: number
}

export async function searchBooks(query: string): Promise<OLBook[]> {
  if (!query.trim()) return []
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&fields=key,title,author_name,cover_i,first_publish_year&limit=12`
  const res = await fetch(url)
  if (!res.ok) return []
  const data = await res.json()
  return (data.docs as OLBook[]) ?? []
}

export function coverUrl(coverId: number, size: 'S' | 'M' | 'L' = 'M') {
  return `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`
}
