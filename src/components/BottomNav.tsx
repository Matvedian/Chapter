import { useLocation, useNavigate } from 'react-router-dom'

const TABS = [
  { path: '/',        label: 'Discover', icon: '🔍' },
  { path: '/matches', label: 'Matches',  icon: '💬' },
  { path: '/profile', label: 'Profile',  icon: '👤' },
]

export default function BottomNav() {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  return (
    <div className="flex-shrink-0 flex border-t border-stone-200 bg-white">
      {TABS.map(tab => {
        const active = tab.path === '/'
          ? pathname === '/'
          : pathname.startsWith(tab.path)
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            className={`flex-1 flex flex-col items-center py-3 gap-0.5 text-xs font-medium transition-colors ${
              active ? 'text-amber-500' : 'text-stone-400 hover:text-stone-600'
            }`}
          >
            <span className="text-xl leading-none">{tab.icon}</span>
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
