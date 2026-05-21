import { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
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
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  if (profile && !profile.onboarding_complete && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }

  return <>{children}</>
}
