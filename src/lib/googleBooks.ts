export interface BookResult {
  source: 'google_books' | 'open_library' | 'spotify'
  external_id: string
  title: string
  author: string
  cover_url: string | null
}

function parseVolumes(items: GoogleVolume[]): BookResult[] {
  return items.map(item => {
    const info = item.volumeInfo
    let cover: string | null = info.imageLinks?.thumbnail ?? null
    if (cover) {
      cover = cover.replace(/^http:\/\//, 'https://')
      cover = cover.replace(/&zoom=\d+/, '')
    }
    return {
      source: 'google_books' as const,
      external_id: item.id,
      title: info.title ?? 'Unknown title',
      author: info.authors?.[0] ?? '',
      cover_url: cover,
    }
  })
}

async function fetchVolumes(q: string, key: string): Promise<BookResult[]> {
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=20&key=${key}`
  const res = await fetch(url)
  if (!res.ok) return []
  const data = await res.json()
  return parseVolumes((data.items ?? []) as GoogleVolume[])
}

export async function searchGoogleBooks(query: string): Promise<BookResult[]> {
  if (!query.trim()) return []
  const key = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY
  if (!key) return []
  try {
    const [general, byAuthor] = await Promise.all([
      fetchVolumes(query, key),
      fetchVolumes(`inauthor:${query}`, key),
    ])
    const seen = new Set<string>()
    const merged: BookResult[] = []
    for (const book of [...byAuthor, ...general]) {
      if (!seen.has(book.external_id)) {
        seen.add(book.external_id)
        merged.push(book)
      }
    }
    return merged
  } catch {
    return []
  }
}

interface GoogleVolume {
  id: string
  volumeInfo: {
    title?: string
    authors?: string[]
    imageLinks?: { thumbnail?: string }
  }
}
