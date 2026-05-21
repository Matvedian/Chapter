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
}

function getAge(birthDate: string): number {
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

export default function Discover() {
  const { user } = useAuthStore()
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [swipeDir, setSwipeDir] = useState<'left' | 'right' | null>(null)
  const [matchName, setMatchName] = useState<string | null>(null)
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
      .select('id, name, birth_date, photos')
      .in('id', ids)

    if (!profiles?.length) { setLoading(false); return }

    const enriched: Candidate[] = ids
      .map(id => {
        const p = profiles.find(x => x.id === id)
        return p ? { id: p.id, name: p.name, birth_date: p.birth_date, photos: p.photos ?? [], score: scoreMap[id] ?? 0 } : null
      })
      .filter((c): c is Candidate => c !== null)

    setCandidates(enriched)
    setCurrentIndex(enriched.length - 1)
    setLoading(false)
  }, [user?.id])

  useEffect(() => { loadCandidates() }, [loadCandidates])

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
      <div className="px-6 pt-12 pb-3 flex-shrink-0 flex items-center justify-center">
        <h1 className="text-2xl font-bold text-stone-900">Chapter</h1>
      </div>

      {/* Card area */}
      <div className="flex-1 flex items-center justify-center overflow-hidden">
        {isEmpty ? (
          <div className="text-center px-8">
            <p className="text-5xl mb-4">📚</p>
            <h2 className="text-xl font-bold text-stone-900">All caught up</h2>
            <p className="text-stone-500 text-sm mt-2">
              You've seen everyone. Check back as more readers join.
            </p>
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
    </div>
  )
}
