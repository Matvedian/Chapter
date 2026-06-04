import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Browser } from '@capacitor/browser'
import { useAuthStore } from '../store/auth'
import { useProfileStore } from '../store/profile'
import { supabase } from '../lib/supabase'
import { generateCodeVerifier, getAuthUrl, getSavedAudiobooks, refreshAccessToken } from '../lib/spotify'
import BottomNav from '../components/BottomNav'

function getAge(birthDate: string): number {
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

interface SpotifyConnection {
  access_token: string
  refresh_token: string | null
  expires_at: string | null
}

export default function Profile() {
  const { signOut, user } = useAuthStore()
  const { profile } = useProfileStore()
  const navigate = useNavigate()

  const [spotify, setSpotify] = useState<SpotifyConnection | null>(null)
  const [spotifyLoading, setSpotifyLoading] = useState(true)
  const [spotifyWorking, setSpotifyWorking] = useState(false)
  const [importDone, setImportDone] = useState(false)

  const photo = profile?.photos?.[0] ?? null
  const age = profile?.birth_date ? getAge(profile.birth_date) : null

  useEffect(() => {
    if (!user) return
    supabase
      .from('platform_connections')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', user.id)
      .eq('platform', 'spotify')
      .maybeSingle()
      .then(({ data }) => {
        setSpotify(data ?? null)
        setSpotifyLoading(false)
      })
  }, [user?.id])

  const connectSpotify = async () => {
    const verifier = generateCodeVerifier()
    sessionStorage.setItem('spotify_code_verifier', verifier)
    const url = await getAuthUrl(verifier)
    await Browser.open({ url, presentationStyle: 'popover' })
  }

  const disconnectSpotify = async () => {
    if (!user) return
    setSpotifyWorking(true)
    await supabase.from('platform_connections').delete().eq('user_id', user.id).eq('platform', 'spotify')
    setSpotify(null)
    setSpotifyWorking(false)
  }

  const reimportAudiobooks = async () => {
    if (!spotify || !user) return
    setSpotifyWorking(true)
    setImportDone(false)
    try {
      let token = spotify.access_token
      // Refresh if expired
      if (spotify.expires_at && new Date(spotify.expires_at) <= new Date() && spotify.refresh_token) {
        const refreshed = await refreshAccessToken(spotify.refresh_token)
        token = refreshed.access_token
        await supabase.from('platform_connections').update({
          access_token: refreshed.access_token,
          refresh_token: refreshed.refresh_token,
          expires_at: refreshed.expires_at,
        }).eq('user_id', user.id).eq('platform', 'spotify')
        setSpotify(prev => prev ? { ...prev, ...refreshed } : prev)
      }
      const audiobooks = await getSavedAudiobooks(token)
      for (const book of audiobooks) {
        const { data: bookRow } = await supabase
          .from('books')
          .upsert(
            { source: book.source, external_id: book.external_id, title: book.title, author: book.author, cover_url: book.cover_url },
            { onConflict: 'source,external_id' }
          )
          .select('id')
          .single()
        if (bookRow) {
          await supabase.from('user_books').upsert(
            { user_id: user.id, book_id: bookRow.id, shelf: 'favorite' },
            { onConflict: 'user_id,book_id' }
          )
        }
      }
      setImportDone(true)
    } catch {
      // ignore
    }
    setSpotifyWorking(false)
  }

  return (
    <div className="h-screen bg-stone-50 flex flex-col overflow-hidden">
      <div className="px-6 safe-top pb-4 flex-shrink-0">
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

        {/* Connected platforms */}
        <section className="bg-white rounded-2xl border border-stone-100 px-5 py-4 mb-3">
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-3">Connected platforms</p>

          {spotifyLoading ? (
            <div className="h-10 rounded-xl skeleton" />
          ) : spotify ? (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <SpotifyIcon />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-stone-900">Spotify</p>
                  <p className="text-xs text-green-600">Connected</p>
                </div>
              </div>
              {importDone && (
                <p className="text-xs text-green-600 mb-2">Audiobooks imported to your library.</p>
              )}
              <div className="flex gap-2">
                <button
                  disabled={spotifyWorking}
                  onClick={reimportAudiobooks}
                  className="flex-1 py-2 rounded-xl bg-amber-400 text-stone-900 text-sm font-medium disabled:opacity-40"
                >
                  {spotifyWorking ? 'Importing…' : 'Re-import audiobooks'}
                </button>
                <button
                  disabled={spotifyWorking}
                  onClick={disconnectSpotify}
                  className="py-2 px-4 rounded-xl border border-stone-200 text-stone-500 text-sm disabled:opacity-40"
                >
                  Disconnect
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={connectSpotify}
              className="w-full flex items-center gap-3 py-3 px-4 rounded-xl border border-stone-200 hover:border-green-400 transition-colors"
            >
              <SpotifyIcon />
              <div className="text-left">
                <p className="text-sm font-semibold text-stone-900">Spotify</p>
                <p className="text-xs text-stone-400">Import your saved audiobooks</p>
              </div>
              <span className="ml-auto text-stone-300 text-lg">›</span>
            </button>
          )}
        </section>

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

function SpotifyIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="12" fill="#1DB954" />
      <path d="M16.7 10.9c-2.7-1.6-7.2-1.8-9.8-1a.77.77 0 0 1-.95-.52.77.77 0 0 1 .52-.95c3-.9 8-.7 11.1 1.1a.77.77 0 0 1 .27 1.06.77.77 0 0 1-1.06.27zm-.1 2.7a.64.64 0 0 1-.88.21c-2.3-1.4-5.8-1.8-8.5-1a.64.64 0 0 1-.79-.43.64.64 0 0 1 .43-.8c3.1-.94 7-.48 9.6 1.15a.64.64 0 0 1 .21.87zm-.9 2.6a.51.51 0 0 1-.7.17c-2-1.2-4.5-1.47-7.4-.8a.51.51 0 0 1-.23-1c3.1-.7 5.9-.4 8.2.93a.51.51 0 0 1 .13.7z" fill="white" />
    </svg>
  )
}
