import { useEffect, useRef, useState } from 'react'
import { searchBooks } from '../../lib/bookSearch'
import type { BookResult } from '../../lib/bookSearch'
import type { OnboardingData, SelectedBook } from './index'
import BookDetailModal from '../../components/BookDetailModal'
import type { DetailBook } from '../../components/BookDetailModal'

interface Props {
  onNext: (patch: Partial<OnboardingData>) => void
  submitting: boolean
}

export default function StepBooks({ onNext, submitting }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<BookResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<SelectedBook[]>([])
  const [detailBook, setDetailBook] = useState<DetailBook | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) {
      setResults([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      const books = await searchBooks(query)
      setResults(books)
      setSearching(false)
    }, 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  const isSelected = (id: string) => selected.some(b => b.external_id === id)

  const toggle = (book: BookResult) => {
    if (isSelected(book.external_id)) {
      setSelected(prev => prev.filter(b => b.external_id !== book.external_id))
    } else {
      setSelected(prev => [...prev, {
        source: book.source,
        external_id: book.external_id,
        title: book.title,
        author: book.author,
        cover_url: book.cover_url,
      }])
    }
  }

  return (
    <div className="px-6 pt-6 pb-10">
      <h2 className="text-2xl font-bold text-stone-900 mb-1">Favourite books</h2>
      <p className="text-stone-500 text-sm mb-6">Add at least one book that defines you.</p>

      {selected.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-3 mb-6 -mx-6 px-6">
          {selected.map(book => (
            <button
              key={book.external_id}
              onClick={() => setSelected(prev => prev.filter(b => b.external_id !== book.external_id))}
              className="flex-shrink-0 relative w-16"
            >
              {book.cover_url ? (
                <img src={book.cover_url} alt={book.title} className="w-16 h-24 object-cover rounded-lg shadow" />
              ) : (
                <div className="w-16 h-24 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700 text-xs font-medium text-center px-1 shadow">
                  {book.title.slice(0, 20)}
                </div>
              )}
              <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-stone-800 text-white text-xs flex items-center justify-center">
                ×
              </div>
            </button>
          ))}
        </div>
      )}

      <input
        type="search"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search for a book…"
        className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400 mb-4"
      />

      {searching && (
        <p className="text-sm text-stone-400 text-center py-4">Searching…</p>
      )}

      {!searching && results.length > 0 && (
        <div className="space-y-2 mb-8">
          {results.map(book => (
            <div
              key={book.external_id}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                isSelected(book.external_id) ? 'border-amber-400 bg-amber-50' : 'border-stone-200 bg-white'
              }`}
            >
              <button onClick={() => setDetailBook(book)} className="flex-shrink-0">
                {book.cover_url ? (
                  <img src={book.cover_url} alt="" className="w-10 h-14 object-cover rounded" />
                ) : (
                  <div className="w-10 h-14 rounded bg-stone-100" />
                )}
              </button>
              <button onClick={() => toggle(book)} className="flex-1 min-w-0 text-left flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-stone-900 truncate">{book.title}</p>
                  {book.author && <p className="text-xs text-stone-500 truncate">{book.author}</p>}
                </div>
                {isSelected(book.external_id) && (
                  <div className="ml-auto flex-shrink-0 w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center text-stone-900 text-xs">✓</div>
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => onNext({ books: selected })}
        disabled={selected.length === 0 || submitting}
        className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-500 text-stone-900 font-semibold transition-colors disabled:opacity-40"
      >
        {submitting ? 'Saving…' : 'Finish'}
      </button>
      <button
        onClick={() => onNext({ books: [] })}
        disabled={submitting}
        className="w-full py-2 mt-3 text-sm text-stone-400 hover:text-stone-600 transition-colors disabled:opacity-40"
      >
        Skip for now
      </button>

      <BookDetailModal book={detailBook} onClose={() => setDetailBook(null)} />
    </div>
  )
}
