import { Combobox as Base } from '@/components/ui/Combobox'

export interface ComboItem { id: string; label: string; sublabel?: string }

// Thin adapter so the older `items`/`sublabel` call sites keep working while
// every combobox in the app shares one implementation (@/components/ui/Combobox).
export function Combobox({ items, value, onChange, placeholder = 'Search…' }:
  { items: ComboItem[]; value: string; onChange: (id: string) => void; placeholder?: string }) {
  return (
    <Base
      options={items.map(i => ({ id: i.id, label: i.label, sub: i.sublabel }))}
      value={value} onChange={onChange} placeholder={placeholder} />
  )
}
