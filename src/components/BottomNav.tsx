import { useLocation, useNavigate } from 'react-router-dom'
import { useNotificationStore } from '../store/notifications'

const TABS = [
  { path: '/',        label: 'Discover', icon: '🔍' },
  { path: '/matches', label: 'Matches',  icon: '💬' },
  { path: '/profile', label: 'Profile',  icon: '👤' },
]

export default function BottomNav() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { unreadCount, clearUnread } = useNotificationStore()

  return (
    <div className="flex-shrink-0 flex border-t border-stone-200 bg-white safe-bottom">
      {TABS.map(tab => {
        const active = tab.path === '/'
          ? pathname === '/'
          : pathname.startsWith(tab.path)
        const isMatches = tab.path === '/matches'
        return (
          <button
            key={tab.path}
            onClick={() => { navigate(tab.path); if (isMatches) clearUnread() }}
            className={`flex-1 flex flex-col items-center py-3 gap-0.5 text-xs font-medium transition-colors relative ${
              active ? 'text-amber-500' : 'text-stone-400 hover:text-stone-600'
            }`}
          >
            <span className="text-xl leading-none relative">
              {tab.icon}
              {isMatches && unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-1.5 w-2 h-2 rounded-full bg-amber-400" />
              )}
            </span>
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
