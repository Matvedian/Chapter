import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import { useProfileStore } from '../../store/profile'
import { supabase } from '../../lib/supabase'
import StepPhotos from './StepPhotos'
import StepInfo from './StepInfo'
import StepGenres from './StepGenres'
import StepBooks from './StepBooks'

const STEPS = ['Photos', 'Info', 'Genres', 'Books']

export interface SelectedBook {
  open_library_id: string
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
  genreIds: number[]
  books: SelectedBook[]
}

export default function Onboarding() {
  const [step, setStep] = useState(0)
  const [data, setData] = useState<OnboardingData>({
    photos: [],
    name: '',
    birthDate: '',
    gender: '',
    lookingFor: [],
    genreIds: [],
    books: [],
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
          { open_library_id: book.open_library_id, title: book.title, author: book.author, cover_url: book.cover_url },
          { onConflict: 'open_library_id' }
        )
        .select('id')
        .single()
      if (bookRow) {
        await supabase.from('user_books').insert({
          user_id: user.id,
          book_id: bookRow.id,
          shelf: 'favorite',
        })
      }
    }

    await fetchProfile(user.id)
    setSubmitting(false)
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="px-6 pt-12 pb-2">
        <div className="flex items-center gap-1.5 mb-1">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i <= step ? 'bg-amber-400' : 'bg-stone-200'}`}
            />
          ))}
        </div>
        <p className="text-xs text-stone-400 text-right">Step {step + 1} of {STEPS.length}</p>
      </div>

      {step === 0 && <StepPhotos onNext={next} />}
      {step === 1 && <StepInfo onNext={next} />}
      {step === 2 && <StepGenres onNext={next} />}
      {step === 3 && <StepBooks onNext={next} submitting={submitting} />}
    </div>
  )
}
