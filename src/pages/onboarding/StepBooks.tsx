import { useEffect, useRef, useState } from 'react'
import { Button, Input, OnboardingStepHeader } from '../../components/ui'
import BookDetailModal from '../../components/BookDetailModal'
import type { DetailBook } from '../../components/BookDetailModal'
import { searchBooks } from '../../lib/bookSearch'
import type { BookResult } from '../../lib/bookSearch'
import { cn } from '../../lib/cn'
import type { OnboardingData, SelectedBook } from './index'

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
      <OnboardingStepHeader
        title="Favourite books"
        description="Add at least one book that defines you."
      />

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
                <div className="w-16 h-24 rounded-lg bg-brand-subtle flex items-center justify-center text-brand-ink text-xs font-medium text-center px-1 shadow">
                  {book.title.slice(0, 20)}
                </div>
              )}
              <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-ink text-white text-xs flex items-center justify-center">
                ×
              </div>
            </button>
          ))}
        </div>
      )}

      <Input
        type="search"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search for a book…"
        className="mb-4"
      />

      {searching && (
        <p className="text-sm text-subtle text-center py-4">Searching…</p>
      )}

      {!searching && results.length > 0 && (
        <div className="space-y-2 mb-8">
          {results.map(book => (
            <div
              key={book.external_id}
              className={cn(
                'w-full flex items-center gap-3 p-3 rounded-card border transition-colors',
                isSelected(book.external_id) ? 'border-brand bg-brand-subtle' : 'border-border bg-surface',
              )}
            >
              <button type="button" onClick={() => setDetailBook(book)} className="flex-shrink-0">
                {book.cover_url ? (
                  <img src={book.cover_url} alt="" className="w-10 h-14 object-cover rounded" />
                ) : (
                  <div className="w-10 h-14 rounded bg-canvas" />
                )}
              </button>
              <button type="button" onClick={() => toggle(book)} className="flex-1 min-w-0 text-left flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink truncate">{book.title}</p>
                  {book.author && <p className="text-xs text-muted truncate">{book.author}</p>}
                </div>
                {isSelected(book.external_id) && (
                  <div className="ml-auto flex-shrink-0 w-5 h-5 rounded-full bg-brand flex items-center justify-center text-on-brand text-xs">✓</div>
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      <Button
        onClick={() => onNext({ books: selected })}
        disabled={selected.length === 0 || submitting}
        fullWidth
        className="disabled:opacity-40"
      >
        {submitting ? 'Saving…' : 'Finish'}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        fullWidth
        onClick={() => onNext({ books: [] })}
        disabled={submitting}
        className="mt-3 disabled:opacity-40"
      >
        Skip for now
      </Button>

      <BookDetailModal book={detailBook} onClose={() => setDetailBook(null)} />
    </div>
  )
}
