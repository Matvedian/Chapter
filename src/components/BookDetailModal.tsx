import { useEffect, useState } from 'react'

export interface DetailBook {
  source: string
  external_id: string
  title: string
  author: string
  cover_url: string | null
}

async function fetchDescription(book: DetailBook): Promise<string | null> {
  try {
    if (book.source === 'google_books') {
      const key = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY as string | undefined
      const url = `https://www.googleapis.com/books/v1/volumes/${book.external_id}${key ? `?key=${key}` : ''}`
      const res = await fetch(url)
      if (!res.ok) return null
      const data = await res.json()
      return (data.volumeInfo?.description as string | undefined) ?? null
    }
    if (book.source === 'open_library') {
      const key = book.external_id.startsWith('/') ? book.external_id : `/works/${book.external_id}`
      const res = await fetch(`https://openlibrary.org${key}.json`)
      if (!res.ok) return null
      const data = await res.json()
      const desc = data.description
      if (!desc) return null
      return typeof desc === 'string' ? desc : (desc as { value: string }).value ?? null
    }
  } catch { /* ignore */ }
  return null
}

export default function BookDetailModal({
  book, onClose,
}: {
  book: DetailBook | null
  onClose: () => void
}) {
  const [description, setDescription] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!book) return
    setDescription(null)
    setLoading(true)
    fetchDescription(book).then(d => { setDescription(d); setLoading(false) })
  }, [book?.external_id])

  if (!book) return null

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-end" onClick={onClose}>
      <div
        className="w-full bg-white rounded-t-3xl px-6 pt-4 pb-10 max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* drag handle */}
        <div className="w-10 h-1 bg-stone-200 rounded-full mx-auto mb-5" />

        <div className="flex gap-4 mb-4">
          {book.cover_url ? (
            <img src={book.cover_url} alt="" className="w-20 h-28 object-cover rounded-xl shadow flex-shrink-0" />
          ) : (
            <div className="w-20 h-28 rounded-xl bg-amber-100 flex-shrink-0 flex items-center justify-center text-amber-700 text-2xl">📖</div>
          )}
          <div className="flex-1 min-w-0 pt-1">
            <p className="font-bold text-stone-900 text-base leading-snug mb-1">{book.title}</p>
            {book.author && <p className="text-sm text-stone-500">{book.author}</p>}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="space-y-2 mt-1">
              <div className="h-3 bg-stone-100 rounded-full w-full skeleton" />
              <div className="h-3 bg-stone-100 rounded-full w-5/6 skeleton" />
              <div className="h-3 bg-stone-100 rounded-full w-4/6 skeleton" />
            </div>
          ) : description ? (
            <p className="text-sm text-stone-600 leading-relaxed">{description}</p>
          ) : (
            <p className="text-sm text-stone-400 italic">No description available.</p>
          )}
        </div>
      </div>
    </div>
  )
}
