import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav'

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
  const navigate = useNavigate()

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)

    const { data: matchRows } = await supabase
      .from('matches')
      .select('id, user1_id, user2_id, created_at, messages(content, created_at, sender_id)')
      .or(`user1_id.eq.${user!.id},user2_id.eq.${user!.id}`)

    if (!matchRows?.length) { setLoading(false); return }

    const otherIds = matchRows.map((m: MatchRow) =>
      m.user1_id === user!.id ? m.user2_id : m.user1_id
    )

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, photos')
      .in('id', otherIds)

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
  }, [user?.id])

  useEffect(() => { load() }, [load])

  return (
    <div className="h-screen bg-stone-50 flex flex-col overflow-hidden">
      <div className="px-6 pt-12 pb-4 flex-shrink-0">
        <h1 className="text-2xl font-bold text-stone-900">Matches</h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center pt-16">
            <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center px-8 pt-16">
            <p className="text-4xl mb-3">❤️</p>
            <h2 className="text-lg font-bold text-stone-900">No matches yet</h2>
            <p className="text-stone-500 text-sm mt-1">Keep swiping to find your next great read — and reader.</p>
          </div>
        ) : (
          <ul>
            {items.map(item => (
              <li key={item.matchId}>
                <button
                  onClick={() => navigate(`/chat/${item.matchId}`)}
                  className="w-full flex items-center gap-4 px-6 py-4 hover:bg-stone-100 transition-colors text-left"
                >
                  {item.photo ? (
                    <img src={item.photo} alt="" className="w-14 h-14 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 text-2xl">
                      📖
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between">
                      <p className={`font-semibold text-stone-900 truncate ${item.unread ? 'font-bold' : ''}`}>
                        {item.name ?? 'Reader'}
                      </p>
                      {item.lastAt && (
                        <span className="text-xs text-stone-400 ml-2 flex-shrink-0">
                          {timeAgo(item.lastAt)}
                        </span>
                      )}
                    </div>
                    <p className={`text-sm truncate mt-0.5 ${item.unread ? 'text-stone-900 font-medium' : 'text-stone-400'}`}>
                      {item.lastMessage ?? 'New match — say hello!'}
                    </p>
                  </div>
                  {item.unread && (
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400 flex-shrink-0" />
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
