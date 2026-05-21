import { useEffect, useRef, useState } from 'react'
import { searchBooks, coverUrl } from '../../lib/openLibrary'
import type { OLBook } from '../../lib/openLibrary'
import type { OnboardingData, SelectedBook } from './index'

interface Props {
  onNext: (patch: Partial<OnboardingData>) => void
  submitting: boolean
}

export default function StepBooks({ onNext, submitting }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<OLBook[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<SelectedBook[]>([])
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

  const isSelected = (key: string) => selected.some(b => b.open_library_id === key)

  const toggle = (book: OLBook) => {
    if (isSelected(book.key)) {
      setSelected(prev => prev.filter(b => b.open_library_id !== book.key))
    } else {
      setSelected(prev => [...prev, {
        open_library_id: book.key,
        title: book.title,
        author: book.author_name?.[0] ?? '',
        cover_url: book.cover_i ? coverUrl(book.cover_i) : null,
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
              key={book.open_library_id}
              onClick={() => setSelected(prev => prev.filter(b => b.open_library_id !== book.open_library_id))}
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
            <button
              key={book.key}
              onClick={() => toggle(book)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-left ${
                isSelected(book.key)
                  ? 'border-amber-400 bg-amber-50'
                  : 'border-stone-200 bg-white hover:border-amber-300'
              }`}
            >
              {book.cover_i ? (
                <img
                  src={coverUrl(book.cover_i, 'S')}
                  alt=""
                  className="w-10 h-14 object-cover rounded flex-shrink-0"
                />
              ) : (
                <div className="w-10 h-14 rounded bg-stone-100 flex-shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-stone-900 truncate">{book.title}</p>
                {book.author_name?.[0] && (
                  <p className="text-xs text-stone-500 truncate">{book.author_name[0]}</p>
                )}
                {book.first_publish_year && (
                  <p className="text-xs text-stone-400">{book.first_publish_year}</p>
                )}
              </div>
              {isSelected(book.key) && (
                <div className="ml-auto flex-shrink-0 w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center text-stone-900 text-xs">
                  ✓
                </div>
              )}
            </button>
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
    </div>
  )
}
