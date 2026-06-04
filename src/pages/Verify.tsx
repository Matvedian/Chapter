import { useEffect, useRef, useState } from 'react'
import { Browser } from '@capacitor/browser'
import { useAuthStore } from '../store/auth'
import { useProfileStore } from '../store/profile'
import { supabase } from '../lib/supabase'

type Status = 'idle' | 'creating' | 'open' | 'checking' | 'processing' | 'failed'

export default function Verify() {
  const { user } = useAuthStore()
  const { fetch: fetchProfile } = useProfileStore()
  const [status, setStatus] = useState<Status>('idle')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollCount = useRef(0)

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }

  const startPolling = () => {
    pollCount.current = 0
    pollRef.current = setInterval(async () => {
      pollCount.current++
      if (!user) return
      const { data } = await supabase
        .from('profiles')
        .select('identity_verified')
        .eq('id', user.id)
        .single()
      if (data?.identity_verified) {
        stopPolling()
        await fetchProfile(user.id)
        // AuthGuard will redirect automatically once identity_verified is true
        return
      }
      // Give up after ~30s and show "processing" message
      if (pollCount.current >= 10) {
        stopPolling()
        setStatus('processing')
      }
    }, 3000)
  }

  useEffect(() => {
    const listener = Browser.addListener('browserFinished', () => {
      setStatus('checking')
      startPolling()
    })
    return () => {
      stopPolling()
      listener.then(h => h.remove())
    }
  }, [user?.id])

  const startVerification = async () => {
    if (!user) return
    setStatus('creating')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await supabase.functions.invoke('create-verification-session', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (res.error || !res.data?.url) throw new Error()
      setStatus('open')
      await Browser.open({ url: res.data.url, presentationStyle: 'fullscreen' })
    } catch {
      setStatus('failed')
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center px-8 text-center">
      <div className="text-5xl mb-6">🪪</div>
      <h1 className="text-2xl font-bold text-stone-900 mb-2">Verify your identity</h1>
      <p className="text-stone-500 text-sm leading-relaxed mb-8">
        To keep Chapter safe for everyone, we ask all users to verify their identity before joining.
        It only takes a minute — you'll need a government-issued ID and a selfie.
      </p>

      {status === 'idle' && (
        <button
          onClick={startVerification}
          className="w-full max-w-xs py-3.5 rounded-2xl bg-amber-400 text-stone-900 font-semibold text-base"
        >
          Verify my identity
        </button>
      )}

      {status === 'creating' && (
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-stone-400">Opening verification…</p>
        </div>
      )}

      {status === 'open' && (
        <p className="text-sm text-stone-400">Complete the steps in the browser, then come back here.</p>
      )}

      {status === 'checking' && (
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-stone-400">Checking your verification…</p>
        </div>
      )}

      {status === 'processing' && (
        <div className="flex flex-col items-center gap-4">
          <p className="text-stone-600 text-sm leading-relaxed">
            Your verification is being processed — this usually takes under a minute.
            Please come back shortly.
          </p>
          <button
            onClick={() => { setStatus('checking'); startPolling() }}
            className="px-6 py-2.5 rounded-xl bg-amber-400 text-stone-900 font-semibold text-sm"
          >
            Check again
          </button>
        </div>
      )}

      {status === 'failed' && (
        <div className="flex flex-col items-center gap-4">
          <p className="text-red-500 text-sm">Something went wrong. Please try again.</p>
          <button
            onClick={() => setStatus('idle')}
            className="px-6 py-2.5 rounded-xl bg-amber-400 text-stone-900 font-semibold text-sm"
          >
            Try again
          </button>
        </div>
      )}

      <p className="text-xs text-stone-400 mt-8 max-w-xs">
        Powered by Stripe Identity. Your ID is verified by Stripe and never stored by Chapter.
      </p>
    </div>
  )
}
