export interface BookResult {
  source: 'google_books' | 'open_library' | 'spotify'
  external_id: string
  title: string
  author: string
  cover_url: string | null
}

export async function searchGoogleBooks(query: string): Promise<BookResult[]> {
  if (!query.trim()) return []
  const key = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY
  if (!key) return []
  try {
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=20&key=${key}`
    const res = await fetch(url)
    if (!res.ok) return []
    const data = await res.json()
    return ((data.items ?? []) as GoogleVolume[]).map(item => {
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
