import { clsx, type ClassValue } from 'clsx'

export const cn = (...inputs: ClassValue[]) => clsx(inputs)

export const formatNumber = (n: number | null | undefined, dp = 0) =>
  (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })

export const formatDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

export const formatDateTime = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

export const initials = (name?: string | null) =>
  (name || '?').split(' ').map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()

// Bangladeshi vehicle plate mask, always uppercase: "DM TA 00-0000"
export const formatVehicleNo = (v: string | null | undefined) => {
  const s = (v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)
  let out = s.slice(0, 2)
  if (s.length > 2) out += ' ' + s.slice(2, 4)
  if (s.length > 4) out += ' ' + s.slice(4, 6)
  if (s.length > 6) out += '-' + s.slice(6, 10)
  return out
}
