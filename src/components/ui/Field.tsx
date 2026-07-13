import { forwardRef } from 'react'
import { cn } from '@/lib/utils'
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react'

// Width standard for fields inside a 12-column form grid. `size` maps to a
// column span so narrow data (date, qty, code) takes less room than wide data
// (name, remarks) without leaving dead whitespace. Undefined = no span class,
// so every field outside a 12-col grid (finance, modals, filters) is untouched.
export type FieldSize = 'sm' | 'md' | 'lg' | 'xl' | 'full'
export const FIELD_SPAN: Record<FieldSize, string> = {
  sm:   'sm:col-span-3',   // date, time, quantity, short code
  md:   'sm:col-span-4',   // phone, invoice/reference no
  lg:   'sm:col-span-6',   // default half-width
  xl:   'sm:col-span-8',   // long names
  full: 'sm:col-span-12'   // remarks, address, images
}

export function Field({ label, error, required, children, className, size }:
  { label?: string; error?: string; required?: boolean; children: ReactNode; className?: string; size?: FieldSize }) {
  return (
    <div className={cn(size && FIELD_SPAN[size], className)}>
      {label && <label className="fiori-label">{label}{required && <span className="text-horizon-negative"> *</span>}</label>}
      {children}
      {error && <p className="mt-1 text-xs text-horizon-negative">{error}</p>}
    </div>
  )
}
// forwardRef so react-hook-form's register() can attach its ref and write
// default/existing values into the DOM (e.g. when editing a record).
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>((p, ref) =>
  <input ref={ref} {...p} className={cn('fiori-input', p.className)} />)
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>((p, ref) =>
  <textarea ref={ref} {...p} className={cn('fiori-input min-h-[80px]', p.className)} />)
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>((p, ref) =>
  <select ref={ref} {...p} className={cn('fiori-input', p.className)} />)
