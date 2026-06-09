import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
// SPOTIFY STANDBY: import { Browser } from '@capacitor/browser'
import { useAuthStore } from '../store/auth'
import { useProfileStore } from '../store/profile'
import { supabase } from '../lib/supabase'
// SPOTIFY STANDBY: import { generateCodeVerifier, getAuthUrl, getSavedAudiobooks, refreshAccessToken } from '../lib/spotify'
import BottomNav from '../components/BottomNav'

function getAge(birthDate: string): number {
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

// SPOTIFY STANDBY: interface SpotifyConnection { access_token: string; refresh_token: string | null; expires_at: string | null }

type DeleteState = 'idle' | 'confirming' | 'deleting' | 'error'

export default function Profile() {
  const { signOut, user } = useAuthStore()
  const { profile, fetch: fetchProfile } = useProfileStore()
  const navigate = useNavigate()

  // SPOTIFY STANDBY: const [spotify, setSpotify] = useState<SpotifyConnection | null>(null)
  // SPOTIFY STANDBY: const [spotifyLoading, setSpotifyLoading] = useState(true)
  // SPOTIFY STANDBY: const [spotifyWorking, setSpotifyWorking] = useState(false)
  // SPOTIFY STANDBY: const [importDone, setImportDone] = useState(false)

  const [pauseWorking, setPauseWorking] = useState(false)
  const [showPauseConfirm, setShowPauseConfirm] = useState(false)

  const [deleteState, setDeleteState] = useState<DeleteState>('idle')
  const [deleteError, setDeleteError] = useState('')

  const photo = profile?.photos?.[0] ?? null
  const age = profile?.birth_date ? getAge(profile.birth_date) : null

  // SPOTIFY STANDBY — re-enable when VITE_SPOTIFY_CLIENT_ID is configured
  // useEffect(() => {
  //   if (!user) return
  //   supabase.from('platform_connections').select('access_token, refresh_token, expires_at')
  //     .eq('user_id', user.id).eq('platform', 'spotify').maybeSingle()
  //     .then(({ data }) => { setSpotify(data ?? null); setSpotifyLoading(false) })
  // }, [user?.id])
  // const connectSpotify = async () => {
  //   const verifier = generateCodeVerifier(); sessionStorage.setItem('spotify_code_verifier', verifier)
  //   await Browser.open({ url: await getAuthUrl(verifier), presentationStyle: 'popover' })
  // }
  // const disconnectSpotify = async () => {
  //   if (!user) return; setSpotifyWorking(true)
  //   await supabase.from('platform_connections').delete().eq('user_id', user.id).eq('platform', 'spotify')
  //   setSpotify(null); setSpotifyWorking(false)
  // }
  // const reimportAudiobooks = async () => {
  //   if (!spotify || !user) return; setSpotifyWorking(true); setImportDone(false)
  //   try {
  //     let token = spotify.access_token
  //     if (spotify.expires_at && new Date(spotify.expires_at) <= new Date() && spotify.refresh_token) {
  //       const refreshed = await refreshAccessToken(spotify.refresh_token); token = refreshed.access_token
  //       await supabase.from('platform_connections').update(refreshed).eq('user_id', user.id).eq('platform', 'spotify')
  //       setSpotify(prev => prev ? { ...prev, ...refreshed } : prev)
  //     }
  //     const audiobooks = await getSavedAudiobooks(token)
  //     for (const book of audiobooks) {
  //       const { data: bookRow } = await supabase.from('books')
  //         .upsert({ source: book.source, external_id: book.external_id, title: book.title, author: book.author, cover_url: book.cover_url }, { onConflict: 'source,external_id' })
  //         .select('id').single()
  //       if (bookRow) await supabase.from('user_books').upsert({ user_id: user.id, book_id: bookRow.id, shelf: 'favorite' }, { onConflict: 'user_id,book_id' })
  //     }
  //     setImportDone(true)
  //   } catch { } // ignore
  //   setSpotifyWorking(false)
  // }

  const togglePause = async (newPaused: boolean) => {
    if (!user) return
    if (newPaused) { setShowPauseConfirm(true); return }
    setPauseWorking(true)
    await supabase.from('profiles').update({ paused: false }).eq('id', user.id)
    await fetchProfile(user.id)
    setPauseWorking(false)
  }

  const confirmPause = async () => {
    if (!user) return
    setShowPauseConfirm(false)
    setPauseWorking(true)
    await supabase.from('profiles').update({ paused: true }).eq('id', user.id)
    await fetchProfile(user.id)
    setPauseWorking(false)
  }

  const deleteAccount = async () => {
    if (!user) return
    setDeleteState('deleting')
    setDeleteError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await supabase.functions.invoke('delete-account', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (res.error) throw new Error(res.error.message)
      await signOut()
    } catch (e: unknown) {
      setDeleteError(e instanceof Error ? e.message : 'Something went wrong.')
      setDeleteState('error')
    }
  }

  return (
    <div className="h-screen bg-stone-50 flex flex-col overflow-hidden">
      <div className="px-6 safe-top pb-4 flex-shrink-0">
        <h1 className="text-2xl font-bold text-stone-900">Profile</h1>
      </div>

      {profile?.paused && (
        <div className="bg-amber-400 px-6 py-2 text-center flex-shrink-0">
          <p className="text-stone-900 text-sm font-medium">Your profile is paused — you're hidden from Discover</p>
        </div>
      )}

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
          {profile?.bio && (
            <p className="text-stone-600 text-sm mt-3 text-center leading-relaxed">{profile.bio}</p>
          )}
        </div>

        {/* Edit profile */}
        <button
          onClick={() => navigate('/profile/edit')}
          className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-500 text-stone-900 font-semibold transition-colors mb-3"
        >
          Edit profile
        </button>

        {/* SPOTIFY STANDBY: Connected platforms section hidden until Client ID is configured */}

        {/* Pause profile */}
        <section className="bg-white rounded-2xl border border-stone-100 px-5 py-4 mb-3">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0 pr-4">
              <p className="text-sm font-semibold text-stone-900">Pause my profile</p>
              <p className="text-xs text-stone-400 mt-0.5">Hide yourself from Discover. You can unpause anytime.</p>
            </div>
            <button
              disabled={pauseWorking}
              onClick={() => togglePause(!profile?.paused)}
              className={`w-12 h-7 rounded-full transition-colors flex-shrink-0 relative disabled:opacity-40 ${profile?.paused ? 'bg-amber-400' : 'bg-stone-200'}`}
            >
              <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${profile?.paused ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </section>

        {/* Sign out */}
        <button
          onClick={signOut}
          className="w-full py-3 rounded-xl border border-stone-200 bg-white text-stone-700 font-medium hover:bg-stone-100 transition-colors mb-3"
        >
          Sign out
        </button>

        {/* Delete account */}
        <button
          onClick={() => setDeleteState('confirming')}
          className="w-full py-3 rounded-xl text-red-500 text-sm font-medium"
        >
          Delete account
        </button>
      </div>

      {/* Pause confirmation modal */}
      {showPauseConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-8 bg-black/40">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold text-stone-900 mb-2">Pause your profile?</h2>
            <p className="text-stone-500 text-sm leading-relaxed mb-6">
              You won't appear in anyone's deck while paused. You can unpause anytime from your profile.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowPauseConfirm(false)}
                className="flex-1 py-3 rounded-xl border border-stone-200 text-stone-700 font-medium text-sm"
              >
                Cancel
              </button>
              <button
                onClick={confirmPause}
                className="flex-1 py-3 rounded-xl bg-amber-400 text-stone-900 font-semibold text-sm"
              >
                Pause
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete account modal */}
      {(deleteState === 'confirming' || deleteState === 'deleting' || deleteState === 'error') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-8 bg-black/40">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold text-stone-900 mb-2">Delete your account?</h2>
            <p className="text-stone-500 text-sm leading-relaxed mb-4">
              This will permanently delete your profile, matches, and messages. This cannot be undone.
            </p>
            {deleteState === 'error' && (
              <p className="text-red-500 text-xs mb-4">{deleteError}</p>
            )}
            <div className="flex gap-3">
              <button
                disabled={deleteState === 'deleting'}
                onClick={() => setDeleteState('idle')}
                className="flex-1 py-3 rounded-xl border border-stone-200 text-stone-700 font-medium text-sm disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                disabled={deleteState === 'deleting'}
                onClick={deleteAccount}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-semibold text-sm disabled:opacity-40"
              >
                {deleteState === 'deleting' ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}

// SPOTIFY STANDBY: SpotifyIcon component preserved in git history
