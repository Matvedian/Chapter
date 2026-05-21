import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import { supabase } from '../lib/supabase'

interface Message {
  id: string
  sender_id: string
  content: string
  created_at: string
}

interface Partner {
  name: string | null
  photo: string | null
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function Chat() {
  const { matchId } = useParams<{ matchId: string }>()
  const { user } = useAuthStore()
  const [messages, setMessages] = useState<Message[]>([])
  const [partner, setPartner] = useState<Partner>({ name: null, photo: null })
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState(false)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!matchId || !user) return
    loadInitial()

    const channel = supabase
      .channel(`chat:${matchId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${matchId}` },
        (payload) => {
          const msg = payload.new as Message
          // Deduplicate: the message may already be present from the initial load
          setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [matchId, user?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadInitial = async () => {
    setLoading(true)

    const { data: match } = await supabase
      .from('matches')
      .select('user1_id, user2_id')
      .eq('id', matchId!)
      .single()

    if (match) {
      const otherId = match.user1_id === user!.id ? match.user2_id : match.user1_id
      const { data: p } = await supabase
        .from('profiles')
        .select('name, photos')
        .eq('id', otherId)
        .single()
      if (p) setPartner({ name: p.name, photo: p.photos?.[0] ?? null })
    }

    const { data: msgs } = await supabase
      .from('messages')
      .select('id, sender_id, content, created_at')
      .eq('match_id', matchId!)
      .order('created_at', { ascending: true })

    setMessages(prev => {
      const byId = new Map<string, Message>()
      for (const m of (msgs ?? [])) byId.set(m.id, m)
      for (const m of prev) byId.set(m.id, m)
      return [...byId.values()].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
    })
    setLoading(false)
  }

  const send = async () => {
    const content = text.trim()
    if (!content || sending || !user) return
    setSending(true)
    setSendError(false)
    const { error } = await supabase.from('messages').insert({
      match_id: matchId,
      sender_id: user.id,
      content,
    })
    setSending(false)
    if (error) {
      setSendError(true)
    } else {
      setText('')
    }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <div className="h-screen bg-stone-50 flex flex-col overflow-hidden">

      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-stone-200 px-4 pt-12 pb-3 flex items-center gap-3">
        <button
          onClick={() => navigate('/matches')}
          className="text-3xl text-stone-500 hover:text-stone-900 transition-colors p-1 -ml-1"
          aria-label="Back"
        >
          ‹
        </button>
        {partner.photo ? (
          <img src={partner.photo} alt="" className="w-9 h-9 rounded-full object-cover" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center text-base">📖</div>
        )}
        <p className="font-semibold text-stone-900 flex-1">{partner.name ?? 'Reader'}</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {loading ? (
          <div className="flex justify-center pt-8">
            <div className="w-6 h-6 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-stone-400 text-sm pt-8">
            Say hello to {partner.name ?? 'your match'}!
          </p>
        ) : (
          messages.map(msg => {
            const mine = msg.sender_id === user?.id
            return (
              <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm ${
                  mine
                    ? 'bg-amber-400 text-stone-900 rounded-br-sm'
                    : 'bg-white text-stone-900 shadow-sm rounded-bl-sm'
                }`}>
                  <p>{msg.content}</p>
                  <p className={`text-xs mt-1 ${mine ? 'text-stone-700/60' : 'text-stone-400'}`}>
                    {formatTime(msg.created_at)}
                  </p>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 bg-white border-t border-stone-200 px-4 py-3 flex flex-col gap-1">
      {sendError && (
        <p className="text-xs text-red-500 text-center">Message failed to send — please try again.</p>
      )}
      <div className="flex items-end gap-3">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Type a message…"
          rows={1}
          className="flex-1 resize-none rounded-2xl border border-stone-200 px-4 py-2.5 text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400 max-h-32"
        />
        <button
          onClick={send}
          disabled={!text.trim() || sending}
          className="w-10 h-10 rounded-full bg-amber-400 hover:bg-amber-500 flex items-center justify-center text-stone-900 font-bold transition-colors disabled:opacity-40 flex-shrink-0"
          aria-label="Send"
        >
          ↑
        </button>
      </div>
      </div>
    </div>
  )
}
