import { cn } from '../../lib/cn'

export default function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin',
        className,
      )}
      role="status"
      aria-label="Loading"
    />
  )
}
