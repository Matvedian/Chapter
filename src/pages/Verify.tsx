import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { useAuthStore } from '../store/auth'
import { useProfileStore } from '../store/profile'
import { supabase } from '../lib/supabase'

type Status = 'idle' | 'creating' | 'open' | 'checking' | 'processing' | 'failed'

export default function Verify() {
  const { user } = useAuthStore()
  const { fetch: fetchProfile } = useProfileStore()
  const navigate = useNavigate()
  const [status, setStatus] = useState<Status>('idle')
  const [errorDetail, setErrorDetail] = useState<string>('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollCount = useRef(0)
  const browserOpenRef = useRef(false)

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }

  const checkVerified = async (): Promise<boolean> => {
    if (!user) return false
    const { data } = await supabase
      .from('profiles')
      .select('identity_verified')
      .eq('id', user.id)
      .single()
    if (data?.identity_verified) {
      stopPolling()
      // Close browser if still open, then refresh profile
      if (browserOpenRef.current) {
        browserOpenRef.current = false
        await Browser.close()
      }
      await fetchProfile(user.id)
      navigate('/', { replace: true })
      return true
    }
    return false
  }

  const startPolling = (limit = 20) => {
    pollCount.current = 0
    pollRef.current = setInterval(async () => {
      pollCount.current++
      const verified = await checkVerified()
      if (verified) return
      if (pollCount.current >= limit) {
        stopPolling()
        setStatus('processing')
      }
    }, 3000)
  }

  useEffect(() => {
    // Stripe redirects to chapter://verify-complete when done — close the browser so browserFinished fires
    const appUrl = App.addListener('appUrlOpen', ({ url }: { url: string }) => {
      if (url.startsWith('chapter://verify-complete') && browserOpenRef.current) {
        browserOpenRef.current = false
        Browser.close()
      }
    })

    // Poll in background while browser is open
    const pageLoaded = Browser.addListener('browserPageLoaded', () => {
      if (browserOpenRef.current && !pollRef.current) {
        startPolling(20)
      }
    })

    // Poll when browser closes (covers both manual close and return_url redirect)
    const finished = Browser.addListener('browserFinished', () => {
      browserOpenRef.current = false
      stopPolling()
      setStatus('checking')
      startPolling(10)
    })

    return () => {
      stopPolling()
      appUrl.then(h => h.remove())
      pageLoaded.then(h => h.remove())
      finished.then(h => h.remove())
    }
  }, [user?.id])

  const startVerification = async () => {
    if (!user) return
    setStatus('creating')
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session) throw new Error(`No session: ${sessionError?.message}`)
      const res = await supabase.functions.invoke('create-verification-session', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.error) throw new Error(`Function error: ${res.error.message}`)
      if (res.data?.error) throw new Error(`Stripe error: ${res.data.error}`)
      if (!res.data?.url) throw new Error(`No URL in response: ${JSON.stringify(res.data)}`)
      browserOpenRef.current = true
      setStatus('open')
      await Browser.open({ url: res.data.url, presentationStyle: 'fullscreen' })
    } catch (e: unknown) {
      setErrorDetail(e instanceof Error ? e.message : String(e))
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
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-stone-400">Complete the steps in the browser…</p>
        </div>
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
            onClick={() => { setStatus('checking'); startPolling(10) }}
            className="px-6 py-2.5 rounded-xl bg-amber-400 text-stone-900 font-semibold text-sm"
          >
            Check again
          </button>
        </div>
      )}

      {status === 'failed' && (
        <div className="flex flex-col items-center gap-4">
          <p className="text-red-500 text-sm">Something went wrong. Please try again.</p>
          {errorDetail ? <p className="text-xs text-red-400 mt-1 break-all">{errorDetail}</p> : null}
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
