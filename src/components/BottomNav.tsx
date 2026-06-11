import { BookOpen, Compass, MessageCircle, User } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useNotificationStore } from '../store/notifications'
import { cn } from '../lib/cn'

const TABS: { path: string; label: string; icon: LucideIcon }[] = [
  { path: '/', label: 'Discover', icon: Compass },
  { path: '/matches', label: 'Matches', icon: MessageCircle },
  { path: '/library', label: 'Books', icon: BookOpen },
  { path: '/profile', label: 'Profile', icon: User },
]

export default function BottomNav() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { unreadCount, clearUnread } = useNotificationStore()

  return (
    <div className="flex-shrink-0 flex border-t border-border bg-surface safe-bottom">
      {TABS.map(tab => {
        const active = tab.path === '/'
          ? pathname === '/'
          : pathname.startsWith(tab.path)
        const isMatches = tab.path === '/matches'
        const Icon = tab.icon

        return (
          <button
            key={tab.path}
            onClick={() => { navigate(tab.path); if (isMatches) clearUnread() }}
            className={cn(
              'flex-1 flex flex-col items-center py-3 gap-1 text-xs font-medium transition-colors relative',
              active ? 'text-brand' : 'text-subtle hover:text-muted',
            )}
          >
            <span className="relative leading-none">
              <Icon
                size={22}
                strokeWidth={active ? 2.25 : 1.75}
                aria-hidden
              />
              {isMatches && unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-1.5 w-2 h-2 rounded-full bg-brand" />
              )}
            </span>
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
