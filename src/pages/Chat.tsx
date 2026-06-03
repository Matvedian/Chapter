import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import { supabase } from '../lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface Message {
  id: string
  sender_id: string
  content: string
  created_at: string
}

interface Partner {
  id: string | null
  name: string | null
  photo: string | null
}

const REPORT_REASONS = [
  'Inappropriate photos',
  'Offensive or abusive messages',
  'Spam or fake account',
  'I think they\'re underage',
  'Other',
]

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function Chat() {
  const { matchId } = useParams<{ matchId: string }>()
  const { user } = useAuthStore()
  const [messages, setMessages] = useState<Message[]>([])
  const [partner, setPartner] = useState<Partner>({ id: null, name: null, photo: null })
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showMenu, setShowMenu] = useState(false)
  const [showUnmatchConfirm, setShowUnmatchConfirm] = useState(false)
  const [unmatching, setUnmatching] = useState(false)
  const [showBlockConfirm, setShowBlockConfirm] = useState(false)
  const [blocking, setBlocking] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reporting, setReporting] = useState(false)
  const [reportDone, setReportDone] = useState(false)
  const [partnerTyping, setPartnerTyping] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!matchId || !user) return
    loadInitial()

    const channel = supabase
      .channel(`chat:${matchId}`, { config: { presence: { key: user.id } } })
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${matchId}` },
        (payload) => {
          const msg = payload.new as Message
          setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
        }
      )
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{ typing: boolean }>()
        const isTyping = Object.entries(state).some(
          ([key, presences]) => key !== user.id && presences.some(p => p.typing)
        )
        setPartnerTyping(isTyping)
      })
      .subscribe()

    channelRef.current = channel
    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [matchId, user?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, partnerTyping])

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
      if (p) setPartner({ id: otherId, name: p.name, photo: p.photos?.[0] ?? null })
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

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value)
    if (typingTimeout.current) clearTimeout(typingTimeout.current)
    channelRef.current?.track({ typing: true })
    typingTimeout.current = setTimeout(() => {
      channelRef.current?.track({ typing: false })
    }, 1500)
  }

  const send = async () => {
    const content = text.trim()
    if (!content || sending || !user) return
    if (typingTimeout.current) clearTimeout(typingTimeout.current)
    channelRef.current?.track({ typing: false })
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

  const unmatch = async () => {
    if (!matchId || unmatching) return
    setUnmatching(true)
    const { error } = await supabase.from('matches').delete().eq('id', matchId)
    if (error) { setUnmatching(false); return }
    navigate('/matches', { replace: true })
  }

  const block = async () => {
    if (!partner.id || blocking) return
    setBlocking(true)
    await supabase.from('blocks').insert({ blocker_id: user!.id, blocked_id: partner.id })
    await supabase.from('matches').delete().eq('id', matchId)
    navigate('/matches', { replace: true })
  }

  const report = async () => {
    if (!partner.id || !reportReason || reporting) return
    setReporting(true)
    await supabase.from('reports').insert({ reporter_id: user!.id, reported_id: partner.id, reason: reportReason })
    setReporting(false)
    setReportDone(true)
  }

  const closeReport = () => {
    setShowReport(false)
    setReportReason('')
    setReportDone(false)
  }

  return (
    <div className="h-dvh bg-stone-50 flex flex-col overflow-hidden">

      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-stone-200 px-4 safe-top pb-3 flex items-center gap-3">
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
        <div className="relative">
          <button
            onClick={() => setShowMenu(m => !m)}
            className="w-8 h-8 flex items-center justify-center text-stone-400 hover:text-stone-700 transition-colors"
            aria-label="More options"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
            </svg>
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-10 bg-white rounded-xl shadow-xl border border-stone-100 z-50 min-w-40 overflow-hidden">
                <button
                  onClick={() => { setShowMenu(false); setShowReport(true) }}
                  className="w-full px-4 py-3 text-left text-sm text-stone-700 hover:bg-stone-50 transition-colors"
                >
                  Report
                </button>
                <button
                  onClick={() => { setShowMenu(false); setShowBlockConfirm(true) }}
                  className="w-full px-4 py-3 text-left text-sm text-red-500 hover:bg-red-50 transition-colors"
                >
                  Block
                </button>
                <button
                  onClick={() => { setShowMenu(false); setShowUnmatchConfirm(true) }}
                  className="w-full px-4 py-3 text-left text-sm text-red-500 hover:bg-red-50 transition-colors border-t border-stone-100"
                >
                  Unmatch
                </button>
              </div>
            </>
          )}
        </div>
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
        {partnerTyping && (
          <div className="flex justify-start">
            <div className="bg-white text-stone-900 shadow-sm rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1 items-center h-4">
                <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
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
          onChange={handleTextChange}
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

      {/* Unmatch confirmation */}
      {showUnmatchConfirm && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-6"
          onClick={() => setShowUnmatchConfirm(false)}
        >
          <div
            className="bg-white rounded-3xl p-6 max-w-xs w-full shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-stone-900 mb-2">Unmatch?</h2>
            <p className="text-stone-500 text-sm mb-6">
              This will remove your match with {partner.name ?? 'this person'} and delete the conversation.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowUnmatchConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-stone-200 text-stone-600 font-semibold text-sm hover:bg-stone-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={unmatch}
                disabled={unmatching}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold text-sm transition-colors disabled:opacity-50"
              >
                {unmatching ? 'Removing…' : 'Unmatch'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Block confirmation */}
      {showBlockConfirm && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-6"
          onClick={() => setShowBlockConfirm(false)}
        >
          <div
            className="bg-white rounded-3xl p-6 max-w-xs w-full shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-stone-900 mb-2">Block {partner.name ?? 'this person'}?</h2>
            <p className="text-stone-500 text-sm mb-6">
              They won't appear in your matches or swipe deck. This will also remove your conversation.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowBlockConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-stone-200 text-stone-600 font-semibold text-sm hover:bg-stone-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={block}
                disabled={blocking}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold text-sm transition-colors disabled:opacity-50"
              >
                {blocking ? 'Blocking…' : 'Block'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report modal */}
      {showReport && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-6"
          onClick={reportDone ? closeReport : undefined}
        >
          <div
            className="bg-white rounded-3xl p-6 max-w-xs w-full shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {reportDone ? (
              <>
                <h2 className="text-lg font-bold text-stone-900 mb-2">Report submitted</h2>
                <p className="text-stone-500 text-sm mb-6">
                  Thanks for letting us know. We'll review your report.
                </p>
                <button
                  onClick={closeReport}
                  className="w-full py-2.5 rounded-xl bg-stone-900 text-white font-semibold text-sm hover:bg-stone-700 transition-colors"
                >
                  Done
                </button>
              </>
            ) : (
              <>
                <h2 className="text-lg font-bold text-stone-900 mb-1">Report {partner.name ?? 'this person'}</h2>
                <p className="text-stone-500 text-sm mb-4">What's the issue?</p>
                <div className="space-y-2 mb-6">
                  {REPORT_REASONS.map(reason => (
                    <button
                      key={reason}
                      onClick={() => setReportReason(reason)}
                      className={`w-full px-4 py-2.5 rounded-xl border text-sm text-left transition-colors ${
                        reportReason === reason
                          ? 'border-amber-400 bg-amber-50 text-stone-900 font-medium'
                          : 'border-stone-200 text-stone-700 hover:bg-stone-50'
                      }`}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={closeReport}
                    className="flex-1 py-2.5 rounded-xl border border-stone-200 text-stone-600 font-semibold text-sm hover:bg-stone-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={report}
                    disabled={!reportReason || reporting}
                    className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold text-sm transition-colors disabled:opacity-50"
                  >
                    {reporting ? 'Sending…' : 'Report'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
