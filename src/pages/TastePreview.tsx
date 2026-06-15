import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TastePreviewCard from '../components/discover/TastePreviewCard'
import { Button, Spinner } from '../components/ui'
import { loadDiscoverCandidates } from '../lib/candidates'
import { useAuthStore } from '../store/auth'
import type { DiscoverCandidate } from '../types/discover'

export default function TastePreview() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [candidates, setCandidates] = useState<DiscoverCandidate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!user) return
    loadDiscoverCandidates(user.id, 3).then(({ candidates: c, error: err }) => {
      setCandidates(c)
      setError(err)
      setLoading(false)
    })
  }, [user?.id])

  return (
    <div className="min-h-screen bg-canvas flex flex-col px-6 safe-top pb-10">
      <div className="pt-8 pb-6 text-center">
        <p className="text-4xl mb-3">📚</p>
        <h1 className="text-display text-2xl mb-2">Readers like you</h1>
        <p className="text-muted text-sm leading-relaxed max-w-sm mx-auto">
          Here's a taste of who's waiting in your deck — based on shared books and genres.
        </p>
      </div>

      <div className="flex-1 flex flex-col gap-3 max-w-md mx-auto w-full">
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-muted text-sm">Couldn't load previews right now.</p>
          </div>
        ) : candidates.length === 0 ? (
          <div className="bg-surface rounded-card border border-border p-6 text-center">
            <p className="text-muted text-sm leading-relaxed">
              You're early — more readers are joining every day. Verify your identity to be first in line when they arrive.
            </p>
          </div>
        ) : (
          candidates.map(c => <TastePreviewCard key={c.id} candidate={c} />)
        )}
      </div>

      <div className="max-w-md mx-auto w-full pt-8 space-y-3">
        <p className="text-xs text-subtle text-center">
          Verify your identity to start swiping and matching.
        </p>
        <Button onClick={() => navigate('/verify', { replace: true })} fullWidth>
          Continue to verify
        </Button>
      </div>
    </div>
  )
}
