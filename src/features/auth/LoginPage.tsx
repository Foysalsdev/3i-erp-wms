import { useState } from 'react'
import { useAuth } from '@/store/auth'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

const FEATURES = [
  { icon: 'inventory_2', text: 'SAP-compatible inventory & SKU tracking' },
  { icon: 'local_shipping', text: 'End-to-end 3PL warehouse operations' },
  { icon: 'verified_user', text: 'Client-isolated, audited & secure' }
]

export default function LoginPage() {
  const signIn = useAuth(s => s.signIn)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError(undefined)
    const { error } = await signIn(email, password)
    if (error) setError(error)
    setLoading(false)
  }

  return (
    <div className="relative grid min-h-full bg-surface-sunken lg:grid-cols-[1.05fr_1fr]">
      <ThemeToggle className="absolute right-4 top-4 z-10" />
      {/* Brand panel — soft, neutral, airy */}
      <div className="relative hidden flex-col justify-between border-r border-surface-line bg-surface p-14 lg:flex">
        <span className="absolute inset-x-0 top-0 h-1 bg-brand-500" />
        <div className="flex items-center gap-2.5">
          <img src="/favicon.svg" alt="Whirlpool" className="h-10 w-10 shrink-0 rounded-xl ring-1 ring-surface-line" />
          <div><p className="font-display text-base font-bold text-ink">Whirlpool WH</p><p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-ink-faint">ERP · WMS Platform</p></div>
        </div>
        <div>
          <h1 className="font-display text-3xl font-extrabold leading-tight text-ink">Whirlpool WH<br/>ERP &amp; WMS.</h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-ink-soft">Warehouse, inventory, logistics, finance and HR for Whirlpool — one SAP-compatible platform.</p>
          <div className="mt-10 space-y-4">
            {FEATURES.map(f => (
              <div key={f.text} className="flex items-center gap-3 text-sm text-ink">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-sunken text-ink-soft ring-1 ring-surface-line"><Icon name={f.icon} className="text-[19px]" /></span>
                {f.text}
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-ink-faint">© 2026 Whirlpool · Powered by Whirlpool WH</p>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm animate-fade-up">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <img src="/favicon.svg" alt="Whirlpool" className="h-9 w-9 shrink-0 rounded-xl ring-1 ring-surface-line" />
            <p className="font-display text-base font-bold text-ink">Whirlpool WH</p>
          </div>
          <h2 className="font-display text-2xl font-bold text-ink">Sign in</h2>
          <p className="mt-1 text-sm text-ink-soft">Welcome back to your workspace.</p>
          <form onSubmit={submit} className="mt-8 space-y-4">
            <Field label="Email" required>
              <Input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@whirlpool.com" autoComplete="email" />
            </Field>
            <Field label="Password" required>
              <Input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
            </Field>
            {error && <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700 ring-1 ring-red-100 dark:bg-red-500/15 dark:text-red-400 dark:ring-red-500/30"><Icon name="error" className="text-[16px]" />{error}</div>}
            <Button type="submit" loading={loading} className="w-full !py-2.5">Sign in</Button>
          </form>
        </div>
      </div>
    </div>
  )
}
