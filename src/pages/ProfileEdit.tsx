import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DndContext, closestCenter, PointerSensor, TouchSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, rectSortingStrategy, useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useAuthStore } from '../store/auth'
import { useProfileStore } from '../store/profile'
import { supabase } from '../lib/supabase'
import { searchBooks } from '../lib/bookSearch'
import type { BookResult } from '../lib/bookSearch'

interface Genre { id: number; name: string }
interface BookItem { source: string; external_id: string; title: string; author: string; cover_url: string | null }

const GENDERS = [
  { value: 'man', label: 'Man' },
  { value: 'woman', label: 'Woman' },
  { value: 'nonbinary', label: 'Non-binary' },
]

const LOOKING_FOR = [
  { value: 'men', label: 'Men' },
  { value: 'women', label: 'Women' },
  { value: 'nonbinary', label: 'Non-binary' },
]

const maxBirthDate = (() => {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 18)
  return d.toISOString().split('T')[0]
})()

type Feedback = 'saved' | 'error' | null

function SortablePhoto({
  url, index, onRemove, onSetMain,
}: { url: string; index: number; onRemove: () => void; onSetMain: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: url })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  }
  return (
    <div ref={setNodeRef} style={style} className="relative aspect-square rounded-2xl overflow-hidden bg-stone-200 touch-none">
      <img
        src={url} alt=""
        className="w-full h-full object-cover cursor-grab active:cursor-grabbing"
        {...attributes} {...listeners}
      />
      {index === 0 ? (
        <span className="absolute bottom-1.5 left-1.5 text-[10px] font-semibold bg-amber-400 text-stone-900 px-1.5 py-0.5 rounded-full leading-none">
          Profile
        </span>
      ) : (
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={onSetMain}
          className="absolute bottom-1.5 left-1.5 w-6 h-6 rounded-full bg-stone-900/60 text-amber-400 text-xs flex items-center justify-center"
          aria-label="Set as profile photo"
        >
          ★
        </button>
      )}
      <button
        onPointerDown={e => e.stopPropagation()}
        onClick={onRemove}
        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-stone-900/60 text-white text-xs flex items-center justify-center"
        aria-label="Remove photo"
      >
        ×
      </button>
    </div>
  )
}

export default function ProfileEdit() {
  const { user } = useAuthStore()
  const { profile, fetch: fetchProfile } = useProfileStore()
  const navigate = useNavigate()

  // ── Photos ────────────────────────────────────────────────
  const [photos, setPhotos] = useState<string[]>(profile?.photos ?? [])
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photosSaving, setPhotosSaving] = useState(false)
  const [photosFeedback, setPhotosFeedback] = useState<Feedback>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setPhotos(prev => {
        const oldIndex = prev.indexOf(active.id as string)
        const newIndex = prev.indexOf(over.id as string)
        return arrayMove(prev, oldIndex, newIndex)
      })
    }
  }

  // ── Info ──────────────────────────────────────────────────
  const [name, setName] = useState(profile?.name ?? '')
  const [birthDate, setBirthDate] = useState(profile?.birth_date ?? '')
  const [gender, setGender] = useState(profile?.gender ?? '')
  const [lookingFor, setLookingFor] = useState<string[]>(profile?.looking_for ?? [])
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [infoSaving, setInfoSaving] = useState(false)
  const [infoFeedback, setInfoFeedback] = useState<Feedback>(null)

  // ── Genres ────────────────────────────────────────────────
  const [allGenres, setAllGenres] = useState<Genre[]>([])
  const [selectedGenres, setSelectedGenres] = useState<number[]>([])
  const [originalGenres, setOriginalGenres] = useState<number[]>([])
  const [genresSaving, setGenresSaving] = useState(false)
  const [genresFeedback, setGenresFeedback] = useState<Feedback>(null)

  // ── Books ─────────────────────────────────────────────────
  const [selectedBooks, setSelectedBooks] = useState<BookItem[]>([])
  const [originalBooks, setOriginalBooks] = useState<{ userBookId: string; external_id: string }[]>([])
  const [bookQuery, setBookQuery] = useState('')
  const [bookResults, setBookResults] = useState<BookResult[]>([])
  const [bookSearching, setBookSearching] = useState(false)
  const [booksSaving, setBooksSaving] = useState(false)
  const [booksFeedback, setBooksFeedback] = useState<Feedback>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flashTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // Load genres + user's current genre selections
  useEffect(() => {
    if (!user) return
    Promise.all([
      supabase.from('genres').select('id, name').order('name'),
      supabase.from('user_genres').select('genre_id').eq('user_id', user.id),
    ]).then(([{ data: genreData }, { data: userGenreData }]) => {
      if (genreData) setAllGenres(genreData)
      const ids = (userGenreData ?? []).map((r: { genre_id: number }) => r.genre_id)
      setSelectedGenres(ids)
      setOriginalGenres(ids)
    })
  }, [user?.id])

  // Load user's current favourite books
  useEffect(() => {
    if (!user) return
    supabase
      .from('user_books')
      .select('id, books(source, external_id, title, author, cover_url)')
      .eq('user_id', user.id)
      .eq('shelf', 'favorite')
      .then(({ data }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rows = (data ?? []) as any[]
        const books: BookItem[] = rows.map(r => r.books as BookItem | null).filter((b): b is BookItem => b !== null)
        setSelectedBooks(books)
        setOriginalBooks(rows.map(r => ({ userBookId: r.id as string, external_id: (r.books as BookItem).external_id })))
      })
  }, [user?.id])

  // Debounced book search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!bookQuery.trim()) { setBookResults([]); return }
    debounceRef.current = setTimeout(async () => {
      setBookSearching(true)
      const results = await searchBooks(bookQuery)
      setBookResults(results)
      setBookSearching(false)
    }, 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [bookQuery])

  // ── Helpers ───────────────────────────────────────────────
  const flash = (key: string, set: (v: Feedback) => void, value: Feedback) => {
    clearTimeout(flashTimers.current[key])
    set(value)
    flashTimers.current[key] = setTimeout(() => set(null), 2000)
  }

  const toggleLookingFor = (value: string) =>
    setLookingFor(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value])

  const toggleGenre = (id: number) =>
    setSelectedGenres(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id])

  const toggleBook = (book: BookResult) => {
    const id = book.external_id
    if (selectedBooks.some(b => b.external_id === id)) {
      setSelectedBooks(prev => prev.filter(b => b.external_id !== id))
    } else {
      setSelectedBooks(prev => [...prev, {
        source: book.source,
        external_id: id,
        title: book.title,
        author: book.author,
        cover_url: book.cover_url,
      }])
    }
  }

  // ── Save handlers ─────────────────────────────────────────
  const handlePhotoUpload = async (files: FileList | null) => {
    if (!files || !user) return
    setPhotoUploading(true)
    const filesToUpload = Array.from(files).slice(0, 6 - photos.length)
    const results = await Promise.all(
      filesToUpload.map(async file => {
        const ext = file.name.split('.').pop()
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error } = await supabase.storage.from('photos').upload(path, file)
        if (error) return null
        return supabase.storage.from('photos').getPublicUrl(path).data.publicUrl
      })
    )
    const newUrls = results.filter((url): url is string => url !== null)
    setPhotos(prev => [...prev, ...newUrls])
    setPhotoUploading(false)
  }

  const savePhotos = async () => {
    if (!user) return
    setPhotosSaving(true)
    const { error } = await supabase.from('profiles').update({ photos }).eq('id', user.id)
    setPhotosSaving(false)
    if (!error) { await fetchProfile(user.id); flash('photos', setPhotosFeedback, 'saved') }
    else flash('photos', setPhotosFeedback, 'error')
  }

  const saveInfo = async () => {
    if (!user) return
    setInfoSaving(true)
    const { error } = await supabase.from('profiles').update({
      name: name.trim(), birth_date: birthDate, gender, looking_for: lookingFor, bio: bio.trim() || null,
    }).eq('id', user.id)
    setInfoSaving(false)
    if (!error) { await fetchProfile(user.id); flash('info', setInfoFeedback, 'saved') }
    else flash('info', setInfoFeedback, 'error')
  }

  const saveGenres = async () => {
    if (!user) return
    setGenresSaving(true)
    await supabase.from('user_genres').delete().eq('user_id', user.id)
    const { error } = selectedGenres.length
      ? await supabase.from('user_genres').insert(selectedGenres.map(genre_id => ({ user_id: user.id, genre_id })))
      : { error: null }
    setGenresSaving(false)
    if (!error) { setOriginalGenres([...selectedGenres]); flash('genres', setGenresFeedback, 'saved') }
    else flash('genres', setGenresFeedback, 'error')
  }

  const saveBooks = async () => {
    if (!user) return
    setBooksSaving(true)

    const selectedIds = new Set(selectedBooks.map(b => b.external_id))
    const originalIdSet = new Set(originalBooks.map(b => b.external_id))

    // Delete only removed books (preserves ratings on other shelves; ratings on removed favorites are intentionally discarded)
    const removedUserBookIds = originalBooks.filter(b => !selectedIds.has(b.external_id)).map(b => b.userBookId)
    if (removedUserBookIds.length > 0) {
      await supabase.from('user_books').delete().in('id', removedUserBookIds)
    }

    // Upsert only newly added books — existing ones (with their ratings) are left untouched
    const toAdd = selectedBooks.filter(b => !originalIdSet.has(b.external_id))
    let allAdded = true
    for (const book of toAdd) {
      const { data: bookRow } = await supabase
        .from('books')
        .upsert(
          { source: book.source, external_id: book.external_id, title: book.title, author: book.author, cover_url: book.cover_url },
          { onConflict: 'source,external_id' }
        )
        .select('id')
        .single()
      if (!bookRow) { allAdded = false; continue }
      await supabase.from('user_books').upsert(
        { user_id: user.id, book_id: bookRow.id, shelf: 'favorite' },
        { onConflict: 'user_id,book_id' }
      )
    }

    // Refresh to sync new userBookIds into originalBooks state
    const { data: refreshed } = await supabase
      .from('user_books')
      .select('id, books(external_id)')
      .eq('user_id', user.id)
      .eq('shelf', 'favorite')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setOriginalBooks((refreshed ?? []).map((r: any) => ({ userBookId: r.id as string, external_id: r.books.external_id as string })))

    setBooksSaving(false)
    flash('books', setBooksFeedback, allAdded ? 'saved' : 'error')
  }

  // ── Dirty checks ──────────────────────────────────────────
  const photosDirty = JSON.stringify(photos) !== JSON.stringify(profile?.photos ?? [])
  const infoDirty =
    name.trim() !== (profile?.name ?? '') ||
    birthDate !== (profile?.birth_date ?? '') ||
    gender !== (profile?.gender ?? '') ||
    JSON.stringify([...lookingFor].sort()) !== JSON.stringify([...(profile?.looking_for ?? [])].sort()) ||
    bio.trim() !== (profile?.bio ?? '')
  const genresDirty =
    JSON.stringify([...selectedGenres].sort()) !== JSON.stringify([...originalGenres].sort())
  const booksDirty =
    JSON.stringify([...selectedBooks.map(b => b.external_id)].sort()) !==
    JSON.stringify([...originalBooks.map(b => b.external_id)].sort())

  if (!profile || !user) return null

  return (
    <div className="h-screen bg-stone-50 flex flex-col overflow-hidden">

      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-stone-200 px-4 safe-top pb-3 flex items-center gap-3">
        <button
          onClick={() => navigate('/profile')}
          className="text-3xl text-stone-500 hover:text-stone-900 transition-colors p-1 -ml-1"
          aria-label="Back"
        >
          ‹
        </button>
        <p className="font-semibold text-stone-900 flex-1">Edit profile</p>
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* ── Photos ── */}
        <section className="bg-white border-b border-stone-100 px-6 py-6">
          <h2 className="text-base font-semibold text-stone-900 mb-4">Photos</h2>
          <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={photos} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {photos.map((url, i) => (
                  <SortablePhoto
                    key={url}
                    url={url}
                    index={i}
                    onRemove={() => setPhotos(prev => prev.filter((_, j) => j !== i))}
                    onSetMain={() => setPhotos(prev => arrayMove(prev, i, 0))}
                  />
                ))}
                {photos.length < 6 && Array.from({ length: 6 - photos.length }).map((_, i) => (
                  <button
                    key={`empty-${i}`}
                    onClick={() => photoInputRef.current?.click()}
                    disabled={photoUploading}
                    className="aspect-square rounded-2xl border-2 border-dashed border-stone-300 flex items-center justify-center text-stone-400 hover:border-amber-400 hover:text-amber-500 transition-colors disabled:opacity-40"
                  >
                    <span className="text-2xl">+</span>
                  </button>
                ))}
              </div>
            </SortableContext>
          </DndContext>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={e => { handlePhotoUpload(e.target.files); e.target.value = '' }}
          />
          {photosFeedback === 'error' && <p className="text-xs text-red-500 mb-2">Failed to save photos.</p>}
          {photosFeedback === 'saved' && <p className="text-xs text-green-600 mb-2">Saved.</p>}
          <button
            onClick={savePhotos}
            disabled={!photosDirty || photosSaving || photoUploading || photos.length === 0}
            className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-stone-900 font-semibold text-sm transition-colors disabled:opacity-40"
          >
            {photosSaving ? 'Saving…' : 'Save photos'}
          </button>
        </section>

        {/* ── Info ── */}
        <section className="bg-white border-b border-stone-100 px-6 py-6 space-y-5">
          <h2 className="text-base font-semibold text-stone-900">About you</h2>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-stone-50 text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">Date of birth</label>
            <input
              type="date"
              value={birthDate}
              onChange={e => setBirthDate(e.target.value)}
              max={maxBirthDate}
              className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-stone-50 text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">I am a…</label>
            <div className="flex gap-2 flex-wrap">
              {GENDERS.map(g => (
                <button
                  key={g.value}
                  onClick={() => setGender(g.value)}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                    gender === g.value
                      ? 'bg-amber-400 border-amber-400 text-stone-900'
                      : 'bg-white border-stone-200 text-stone-700 hover:border-amber-300'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Looking for…</label>
            <div className="flex gap-2 flex-wrap">
              {LOOKING_FOR.map(l => (
                <button
                  key={l.value}
                  onClick={() => toggleLookingFor(l.value)}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                    lookingFor.includes(l.value)
                      ? 'bg-amber-400 border-amber-400 text-stone-900'
                      : 'bg-white border-stone-200 text-stone-700 hover:border-amber-300'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <label className="text-sm font-medium text-stone-700">About me <span className="text-stone-400 font-normal">(optional)</span></label>
              <span className="text-xs text-stone-400">{bio.length}/300</span>
            </div>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value.slice(0, 300))}
              placeholder="What are you reading lately? What do you love about books?"
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-stone-50 text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
            />
          </div>

          {infoFeedback === 'error' && <p className="text-xs text-red-500">Failed to save.</p>}
          {infoFeedback === 'saved' && <p className="text-xs text-green-600">Saved.</p>}
          <button
            onClick={saveInfo}
            disabled={!infoDirty || infoSaving || !name.trim() || !birthDate || !gender || lookingFor.length === 0}
            className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-stone-900 font-semibold text-sm transition-colors disabled:opacity-40"
          >
            {infoSaving ? 'Saving…' : 'Save info'}
          </button>
        </section>

        {/* ── Genres ── */}
        <section className="bg-white border-b border-stone-100 px-6 py-6">
          <h2 className="text-base font-semibold text-stone-900 mb-1">Genres</h2>
          <p className="text-stone-500 text-xs mb-4">Pick at least 3.</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {allGenres.map(g => (
              <button
                key={g.id}
                onClick={() => toggleGenre(g.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                  selectedGenres.includes(g.id)
                    ? 'bg-amber-400 border-amber-400 text-stone-900'
                    : 'bg-white border-stone-200 text-stone-700 hover:border-amber-300'
                }`}
              >
                {g.name}
              </button>
            ))}
          </div>
          {genresFeedback === 'error' && <p className="text-xs text-red-500 mb-2">Failed to save.</p>}
          {genresFeedback === 'saved' && <p className="text-xs text-green-600 mb-2">Saved.</p>}
          <button
            onClick={saveGenres}
            disabled={!genresDirty || genresSaving || selectedGenres.length < 3}
            className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-stone-900 font-semibold text-sm transition-colors disabled:opacity-40"
          >
            {genresSaving ? 'Saving…' : 'Save genres'}
          </button>
        </section>

        {/* ── Books ── */}
        <section className="bg-white px-6 py-6 pb-12">
          <h2 className="text-base font-semibold text-stone-900 mb-1">Favourite books</h2>
          <p className="text-stone-500 text-xs mb-4">At least 1 required.</p>

          {selectedBooks.length > 0 && (
            <div className="flex gap-3 overflow-x-auto pb-3 mb-4 -mx-6 px-6">
              {selectedBooks.map(book => (
                <button
                  key={book.external_id}
                  onClick={() => setSelectedBooks(prev => prev.filter(b => b.external_id !== book.external_id))}
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
            value={bookQuery}
            onChange={e => setBookQuery(e.target.value)}
            placeholder="Search to add books…"
            className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-stone-50 text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400 mb-3"
          />

          {bookSearching && <p className="text-sm text-stone-400 text-center py-3">Searching…</p>}

          {!bookSearching && bookResults.length > 0 && (
            <div className="space-y-2 mb-4">
              {bookResults.map(book => {
                const isSelected = selectedBooks.some(b => b.external_id === book.external_id)
                return (
                  <button
                    key={book.external_id}
                    onClick={() => toggleBook(book)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-left ${
                      isSelected
                        ? 'border-amber-400 bg-amber-50'
                        : 'border-stone-200 bg-white hover:border-amber-300'
                    }`}
                  >
                    {book.cover_url ? (
                      <img src={book.cover_url} alt="" className="w-10 h-14 object-cover rounded flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-14 rounded bg-stone-100 flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-stone-900 truncate">{book.title}</p>
                      {book.author && (
                        <p className="text-xs text-stone-500 truncate">{book.author}</p>
                      )}
                    </div>
                    {isSelected && (
                      <div className="ml-auto flex-shrink-0 w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center text-stone-900 text-xs">
                        ✓
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {booksFeedback === 'error' && <p className="text-xs text-red-500 mb-2">Failed to save.</p>}
          {booksFeedback === 'saved' && <p className="text-xs text-green-600 mb-2">Saved.</p>}
          <button
            onClick={saveBooks}
            disabled={!booksDirty || booksSaving || selectedBooks.length === 0}
            className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-stone-900 font-semibold text-sm transition-colors disabled:opacity-40"
          >
            {booksSaving ? 'Saving…' : 'Save books'}
          </button>
        </section>

      </div>
    </div>
  )
}
