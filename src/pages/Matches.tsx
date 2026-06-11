import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav'
import { Button, Input } from '../components/ui'

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-6 py-4">
      <div className="w-14 h-14 rounded-full skeleton flex-shrink-0" />
      <div className="flex-1 flex flex-col gap-2.5">
        <div className="h-3.5 rounded-lg skeleton w-1/3" />
        <div className="h-3 rounded-lg skeleton w-2/3" />
      </div>
    </div>
  )
}

interface MatchRow {
  id: string
  user1_id: string
  user2_id: string
  created_at: string
  messages: { content: string; created_at: string; sender_id: string }[]
}

interface MatchItem {
  matchId: string
  otherId: string
  name: string | null
  photo: string | null
  lastMessage: string | null
  lastAt: string | null
  unread: boolean
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000) return 'now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`
  return new Date(iso).toLocaleDateString()
}

export default function Matches() {
  const { user } = useAuthStore()
  const [items, setItems] = useState<MatchItem[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [query, setQuery] = useState('')
  const [loaded, setLoaded] = useState(false)
  const navigate = useNavigate()
  const loadedRef = useRef(false)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setFetchError(false)

    const { data: matchRows, error: matchError } = await supabase
      .from('matches')
      .select('id, user1_id, user2_id, created_at, messages(content, created_at, sender_id)')
      .or(`user1_id.eq.${user!.id},user2_id.eq.${user!.id}`)

    if (matchError) { setFetchError(true); setLoading(false); return }
    if (!matchRows?.length) { setLoading(false); return }

    const otherIds = matchRows.map((m: MatchRow) =>
      m.user1_id === user!.id ? m.user2_id : m.user1_id
    )

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, name, photos')
      .in('id', otherIds)

    if (profilesError) { setFetchError(true); setLoading(false); return }

    const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))

    const built: MatchItem[] = matchRows.map((m: MatchRow) => {
      const otherId = m.user1_id === user!.id ? m.user2_id : m.user1_id
      const p = profileMap[otherId]
      const sorted = [...(m.messages ?? [])].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      const last = sorted[0] ?? null
      return {
        matchId: m.id,
        otherId,
        name: p?.name ?? null,
        photo: p?.photos?.[0] ?? null,
        lastMessage: last?.content ?? null,
        lastAt: last?.created_at ?? m.created_at,
        unread: !!last && last.sender_id !== user!.id,
      }
    })

    built.sort((a, b) => new Date(b.lastAt!).getTime() - new Date(a.lastAt!).getTime())
    setItems(built)
    setLoading(false)
    if (!loadedRef.current) {
      loadedRef.current = true
      setLoaded(true)
    }
  }, [user?.id])

  useEffect(() => { load() }, [load])

  // Realtime: update list when a new message arrives in any of the user's matches.
  // Depends on `loaded` (one-time flip) rather than `loading` so retries don't tear down the subscription.
  useEffect(() => {
    if (!user || !loaded) return

    const channel = supabase
      .channel('matches-page:messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const msg = payload.new as { match_id: string; sender_id: string; content: string; created_at: string }
          setItems(prev => {
            const idx = prev.findIndex(i => i.matchId === msg.match_id)
            if (idx === -1) return prev
            const updated = prev.map(i =>
              i.matchId === msg.match_id
                ? { ...i, lastMessage: msg.content, lastAt: msg.created_at, unread: msg.sender_id !== user.id }
                : i
            )
            return [...updated].sort((a, b) => new Date(b.lastAt!).getTime() - new Date(a.lastAt!).getTime())
          })
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user?.id, loaded])

  const q = query.toLowerCase()
  const filteredItems = q
    ? items.filter(i =>
        i.name?.toLowerCase().includes(q) ||
        i.lastMessage?.toLowerCase().includes(q)
      )
    : items

  return (
    <div className="h-screen bg-canvas flex flex-col overflow-hidden">
      <div className="px-6 safe-top pb-3 flex-shrink-0">
        <h1 className="text-display text-2xl mb-3">Matches</h1>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-subtle z-10 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <circle cx={11} cy={11} r={8} /><path d="m21 21-4.35-4.35" />
          </svg>
          <Input
            type="search"
            placeholder="Search matches…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="pl-9 py-2 text-sm"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col">
            {[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}
          </div>
        ) : fetchError ? (
          <div className="text-center px-8 pt-16">
            <h2 className="text-lg font-bold text-ink">Couldn't load matches</h2>
            <p className="text-muted text-sm mt-1">Check your connection and try again.</p>
            <Button onClick={load} size="sm" className="mt-5">
              Try again
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center px-8 pt-16">
            <p className="text-4xl mb-3">❤️</p>
            <h2 className="text-lg font-bold text-ink">No matches yet</h2>
            <p className="text-muted text-sm mt-1">Keep swiping to find your next great read — and reader.</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center px-8 pt-16">
            <p className="text-4xl mb-3">🔍</p>
            <h2 className="text-lg font-bold text-ink">No results</h2>
            <p className="text-muted text-sm mt-1">No matches found for "{query}".</p>
          </div>
        ) : (
          <ul>
            {filteredItems.map(item => (
              <li key={item.matchId}>
                <button
                  onClick={() => navigate(`/chat/${item.matchId}`)}
                  className="w-full flex items-center gap-4 px-6 py-4 hover:bg-canvas transition-colors text-left"
                >
                  {item.photo ? (
                    <img src={item.photo} alt="" className="w-14 h-14 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-brand-subtle flex items-center justify-center flex-shrink-0 text-2xl">
                      📖
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between">
                      <p className={`font-semibold text-ink truncate ${item.unread ? 'font-bold' : ''}`}>
                        {item.name ?? 'Reader'}
                      </p>
                      {item.lastAt && (
                        <span className="text-xs text-subtle ml-2 flex-shrink-0">
                          {timeAgo(item.lastAt)}
                        </span>
                      )}
                    </div>
                    <p className={`text-sm truncate mt-0.5 ${item.unread ? 'text-ink font-medium' : 'text-subtle'}`}>
                      {item.lastMessage ?? 'New match — say hello!'}
                    </p>
                  </div>
                  {item.unread && (
                    <div className="w-2.5 h-2.5 rounded-full bg-brand flex-shrink-0" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
