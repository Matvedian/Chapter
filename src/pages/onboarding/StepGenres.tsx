import { useEffect, useState } from 'react'
import { Button, Chip, OnboardingStepHeader } from '../../components/ui'
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
      <OnboardingStepHeader
        title="Your genres"
        description={
          selected.length > 0
            ? `Pick at least 3 genres you love. ${selected.length} selected`
            : 'Pick at least 3 genres you love.'
        }
      />

      <div className="flex flex-wrap gap-2 mb-10">
        {genres.map(g => (
          <Chip
            key={g.id}
            selected={selected.includes(g.id)}
            onClick={() => toggle(g.id)}
          >
            {g.name}
          </Chip>
        ))}
      </div>

      <Button
        onClick={() => onNext({ genreIds: selected })}
        disabled={selected.length < 3}
        fullWidth
        className="disabled:opacity-40"
      >
        Continue
      </Button>
      <Button
        variant="ghost"
        size="sm"
        fullWidth
        onClick={() => onNext({ genreIds: [] })}
        className="mt-3"
      >
        Skip for now
      </Button>
    </div>
  )
}
