import { useParams, useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/shared/PageHeader'
import { Tabs } from '@/components/ui/Tabs'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/States'
import { MODULES } from '@/lib/constants'
import { DOC_CONFIGS } from '@/features/inbound/docConfigs'
import { DocModule } from '@/features/inbound/components/DocModule'
import { ConditionChangeModule, type CCConfig } from '../components/ConditionChangeModule'

// Document-style reverse flows backed by docConfigs + the app.post_* RPCs
// (sales return / exchange / replacement post stock back into inventory).
const DOC_KEYS = ['sales-return', 'exchange', 'replacement']

// Condition-reclassification flows: re-grade returned/damaged stock between
// Good / Damaged / Quarantine / Scrap, posting paired stock movements.
const CC_CONFIGS: Record<string, CCConfig> = {
  'return-inspection': {
    key: 'return-inspection', table: 'return_inspections', itemTable: 'return_inspection_items', itemFK: 'ri_id',
    docType: 'RINS', postRpc: 'post_return_inspection', postParam: 'p_ri',
    title: 'Return Inspection', singular: 'Inspection', icon: 'fact_check', dateField: 'inspection_date',
    fromDefault: 'quarantine', toDefault: 'good', allowScrap: true, linkSalesReturn: true
  },
  refurbishment: {
    key: 'refurbishment', table: 'refurbishments', itemTable: 'refurbishment_items', itemFK: 'refurb_id',
    docType: 'RFB', postRpc: 'post_refurbishment', postParam: 'p_rf',
    title: 'Refurbishment', singular: 'Refurbishment', icon: 'build', dateField: 'refurb_date',
    fromDefault: 'damaged', toDefault: 'good', showCost: true
  }
}

export default function ReversePage() {
  const { tab } = useParams()
  const nav = useNavigate()
  const tabs = MODULES.find(m => m.key === 'reverse')!.tabs!
  const active = tab && tabs.some(t => t.key === tab) ? tab : 'sales-return'
  const docConfig = DOC_CONFIGS[active]
  const ccConfig = CC_CONFIGS[active]
  const label = tabs.find(t => t.key === active)?.label ?? 'Reverse Logistics'

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <PageHeader icon="undo" title="Reverse Logistics" subtitle="Sales return, exchange, replacement, refurbishment & inspection" />
      <Tabs tabs={tabs} active={active} onChange={k => nav(`/reverse/${k}`)} />
      {DOC_KEYS.includes(active) && docConfig ? (
        <DocModule key={active} config={docConfig} permModule="reverse" />
      ) : ccConfig ? (
        <ConditionChangeModule key={active} config={ccConfig} />
      ) : (
        <Card className="p-2"><EmptyState icon="construction" title={label} hint="On the roadmap." /></Card>
      )}
    </div>
  )
}
