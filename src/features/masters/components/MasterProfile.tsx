import { useState } from 'react'
import type { MasterDef, MasterRecord } from '../registry'

const str = (v: unknown) => (v == null ? '' : String(v))
import { useRelationLabels, fieldDisplay } from '../masterUtils'
import { Icon } from '@/components/ui/Icon'
import { Button } from '@/components/ui/Button'
import { Tabs } from '@/components/ui/Tabs'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { initials } from '@/lib/utils'
import { NotesPanel, AttachmentsPanel, TimelinePanel } from './Panels'
import { CourierRatesPanel } from './CourierRatesPanel'

export function MasterProfile({ def, record, onEdit, onBack, canEdit, initialTab = 'details' }:
  { def: MasterDef; record: MasterRecord; onEdit: () => void; onBack: () => void; canEdit: boolean; initialTab?: string }) {
  const tabs = [{ key: 'details', label: 'Details' },
    // Couriers carry a per-category price list (they bill per piece by size class).
    ...(def.key === 'couriers' ? [{ key: 'rates', label: 'Rate Card' }] : []),
    { key: 'attachments', label: 'Attachments' },
    { key: 'notes', label: 'Notes' }, { key: 'activity', label: 'Activity' }]
  const [tab, setTab] = useState(initialTab)
  const rel = useRelationLabels(def)
  const img = def.imageField ? str(record[def.imageField]) : ''

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-ink-soft hover:text-brand-700"><Icon name="arrow_back" className="text-[18px]" /> Back to list</button>
      <Card className="p-5">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl bg-surface-sunken text-2xl font-bold text-ink-soft ring-1 ring-surface-line">
            {img ? <img src={img} alt="" className="h-full w-full object-cover" /> : initials(str(record[def.nameField]))}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-lg font-bold text-ink">{str(record[def.nameField])}</h2>
              <StatusBadge status={record.status} />
            </div>
            <p className="text-sm text-ink-soft">{def.codeField}: <b className="text-ink">{str(record[def.codeField])}</b>{def.subField && record[def.subField] ? ` · ${str(record[def.subField])}` : ''}</p>
          </div>
          {canEdit && <Button variant="secondary" icon="edit" onClick={onEdit}>Edit</Button>}
        </div>
      </Card>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />
      <Card className="p-5">
        {tab === 'details' && (
          <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            {def.fields.filter(f => f.type !== 'image').map(f => (
              <div key={f.name} className="border-b border-surface-line/70 pb-2">
                <dt className="text-xs text-ink-soft">{f.label}</dt>
                <dd className="text-sm font-medium text-ink">{fieldDisplay(def, record, f.name, rel)}</dd>
              </div>
            ))}
          </dl>
        )}
        {tab === 'rates' && def.key === 'couriers' && <CourierRatesPanel courierId={record.id} />}
        {tab === 'attachments' && <AttachmentsPanel entityType={def.table} entityId={record.id} />}
        {tab === 'notes' && <NotesPanel entityType={def.table} entityId={record.id} />}
        {tab === 'activity' && <TimelinePanel table={def.table} recordId={record.id} />}
      </Card>
    </div>
  )
}
