// WES principle #6 "Workflow Driven": the outbound order follows a predefined
// business workflow. Every order can therefore report its current / previous /
// next stage, the pending action, who is responsible and when it's expected.

export interface WfStage {
  key: string
  label: string
  icon: string
  statuses: string[]   // sales-order statuses that map to this stage
  action: string       // the pending action while the order sits at this stage
  role: string         // who is responsible for that action
  slaDays: number      // expected days to clear this stage
}

export const OUTBOUND_STAGES: WfStage[] = [
  { key: 'order', label: 'Order', icon: 'shopping_cart', statuses: ['draft', 'pending', 'approved'],
    action: 'Pick & scan the ordered items', role: 'Warehouse Picker', slaDays: 1 },
  { key: 'picked', label: 'Picked', icon: 'shopping_cart_checkout', statuses: ['picking', 'packed'],
    action: 'Enter SAP invoice & issue the delivery challan', role: 'Warehouse / Billing', slaDays: 1 },
  { key: 'invoiced', label: 'Invoiced', icon: 'receipt', statuses: ['invoiced'],
    action: 'Assign logistics & dispatch the shipment', role: 'Dispatch Desk', slaDays: 1 },
  { key: 'dispatched', label: 'Dispatched', icon: 'local_shipping', statuses: ['dispatched'],
    action: 'Collect customer POD & close the order', role: 'Driver / Delivery', slaDays: 2 },
  { key: 'delivered', label: 'Delivered', icon: 'task_alt', statuses: ['delivered', 'closed'],
    action: 'Order complete', role: '—', slaDays: 0 }
]

// Per-client SLA overrides primed from Settings → Workflow (see lib/settings).
// When unset the hard-coded stage defaults apply.
let slaOverrides: Record<string, number> | null = null
export function setWorkflowSla(overrides: Record<string, number> | null) { slaOverrides = overrides }
const stageSla = (st: WfStage) => slaOverrides?.[st.key] ?? st.slaDays
const totalSla = () => OUTBOUND_STAGES.reduce((s, st) => s + stageSla(st), 0)

export const isCancelled = (status: string) => status === 'cancelled'
export const isDone = (status: string) => ['delivered', 'closed'].includes(status)

// Index of the stage a status belongs to (-1 when cancelled / unknown).
export function stageIndexOf(status: string): number {
  return OUTBOUND_STAGES.findIndex(st => st.statuses.includes(status))
}

export interface WfState {
  cancelled: boolean
  index: number
  current?: WfStage
  previous?: WfStage
  next?: WfStage
  action: string
  role: string
  expected: Date | null
  overdue: boolean
}

const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }

// Resolve the full workflow state for an order (status + dates).
export function workflowState(order: { status: string; order_date?: string | null; required_date?: string | null }): WfState {
  const status = order.status
  if (isCancelled(status)) {
    return { cancelled: true, index: -1, action: 'Order cancelled', role: '—', expected: null, overdue: false }
  }
  const index = Math.max(0, stageIndexOf(status))
  const current = OUTBOUND_STAGES[index]
  const previous = index > 0 ? OUTBOUND_STAGES[index - 1] : undefined
  const next = index < OUTBOUND_STAGES.length - 1 ? OUTBOUND_STAGES[index + 1] : undefined
  const done = isDone(status)

  // Expected completion of the whole order: the customer required date if set,
  // otherwise the order date + total workflow SLA.
  const base = order.order_date ? new Date(order.order_date) : null
  const expected = order.required_date ? new Date(order.required_date) : (base ? addDays(base, totalSla()) : null)
  const overdue = !done && !!expected && expected.getTime() < Date.now()

  return {
    cancelled: false, index, current, previous, next,
    action: done ? 'Order complete' : (current?.action ?? '—'),
    role: done ? '—' : (current?.role ?? '—'),
    expected, overdue
  }
}
