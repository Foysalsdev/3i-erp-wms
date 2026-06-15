import { cn } from '@/lib/utils'
// Google Material Symbols (loaded in index.html)
export function Icon({ name, className, filled }: { name: string; className?: string; filled?: boolean }) {
  return (
    <span
      className={cn('material-symbols-rounded', className)}
      style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}
    >{name}</span>
  )
}
