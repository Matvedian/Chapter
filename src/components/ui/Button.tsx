import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

type Variant = 'primary' | 'secondary' | 'destructive' | 'ghost'
type Size = 'md' | 'sm' | 'icon'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  fullWidth?: boolean
}

const variantClass: Record<Variant, string> = {
  primary:
    'bg-brand hover:bg-brand-hover text-on-brand disabled:opacity-50',
  secondary:
    'border border-border bg-surface text-muted hover:bg-canvas disabled:opacity-50',
  destructive:
    'bg-destructive hover:bg-destructive-hover text-white disabled:opacity-50',
  ghost:
    'text-muted hover:text-ink hover:bg-canvas disabled:opacity-50',
}

const sizeClass: Record<Size, string> = {
  md: 'px-4 py-3 text-sm rounded-btn font-semibold',
  sm: 'px-3 py-2 text-sm rounded-btn font-semibold',
  icon: 'p-2.5 rounded-btn',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-canvas',
        variantClass[variant],
        sizeClass[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    />
  )
}
