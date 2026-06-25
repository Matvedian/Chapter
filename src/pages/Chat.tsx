import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import VerifiedBadge from '../components/VerifiedBadge'
import { Button, Chip, Spinner, Textarea } from '../components/ui'
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
  identity_verified: boolean
}

type ReactionsMap = Record<string, { emoji: string; user_id: string }[]>

const REPORT_REASONS = [
  'Inappropriate photos',
  'Offensive or abusive messages',
  'Spam or fake account',
  'I think they\'re underage',
  'Other',
]

const REACTION_EMOJIS = ['❤️', '😂', '😮', '😢', '😡', '👍']

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function Chat() {
  const { matchId } = useParams<{ matchId: string }>()
  const { user } = useAuthStore()
  const [messages, setMessages] = useState<Message[]>([])
  const [partner, setPartner] = useState<Partner>({ id: null, name: null, photo: null, identity_verified: false })
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
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
  const [reactions, setReactions] = useState<ReactionsMap>({})
  const [pickerMsgId, setPickerMsgId] = useState<string | null>(null)
  const [pickerY, setPickerY] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchStartPos = useRef<{ x: number; y: number } | null>(null)
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
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'message_reactions' },
        (payload) => {
          const r = payload.new as { message_id: string; user_id: string; emoji: string }
          setReactions(prev => ({
            ...prev,
            [r.message_id]: [
              ...(prev[r.message_id] ?? []).filter(x => !(x.user_id === r.user_id && x.emoji === r.emoji)),
              { emoji: r.emoji, user_id: r.user_id },
            ],
          }))
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'message_reactions' },
        (payload) => {
          const r = payload.old as { message_id: string; user_id: string; emoji: string }
          setReactions(prev => ({
            ...prev,
            [r.message_id]: (prev[r.message_id] ?? []).filter(
              x => !(x.user_id === r.user_id && x.emoji === r.emoji)
            ),
          }))
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
      if (typingTimeout.current) clearTimeout(typingTimeout.current)
      if (longPressTimer.current) clearTimeout(longPressTimer.current)
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [matchId, user?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, partnerTyping])

  const loadInitial = async () => {
    setLoading(true)
    setLoadError(false)

    const [{ data: match }, { data: msgs, error: msgsError }] = await Promise.all([
      supabase.from('matches').select('user1_id, user2_id').eq('id', matchId!).single(),
      supabase.from('messages').select('id, sender_id, content, created_at').eq('match_id', matchId!).order('created_at', { ascending: true }),
    ])

    if (msgsError) { setLoadError(true); setLoading(false); return }

    if (match) {
      const otherId = match.user1_id === user!.id ? match.user2_id : match.user1_id
      supabase.from('profiles').select('name, photos, identity_verified').eq('id', otherId).single().then(({ data: p }) => {
        if (p) setPartner({ id: otherId, name: p.name, photo: p.photos?.[0] ?? null, identity_verified: p.identity_verified ?? false })
      })
    }

    const mergedMsgs = (() => {
      const byId = new Map<string, Message>()
      for (const m of (msgs ?? [])) byId.set(m.id, m)
      return [...byId.values()].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
    })()

    setMessages(mergedMsgs)

    if (mergedMsgs.length > 0) {
      const { data: rxData } = await supabase
        .from('message_reactions')
        .select('message_id, user_id, emoji')
        .in('message_id', mergedMsgs.map(m => m.id))
      if (rxData) {
        const rxMap: ReactionsMap = {}
        for (const r of rxData) {
          if (!rxMap[r.message_id]) rxMap[r.message_id] = []
          rxMap[r.message_id].push({ emoji: r.emoji, user_id: r.user_id })
        }
        setReactions(rxMap)
      }
    }

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

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!user) return
    setPickerMsgId(null)
    const hasReacted = reactions[messageId]?.some(r => r.user_id === user.id && r.emoji === emoji)
    if (hasReacted) {
      await supabase.from('message_reactions').delete()
        .eq('message_id', messageId).eq('user_id', user.id).eq('emoji', emoji)
    } else {
      await supabase.from('message_reactions').insert({ message_id: messageId, user_id: user.id, emoji })
    }
  }

  const handleTouchStart = (msgId: string, e: React.TouchEvent) => {
    touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    const target = e.currentTarget as HTMLElement
    longPressTimer.current = setTimeout(() => {
      const rect = target.getBoundingClientRect()
      setPickerY(Math.max(70, rect.top - 52))
      setPickerMsgId(msgId)
    }, 500)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPos.current || !longPressTimer.current) return
    const dx = Math.abs(e.touches[0].clientX - touchStartPos.current.x)
    const dy = Math.abs(e.touches[0].clientY - touchStartPos.current.y)
    if (dx > 10 || dy > 10) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  const handleTouchEnd = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null }
    touchStartPos.current = null
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
    const [{ error: blockError }, { error: matchError }] = await Promise.all([
      supabase.from('blocks').insert({ blocker_id: user!.id, blocked_id: partner.id }),
      supabase.from('matches').delete().eq('id', matchId),
    ])
    if (blockError || matchError) { setBlocking(false); return }
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
    <div className="h-dvh bg-canvas flex flex-col overflow-hidden">

      {/* Header */}
      <div className="flex-shrink-0 bg-surface border-b border-border px-4 safe-top pb-3 flex items-center gap-3">
        <button
          onClick={() => navigate('/matches')}
          className="text-3xl text-muted hover:text-ink transition-colors p-1 -ml-1"
          aria-label="Back"
        >
          ‹
        </button>
        {partner.photo ? (
          <img src={partner.photo} alt="" className="w-9 h-9 rounded-full object-cover" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-brand-subtle flex items-center justify-center text-base">📖</div>
        )}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <p className="font-semibold text-ink truncate">{partner.name ?? 'Reader'}</p>
          {partner.identity_verified && <VerifiedBadge className="flex-shrink-0" />}
        </div>
        <div className="relative">
          <button
            onClick={() => setShowMenu(m => !m)}
            className="w-8 h-8 flex items-center justify-center text-subtle hover:text-ink-secondary transition-colors"
            aria-label="More options"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
            </svg>
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-10 bg-surface rounded-xl shadow-xl border border-border z-50 min-w-40 overflow-hidden">
                <button
                  onClick={() => { setShowMenu(false); setShowReport(true) }}
                  className="w-full px-4 py-3 text-left text-sm text-ink-secondary hover:bg-canvas transition-colors"
                >
                  Report
                </button>
                <button
                  onClick={() => { setShowMenu(false); setShowBlockConfirm(true) }}
                  className="w-full px-4 py-3 text-left text-sm text-destructive hover:bg-destructive-subtle transition-colors"
                >
                  Block
                </button>
                <button
                  onClick={() => { setShowMenu(false); setShowUnmatchConfirm(true) }}
                  className="w-full px-4 py-3 text-left text-sm text-destructive hover:bg-destructive-subtle transition-colors border-t border-border"
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
            <Spinner className="w-6 h-6" />
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center pt-16 px-8 text-center">
            <p className="font-semibold text-ink">Couldn't load messages</p>
            <p className="text-subtle text-sm mt-1">Check your connection and try again.</p>
            <Button onClick={loadInitial} size="sm" className="mt-5">
              Try again
            </Button>
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-subtle text-sm pt-8">
            Say hello to {partner.name ?? 'your match'}!
          </p>
        ) : (
          messages.map(msg => {
            const mine = msg.sender_id === user?.id
            const msgReactions = reactions[msg.id] ?? []
            const grouped = REACTION_EMOJIS
              .map(emoji => ({
                emoji,
                count: msgReactions.filter(r => r.emoji === emoji).length,
                mine: msgReactions.some(r => r.emoji === emoji && r.user_id === user?.id),
              }))
              .filter(g => g.count > 0)

            return (
              <div key={msg.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm select-none ${
                    mine
                      ? 'bg-brand text-on-brand rounded-br-sm'
                      : 'bg-surface text-ink shadow-sm rounded-bl-sm'
                  } ${pickerMsgId === msg.id ? 'opacity-75' : ''}`}
                  onTouchStart={e => handleTouchStart(msg.id, e)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  onContextMenu={e => {
                    e.preventDefault()
                    const rect = e.currentTarget.getBoundingClientRect()
                    setPickerY(Math.max(70, rect.top - 52))
                    setPickerMsgId(msg.id)
                  }}
                >
                  <p>{msg.content}</p>
                  <p className={`text-xs mt-1 ${mine ? 'text-ink-secondary/60' : 'text-subtle'}`}>
                    {formatTime(msg.created_at)}
                  </p>
                </div>

                {grouped.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {grouped.map(g => (
                      <button
                        key={g.emoji}
                        onClick={() => toggleReaction(msg.id, g.emoji)}
                        className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border transition-colors ${
                          g.mine
                            ? 'bg-brand-subtle border-brand text-brand-ink'
                            : 'bg-surface border-border text-ink-secondary'
                        }`}
                      >
                        <span>{g.emoji}</span>
                        {g.count > 1 && <span className="font-medium">{g.count}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })
        )}
        {partnerTyping && (
          <div className="flex justify-start">
            <div className="bg-surface text-ink shadow-sm rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1 items-center h-4">
                <span className="w-1.5 h-1.5 bg-subtle rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-subtle rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-subtle rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 bg-surface border-t border-border px-4 py-3 flex flex-col gap-1">
      {sendError && (
        <p className="text-xs text-destructive text-center">Message failed to send — please try again.</p>
      )}
      <div className="flex items-end gap-3">
        <Textarea
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKey}
          placeholder="Type a message…"
          rows={1}
          className="flex-1 rounded-2xl py-2.5 text-sm max-h-32"
        />
        <Button
          onClick={send}
          disabled={!text.trim() || sending}
          size="icon"
          className="rounded-full flex-shrink-0"
          aria-label="Send"
        >
          ↑
        </Button>
      </div>
      </div>

      {/* Emoji picker */}
      {pickerMsgId && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPickerMsgId(null)} />
          <div
            className="fixed z-50 bg-surface rounded-full shadow-xl border border-border flex gap-0.5 px-2 py-1.5"
            style={{ top: pickerY, left: '50%', transform: 'translateX(-50%)' }}
          >
            {REACTION_EMOJIS.map(emoji => {
              const hasReacted = reactions[pickerMsgId]?.some(r => r.user_id === user?.id && r.emoji === emoji)
              return (
                <button
                  key={emoji}
                  onClick={() => toggleReaction(pickerMsgId, emoji)}
                  className={`w-10 h-10 flex items-center justify-center text-xl hover:scale-125 active:scale-110 transition-transform rounded-full ${
                    hasReacted ? 'bg-brand-subtle' : ''
                  }`}
                >
                  {emoji}
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* Unmatch confirmation */}
      {showUnmatchConfirm && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-6"
          onClick={() => setShowUnmatchConfirm(false)}
        >
          <div
            className="bg-surface rounded-3xl p-6 max-w-xs w-full shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-ink mb-2">Unmatch?</h2>
            <p className="text-muted text-sm mb-6">
              This will remove your match with {partner.name ?? 'this person'} and delete the conversation.
            </p>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setShowUnmatchConfirm(false)} className="flex-1">
                Cancel
              </Button>
              <Button variant="destructive" onClick={unmatch} disabled={unmatching} className="flex-1">
                {unmatching ? 'Removing…' : 'Unmatch'}
              </Button>
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
            className="bg-surface rounded-3xl p-6 max-w-xs w-full shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-ink mb-2">Block {partner.name ?? 'this person'}?</h2>
            <p className="text-muted text-sm mb-6">
              They won't appear in your matches or swipe deck. This will also remove your conversation.
            </p>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setShowBlockConfirm(false)} className="flex-1">
                Cancel
              </Button>
              <Button variant="destructive" onClick={block} disabled={blocking} className="flex-1">
                {blocking ? 'Blocking…' : 'Block'}
              </Button>
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
            className="bg-surface rounded-3xl p-6 max-w-xs w-full shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {reportDone ? (
              <>
                <h2 className="text-lg font-bold text-ink mb-2">Report submitted</h2>
                <p className="text-muted text-sm mb-6">
                  Thanks for letting us know. We'll review your report.
                </p>
                <Button onClick={closeReport} fullWidth>
                  Done
                </Button>
              </>
            ) : (
              <>
                <h2 className="text-lg font-bold text-ink mb-1">Report {partner.name ?? 'this person'}</h2>
                <p className="text-muted text-sm mb-4">What's the issue?</p>
                <div className="flex flex-wrap gap-2 mb-6">
                  {REPORT_REASONS.map(reason => (
                    <Chip
                      key={reason}
                      selected={reportReason === reason}
                      onClick={() => setReportReason(reason)}
                      className="w-full justify-start text-left"
                    >
                      {reason}
                    </Chip>
                  ))}
                </div>
                <div className="flex gap-3">
                  <Button variant="secondary" onClick={closeReport} className="flex-1">
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={report}
                    disabled={!reportReason || reporting}
                    className="flex-1"
                  >
                    {reporting ? 'Sending…' : 'Report'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
