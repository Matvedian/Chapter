import { BadgeCheck } from 'lucide-react'
import { cn } from '../lib/cn'

export default function VerifiedBadge({
  className,
  size = 'sm',
}: {
  className?: string
  size?: 'sm' | 'md'
}) {
  const icon = size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5'
  const text = size === 'md' ? 'text-xs' : 'text-[10px]'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 font-semibold text-brand-ink bg-brand-subtle rounded-full',
        size === 'md' ? 'px-2 py-0.5' : 'px-1.5 py-0.5',
        text,
        className,
      )}
      title="Identity verified"
    >
      <BadgeCheck className={icon} aria-hidden />
      Verified
    </span>
  )
}
