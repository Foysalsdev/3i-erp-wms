import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

type Tab = { key: string; label: string; group?: string }

export function Tabs({ tabs, active, onChange }: { tabs: Tab[]; active: string; onChange: (k: string) => void }) {
  const hasGroups = tabs.some(t => t.group)
  if (!hasGroups) return <TabRow tabs={tabs} active={active} onChange={onChange} />
  return <GroupedTabs tabs={tabs} active={active} onChange={onChange} />
}

// Pages with many tabs (15+) get a group pill row on top so the flat list
// below never has to be scanned/scrolled in full — picking a group narrows
// it to a handful of relevant tabs.
function GroupedTabs({ tabs, active, onChange }: { tabs: Tab[]; active: string; onChange: (k: string) => void }) {
  const groups = Array.from(new Set(tabs.map(t => t.group ?? 'Other')))
  const activeGroup = tabs.find(t => t.key === active)?.group ?? groups[0]
  const [openGroup, setOpenGroup] = useState(activeGroup)
  useEffect(() => { setOpenGroup(activeGroup) }, [activeGroup])

  const groupTabs = tabs.filter(t => (t.group ?? 'Other') === openGroup)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {groups.map(g => (
          <button key={g} type="button" onClick={() => setOpenGroup(g)}
            className={cn('rounded-full px-3 py-1 text-xs font-semibold transition-colors',
              openGroup === g ? 'bg-brand-500/15 text-brand-700 dark:text-brand-400' : 'bg-surface-sunken text-ink-faint hover:text-ink-soft')}>
            {g}
          </button>
        ))}
      </div>
      <TabRow tabs={groupTabs} active={active} onChange={onChange} />
    </div>
  )
}

function TabRow({ tabs, active, onChange }: { tabs: Tab[]; active: string; onChange: (k: string) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-surface-line">
      {tabs.map(t => (
        <button key={t.key} onClick={() => onChange(t.key)}
          className={cn('relative whitespace-nowrap px-3.5 py-2.5 text-sm font-medium transition-colors',
            active === t.key ? 'text-ink' : 'text-ink-faint hover:text-ink-soft')}>
          {t.label}
          {active === t.key && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-500" />}
        </button>
      ))}
    </div>
  )
}
