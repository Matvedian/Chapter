import { Button, Textarea } from '../ui'
import type { DiscoverCandidate } from '../../types/discover'

export default function LikeCommentSheet({
  candidate,
  comment,
  sending,
  onCommentChange,
  onClose,
  onSubmit,
}: {
  candidate: DiscoverCandidate
  comment: string
  sending: boolean
  onCommentChange: (value: string) => void
  onClose: () => void
  onSubmit: () => void
}) {
  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-end" onClick={onClose}>
      <div
        className="w-full bg-surface rounded-t-sheet px-6 pt-4 pb-10"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-border rounded-full mx-auto mb-5" />

        <h2 className="text-display text-xl mb-1">
          Like {candidate.name ?? 'this reader'}?
        </h2>
        <p className="text-muted text-sm mb-4">
          Add a note to stand out — or just send the like.
        </p>

        <label className="block text-sm font-medium text-ink-secondary mb-1.5">
          Say something <span className="text-subtle font-normal">(optional)</span>
        </label>
        <Textarea
          value={comment}
          onChange={e => onCommentChange(e.target.value.slice(0, 200))}
          placeholder="What caught your eye?"
          rows={3}
          className="mb-1"
          autoFocus
        />
        <p className="text-xs text-subtle text-right mb-5">{comment.length}/200</p>

        <Button onClick={onSubmit} disabled={sending} fullWidth>
          {sending ? 'Sending…' : 'Send like'}
        </Button>
        <Button variant="ghost" size="sm" fullWidth onClick={onClose} className="mt-2">
          Cancel
        </Button>
      </div>
    </div>
  )
}
