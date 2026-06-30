import { useParams, useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/shared/PageHeader'
import { Tabs } from '@/components/ui/Tabs'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/States'
import { MODULES } from '@/lib/constants'
import { useAuth } from '@/store/auth'
import { CompanyTab } from '../components/CompanyTab'
import { NotificationsTab } from '../components/NotificationsTab'
import { WorkflowTab } from '../components/WorkflowTab'
import { BarcodeTab } from '../components/BarcodeTab'
import { TemplatesTab } from '../components/TemplatesTab'
import { AuditLogsTab } from '../components/AuditLogsTab'

export default function SettingsPage() {
  const { tab } = useParams()
  const nav = useNavigate()
  const { can, isPlatformAdmin } = useAuth()
  const tabs = MODULES.find(m => m.key === 'settings')!.tabs!
  const active = tab && tabs.some(t => t.key === tab) ? tab : 'company'
  const label = tabs.find(t => t.key === active)?.label ?? 'Settings'

  const canEdit = isPlatformAdmin || can('settings.create') || can('settings.edit')
  const canDelete = isPlatformAdmin || can('settings.delete')

  return (
    <div className="space-y-4">
      <PageHeader icon="settings" title="Settings" subtitle="Company profile, workflow SLAs, notifications, barcodes, templates & audit trail" />
      <Tabs tabs={tabs} active={active} onChange={k => nav(`/settings/${k}`)} />
      {active === 'company' && <CompanyTab canEdit={canEdit} />}
      {active === 'workflow' && <WorkflowTab canEdit={canEdit} />}
      {active === 'notifications' && <NotificationsTab canEdit={canEdit} />}
      {active === 'barcode' && <BarcodeTab canEdit={canEdit} />}
      {active === 'print-template' && <TemplatesTab channel="print" canEdit={canEdit} canDelete={canDelete} />}
      {active === 'email-templates' && <TemplatesTab channel="email" canEdit={canEdit} canDelete={canDelete} />}
      {active === 'audit' && <AuditLogsTab />}
      {!['company', 'workflow', 'notifications', 'barcode', 'print-template', 'email-templates', 'audit'].includes(active) && (
        <Card className="p-2"><EmptyState icon="construction" title={label} hint="On the roadmap." /></Card>
      )}
    </div>
  )
}
