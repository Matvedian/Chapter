export interface CandidateBook {
  book_id: string
  title: string
  author: string
  cover_url: string | null
  source: string
  external_id: string
  shared: boolean
}

export interface DiscoverCandidate {
  id: string
  name: string | null
  birth_date: string | null
  photos: string[]
  score: number
  sharedBooks: number
  sharedGenres: number
  gender: string | null
  bio: string | null
  relationship_goal: string | null
  identity_verified: boolean
  books: CandidateBook[]
  genres: string[]
  reading: CandidateBook[]
  prompts: { question: string; answer: string }[]
}
