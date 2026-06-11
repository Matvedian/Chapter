import type { LabelHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export default function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn('block text-sm font-medium text-ink-secondary mb-1', className)}
      {...props}
    />
  )
}
