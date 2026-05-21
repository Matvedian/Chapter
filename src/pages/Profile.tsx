import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import { useProfileStore } from '../store/profile'
import BottomNav from '../components/BottomNav'

function getAge(birthDate: string): number {
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

export default function Profile() {
  const { signOut } = useAuthStore()
  const { profile } = useProfileStore()
  const navigate = useNavigate()

  const photo = profile?.photos?.[0] ?? null
  const age = profile?.birth_date ? getAge(profile.birth_date) : null

  return (
    <div className="h-screen bg-stone-50 flex flex-col overflow-hidden">
      <div className="px-6 pt-12 pb-4 flex-shrink-0">
        <h1 className="text-2xl font-bold text-stone-900">Profile</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {/* Avatar + name */}
        <div className="flex flex-col items-center py-8">
          {photo ? (
            <img src={photo} alt="" className="w-28 h-28 rounded-full object-cover shadow-md" />
          ) : (
            <div className="w-28 h-28 rounded-full bg-amber-100 flex items-center justify-center text-5xl shadow-md">
              📖
            </div>
          )}
          <p className="mt-4 text-2xl font-bold text-stone-900">
            {profile?.name ?? 'Reader'}
            {age !== null ? `, ${age}` : ''}
          </p>
          {profile?.gender && (
            <p className="text-stone-500 text-sm mt-1 capitalize">{profile.gender}</p>
          )}
        </div>

        {/* Edit profile */}
        <button
          onClick={() => navigate('/profile/edit')}
          className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-500 text-stone-900 font-semibold transition-colors mb-3"
        >
          Edit profile
        </button>

        {/* Sign out */}
        <button
          onClick={signOut}
          className="w-full py-3 rounded-xl border border-stone-200 bg-white text-stone-700 font-medium hover:bg-stone-100 transition-colors"
        >
          Sign out
        </button>
      </div>

      <BottomNav />
    </div>
  )
}
