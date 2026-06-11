/**
 * Chapter design tokens — mirrors src/index.css @theme values.
 * Use for inline styles, Capacitor config, or non-Tailwind contexts.
 * In components, prefer Tailwind utilities: bg-brand, text-ink, rounded-btn, etc.
 */
export const tokens = {
  color: {
    canvas: '#fafaf9',
    surface: '#ffffff',
    brand: '#fbbf24',
    brandHover: '#f59e0b',
    brandSubtle: '#fef3c7',
    brandInk: '#b45309',
    ink: '#1c1917',
    inkSecondary: '#44403c',
    muted: '#78716c',
    subtle: '#a8a29e',
    faint: '#d6d3d1',
    onBrand: '#1c1917',
    border: '#e7e5e4',
    borderStrong: '#d6d3d1',
    destructive: '#ef4444',
    destructiveHover: '#dc2626',
    destructiveSubtle: '#fef2f2',
    destructiveInk: '#b91c1c',
    success: '#22c55e',
    successSubtle: '#f0fdf4',
    skeletonFrom: '#f0ece8',
    skeletonMid: '#e4ddd7',
  },
  radius: {
    btn: '0.75rem',
    input: '0.75rem',
    card: '1rem',
    bubble: '1rem',
    sheet: '1.5rem',
    modal: '1.875rem',
  },
  font: {
    sans: '"Inter", ui-sans-serif, system-ui, -apple-system, sans-serif',
    display: '"Fraunces", Georgia, "Times New Roman", serif',
  },
} as const

/** Tailwind class cheat sheet for migrations */
export const tw = {
  page: 'min-h-screen bg-canvas',
  surface: 'bg-surface',
  border: 'border border-border',
  textPrimary: 'text-ink',
  textSecondary: 'text-muted',
  textSubtle: 'text-subtle',
  btnPrimary:
    'rounded-btn bg-brand hover:bg-brand-hover text-on-brand font-semibold transition-colors disabled:opacity-50',
  btnSecondary:
    'rounded-btn border border-border text-muted font-semibold hover:bg-canvas transition-colors',
  input:
    'w-full px-4 py-3 rounded-input border border-border bg-surface text-ink placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-brand',
  focusRing: 'focus:outline-none focus:ring-2 focus:ring-brand',
} as const
