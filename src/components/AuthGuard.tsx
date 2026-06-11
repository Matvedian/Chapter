import { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Spinner } from './ui'
import { useAuthStore } from '../store/auth'
import { useProfileStore } from '../store/profile'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, loading: authLoading, user } = useAuthStore()
  const { profile, loading: profileLoading, fetch, clear } = useProfileStore()
  const location = useLocation()

  useEffect(() => {
    if (user) {
      fetch(user.id)
    } else {
      clear()
    }
  }, [user?.id, fetch, clear])

  if (authLoading || (session && profileLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <Spinner />
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  if (profile && !profile.onboarding_complete && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }

  if (profile && profile.onboarding_complete && !profile.identity_verified && location.pathname !== '/verify') {
    return <Navigate to="/verify" replace />
  }

  return <>{children}</>
}
