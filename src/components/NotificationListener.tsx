import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import { supabase } from '../lib/supabase'
import { useNotificationStore } from '../store/notifications'

export default function NotificationListener() {
  const { user } = useAuthStore()
  const { addToast, incrementUnread } = useNotificationStore()
  const location = useLocation()
  const locationRef = useRef(location)
  const matchIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => { locationRef.current = location }, [location])

  useEffect(() => {
    if (!user) return

    // Seed existing match IDs so message notifications work immediately on mount
    supabase
      .from('matches')
      .select('id')
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
      .then(({ data }) => {
        for (const m of data ?? []) matchIdsRef.current.add(m.id)
      })

    const matchChannel = supabase
      .channel('notif:matches')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'matches' },
        async (payload) => {
          const match = payload.new as { id: string; user1_id: string; user2_id: string }
          if (match.user1_id !== user.id && match.user2_id !== user.id) return

          matchIdsRef.current.add(match.id)

          // Only increment badge when not already on Matches page
          if (locationRef.current.pathname !== '/matches') incrementUnread()

          // Discover already shows a match modal — skip toast there
          if (locationRef.current.pathname === '/') return

          const otherId = match.user1_id === user.id ? match.user2_id : match.user1_id
          const { data: p } = await supabase
            .from('profiles')
            .select('name, photos')
            .eq('id', otherId)
            .single()

          addToast({
            type: 'match',
            title: "It's a match!",
            body: `You and ${p?.name ?? 'someone'} both swiped right`,
            matchId: match.id,
            photo: p?.photos?.[0] ?? null,
          })
        },
      )
      .subscribe()

    const msgChannel = supabase
      .channel('notif:messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        async (payload) => {
          const msg = payload.new as { id: string; match_id: string; sender_id: string; content: string }
          if (msg.sender_id === user.id) return
          if (!matchIdsRef.current.has(msg.match_id)) return

          // Don't badge if already looking at matches or this specific chat
          const path = locationRef.current.pathname
          const inThisChat = path === `/chat/${msg.match_id}`
          const onMatchesPage = path === '/matches'
          if (!inThisChat && !onMatchesPage) incrementUnread()

          // No toast needed if already reading this chat
          if (inThisChat) return

          const { data: match } = await supabase
            .from('matches')
            .select('user1_id, user2_id')
            .eq('id', msg.match_id)
            .single()
          if (!match) return

          const otherId = match.user1_id === user.id ? match.user2_id : match.user1_id
          const { data: p } = await supabase
            .from('profiles')
            .select('name, photos')
            .eq('id', otherId)
            .single()

          addToast({
            type: 'message',
            title: p?.name ?? 'New message',
            body: msg.content,
            matchId: msg.match_id,
            photo: p?.photos?.[0] ?? null,
          })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(matchChannel)
      supabase.removeChannel(msgChannel)
    }
  }, [user?.id])

  return null
}
