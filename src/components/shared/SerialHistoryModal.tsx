import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/utils'
import type { SerialHistoryItem } from '@/lib/serials'

// Small non-blocking notice shown after saving serials that already carry
// transaction history: where each one was last (document · party · date).
// The serials were accepted — this is information, not an error.
export function SerialHistoryModal({ items, onClose }: { items: SerialHistoryItem[]; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title="Serial seen before" size="md">
      <div className="space-y-4">
        <p className="text-sm text-ink-soft">
          The following serial(s) already have transaction history. They were accepted and
          re-assigned to this document — previous whereabouts shown for reference.
        </p>
        <div className="overflow-hidden rounded-xl border border-surface-line">
          {items.map((h, i) => (
            <div key={h.serial_no + i} className={'px-3.5 py-2.5 text-sm ' + (i ? 'border-t border-surface-line' : '')}>
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate font-mono font-medium text-ink">{h.serial_no}</span>
                <Badge tone="neutral">{h.status || '—'}</Badge>
              </div>
              <p className="mt-0.5 text-xs text-ink-soft">
                Last on <b className="text-ink">{h.reference_no ?? '—'}</b>
                {h.party ? <> · {h.party}</> : null}
                {h.date ? <> · {formatDate(h.date)}</> : null}
              </p>
            </div>
          ))}
        </div>
        <div className="flex justify-end"><Button onClick={onClose}>OK</Button></div>
      </div>
    </Modal>
  )
}
