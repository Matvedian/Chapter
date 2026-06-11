import { useRef, useState } from 'react'
import { Button, OnboardingStepHeader } from '../../components/ui'
import { useAuthStore } from '../../store/auth'
import { supabase } from '../../lib/supabase'
import type { OnboardingData } from './index'

interface Props {
  onNext: (patch: Partial<OnboardingData>) => void
}

export default function StepPhotos({ onNext }: Props) {
  const [photos, setPhotos] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { user } = useAuthStore()

  const handleFiles = async (files: FileList | null) => {
    if (!files || !user) return
    setError(null)
    setUploading(true)

    const uploads = Array.from(files).slice(0, 6 - photos.length)
    const newUrls: string[] = []

    for (const file of uploads) {
      const ext = file.name.split('.').pop()
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: uploadError } = await supabase.storage.from('photos').upload(path, file)
      if (uploadError) {
        setError('Failed to upload one or more photos.')
        continue
      }
      const { data } = supabase.storage.from('photos').getPublicUrl(path)
      newUrls.push(data.publicUrl)
    }

    setPhotos(prev => [...prev, ...newUrls])
    setUploading(false)
  }

  const remove = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index))
  }

  const slots = Array.from({ length: 6 })

  return (
    <div className="px-6 pt-6 pb-10">
      <OnboardingStepHeader
        title="Add your photos"
        description="Add at least one photo to show who you are."
      />

      <div className="grid grid-cols-3 gap-3 mb-8">
        {slots.map((_, i) => {
          const url = photos[i]
          return url ? (
            <div key={i} className="relative aspect-square rounded-card overflow-hidden bg-border">
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button
                onClick={() => remove(i)}
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-ink/60 text-white text-xs flex items-center justify-center leading-none"
              >
                ×
              </button>
            </div>
          ) : (
            <button
              key={i}
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="aspect-square rounded-card border-2 border-dashed border-border-strong flex items-center justify-center text-subtle hover:border-brand hover:text-brand transition-colors disabled:opacity-40"
            >
              <span className="text-2xl leading-none">+</span>
            </button>
          )
        })}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={e => { handleFiles(e.target.files); e.target.value = '' }}
      />

      {uploading && (
        <p className="text-sm text-muted text-center mb-4">Uploading…</p>
      )}

      {error && (
        <p className="text-sm text-destructive text-center mb-4">{error}</p>
      )}

      <Button
        onClick={() => onNext({ photos })}
        disabled={photos.length === 0 || uploading}
        fullWidth
        className="disabled:opacity-40"
      >
        Continue
      </Button>
    </div>
  )
}
