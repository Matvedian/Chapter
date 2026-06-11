import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean
}

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, hasError = false, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        'w-full px-4 py-3 rounded-input border bg-surface text-ink',
        'placeholder:text-subtle',
        'focus:outline-none focus:ring-2 focus:ring-brand',
        hasError ? 'border-destructive focus:ring-destructive' : 'border-border',
        className,
      )}
      {...props}
    />
  )
})

export default Input
