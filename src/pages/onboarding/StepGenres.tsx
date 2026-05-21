import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { OnboardingData } from './index'

interface Genre {
  id: number
  name: string
}

interface Props {
  onNext: (patch: Partial<OnboardingData>) => void
}

export default function StepGenres({ onNext }: Props) {
  const [genres, setGenres] = useState<Genre[]>([])
  const [selected, setSelected] = useState<number[]>([])

  useEffect(() => {
    supabase.from('genres').select('id, name').order('name').then(({ data }) => {
      if (data) setGenres(data)
    })
  }, [])

  const toggle = (id: number) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
    )
  }

  return (
    <div className="px-6 pt-6 pb-10">
      <h2 className="text-2xl font-bold text-stone-900 mb-1">Your genres</h2>
      <p className="text-stone-500 text-sm mb-8">
        Pick at least 3 genres you love.{' '}
        {selected.length > 0 && (
          <span className="text-amber-600 font-medium">{selected.length} selected</span>
        )}
      </p>

      <div className="flex flex-wrap gap-2 mb-10">
        {genres.map(g => (
          <button
            key={g.id}
            onClick={() => toggle(g.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
              selected.includes(g.id)
                ? 'bg-amber-400 border-amber-400 text-stone-900'
                : 'bg-white border-stone-200 text-stone-700 hover:border-amber-300'
            }`}
          >
            {g.name}
          </button>
        ))}
      </div>

      <button
        onClick={() => onNext({ genreIds: selected })}
        disabled={selected.length < 3}
        className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-500 text-stone-900 font-semibold transition-colors disabled:opacity-40"
      >
        Continue
      </button>
    </div>
  )
}
