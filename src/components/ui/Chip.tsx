import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean
}

export default function Chip({
  selected = false,
  className,
  type = 'button',
  ...props
}: ChipProps) {
  return (
    <button
      type={type}
      className={cn(
        'px-4 py-2 rounded-full text-sm font-medium border transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-1 focus:ring-offset-canvas',
        selected
          ? 'bg-brand border-brand text-on-brand'
          : 'bg-surface border-border text-ink-secondary hover:border-brand-muted',
        className,
      )}
      {...props}
    />
  )
}
