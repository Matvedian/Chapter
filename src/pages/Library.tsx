import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuthStore } from '../store/auth'
import { supabase } from '../lib/supabase'
import { searchBooks } from '../lib/bookSearch'
import type { BookResult } from '../lib/bookSearch'
import BottomNav from '../components/BottomNav'

type Shelf = 'favorite' | 'reading' | 'read' | 'want_to_read'

interface LibraryBook {
  userBookId: string
  bookId: string
  shelf: Shelf
  rating: number | null
  title: string
  author: string
  cover_url: string | null
  source: string
  external_id: string
}

const SHELVES: { key: Shelf | 'all'; label: string }[] = [
  { key: 'all',          label: 'All' },
  { key: 'favorite',     label: 'Favourites' },
  { key: 'reading',      label: 'Reading' },
  { key: 'read',         label: 'Read' },
  { key: 'want_to_read', label: 'Want to read' },
]

const SHELF_LABELS: Record<Shelf, string> = {
  favorite:     'Favourite',
  reading:      'Reading',
  read:         'Read',
  want_to_read: 'Want to read',
}

function SkeletonCard() {
  return (
    <div className="flex flex-col gap-2">
      <div className="w-full aspect-[2/3] rounded-xl skeleton" />
      <div className="h-3 rounded skeleton w-3/4" />
      <div className="h-2.5 rounded skeleton w-1/2" />
    </div>
  )
}

export default function Library() {
  const { user } = useAuthStore()
  const [books, setBooks] = useState<LibraryBook[]>([])
  const [loading, setLoading] = useState(true)
  const [activeShelf, setActiveShelf] = useState<Shelf | 'all'>('all')

  // Search / add panel
  const [showSearch, setShowSearch] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<BookResult[]>([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Book action sheet
  const [selected, setSelected] = useState<LibraryBook | null>(null)
  const [moving, setMoving] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('user_books')
      .select('id, shelf, rating, books(id, title, author, cover_url, source, external_id)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapped: LibraryBook[] = (data ?? []).map((r: any) => ({
      userBookId: r.id,
      bookId: r.books.id,
      shelf: r.shelf as Shelf,
      rating: r.rating ?? null,
      title: r.books.title,
      author: r.books.author,
      cover_url: r.books.cover_url,
      source: r.books.source,
      external_id: r.books.external_id,
    }))
    setBooks(mapped)
    setLoading(false)
  }, [user?.id])

  useEffect(() => { load() }, [load])

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) { setResults([]); return }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      setResults(await searchBooks(query))
      setSearching(false)
    }, 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  const addBook = async (book: BookResult, shelf: Shelf) => {
    if (!user) return
    const { data: bookRow } = await supabase
      .from('books')
      .upsert(
        { source: book.source, external_id: book.external_id, title: book.title, author: book.author, cover_url: book.cover_url },
        { onConflict: 'source,external_id' }
      )
      .select('id')
      .single()
    if (!bookRow) return
    await supabase.from('user_books').upsert(
      { user_id: user.id, book_id: bookRow.id, shelf },
      { onConflict: 'user_id,book_id' }
    )
    await load()
  }

  const moveToShelf = async (book: LibraryBook, shelf: Shelf) => {
    setMoving(true)
    await supabase.from('user_books').update({ shelf }).eq('id', book.userBookId)
    setMoving(false)
    setSelected(null)
    setBooks(prev => prev.map(b => b.userBookId === book.userBookId ? { ...b, shelf } : b))
  }

  const rateBook = async (book: LibraryBook, rating: number) => {
    const newRating = book.rating === rating ? null : rating
    await supabase.from('user_books').update({ rating: newRating }).eq('id', book.userBookId)
    setBooks(prev => prev.map(b => b.userBookId === book.userBookId ? { ...b, rating: newRating } : b))
    setSelected(prev => prev?.userBookId === book.userBookId ? { ...prev, rating: newRating } : prev)
  }

  const removeBook = async (book: LibraryBook) => {
    setMoving(true)
    await supabase.from('user_books').delete().eq('id', book.userBookId)
    setMoving(false)
    setSelected(null)
    setBooks(prev => prev.filter(b => b.userBookId !== book.userBookId))
  }

  const visible = activeShelf === 'all' ? books : books.filter(b => b.shelf === activeShelf)
  const inLibraryIds = new Set(books.map(b => b.external_id))

  return (
    <div className="h-screen bg-stone-50 flex flex-col overflow-hidden">

      {/* Header */}
      <div className="px-6 safe-top pb-3 flex-shrink-0 flex items-end justify-between">
        <h1 className="text-2xl font-bold text-stone-900">My Library</h1>
        <button
          onClick={() => { setShowSearch(true); setQuery(''); setResults([]) }}
          className="w-9 h-9 rounded-full bg-amber-400 flex items-center justify-center text-stone-900 font-bold text-xl leading-none"
        >
          +
        </button>
      </div>

      {/* Shelf tabs */}
      <div className="flex-shrink-0 flex gap-2 overflow-x-auto px-6 pb-3 no-scrollbar">
        {SHELVES.map(s => (
          <button
            key={s.key}
            onClick={() => setActiveShelf(s.key)}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeShelf === s.key
                ? 'bg-amber-400 text-stone-900'
                : 'bg-white border border-stone-200 text-stone-500'
            }`}
          >
            {s.label}
            {s.key !== 'all' && (
              <span className="ml-1.5 text-xs opacity-60">
                {books.filter(b => b.shelf === s.key).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Books grid */}
      <div className="flex-1 overflow-y-auto px-6 pb-4">
        {loading ? (
          <div className="grid grid-cols-3 gap-4">
            {[...Array(9)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : visible.length === 0 ? (
          <div className="text-center pt-16">
            <p className="text-4xl mb-3">📚</p>
            <h2 className="text-lg font-bold text-stone-900">
              {activeShelf === 'all' ? 'Your library is empty' : `No books here yet`}
            </h2>
            <p className="text-stone-500 text-sm mt-1">Tap + to add your first book.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {visible.map(book => (
              <button
                key={book.userBookId}
                onClick={() => setSelected(book)}
                className="flex flex-col gap-1.5 text-left"
              >
                {book.cover_url ? (
                  <img
                    src={book.cover_url}
                    alt={book.title}
                    className="w-full aspect-[2/3] object-cover rounded-xl shadow-sm"
                  />
                ) : (
                  <div className="w-full aspect-[2/3] rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 text-xs font-medium text-center px-2">
                    {book.title.slice(0, 30)}
                  </div>
                )}
                <p className="text-xs font-medium text-stone-900 leading-tight line-clamp-2">{book.title}</p>
                <p className="text-xs text-stone-400 truncate">{book.author}</p>
                {book.rating && (
                  <p className="text-xs text-amber-400 leading-none">{'★'.repeat(book.rating)}{'☆'.repeat(5 - book.rating)}</p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <BottomNav />

      {/* Add book panel */}
      {showSearch && (
        <div className="fixed inset-0 z-50 flex flex-col bg-stone-50">
          <div className="px-6 safe-top pb-3 flex items-center gap-3 bg-white border-b border-stone-100">
            <button onClick={() => setShowSearch(false)} className="text-3xl text-stone-500 p-1 -ml-1">‹</button>
            <h2 className="font-semibold text-stone-900 flex-1">Add to library</h2>
          </div>
          <div className="px-6 pt-4 pb-2 flex-shrink-0">
            <input
              autoFocus
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search for a book…"
              className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div className="flex-1 overflow-y-auto px-6">
            {searching && <p className="text-sm text-stone-400 text-center py-6">Searching…</p>}
            {!searching && results.map(book => {
              const inLib = inLibraryIds.has(book.external_id)
              return (
                <div key={book.external_id} className="flex items-center gap-3 py-3 border-b border-stone-100">
                  {book.cover_url ? (
                    <img src={book.cover_url} alt="" className="w-10 h-14 object-cover rounded flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-14 rounded bg-stone-100 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-900 truncate">{book.title}</p>
                    {book.author && <p className="text-xs text-stone-500 truncate">{book.author}</p>}
                  </div>
                  {inLib ? (
                    <span className="text-xs text-stone-400 flex-shrink-0">In library</span>
                  ) : (
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      {(['favorite','reading','want_to_read'] as Shelf[]).map(s => (
                        <button
                          key={s}
                          onClick={() => addBook(book, s).then(() => inLibraryIds.add(book.external_id))}
                          className="text-xs px-2.5 py-1 rounded-lg bg-amber-400 text-stone-900 font-medium"
                        >
                          {SHELF_LABELS[s]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Book action sheet */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setSelected(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full bg-white rounded-t-3xl px-6 pt-5 pb-10 safe-bottom"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-4 mb-5">
              {selected.cover_url ? (
                <img src={selected.cover_url} alt="" className="w-12 h-16 object-cover rounded-lg flex-shrink-0" />
              ) : (
                <div className="w-12 h-16 rounded-lg bg-amber-100 flex-shrink-0" />
              )}
              <div className="min-w-0">
                <p className="font-semibold text-stone-900 leading-tight">{selected.title}</p>
                <p className="text-sm text-stone-500">{selected.author}</p>
                <p className="text-xs text-amber-600 mt-0.5">{SHELF_LABELS[selected.shelf]}</p>
              </div>
            </div>
            <div className="mb-5">
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">Your rating</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    onClick={() => rateBook(selected, star)}
                    className={`text-2xl transition-opacity ${star <= (selected.rating ?? 0) ? 'opacity-100' : 'opacity-25'}`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-3">Move to</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {(Object.keys(SHELF_LABELS) as Shelf[]).filter(s => s !== selected.shelf).map(s => (
                <button
                  key={s}
                  disabled={moving}
                  onClick={() => moveToShelf(selected, s)}
                  className="py-2.5 rounded-xl border border-stone-200 text-sm font-medium text-stone-700 hover:border-amber-400 transition-colors disabled:opacity-40"
                >
                  {SHELF_LABELS[s]}
                </button>
              ))}
            </div>
            <button
              disabled={moving}
              onClick={() => removeBook(selected)}
              className="w-full py-2.5 rounded-xl text-sm font-medium text-red-500 border border-red-100 disabled:opacity-40"
            >
              Remove from library
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
