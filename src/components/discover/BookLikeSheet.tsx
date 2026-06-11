import { Button, Textarea } from '../ui'
import type { DiscoverCandidate, CandidateBook } from '../../types/discover'

export default function BookLikeSheet({
  candidate,
  book,
  comment,
  sending,
  onCommentChange,
  onClose,
  onSubmit,
}: {
  candidate: DiscoverCandidate
  book: CandidateBook
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

        <h2 className="text-display text-xl mb-1">Like this book?</h2>
        <p className="text-muted text-sm mb-4">
          Send {candidate.name ?? 'them'} a like about a book you both care about.
        </p>

        <div className="flex gap-3 mb-4 p-3 rounded-card bg-canvas border border-border">
          {book.cover_url ? (
            <img src={book.cover_url} alt="" className="w-12 h-[4.5rem] object-cover rounded shadow flex-shrink-0" />
          ) : (
            <div className="w-12 h-[4.5rem] rounded bg-brand-subtle flex items-center justify-center text-lg flex-shrink-0">📖</div>
          )}
          <div className="min-w-0">
            <p className="font-semibold text-ink text-sm leading-snug">{book.title}</p>
            {book.author && <p className="text-xs text-muted mt-0.5">{book.author}</p>}
            {book.shared && (
              <p className="text-xs text-brand-ink font-medium mt-1">You both love this one</p>
            )}
          </div>
        </div>

        <label className="block text-sm font-medium text-ink-secondary mb-1.5">
          Add a note <span className="text-subtle font-normal">(optional)</span>
        </label>
        <Textarea
          value={comment}
          onChange={e => onCommentChange(e.target.value.slice(0, 200))}
          placeholder="What do you love about this book?"
          rows={3}
          className="mb-1"
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
