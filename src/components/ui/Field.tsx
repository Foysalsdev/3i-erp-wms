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
export const Input = (p: InputHTMLAttributes<HTMLInputElement>) =>
  <input {...p} className={cn('fiori-input', p.className)} />
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) =>
  <textarea {...p} className={cn('fiori-input min-h-[80px]', p.className)} />
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) =>
  <select {...p} className={cn('fiori-input', p.className)} />
