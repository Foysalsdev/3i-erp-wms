import { Icon } from '@/components/ui/Icon'
export function SearchBar({ value, onChange, placeholder = 'Search…' }:
  { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-ink-faint" />
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="fiori-input pl-9" />
    </div>
  )
}
