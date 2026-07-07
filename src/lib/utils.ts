import { clsx, type ClassValue } from 'clsx'

export const cn = (...inputs: ClassValue[]) => clsx(inputs)

// Triggers a browser download for a generated Blob (PDF/CSV/XLSX exports).
// The anchor MUST be attached to the document for the click to reliably
// start a download on mobile browsers (Android Chrome/WebView silently do
// nothing for a detached anchor) — and the object URL is revoked on a delay
// so the download has actually started before it's freed.
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

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

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function threeDigitsToWords(n: number): string {
  const parts: string[] = []
  if (n >= 100) { parts.push(ONES[Math.floor(n / 100)], 'Hundred'); n %= 100 }
  if (n >= 20) { parts.push(TENS[Math.floor(n / 10)]); n %= 10 }
  if (n > 0) parts.push(ONES[n])
  return parts.join(' ')
}

// "2550" -> "Two Thousand Five Hundred Fifty Taka Only" — matches the
// wording used on 3i Logistics' printed bill/voucher forms.
export function amountInWords(amount: number): string {
  const whole = Math.round(Math.abs(amount) || 0)
  if (whole === 0) return 'Zero Taka Only'
  const groups: [number, string][] = [[1_000_000_000, 'Billion'], [1_000_000, 'Million'], [1_000, 'Thousand'], [1, '']]
  let n = whole
  const words: string[] = []
  for (const [size, label] of groups) {
    const chunk = Math.floor(n / size)
    if (chunk > 0) { words.push(threeDigitsToWords(chunk)); if (label) words.push(label); n %= size }
  }
  return `${words.join(' ')} Taka Only`
}
