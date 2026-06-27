import { supabase } from './supabase'
import type { CandidateBook, DiscoverCandidate } from '../types/discover'

function mapBookRow(
  row: unknown,
  myBookIds: Set<string>,
): { user_id: string; book: CandidateBook } | null {
  const r = row as { user_id: string; book_id: string; books: { id: string; title: string; author: string; cover_url: string | null; source: string; external_id: string } | null }
  if (!r.books) return null
  return {
    user_id: r.user_id,
    book: {
      book_id: r.books.id,
      title: r.books.title,
      author: r.books.author,
      cover_url: r.books.cover_url,
      source: r.books.source,
      external_id: r.books.external_id,
      shared: myBookIds.has(r.books.id),
    },
  }
}

export async function loadDiscoverCandidates(
  userId: string,
  limit?: number,
): Promise<{ candidates: DiscoverCandidate[]; error: boolean }> {
  const { data: rpcData, error: rpcError } = await supabase.rpc('get_candidates', { p_user_id: userId })
  if (rpcError) return { candidates: [], error: true }
  if (!rpcData?.length) return { candidates: [], error: false }

  const rows = rpcData as { profile_id: string; score: number; shared_books?: number; shared_genres?: number }[]
  const sliced = limit ? rows.slice(0, limit) : rows
  const ids = sliced.map(r => r.profile_id)
  const metaMap = Object.fromEntries(sliced.map(r => [r.profile_id, r]))

  const [
    { data: profiles, error: profilesError },
    { data: favRows },
    { data: readingRows },
    { data: ugRows },
    { data: myBooks },
    { data: promptRows },
  ] = await Promise.all([
    supabase.from('profiles').select('id, name, birth_date, photos, gender, bio, identity_verified, relationship_goal').in('id', ids),
    supabase.from('user_books').select('user_id, book_id, books(id, title, author, cover_url, source, external_id)').in('user_id', ids).eq('is_favorite', true),
    supabase.from('user_books').select('user_id, book_id, books(id, title, author, cover_url, source, external_id)').in('user_id', ids).eq('shelf', 'reading'),
    supabase.from('user_genres').select('user_id, genres(name)').in('user_id', ids),
    supabase.from('user_books').select('book_id').eq('user_id', userId),
    supabase.from('profile_prompts').select('user_id, question, answer, position').in('user_id', ids).order('position'),
  ])

  if (profilesError || !profiles?.length) return { candidates: [], error: true }

  const myBookIds = new Set((myBooks ?? []).map(r => r.book_id))

  const booksByUser = new Map<string, CandidateBook[]>()
  for (const row of favRows ?? []) {
    const mapped = mapBookRow(row, myBookIds)
    if (!mapped) continue
    const list = booksByUser.get(mapped.user_id) ?? []
    list.push(mapped.book)
    booksByUser.set(mapped.user_id, list)
  }

  const readingByUser = new Map<string, CandidateBook[]>()
  for (const row of readingRows ?? []) {
    const mapped = mapBookRow(row, myBookIds)
    if (!mapped) continue
    const list = readingByUser.get(mapped.user_id) ?? []
    list.push(mapped.book)
    readingByUser.set(mapped.user_id, list)
  }

  const genresByUser = new Map<string, string[]>()
  for (const row of ugRows ?? []) {
    const r = row as unknown as { user_id: string; genres: { name: string } | null }
    const name = r.genres?.name
    if (!name) continue
    const list = genresByUser.get(r.user_id) ?? []
    list.push(name)
    genresByUser.set(r.user_id, list)
  }

  const promptsByUser = new Map<string, { question: string; answer: string }[]>()
  for (const row of promptRows ?? []) {
    const r = row as { user_id: string; question: string; answer: string; position: number }
    const list = promptsByUser.get(r.user_id) ?? []
    list.push({ question: r.question, answer: r.answer })
    promptsByUser.set(r.user_id, list)
  }

  const profileMap = Object.fromEntries(profiles.map(p => [p.id, p]))
  const candidates: DiscoverCandidate[] = ids
    .map(id => {
      const p = profileMap[id]
      const meta = metaMap[id]
      if (!p) return null
      const sharedBooks = meta?.shared_books ?? Math.floor((meta?.score ?? 0) / 3)
      const sharedGenres = meta?.shared_genres ?? (meta?.score ?? 0) % 3
      return {
        id: p.id,
        name: p.name,
        birth_date: p.birth_date,
        photos: p.photos ?? [],
        score: meta?.score ?? 0,
        sharedBooks,
        sharedGenres,
        gender: p.gender ?? null,
        bio: p.bio ?? null,
        relationship_goal: p.relationship_goal ?? null,
        identity_verified: p.identity_verified ?? false,
        books: booksByUser.get(id) ?? [],
        genres: genresByUser.get(id) ?? [],
        reading: readingByUser.get(id) ?? [],
        prompts: promptsByUser.get(id) ?? [],
      }
    })
    .filter((c): c is DiscoverCandidate => c !== null)

  return { candidates, error: false }
}
