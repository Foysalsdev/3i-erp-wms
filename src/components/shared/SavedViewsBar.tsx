import { useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { loadViews, saveView, removeView, type SavedView } from '@/lib/savedViews'

// A row of named filter shortcuts ("My open orders", "Overdue only"…) above
// a list: click one to re-apply that exact combination of filters, or save
// the current filters under a new name. Persisted per browser, scoped by key
// so each list keeps its own set.
export function SavedViewsBar<S extends Record<string, unknown>>({ scope, current, onApply }: {
  scope: string
  current: S
  onApply: (state: S) => void
}) {
  const [views, setViews] = useState<SavedView<S>[]>(() => loadViews<S>(scope))
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')

  const confirm = () => {
    const trimmed = name.trim()
    if (trimmed) setViews(saveView(scope, trimmed, current))
    setName(''); setAdding(false)
  }
  const cancel = () => { setName(''); setAdding(false) }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {views.map(v => (
        <span key={v.id} className="inline-flex items-center gap-1 rounded-full border border-surface-line bg-surface py-1 pl-3 pr-1 text-xs font-medium text-ink-soft">
          <button type="button" onClick={() => onApply(v.state)} className="hover:text-brand-700">{v.name}</button>
          <button type="button" onClick={() => setViews(removeView(scope, v.id))} aria-label={`Remove ${v.name}`}
            className="flex h-4 w-4 items-center justify-center rounded-full text-ink-faint hover:bg-bad/10 hover:text-bad">
            <Icon name="close" className="text-[12px]" />
          </button>
        </span>
      ))}
      {adding ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-brand-300 bg-surface py-1 pl-2.5 pr-1 text-xs">
          <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="View name…"
            onKeyDown={e => { if (e.key === 'Enter') confirm(); if (e.key === 'Escape') cancel() }}
            className="w-28 bg-transparent text-ink outline-none placeholder:text-ink-faint" />
          <button type="button" onClick={confirm} className="flex h-5 w-5 items-center justify-center rounded-full text-ok hover:bg-ok/10">
            <Icon name="check" className="text-[14px]" />
          </button>
          <button type="button" onClick={cancel} className="flex h-5 w-5 items-center justify-center rounded-full text-ink-faint hover:bg-surface-sunken">
            <Icon name="close" className="text-[14px]" />
          </button>
        </span>
      ) : (
        <button type="button" onClick={() => setAdding(true)} title="Save the current filters as a view"
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-surface-line px-2.5 py-1 text-xs font-medium text-ink-faint hover:border-brand-300 hover:text-brand-700">
          <Icon name="add" className="text-[14px]" /> Save view
        </button>
      )}
    </div>
  )
}
