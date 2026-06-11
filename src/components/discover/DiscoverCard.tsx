import { MessageCircle } from 'lucide-react'
import VerifiedBadge from '../VerifiedBadge'
import { formatMatchReason } from '../../lib/matchReason'
import type { CandidateBook, DiscoverCandidate } from '../../types/discover'

function getAge(birthDate: string): number {
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

export default function DiscoverCard({
  candidate,
  isTop,
  swipeDir,
  photoIdx,
  loadedImages,
  onImageLoad,
  onNavigatePhoto,
  onInfoClick,
  onBookLike,
}: {
  candidate: DiscoverCandidate
  isTop: boolean
  swipeDir: 'left' | 'right' | null
  photoIdx: number
  loadedImages: Set<string>
  onImageLoad: (key: string) => void
  onNavigatePhoto: (dir: 1 | -1) => void
  onInfoClick: () => void
  onBookLike: (book: CandidateBook) => void
}) {
  const photoUrl = candidate.photos[photoIdx] ?? null
  const imgKey = photoUrl ?? `${candidate.id}:nophoto`
  const matchReason = formatMatchReason(candidate.sharedBooks, candidate.sharedGenres)
  const displayBooks = candidate.books.slice(0, 4)
  const displayGenres = candidate.genres.slice(0, 3)

  return (
    <div
      className="w-full h-full rounded-card overflow-hidden shadow-2xl select-none relative bg-surface flex flex-col"
      style={{
        transform: !isTop ? 'scale(0.93) translateY(-12px)' : undefined,
        transition: 'transform 0.2s ease',
      }}
    >
      {/* Photo strip */}
      <div className="relative h-[200px] flex-shrink-0 bg-border">
        {photoUrl ? (
          <>
            {!loadedImages.has(imgKey) && <div className="absolute inset-0 skeleton" />}
            <img
              src={photoUrl}
              alt=""
              className={`w-full h-full object-cover transition-opacity duration-300 ${loadedImages.has(imgKey) ? 'opacity-100' : 'opacity-0'}`}
              draggable={false}
              onLoad={() => onImageLoad(imgKey)}
            />
            {candidate.photos.length > 1 && (
              <div className="absolute top-3 left-0 right-0 flex justify-center gap-1.5 z-10 pointer-events-none">
                {candidate.photos.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1 rounded-full transition-all duration-200 ${i === photoIdx ? 'w-5 bg-surface' : 'w-1.5 bg-surface/50'}`}
                  />
                ))}
              </div>
            )}
            {isTop && candidate.photos.length > 1 && (
              <>
                <div className="absolute left-0 top-0 w-1/3 h-full z-10" onClick={() => onNavigatePhoto(-1)} />
                <div className="absolute right-0 top-0 w-1/3 h-full z-10" onClick={() => onNavigatePhoto(1)} />
              </>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-brand-subtle">
            <span className="text-5xl">📖</span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />

        {candidate.identity_verified && (
          <div className="absolute top-3 left-3 z-10 pointer-events-none">
            <VerifiedBadge className="bg-surface/90 backdrop-blur-sm shadow-sm" />
          </div>
        )}

        {isTop && swipeDir === 'right' && (
          <div className="absolute top-8 right-4 border-4 border-success text-success font-black text-2xl px-3 py-1 rounded-xl rotate-12 pointer-events-none">
            LIKE
          </div>
        )}
        {isTop && swipeDir === 'left' && (
          <div className="absolute top-8 right-4 border-4 border-destructive text-destructive font-black text-2xl px-3 py-1 rounded-xl rotate-12 pointer-events-none">
            NOPE
          </div>
        )}
      </div>

      {/* Taste-first content */}
      <div className="flex-1 flex flex-col p-4 min-h-0">
        {matchReason && (
          <p className="text-xs font-semibold text-brand-ink mb-2 truncate">
            📚 {matchReason}
          </p>
        )}

        {displayBooks.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto no-scrollbar mb-3 -mx-1 px-1">
            {displayBooks.map(book => (
              <button
                key={book.book_id}
                type="button"
                onClick={e => { e.stopPropagation(); if (isTop) onBookLike(book) }}
                className={`relative flex-shrink-0 group ${isTop ? '' : 'pointer-events-none'}`}
                aria-label={`Like ${book.title} with a note`}
              >
                {book.cover_url ? (
                  <img
                    src={book.cover_url}
                    alt=""
                    className={`w-14 h-20 object-cover rounded-lg shadow border-2 transition-colors ${book.shared ? 'border-brand' : 'border-transparent'}`}
                  />
                ) : (
                  <div className={`w-14 h-20 rounded-lg bg-brand-subtle flex items-center justify-center text-[10px] text-brand-ink font-medium text-center px-1 border-2 ${book.shared ? 'border-brand' : 'border-transparent'}`}>
                    {book.title.slice(0, 24)}
                  </div>
                )}
                {book.shared && (
                  <span className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-brand text-on-brand text-[9px] font-bold flex items-center justify-center">
                    ✓
                  </span>
                )}
                {isTop && (
                  <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-ink text-white flex items-center justify-center opacity-90 group-hover:scale-110 transition-transform">
                    <MessageCircle className="w-3 h-3" />
                  </span>
                )}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-subtle mb-3 italic">No favourite books yet</p>
        )}

        {displayGenres.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {displayGenres.map(g => (
              <span key={g} className="px-2.5 py-0.5 bg-canvas text-ink-secondary rounded-full text-xs font-medium">
                {g}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="text-lg font-bold text-ink leading-snug truncate">
              {candidate.name ?? 'Reader'}
              {candidate.birth_date ? `, ${getAge(candidate.birth_date)}` : ''}
            </p>
            {candidate.bio && (
              <p className="text-xs text-muted line-clamp-2 mt-0.5 leading-relaxed">{candidate.bio}</p>
            )}
          </div>
          {isTop && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onInfoClick() }}
              className="w-9 h-9 rounded-full bg-canvas border border-border flex items-center justify-center text-muted hover:text-ink hover:border-brand transition-colors flex-shrink-0"
              aria-label="View full profile"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
