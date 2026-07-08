import { cn } from '@/lib/utils'

// A font-independent spinner: a CSS ring (border + spin), NOT a Material Symbols
// glyph. Loading states render instantly on a cold load — before the icon font
// has downloaded — instead of flashing the raw ligature text "progress_activity"
// that a `<Icon name="progress_activity">` shows until the font is ready.
// Colour follows `currentColor`; size via the `className` (e.g. `h-7 w-7`).
export function LoadingRing({ className }: { className?: string }) {
  return (
    <span role="status" aria-label="Loading"
      className={cn('inline-block aspect-square shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent', className)} />
  )
}
