import { useCallback, useEffect, useRef, useState } from 'react'
import TinderCard from 'react-tinder-card'
import { useAuthStore } from '../store/auth'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav'

interface Candidate {
  id: string
  name: string | null
  birth_date: string | null
  photos: string[]
  score: number
  gender: string | null
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

export default function Discover() {
  const { user } = useAuthStore()
  const [allCandidates, setAllCandidates] = useState<Candidate[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [swipeDir, setSwipeDir] = useState<'left' | 'right' | null>(null)
  const [matchName, setMatchName] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [draft, setDraft] = useState<Filters>(DEFAULT_FILTERS)
  const topCardRef = useRef<any>(null)
  const swiping = useRef(false)

  const loadCandidates = useCallback(async () => {
    if (!user) return
    setLoading(true)

    const { data: rpcData } = await supabase.rpc('get_candidates', { p_user_id: user.id })
    if (!rpcData?.length) { setLoading(false); return }

    const rows = rpcData as { profile_id: string; score: number }[]
    const ids = rows.map(r => r.profile_id)
    const scoreMap = Object.fromEntries(rows.map(r => [r.profile_id, r.score]))

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, birth_date, photos, gender')
      .in('id', ids)

    if (!profiles?.length) { setLoading(false); return }

    const enriched: Candidate[] = ids
      .map(id => {
        const p = profiles.find(x => x.id === id)
        return p ? {
          id: p.id,
          name: p.name,
          birth_date: p.birth_date,
          photos: p.photos ?? [],
          score: scoreMap[id] ?? 0,
          gender: p.gender ?? null,
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
      if (match) setMatchName(candidate.name ?? 'Someone')
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

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const isEmpty = candidates.length === 0 || currentIndex < 0

  return (
    <div className="h-screen bg-stone-100 flex flex-col overflow-hidden">

      {/* Header */}
      <div className="px-6 pt-12 pb-3 flex-shrink-0 flex items-center justify-between">
        <div className="w-8" />
        <h1 className="text-2xl font-bold text-stone-900">Chapter</h1>
        <button
          onClick={() => { setDraft(filters); setShowFilters(true) }}
          className="relative w-8 h-8 flex items-center justify-center text-stone-400 hover:text-stone-700 transition-colors"
          aria-label="Filters"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="8" y1="12" x2="16" y2="12" />
            <line x1="11" y1="18" x2="13" y2="18" />
          </svg>
          {filtersActive(filters) && (
            <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-amber-400" />
          )}
        </button>
      </div>

      {/* Card area */}
      <div className="flex-1 flex items-center justify-center overflow-hidden">
        {isEmpty ? (
          <div className="text-center px-8">
            <p className="text-5xl mb-4">📚</p>
            <h2 className="text-xl font-bold text-stone-900">
              {filtersActive(filters) ? 'No matches for these filters' : 'All caught up'}
            </h2>
            <p className="text-stone-500 text-sm mt-2">
              {filtersActive(filters)
                ? 'Try widening your filters to see more readers.'
                : "You've seen everyone. Check back as more readers join."}
            </p>
            {filtersActive(filters) && (
              <button
                onClick={resetFilters}
                className="mt-4 px-4 py-2 rounded-xl bg-amber-400 text-stone-900 font-semibold text-sm"
              >
                Reset filters
              </button>
            )}
          </div>
        ) : (
          <div className="relative" style={{ width: 320, height: 480 }}>
            {candidates.map((candidate, index) => {
              if (index < currentIndex - 1 || index > currentIndex) return null
              const isTop = index === currentIndex

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
                    className="w-full h-full rounded-3xl overflow-hidden shadow-2xl select-none relative bg-stone-200"
                    style={{
                      transform: !isTop ? 'scale(0.93) translateY(-12px)' : undefined,
                      transition: 'transform 0.2s ease',
                    }}
                  >
                    {candidate.photos[0] ? (
                      <img
                        src={candidate.photos[0]}
                        alt=""
                        className="w-full h-full object-cover"
                        draggable={false}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-amber-50">
                        <span className="text-7xl">📖</span>
                      </div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/5 to-transparent pointer-events-none" />

                    {isTop && swipeDir === 'right' && (
                      <div className="absolute top-8 left-6 border-4 border-green-400 text-green-400 font-black text-3xl px-3 py-1 rounded-xl -rotate-12 pointer-events-none">
                        LIKE
                      </div>
                    )}
                    {isTop && swipeDir === 'left' && (
                      <div className="absolute top-8 right-6 border-4 border-red-400 text-red-400 font-black text-3xl px-3 py-1 rounded-xl rotate-12 pointer-events-none">
                        NOPE
                      </div>
                    )}

                    <div className="absolute bottom-0 left-0 right-0 p-5 pointer-events-none">
                      <div className="flex items-end justify-between">
                        <p className="text-xl font-bold text-white leading-snug">
                          {candidate.name ?? 'Reader'}
                          {candidate.birth_date ? `, ${getAge(candidate.birth_date)}` : ''}
                        </p>
                        {candidate.score > 0 && (
                          <span className="bg-amber-400 text-stone-900 text-xs font-bold px-2.5 py-1 rounded-full ml-2 shrink-0">
                            📚 {candidate.score}
                          </span>
                        )}
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
          className="w-16 h-16 rounded-full bg-white shadow-lg flex items-center justify-center text-2xl hover:scale-110 active:scale-95 transition-transform disabled:opacity-30 disabled:pointer-events-none"
          aria-label="Pass"
        >
          ✕
        </button>
        <button
          onClick={() => triggerSwipe('right')}
          disabled={isEmpty}
          className="w-16 h-16 rounded-full bg-white shadow-lg flex items-center justify-center text-2xl hover:scale-110 active:scale-95 transition-transform disabled:opacity-30 disabled:pointer-events-none"
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
            className="bg-white rounded-3xl p-8 text-center max-w-xs w-full shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-5xl mb-4">🎉</p>
            <h2 className="text-2xl font-bold text-stone-900">It's a match!</h2>
            <p className="text-stone-500 text-sm mt-2 mb-6">
              You and {matchName} both liked each other.
            </p>
            <button
              onClick={() => setMatchName(null)}
              className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-500 text-stone-900 font-semibold transition-colors"
            >
              Keep swiping
            </button>
          </div>
        </div>
      )}

      {/* Filter sheet */}
      {showFilters && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-end"
          onClick={() => setShowFilters(false)}
        >
          <div
            className="w-full bg-white rounded-t-3xl px-6 pt-5 pb-10 flex flex-col gap-6"
            onClick={e => e.stopPropagation()}
          >
            {/* Sheet header */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-stone-900">Filters</h2>
              <button
                onClick={() => setShowFilters(false)}
                className="text-stone-400 hover:text-stone-700 text-2xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* Age range */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-stone-700">Age range</p>
                <p className="text-sm text-stone-500">{draft.minAge} – {draft.maxAge}</p>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-stone-400 w-6">Min</span>
                  <input
                    type="range"
                    min={18}
                    max={draft.maxAge}
                    value={draft.minAge}
                    onChange={e => setDraft(d => ({ ...d, minAge: Number(e.target.value) }))}
                    className="flex-1 accent-amber-400"
                  />
                  <span className="text-xs text-stone-700 w-6 text-right">{draft.minAge}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-stone-400 w-6">Max</span>
                  <input
                    type="range"
                    min={draft.minAge}
                    max={80}
                    value={draft.maxAge}
                    onChange={e => setDraft(d => ({ ...d, maxAge: Number(e.target.value) }))}
                    className="flex-1 accent-amber-400"
                  />
                  <span className="text-xs text-stone-700 w-6 text-right">{draft.maxAge}</span>
                </div>
              </div>
            </div>

            {/* Gender */}
            <div className="flex flex-col gap-3">
              <p className="text-sm font-semibold text-stone-700">Show me</p>
              <div className="flex flex-wrap gap-2">
                {GENDER_OPTIONS.map(g => {
                  const active = draft.genders.includes(g)
                  return (
                    <button
                      key={g}
                      onClick={() => toggleGender(g)}
                      className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors capitalize ${
                        active
                          ? 'bg-amber-400 border-amber-400 text-stone-900'
                          : 'bg-white border-stone-200 text-stone-600 hover:border-stone-400'
                      }`}
                    >
                      {g}
                    </button>
                  )
                })}
              </div>
              {draft.genders.length === 0 && (
                <p className="text-xs text-stone-400">No gender filter — showing all matches</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={resetFilters}
                className="flex-1 py-3 rounded-xl border border-stone-200 text-stone-600 font-semibold text-sm hover:bg-stone-50 transition-colors"
              >
                Reset
              </button>
              <button
                onClick={applyDraft}
                className="flex-1 py-3 rounded-xl bg-amber-400 hover:bg-amber-500 text-stone-900 font-semibold text-sm transition-colors"
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
