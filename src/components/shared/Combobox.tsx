import { Combobox as SelectCombobox, type ComboOption } from '@/components/ui/Combobox'

// Kept for existing call sites and to match CreatableCombobox's convention.
export interface ComboItem { id: string; label: string; sublabel?: string }

// Thin compatibility wrapper. The single rendering + keyboard implementation
// lives in ui/Combobox; this maps the {items, sublabel} shape (shared with
// CreatableCombobox) onto it so every lookup in the app — masters, operations,
// inbound, outbound, inventory — behaves identically. No duplicate logic.
export function Combobox({ items, value, onChange, placeholder, disabled, allowClear, className, mruKey }:
  { items: ComboItem[]; value?: string; onChange: (id: string) => void
    placeholder?: string; disabled?: boolean; allowClear?: boolean; className?: string; mruKey?: string }) {
  const options: ComboOption[] = items.map(i => ({ id: i.id, label: i.label, sub: i.sublabel }))
  return <SelectCombobox options={options} value={value} onChange={onChange}
    placeholder={placeholder} disabled={disabled} allowClear={allowClear} className={className} mruKey={mruKey} />
}
