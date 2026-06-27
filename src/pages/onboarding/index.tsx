import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import { useProfileStore } from '../../store/profile'
import { supabase } from '../../lib/supabase'
import StepPhotos from './StepPhotos'
import StepInfo from './StepInfo'
import StepGenres from './StepGenres'
import StepBooks from './StepBooks'
import StepPrompts from './StepPrompts'

const STEPS = ['Info', 'Photos', 'Genres', 'Books', 'Prompts']

export interface SelectedBook {
  source: 'google_books' | 'open_library' | 'spotify'
  external_id: string
  title: string
  author: string
  cover_url: string | null
}

export interface OnboardingData {
  photos: string[]
  name: string
  birthDate: string
  gender: string
  lookingFor: string[]
  relationshipGoal: string
  bio: string
  genreIds: number[]
  books: SelectedBook[]
  prompts: { question: string; answer: string; position: number }[]
}

export default function Onboarding() {
  const [step, setStep] = useState(0)
  const [data, setData] = useState<OnboardingData>({
    photos: [],
    name: '',
    birthDate: '',
    gender: '',
    lookingFor: [],
    relationshipGoal: '',
    bio: '',
    genreIds: [],
    books: [],
    prompts: [],
  })
  const [submitting, setSubmitting] = useState(false)
  const { user } = useAuthStore()
  const { fetch: fetchProfile } = useProfileStore()
  const navigate = useNavigate()

  const next = (patch: Partial<OnboardingData>) => {
    const updated = { ...data, ...patch }
    setData(updated)
    if (step < STEPS.length - 1) {
      setStep(step + 1)
    } else {
      submit(updated)
    }
  }

  const submit = async (d: OnboardingData) => {
    if (!user) return
    setSubmitting(true)

    await supabase.from('profiles').update({
      name: d.name,
      birth_date: d.birthDate,
      gender: d.gender,
      looking_for: d.lookingFor,
      relationship_goal: d.relationshipGoal || null,
      bio: d.bio || null,
      photos: d.photos,
      onboarding_complete: true,
    }).eq('id', user.id)

    await supabase.from('user_genres').delete().eq('user_id', user.id)
    if (d.genreIds.length) {
      await supabase.from('user_genres').insert(
        d.genreIds.map(genre_id => ({ user_id: user.id, genre_id }))
      )
    }

    await supabase.from('user_books').delete().eq('user_id', user.id)
    for (const book of d.books) {
      const { data: bookRow } = await supabase
        .from('books')
        .upsert(
          { source: book.source, external_id: book.external_id, title: book.title, author: book.author, cover_url: book.cover_url },
          { onConflict: 'source,external_id' }
        )
        .select('id')
        .single()
      if (bookRow) {
        await supabase.from('user_books').insert({
          user_id: user.id,
          book_id: bookRow.id,
          shelf: 'read',
          is_favorite: true,
        })
      }
    }

    if (d.prompts.length > 0) {
      await supabase.from('profile_prompts').delete().eq('user_id', user.id)
      await supabase.from('profile_prompts').insert(
        d.prompts.map(p => ({ user_id: user.id, question: p.question, answer: p.answer, position: p.position }))
      )
    }

    await fetchProfile(user.id)
    setSubmitting(false)
    navigate('/taste-preview', { replace: true })
  }

  return (
    <div className="min-h-screen bg-canvas">
      <div className="px-6 safe-top pb-2">
        <div className="flex items-center gap-1.5 mb-1">
          {STEPS.map((label, i) => (
            <div
              key={label}
              className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i <= step ? 'bg-brand' : 'bg-border'}`}
            />
          ))}
        </div>
        <p className="text-xs text-subtle text-right">
          Step {step + 1} of {STEPS.length} — {STEPS[step]}
        </p>
      </div>

      {step === 0 && <StepInfo onNext={next} />}
      {step === 1 && <StepPhotos onNext={next} />}
      {step === 2 && <StepGenres onNext={next} />}
      {step === 3 && <StepBooks onNext={next} submitting={false} />}
      {step === 4 && <StepPrompts onNext={next} submitting={submitting} />}
    </div>
  )
}
