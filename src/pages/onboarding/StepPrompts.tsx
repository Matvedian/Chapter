import { useState } from 'react'
import { Button, OnboardingStepHeader, Textarea } from '../../components/ui'
import type { OnboardingData } from './index'

export const PROMPT_QUESTIONS = [
  'My all-time favourite book is…',
  'A book that changed my perspective…',
  'My comfort read when I need a reset…',
  'I judge a book by…',
  'The character I most relate to…',
  "A book I'd recommend to everyone…",
  'My unpopular literary opinion…',
  'The genre I secretly love…',
  'Currently obsessed with…',
  'A book that made me ugly cry…',
  'My ideal reading spot…',
  "The fictional world I'd live in…",
]

interface Props {
  onNext: (patch: Partial<OnboardingData>) => void
  submitting?: boolean
}

export default function StepPrompts({ onNext, submitting }: Props) {
  const [selected, setSelected] = useState<string[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [picking, setPicking] = useState(true)

  const toggleQuestion = (q: string) => {
    if (selected.includes(q)) {
      setSelected(prev => prev.filter(s => s !== q))
    } else if (selected.length < 3) {
      setSelected(prev => [...prev, q])
    }
  }

  const handleSubmit = () => {
    const prompts = selected
      .filter(q => answers[q]?.trim())
      .map((q, i) => ({ question: q, answer: answers[q].trim(), position: i }))
    onNext({ prompts })
  }

  const canSubmit = selected.length > 0 && selected.every(q => answers[q]?.trim())

  if (picking) {
    return (
      <div className="px-6 pt-6 pb-10">
        <OnboardingStepHeader
          title="Your book prompts"
          description={selected.length > 0
            ? `Pick up to 3 questions. ${selected.length} selected.`
            : 'Pick up to 3 questions to answer on your profile.'}
        />

        <div className="space-y-2 mb-10">
          {PROMPT_QUESTIONS.map(q => {
            const isSelected = selected.includes(q)
            return (
              <button
                key={q}
                type="button"
                onClick={() => toggleQuestion(q)}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-colors flex items-center justify-between gap-2 ${
                  isSelected ? 'border-brand bg-brand-subtle' : 'border-border bg-surface'
                } ${!isSelected && selected.length >= 3 ? 'opacity-40' : ''}`}
              >
                <span className="text-sm font-medium text-ink">{q}</span>
                {isSelected && <span className="text-brand-ink text-sm flex-shrink-0">✓</span>}
              </button>
            )
          })}
        </div>

        <Button
          onClick={() => setPicking(false)}
          disabled={selected.length === 0}
          fullWidth
          className="disabled:opacity-40"
        >
          Answer prompts
        </Button>
        <Button
          variant="ghost"
          size="sm"
          fullWidth
          onClick={() => onNext({ prompts: [] })}
          className="mt-3"
        >
          Skip for now
        </Button>
      </div>
    )
  }

  return (
    <div className="px-6 pt-6 pb-10">
      <OnboardingStepHeader
        title="Answer your prompts"
        description="Keep answers short and real."
      />

      <div className="space-y-6 mb-10">
        {selected.map(q => (
          <div key={q}>
            <p className="text-sm font-semibold text-ink mb-2">{q}</p>
            <div className="relative">
              <Textarea
                value={answers[q] ?? ''}
                onChange={e => setAnswers(prev => ({ ...prev, [q]: e.target.value.slice(0, 150) }))}
                placeholder="Your answer…"
                rows={3}
              />
              <span className="absolute bottom-2 right-2 text-xs text-subtle pointer-events-none">
                {(answers[q] ?? '').length}/150
              </span>
            </div>
          </div>
        ))}
      </div>

      <Button
        onClick={handleSubmit}
        disabled={!canSubmit || submitting}
        fullWidth
        className="disabled:opacity-40"
      >
        {submitting ? 'Saving…' : 'Finish'}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        fullWidth
        onClick={() => setPicking(true)}
        className="mt-3"
      >
        Back to questions
      </Button>
    </div>
  )
}
