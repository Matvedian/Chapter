import { useEffect } from 'react'
import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { useAuthStore } from '../store/auth'
import { supabase } from '../lib/supabase'
import { exchangeCode, getSavedAudiobooks } from '../lib/spotify'

export function useSpotifyCallback() {
  const { user } = useAuthStore()

  useEffect(() => {
    if (!user) return

    const handle = App.addListener('appUrlOpen', async ({ url }: { url: string }) => {
      const redirectBase = import.meta.env.VITE_SPOTIFY_REDIRECT_URI as string
      if (!url.startsWith(redirectBase)) return

      await Browser.close()

      const params = new URLSearchParams(url.split('?')[1] ?? '')
      const code = params.get('code')
      const verifier = sessionStorage.getItem('spotify_code_verifier')
      if (!code || !verifier) return
      sessionStorage.removeItem('spotify_code_verifier')

      try {
        const tokens = await exchangeCode(code, verifier)

        await supabase.from('platform_connections').upsert(
          {
            user_id: user.id,
            platform: 'spotify',
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_at: tokens.expires_at,
          },
          { onConflict: 'user_id,platform' }
        )

        // Import audiobooks into the user's library
        const audiobooks = await getSavedAudiobooks(tokens.access_token)
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
      } catch {
        // Silently fail — the user can retry from Profile
      }
    })

    return () => { handle.then((h: { remove: () => void }) => h.remove()) }
  }, [user?.id])
}
