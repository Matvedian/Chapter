import { useEffect, useState } from 'react'
import { useNetworkStatus } from '../hooks/useNetworkStatus'

type Status = 'hidden' | 'offline' | 'reconnected'

export default function OfflineBanner() {
  const isOnline = useNetworkStatus()
  const [status, setStatus] = useState<Status>(() => navigator.onLine ? 'hidden' : 'offline')

  useEffect(() => {
    if (!isOnline) {
      setStatus('offline')
    } else {
      setStatus(prev => prev === 'offline' ? 'reconnected' : prev)
    }
  }, [isOnline])

  useEffect(() => {
    if (status !== 'reconnected') return
    const t = setTimeout(() => setStatus('hidden'), 2000)
    return () => clearTimeout(t)
  }, [status])

  if (status === 'hidden') return null

  return (
    <div
      className={`fixed top-0 inset-x-0 z-[60] flex items-center justify-center text-sm font-medium text-white ${
        status === 'offline' ? 'bg-destructive' : 'bg-success'
      }`}
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.375rem)', paddingBottom: '0.375rem' }}
    >
      {status === 'offline' ? 'No internet connection' : 'Back online'}
    </div>
  )
}
