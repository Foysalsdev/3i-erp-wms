import { useParams, useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/shared/PageHeader'
import { Tabs } from '@/components/ui/Tabs'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/States'
import { MODULES } from '@/lib/constants'
import { DOC_CONFIGS } from '@/features/inbound/docConfigs'
import { DocModule } from '@/features/inbound/components/DocModule'

// Document-style reverse flows backed by docConfigs + the app.post_* RPCs
// (sales return / exchange / replacement all post stock back into inventory).
const DOC_KEYS = ['sales-return', 'exchange', 'replacement']

export default function ReversePage() {
  const { tab } = useParams()
  const nav = useNavigate()
  const tabs = MODULES.find(m => m.key === 'reverse')!.tabs!
  const active = tab && tabs.some(t => t.key === tab) ? tab : 'sales-return'
  const config = DOC_CONFIGS[active]
  const label = tabs.find(t => t.key === active)?.label ?? 'Reverse Logistics'

  return (
    <div className="space-y-4">
      <PageHeader icon="undo" title="Reverse Logistics" subtitle="Sales return, exchange, replacement, refurbishment & inspection" />
      <Tabs tabs={tabs} active={active} onChange={k => nav(`/reverse/${k}`)} />
      {DOC_KEYS.includes(active) && config ? (
        <DocModule key={active} config={config} permModule="reverse" />
      ) : (
        <Card className="p-2">
          <EmptyState icon="construction" title={label}
            hint="Refurbishment and Return Inspection workflows are being wired next — they re-classify returned stock between Good / Damaged / Quarantine conditions." />
        </Card>
      )}
    </div>
  )
}
