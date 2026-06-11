import { useCallback, useEffect, useRef, useState } from 'react'
import TinderCard from 'react-tinder-card'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { useAuthStore } from '../store/auth'
import { supabase } from '../lib/supabase'
import BookDetailModal from '../components/BookDetailModal'
import type { DetailBook } from '../components/BookDetailModal'
import BottomNav from '../components/BottomNav'

interface Candidate {
  id: string
  name: string | null
  birth_date: string | null
  photos: string[]
  score: number
  gender: string | null
  bio: string | null
}

interface ProfileModal {
  candidate: Candidate
  genres: string[]
  books: { title: string; author: string; cover_url: string | null; rating: number | null; source: string; external_id: string }[]
  loadingExtra: boolean
  photoIndex: number
}

interface Filters {
  minAge: number
  maxAge: number
  genders: string[]
}

const DEFAULT_FILTERS: Filters = { minAge: 18, maxAge: 80, genders: [] }
const GENDER_OPTIONS = ['man', 'woman', 'non-binary', 'other']

function getAge(birthDate: string): number {
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

function applyFilters(candidates: Candidate[], f: Filters): Candidate[] {
  return candidates.filter(c => {
    if (c.birth_date) {
      const age = getAge(c.birth_date)
      if (age < f.minAge || age > f.maxAge) return false
    }
    if (f.genders.length > 0 && !f.genders.includes(c.gender ?? '')) return false
    return true
  })
}

function filtersActive(f: Filters): boolean {
  return f.minAge !== DEFAULT_FILTERS.minAge
    || f.maxAge !== DEFAULT_FILTERS.maxAge
    || f.genders.length > 0
}

function DualRangeSlider({ min, max, low, high, onChange }: {
  min: number; max: number; low: number; high: number
  onChange: (low: number, high: number) => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const dragging = useRef<'low' | 'high' | null>(null)

  const pct = (v: number) => ((v - min) / (max - min)) * 100

  const valueFromX = (clientX: number) => {
    const rect = trackRef.current!.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return Math.round(min + ratio * (max - min))
  }

  const onPointerDown = (e: React.PointerEvent) => {
    const v = valueFromX(e.clientX)
    dragging.current = Math.abs(v - low) <= Math.abs(v - high) ? 'low' : 'high';
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    if (dragging.current === 'low') onChange(Math.min(v, high - 1), high)
    else onChange(low, Math.max(v, low + 1))
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return
    const v = valueFromX(e.clientX)
    if (dragging.current === 'low') onChange(Math.min(v, high - 1), high)
    else onChange(low, Math.max(v, low + 1))
  }

  const lowPct = pct(low)
  const highPct = pct(high)

  return (
    <div className="pt-2 pb-5">
      <div
        ref={trackRef}
        className="relative h-8 flex items-center cursor-pointer select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => { dragging.current = null }}
      >
        <div className="absolute left-0 right-0 h-1.5 bg-border rounded-full" />
        <div
          className="absolute h-1.5 bg-brand rounded-full"
          style={{ left: `${lowPct}%`, right: `${100 - highPct}%` }}
        />
        <div
          className="absolute w-6 h-6 bg-surface rounded-full border-2 border-brand shadow"
          style={{ left: `${lowPct}%`, transform: 'translateX(-50%)' }}
        />
        <div
          className="absolute w-6 h-6 bg-surface rounded-full border-2 border-brand shadow"
          style={{ left: `${highPct}%`, transform: 'translateX(-50%)' }}
        />
      </div>
      <div className="relative h-4">
        <span
          className="absolute text-xs font-medium text-ink-secondary -translate-x-1/2"
          style={{ left: `${lowPct}%` }}
        >{low}</span>
        <span
          className="absolute text-xs font-medium text-ink-secondary -translate-x-1/2"
          style={{ left: `${highPct}%` }}
        >{high}</span>
      </div>
    </div>
  )
}

export default function Discover() {
  const { user } = useAuthStore()
  const [allCandidates, setAllCandidates] = useState<Candidate[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [swipeDir, setSwipeDir] = useState<'left' | 'right' | null>(null)
  const [matchName, setMatchName] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [draft, setDraft] = useState<Filters>(DEFAULT_FILTERS)
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set())
  const [cardPhotoIndex, setCardPhotoIndex] = useState<Map<string, number>>(new Map())
  const [profileModal, setProfileModal] = useState<ProfileModal | null>(null)
  const [detailBook, setDetailBook] = useState<DetailBook | null>(null)
  const topCardRef = useRef<any>(null)
  const swiping = useRef(false)
  const profileLoadRef = useRef<string | null>(null)

  const loadCandidates = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setFetchError(false)

    const { data: rpcData, error: rpcError } = await supabase.rpc('get_candidates', { p_user_id: user.id })
    if (rpcError) { setFetchError(true); setLoading(false); return }
    if (!rpcData?.length) { setLoading(false); return }

    const rows = rpcData as { profile_id: string; score: number }[]
    const ids = rows.map(r => r.profile_id)
    const scoreMap = Object.fromEntries(rows.map(r => [r.profile_id, r.score]))

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, name, birth_date, photos, gender, bio')
      .in('id', ids)

    if (profilesError) { setFetchError(true); setLoading(false); return }
    if (!profiles?.length) { setLoading(false); return }

    const profileMap = Object.fromEntries(profiles.map(p => [p.id, p]))
    const enriched: Candidate[] = ids
      .map(id => {
        const p = profileMap[id]
        return p ? {
          id: p.id,
          name: p.name,
          birth_date: p.birth_date,
          photos: p.photos ?? [],
          score: scoreMap[id] ?? 0,
          gender: p.gender ?? null,
          bio: p.bio ?? null,
        } : null
      })
      .filter((c): c is Candidate => c !== null)

    setAllCandidates(enriched)
    setLoading(false)
  }, [user?.id])

  useEffect(() => { loadCandidates() }, [loadCandidates])

  // Re-apply filters whenever allCandidates or filters change
  useEffect(() => {
    const filtered = applyFilters(allCandidates, filters)
    setCandidates(filtered)
    setCurrentIndex(filtered.length - 1)
  }, [allCandidates, filters])

  const handleSwipe = useCallback(async (direction: string, candidate: Candidate) => {
    setSwipeDir(null)
    const dirValue = direction === 'right' ? 'like' : 'pass'
    Haptics.impact({ style: dirValue === 'like' ? ImpactStyle.Medium : ImpactStyle.Light })

    await supabase.from('swipes').insert({
      swiper_id: user!.id,
      swiped_id: candidate.id,
      direction: dirValue,
    })

    if (dirValue === 'like') {
      const { data: match } = await supabase
        .from('matches')
        .select('id')
        .or(`and(user1_id.eq.${user!.id},user2_id.eq.${candidate.id}),and(user1_id.eq.${candidate.id},user2_id.eq.${user!.id})`)
        .maybeSingle()
      if (match) {
        Haptics.notification({ type: NotificationType.Success })
        setMatchName(candidate.name ?? 'Someone')
      }
    }
  }, [user?.id])

  const handleCardLeft = useCallback(() => {
    swiping.current = false
    setCurrentIndex(prev => prev - 1)
    setSwipeDir(null)
  }, [])

  const triggerSwipe = async (dir: 'left' | 'right') => {
    if (currentIndex < 0 || !topCardRef.current || swiping.current) return
    swiping.current = true
    await topCardRef.current.swipe(dir)
  }

  const applyDraft = () => {
    setFilters(draft)
    setShowFilters(false)
  }

  const resetFilters = () => {
    setDraft(DEFAULT_FILTERS)
    setFilters(DEFAULT_FILTERS)
    setShowFilters(false)
  }

  const toggleGender = (g: string) => {
    setDraft(d => ({
      ...d,
      genders: d.genders.includes(g) ? d.genders.filter(x => x !== g) : [...d.genders, g],
    }))
  }

  const navigatePhoto = (candidateId: string, photos: string[], dir: 1 | -1) => {
    setCardPhotoIndex(prev => {
      const m = new Map(prev)
      const cur = m.get(candidateId) ?? 0
      m.set(candidateId, Math.max(0, Math.min(photos.length - 1, cur + dir)))
      return m
    })
  }

  const openProfile = async (candidate: Candidate) => {
    profileLoadRef.current = candidate.id
    setProfileModal({ candidate, genres: [], books: [], loadingExtra: true, photoIndex: 0 })
    const [{ data: ugData }, { data: ubData }] = await Promise.all([
      supabase.from('user_genres').select('genres(name)').eq('user_id', candidate.id),
      supabase.from('user_books').select('rating, books(title, author, cover_url, source, external_id)').eq('user_id', candidate.id).eq('shelf', 'favorite'),
    ])
    if (profileLoadRef.current !== candidate.id) return
    setProfileModal(prev => prev ? {
      ...prev,
      genres: ((ugData ?? []) as any[]).map(r => r.genres?.name).filter(Boolean),
      books: ((ubData ?? []) as any[]).map(r => r.books ? { ...r.books, rating: r.rating ?? null } : null).filter(Boolean),
      loadingExtra: false,
    } : null)
  }

  if (loading) {
    return (
      <div className="h-screen bg-canvas flex flex-col overflow-hidden">
        <div className="px-6 safe-top pb-3 flex-shrink-0 flex items-center justify-between">
          <div className="w-8" />
          <h1 className="text-display text-2xl">Chapter</h1>
          <div className="w-8" />
        </div>
        <div className="flex-1 flex items-center justify-center overflow-hidden">
          <div className="rounded-3xl skeleton" style={{ width: 320, height: 480 }} />
        </div>
        <div className="flex-shrink-0 flex justify-center gap-8 py-5">
          <div className="w-16 h-16 rounded-full skeleton" />
          <div className="w-16 h-16 rounded-full skeleton" />
        </div>
        <BottomNav />
      </div>
    )
  }

  const isEmpty = candidates.length === 0 || currentIndex < 0

  return (
    <div className="h-screen bg-canvas flex flex-col overflow-hidden">

      {/* Header */}
      <div className="px-6 safe-top pb-3 flex-shrink-0 flex items-center justify-between">
        <div className="w-8" />
        <h1 className="text-display text-2xl">Chapter</h1>
        <button
          onClick={() => { setDraft(filters); setShowFilters(true) }}
          className="relative w-8 h-8 flex items-center justify-center text-subtle hover:text-ink-secondary transition-colors"
          aria-label="Filters"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="8" y1="12" x2="16" y2="12" />
            <line x1="11" y1="18" x2="13" y2="18" />
          </svg>
          {filtersActive(filters) && (
            <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-brand" />
          )}
        </button>
      </div>

      {/* Card area */}
      <div className="flex-1 flex items-center justify-center overflow-hidden">
        {isEmpty ? (
          fetchError ? (
            <div className="text-center px-8">
              <h2 className="text-xl font-bold text-ink">Something went wrong</h2>
              <p className="text-muted text-sm mt-2">Couldn't load profiles. Check your connection.</p>
              <button
                onClick={loadCandidates}
                className="mt-5 px-5 py-2.5 rounded-xl bg-brand text-ink font-semibold text-sm"
              >
                Try again
              </button>
            </div>
          ) : (
            <div className="text-center px-8">
              <p className="text-5xl mb-4">📚</p>
              <h2 className="text-xl font-bold text-ink">
                {filtersActive(filters) ? 'No matches for these filters' : 'All caught up'}
              </h2>
              <p className="text-muted text-sm mt-2">
                {filtersActive(filters)
                  ? 'Try widening your filters to see more readers.'
                  : "You've seen everyone. Check back as more readers join."}
              </p>
              {filtersActive(filters) && (
                <button
                  onClick={resetFilters}
                  className="mt-4 px-4 py-2 rounded-xl bg-brand text-ink font-semibold text-sm"
                >
                  Reset filters
                </button>
              )}
            </div>
          )
        ) : (
          <div className="relative" style={{ width: 320, height: 480 }}>
            {candidates.map((candidate, index) => {
              if (index < currentIndex - 1 || index > currentIndex) return null
              const isTop = index === currentIndex
              const photoIdx = cardPhotoIndex.get(candidate.id) ?? 0
              const photoUrl = candidate.photos[photoIdx] ?? null
              const imgKey = photoUrl ?? `${candidate.id}:nophoto`

              return (
                <TinderCard
                  ref={isTop ? topCardRef : undefined}
                  key={candidate.id}
                  onSwipe={(dir) => handleSwipe(dir, candidate)}
                  onCardLeftScreen={() => { if (isTop) handleCardLeft() }}
                  onSwipeRequirementFulfilled={(dir) => {
                    if (isTop) setSwipeDir(dir as 'left' | 'right')
                  }}
                  onSwipeRequirementUnfulfilled={() => {
                    if (isTop) setSwipeDir(null)
                  }}
                  preventSwipe={['up', 'down']}
                  swipeRequirementType="position"
                  swipeThreshold={80}
                  className="absolute top-0 left-0 w-full h-full"
                >
                  <div
                    className="w-full h-full rounded-3xl overflow-hidden shadow-2xl select-none relative bg-border"
                    style={{
                      transform: !isTop ? 'scale(0.93) translateY(-12px)' : undefined,
                      transition: 'transform 0.2s ease',
                    }}
                  >
                    {photoUrl ? (
                      <>
                        {!loadedImages.has(imgKey) && (
                          <div className="absolute inset-0 skeleton" />
                        )}
                        <img
                          src={photoUrl}
                          alt=""
                          className={`w-full h-full object-cover transition-opacity duration-300 ${loadedImages.has(imgKey) ? 'opacity-100' : 'opacity-0'}`}
                          draggable={false}
                          onLoad={() => setLoadedImages(prev => new Set(prev).add(imgKey))}
                        />
                        {candidate.photos.length > 1 && (
                          <div className="absolute top-3 left-0 right-0 flex justify-center gap-1.5 z-10 pointer-events-none">
                            {candidate.photos.map((_, i) => (
                              <div
                                key={i}
                                className={`h-1 rounded-full transition-all duration-200 ${i === photoIdx ? 'w-5 bg-surface' : 'w-1.5 bg-surface/50'}`}
                              />
                            ))}
                          </div>
                        )}
                        {isTop && candidate.photos.length > 1 && (
                          <>
                            <div
                              className="absolute left-0 top-0 w-1/3 h-4/5 z-10"
                              onClick={() => navigatePhoto(candidate.id, candidate.photos, -1)}
                            />
                            <div
                              className="absolute right-0 top-0 w-1/3 h-4/5 z-10"
                              onClick={() => navigatePhoto(candidate.id, candidate.photos, 1)}
                            />
                          </>
                        )}
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-brand-subtle">
                        <span className="text-7xl">📖</span>
                      </div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/5 to-transparent pointer-events-none" />

                    {isTop && swipeDir === 'right' && (
                      <div className="absolute top-8 left-6 border-4 border-success text-success font-black text-3xl px-3 py-1 rounded-xl -rotate-12 pointer-events-none">
                        LIKE
                      </div>
                    )}
                    {isTop && swipeDir === 'left' && (
                      <div className="absolute top-8 right-6 border-4 border-destructive text-destructive font-black text-3xl px-3 py-1 rounded-xl rotate-12 pointer-events-none">
                        NOPE
                      </div>
                    )}

                    <div className="absolute bottom-0 left-0 right-0 p-5 z-20">
                      <div className="flex items-end justify-between">
                        <p className="text-xl font-bold text-white leading-snug pointer-events-none">
                          {candidate.name ?? 'Reader'}
                          {candidate.birth_date ? `, ${getAge(candidate.birth_date)}` : ''}
                        </p>
                        <div className="flex items-center gap-2 shrink-0">
                          {candidate.score > 0 && (
                            <span className="bg-brand text-ink text-xs font-bold px-2.5 py-1 rounded-full pointer-events-none">
                              📚 {candidate.score}
                            </span>
                          )}
                          {isTop && (
                            <button
                              onClick={e => { e.stopPropagation(); openProfile(candidate) }}
                              className="w-9 h-9 rounded-full bg-surface/25 backdrop-blur-sm flex items-center justify-center text-white hover:bg-surface/40 transition-colors"
                              aria-label="View profile"
                            >
                              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </TinderCard>
              )
            })}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex-shrink-0 flex justify-center gap-8 py-5">
        <button
          onClick={() => triggerSwipe('left')}
          disabled={isEmpty}
          className="w-16 h-16 rounded-full bg-surface shadow-lg flex items-center justify-center text-2xl hover:scale-110 active:scale-95 transition-transform disabled:opacity-30 disabled:pointer-events-none"
          aria-label="Pass"
        >
          ✕
        </button>
        <button
          onClick={() => triggerSwipe('right')}
          disabled={isEmpty}
          className="w-16 h-16 rounded-full bg-surface shadow-lg flex items-center justify-center text-2xl hover:scale-110 active:scale-95 transition-transform disabled:opacity-30 disabled:pointer-events-none"
          aria-label="Like"
        >
          ❤️
        </button>
      </div>

      <BottomNav />

      {/* Match modal */}
      {matchName && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-6"
          onClick={() => setMatchName(null)}
        >
          <div
            className="bg-surface rounded-3xl p-8 text-center max-w-xs w-full shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-5xl mb-4">🎉</p>
            <h2 className="text-2xl font-bold text-ink">It's a match!</h2>
            <p className="text-muted text-sm mt-2 mb-6">
              You and {matchName} both liked each other.
            </p>
            <button
              onClick={() => setMatchName(null)}
              className="w-full py-3 rounded-xl bg-brand hover:bg-brand-hover text-ink font-semibold transition-colors"
            >
              Keep swiping
            </button>
          </div>
        </div>
      )}

      {/* Profile modal */}
      {profileModal && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-end"
          onClick={() => setProfileModal(null)}
        >
          <div
            className="w-full bg-surface rounded-t-3xl overflow-hidden flex flex-col"
            style={{ maxHeight: '90vh' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Photo carousel */}
            <div className="relative flex-shrink-0" style={{ height: 360 }}>
              {profileModal.candidate.photos.length > 0 ? (
                <>
                  <img
                    src={profileModal.candidate.photos[profileModal.photoIndex]}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  {profileModal.candidate.photos.length > 1 && (
                    <>
                      <div className="absolute top-3 left-0 right-0 flex justify-center gap-1.5 pointer-events-none">
                        {profileModal.candidate.photos.map((_, i) => (
                          <div
                            key={i}
                            className={`h-1 rounded-full transition-all duration-200 ${i === profileModal.photoIndex ? 'w-5 bg-surface' : 'w-1.5 bg-surface/50'}`}
                          />
                        ))}
                      </div>
                      <button
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/30 rounded-full flex items-center justify-center text-white text-2xl leading-none"
                        onClick={() => setProfileModal(p => p && p.photoIndex > 0 ? { ...p, photoIndex: p.photoIndex - 1 } : p)}
                      >‹</button>
                      <button
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/30 rounded-full flex items-center justify-center text-white text-2xl leading-none"
                        onClick={() => setProfileModal(p => p && p.photoIndex < p.candidate.photos.length - 1 ? { ...p, photoIndex: p.photoIndex + 1 } : p)}
                      >›</button>
                    </>
                  )}
                </>
              ) : (
                <div className="w-full h-full bg-brand-subtle flex items-center justify-center">
                  <span className="text-7xl">📖</span>
                </div>
              )}
              <button
                onClick={() => setProfileModal(null)}
                className="absolute top-4 right-4 w-9 h-9 bg-black/30 rounded-full flex items-center justify-center text-white text-2xl leading-none"
                aria-label="Close"
              >×</button>
            </div>

            {/* Info */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <div>
                <h2 className="text-2xl font-bold text-ink">
                  {profileModal.candidate.name ?? 'Reader'}
                  {profileModal.candidate.birth_date ? `, ${getAge(profileModal.candidate.birth_date)}` : ''}
                </h2>
                {profileModal.candidate.gender && (
                  <p className="text-muted text-sm capitalize mt-0.5">{profileModal.candidate.gender}</p>
                )}
              </div>

              {profileModal.candidate.bio && (
                <p className="text-ink-secondary text-sm leading-relaxed">{profileModal.candidate.bio}</p>
              )}

              {profileModal.loadingExtra ? (
                <div className="flex justify-center py-4">
                  <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  {profileModal.genres.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-subtle uppercase tracking-wide mb-2">Genres</p>
                      <div className="flex flex-wrap gap-2">
                        {profileModal.genres.map(g => (
                          <span key={g} className="px-3 py-1 bg-brand-subtle text-brand-ink rounded-full text-sm font-medium">{g}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {profileModal.books.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-subtle uppercase tracking-wide mb-2">Favourite books</p>
                      <div className="space-y-2">
                        {profileModal.books.map((b, i) => (
                          <button key={i} className="flex items-center gap-3 text-left w-full" onClick={() => setDetailBook(b)}>
                            {b.cover_url ? (
                              <img src={b.cover_url} alt="" className="w-10 h-14 object-cover rounded shadow flex-shrink-0" />
                            ) : (
                              <div className="w-10 h-14 bg-canvas rounded shadow flex items-center justify-center text-lg flex-shrink-0">📖</div>
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-ink">{b.title}</p>
                              <p className="text-xs text-muted">{b.author}</p>
                              {b.rating && <p className="text-xs text-brand">{'★'.repeat(b.rating)}{'☆'.repeat(5 - b.rating)}</p>}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
              <div className="h-4" />
            </div>
          </div>
        </div>
      )}

      <BookDetailModal book={detailBook} onClose={() => setDetailBook(null)} />

      {/* Filter sheet */}
      {showFilters && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-end"
          onClick={() => setShowFilters(false)}
        >
          <div
            className="w-full bg-surface rounded-t-3xl px-6 pt-5 pb-10 flex flex-col gap-6"
            onClick={e => e.stopPropagation()}
          >
            {/* Sheet header */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-ink">Filters</h2>
              <button
                onClick={() => setShowFilters(false)}
                className="text-subtle hover:text-ink-secondary text-2xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* Age range */}
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold text-ink-secondary">Age range</p>
              <DualRangeSlider
                min={18}
                max={80}
                low={draft.minAge}
                high={draft.maxAge}
                onChange={(lo, hi) => setDraft(d => ({ ...d, minAge: lo, maxAge: hi }))}
              />
            </div>

            {/* Gender */}
            <div className="flex flex-col gap-3">
              <p className="text-sm font-semibold text-ink-secondary">Show me</p>
              <div className="flex flex-wrap gap-2">
                {GENDER_OPTIONS.map(g => {
                  const active = draft.genders.includes(g)
                  return (
                    <button
                      key={g}
                      onClick={() => toggleGender(g)}
                      className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors capitalize ${
                        active
                          ? 'bg-brand border-brand text-ink'
                          : 'bg-surface border-border text-ink-secondary hover:border-border-strong'
                      }`}
                    >
                      {g}
                    </button>
                  )
                })}
              </div>
              {draft.genders.length === 0 && (
                <p className="text-xs text-subtle">No gender filter — showing all matches</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={resetFilters}
                className="flex-1 py-3 rounded-xl border border-border text-ink-secondary font-semibold text-sm hover:bg-canvas transition-colors"
              >
                Reset
              </button>
              <button
                onClick={applyDraft}
                className="flex-1 py-3 rounded-xl bg-brand hover:bg-brand-hover text-ink font-semibold text-sm transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
