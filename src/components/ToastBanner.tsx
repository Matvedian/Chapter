import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { type Toast, useNotificationStore } from '../store/notifications'

const DURATION_MS = 4000

function ToastCard({ toast }: { toast: Toast }) {
  const { dismissToast } = useNotificationStore()
  const navigate = useNavigate()

  useEffect(() => {
    const t = setTimeout(() => dismissToast(toast.id), DURATION_MS)
    return () => clearTimeout(t)
  }, [toast.id, dismissToast])

  return (
    <div
      className="flex items-center gap-3 bg-surface rounded-sheet shadow-lg border border-border px-4 py-3 cursor-pointer animate-slide-down"
      onClick={() => { navigate(`/chat/${toast.matchId}`); dismissToast(toast.id) }}
    >
      {toast.photo ? (
        <img src={toast.photo} className="w-10 h-10 rounded-full object-cover flex-shrink-0" alt="" />
      ) : (
        <div className="w-10 h-10 rounded-full bg-brand-subtle flex items-center justify-center flex-shrink-0 text-lg">📖</div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-ink">{toast.title}</p>
        <p className="text-xs text-muted truncate">{toast.body}</p>
      </div>
      <div
        role="button"
        aria-label="Dismiss"
        onClick={(e) => { e.stopPropagation(); dismissToast(toast.id) }}
        className="text-subtle hover:text-muted text-xl leading-none flex-shrink-0 pl-2"
      >
        ×
      </div>
    </div>
  )
}

export default function ToastBanner() {
  const { toasts } = useNotificationStore()
  if (!toasts.length) return null

  return (
    <div className="fixed top-0 inset-x-0 z-50 px-4 toast-safe-top flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastCard toast={t} />
        </div>
      ))}
    </div>
  )
}
