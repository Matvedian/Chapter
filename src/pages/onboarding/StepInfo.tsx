import { useState } from 'react'
import type { OnboardingData } from './index'

interface Props {
  onNext: (patch: Partial<OnboardingData>) => void
}

const GENDERS = [
  { value: 'man', label: 'Man' },
  { value: 'woman', label: 'Woman' },
  { value: 'nonbinary', label: 'Non-binary' },
]

const LOOKING_FOR = [
  { value: 'men', label: 'Men' },
  { value: 'women', label: 'Women' },
  { value: 'nonbinary', label: 'Non-binary' },
]

const maxBirthDate = (() => {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 18)
  return d.toISOString().split('T')[0]
})()

export default function StepInfo({ onNext }: Props) {
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [gender, setGender] = useState('')
  const [lookingFor, setLookingFor] = useState<string[]>([])

  const toggleLookingFor = (value: string) => {
    setLookingFor(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    )
  }

  const canContinue = name.trim() && birthDate && gender && lookingFor.length > 0

  return (
    <div className="px-6 pt-6 pb-10">
      <h2 className="text-2xl font-bold text-stone-900 mb-1">About you</h2>
      <p className="text-stone-500 text-sm mb-8">Help others get to know you.</p>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1.5">Your name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="First name"
            className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1.5">Date of birth</label>
          <input
            type="date"
            value={birthDate}
            onChange={e => setBirthDate(e.target.value)}
            max={maxBirthDate}
            className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-2">I am a…</label>
          <div className="flex gap-2 flex-wrap">
            {GENDERS.map(g => (
              <button
                key={g.value}
                onClick={() => setGender(g.value)}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                  gender === g.value
                    ? 'bg-amber-400 border-amber-400 text-stone-900'
                    : 'bg-white border-stone-200 text-stone-700 hover:border-amber-300'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-2">Looking for…</label>
          <div className="flex gap-2 flex-wrap">
            {LOOKING_FOR.map(l => (
              <button
                key={l.value}
                onClick={() => toggleLookingFor(l.value)}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                  lookingFor.includes(l.value)
                    ? 'bg-amber-400 border-amber-400 text-stone-900'
                    : 'bg-white border-stone-200 text-stone-700 hover:border-amber-300'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={() => onNext({ name: name.trim(), birthDate, gender, lookingFor })}
        disabled={!canContinue}
        className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-500 text-stone-900 font-semibold transition-colors disabled:opacity-40 mt-10"
      >
        Continue
      </button>
    </div>
  )
}
