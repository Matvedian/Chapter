import { useAuthStore } from '../store/auth'

export default function Discover() {
  const { user, signOut } = useAuthStore()

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center px-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-stone-900">Chapter</h1>
        <p className="text-stone-500 mt-2 text-sm">Signed in as {user?.email}</p>
        <button
          onClick={signOut}
          className="mt-6 px-6 py-2 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-700 text-sm font-medium transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
