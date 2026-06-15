import VerifiedBadge from '../VerifiedBadge'
import { formatMatchReason } from '../../lib/matchReason'
import type { DiscoverCandidate } from '../../types/discover'

function getAge(birthDate: string): number {
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

export default function TastePreviewCard({ candidate }: { candidate: DiscoverCandidate }) {
  const photo = candidate.photos[0] ?? null
  const matchReason = formatMatchReason(candidate.sharedBooks, candidate.sharedGenres)

  return (
    <div className="bg-surface rounded-card border border-border overflow-hidden shadow-sm">
      <div className="flex gap-3 p-3">
        {photo ? (
          <img src={photo} alt="" className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
        ) : (
          <div className="w-16 h-16 rounded-xl bg-brand-subtle flex items-center justify-center text-2xl flex-shrink-0">📖</div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="font-semibold text-ink truncate">
              {candidate.name ?? 'Reader'}
              {candidate.birth_date ? `, ${getAge(candidate.birth_date)}` : ''}
            </p>
            {candidate.identity_verified && <VerifiedBadge />}
          </div>
          {matchReason && (
            <p className="text-xs text-brand-ink font-medium mt-0.5">📚 {matchReason}</p>
          )}
          {candidate.genres.length > 0 && (
            <p className="text-xs text-muted mt-1 truncate">
              {candidate.genres.slice(0, 3).join(' · ')}
            </p>
          )}
        </div>
      </div>

      {candidate.reading.length > 0 && (
        <div className="px-3 pb-2">
          <p className="text-[10px] font-semibold text-subtle uppercase tracking-wide mb-1.5">Reading now</p>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {candidate.reading.slice(0, 3).map(book => (
              <div key={book.book_id} className="flex items-center gap-1.5 p-1.5 rounded-lg bg-canvas flex-shrink-0">
                {book.cover_url ? (
                  <img src={book.cover_url} alt="" className="w-7 h-10 object-cover rounded flex-shrink-0" />
                ) : (
                  <div className="w-7 h-10 rounded bg-brand-subtle flex-shrink-0" />
                )}
                <p className="text-[11px] font-medium text-ink max-w-[80px] truncate">{book.title}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {candidate.books.length > 0 && (
        <div className="flex gap-1.5 px-3 pb-3 overflow-x-auto no-scrollbar">
          {candidate.books.slice(0, 4).map(book => (
            book.cover_url ? (
              <img
                key={book.book_id}
                src={book.cover_url}
                alt=""
                className={`w-10 h-14 object-cover rounded flex-shrink-0 border-2 ${book.shared ? 'border-brand' : 'border-transparent'}`}
              />
            ) : (
              <div key={book.book_id} className="w-10 h-14 rounded bg-canvas flex-shrink-0" />
            )
          ))}
        </div>
      )}
    </div>
  )
}
