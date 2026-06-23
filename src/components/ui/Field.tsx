import { forwardRef } from 'react'
import { cn } from '@/lib/utils'
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react'

export function Field({ label, error, required, children, className }:
  { label?: string; error?: string; required?: boolean; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
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
