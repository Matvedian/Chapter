import { forwardRef, type TextareaHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  hasError?: boolean
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, hasError = false, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={cn(
        'w-full px-4 py-3 rounded-input border bg-surface text-ink resize-none',
        'placeholder:text-subtle',
        'focus:outline-none focus:ring-2 focus:ring-brand',
        hasError ? 'border-destructive focus:ring-destructive' : 'border-border',
        className,
      )}
      {...props}
    />
  )
})

export default Textarea
