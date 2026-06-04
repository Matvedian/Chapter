import type { BookResult } from './bookSearch'

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string
const REDIRECT_URI = import.meta.env.VITE_SPOTIFY_REDIRECT_URI as string

export interface SpotifyTokens {
  access_token: string
  refresh_token: string
  expires_at: string // ISO string
}

// ── PKCE helpers ──────────────────────────────────────────────────────────────

function randomBytes(length: number): Uint8Array {
  const arr = new Uint8Array(length)
  crypto.getRandomValues(arr)
  return arr
}

function base64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let str = ''
  bytes.forEach(b => { str += String.fromCharCode(b) })
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export function generateCodeVerifier(): string {
  return base64url(randomBytes(64))
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoded = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  return base64url(digest)
}

// ── Auth flow ─────────────────────────────────────────────────────────────────

export async function getAuthUrl(verifier: string): Promise<string> {
  const challenge = await generateCodeChallenge(verifier)
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: 'user-library-read',
    code_challenge_method: 'S256',
    code_challenge: challenge,
  })
  return `https://accounts.spotify.com/authorize?${params}`
}

export async function exchangeCode(code: string, verifier: string): Promise<SpotifyTokens> {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      code_verifier: verifier,
    }),
  })
  if (!res.ok) throw new Error('Token exchange failed')
  const d = await res.json()
  return {
    access_token: d.access_token,
    refresh_token: d.refresh_token,
    expires_at: new Date(Date.now() + d.expires_in * 1000).toISOString(),
  }
}

export async function refreshAccessToken(refreshToken: string): Promise<SpotifyTokens> {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
    }),
  })
  if (!res.ok) throw new Error('Token refresh failed')
  const d = await res.json()
  return {
    access_token: d.access_token,
    refresh_token: d.refresh_token ?? refreshToken,
    expires_at: new Date(Date.now() + d.expires_in * 1000).toISOString(),
  }
}

// ── Audiobooks ────────────────────────────────────────────────────────────────

interface SpotifyAudiobook {
  id: string
  name: string
  authors: { name: string }[]
  images: { url: string }[]
}

export async function getSavedAudiobooks(accessToken: string): Promise<BookResult[]> {
  const results: BookResult[] = []
  let url: string | null = 'https://api.spotify.com/v1/me/audiobooks?limit=50'

  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) break
    const data = await res.json()
    for (const item of (data.items ?? []) as { audiobook: SpotifyAudiobook }[]) {
      const ab = item.audiobook
      results.push({
        source: 'spotify' as const,
        external_id: ab.id,
        title: ab.name,
        author: ab.authors?.[0]?.name ?? '',
        cover_url: ab.images?.[0]?.url ?? null,
      })
    }
    url = data.next ?? null
  }

  return results
}
