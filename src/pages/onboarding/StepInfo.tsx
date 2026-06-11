import { useState } from 'react'
import { Button, Chip, Input, Label, OnboardingStepHeader, Textarea } from '../../components/ui'
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

function getAge(dateStr: string): number {
  const today = new Date()
  const birth = new Date(dateStr)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

export default function StepInfo({ onNext }: Props) {
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [gender, setGender] = useState('')
  const [lookingFor, setLookingFor] = useState<string[]>([])
  const [bio, setBio] = useState('')
  const [ageError, setAgeError] = useState(false)

  const toggleLookingFor = (value: string) => {
    setLookingFor(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    )
  }

  const canContinue = name.trim() && birthDate && gender && lookingFor.length > 0

  const handleContinue = () => {
    if (getAge(birthDate) < 18) { setAgeError(true); return }
    onNext({ name: name.trim(), birthDate, gender, lookingFor, bio })
  }

  return (
    <div className="px-6 pt-6 pb-10">
      <OnboardingStepHeader
        title="About you"
        description="Help others get to know you."
      />

      <div className="space-y-6">
        <div>
          <Label htmlFor="name">Your name</Label>
          <Input
            id="name"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="First name"
          />
        </div>

        <div>
          <Label htmlFor="birthDate">Date of birth</Label>
          <Input
            id="birthDate"
            type="date"
            value={birthDate}
            onChange={e => { setBirthDate(e.target.value); setAgeError(false) }}
            max={maxBirthDate}
            hasError={ageError}
          />
          {ageError && (
            <p className="text-destructive text-sm mt-1.5">You need to be 18+ to use the app.</p>
          )}
        </div>

        <div>
          <Label>I am a…</Label>
          <div className="flex gap-2 flex-wrap mt-2">
            {GENDERS.map(g => (
              <Chip
                key={g.value}
                selected={gender === g.value}
                onClick={() => setGender(g.value)}
              >
                {g.label}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <Label>Looking for…</Label>
          <div className="flex gap-2 flex-wrap mt-2">
            {LOOKING_FOR.map(l => (
              <Chip
                key={l.value}
                selected={lookingFor.includes(l.value)}
                onClick={() => toggleLookingFor(l.value)}
              >
                {l.label}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between mb-1.5">
            <Label className="mb-0">
              About me <span className="text-subtle font-normal">(optional)</span>
            </Label>
            <span className="text-xs text-subtle">{bio.length}/300</span>
          </div>
          <Textarea
            value={bio}
            onChange={e => setBio(e.target.value.slice(0, 300))}
            placeholder="What are you reading lately? What do you love about books?"
            rows={3}
          />
        </div>
      </div>

      <Button
        onClick={handleContinue}
        disabled={!canContinue}
        fullWidth
        className="mt-10 disabled:opacity-40"
      >
        Continue
      </Button>
    </div>
  )
}
