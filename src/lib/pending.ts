import { supabase } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Pending Matter Engine (docs/TRACKING-ARCHITECTURE.md §3.3).
// One registry describes what "pending" means per document type; one engine
// evaluates every rule and returns the open matters — each knowing WHAT is
// due, WHO owns it (permission), and HOW LONG it has waited. The dashboard
// strip, My Tasks and reports all read this; a new module only adds a rule.
// ---------------------------------------------------------------------------

export interface PendingMatter {
  rule: string; icon: string; label: string
  docNo: string; matter: string; route: string
  owner: string; slaDays?: number
  ageDays: number; overdue: boolean
}

// Each rule's fetch queries a different table with different columns; the
// row shape genuinely varies per rule, so it stays a plain scalar bag (same
// tradeoff as DataTab's ExportRow) with a cast at each field access below.
export type PendingRow = Record<string, unknown>

export interface PendingRule {
  key: string
  icon: string
  label: string               // short group name shown on chips
  owner: string               // human role that owns the matter (for reports)
  perms: string[]             // any of these permissions owns the matter
  slaDays?: number            // older than this = overdue (red)
  fetch: (clientId: string) => PromiseLike<PendingRow[]>
  docNo: (r: PendingRow) => string
  matter: (r: PendingRow) => string
  route: (r: PendingRow) => string
  ageFrom: (r: PendingRow) => string | null
}

const days = (d: string | null) =>
  !d ? 0 : Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86400000))

const openSo = (clientId: string, statuses: string[]) =>
  supabase.from('sales_orders').select('so_no,order_date,status').eq('client_id', clientId)
    .in('status', statuses).order('order_date').limit(50).then(({ data }) => (data ?? []) as PendingRow[])

export const PENDING_RULES: PendingRule[] = [
  {
    key: 'so-approve', icon: 'how_to_reg', label: 'Orders to approve', owner: 'Warehouse Manager', perms: ['outbound.approve'], slaDays: 1,
    fetch: c => openSo(c, ['pending']),
    docNo: r => r.so_no as string, matter: () => 'Approve the order before the warehouse can pick it',
    route: () => '/outbound/approvals', ageFrom: r => r.order_date as string | null
  },
  {
    key: 'so-scan', icon: 'qr_code_scanner', label: 'Orders to pick', owner: 'Warehouse Picker', perms: ['outbound.edit', 'outbound.create'], slaDays: 1,
    fetch: c => openSo(c, ['approved']),
    docNo: r => r.so_no as string, matter: () => 'Pick & scan the ordered items',
    route: r => `/outbound/sales-order?q=${encodeURIComponent(r.so_no as string)}`, ageFrom: r => r.order_date as string | null
  },
  {
    key: 'so-invoice', icon: 'receipt_long', label: 'Awaiting SAP invoice', owner: 'Billing', perms: ['outbound.edit'], slaDays: 1,
    fetch: c => openSo(c, ['picking', 'packed']),
    docNo: r => r.so_no as string, matter: () => 'Enter SAP invoice & issue the challan',
    route: r => `/outbound/sales-order?q=${encodeURIComponent(r.so_no as string)}`, ageFrom: r => r.order_date as string | null
  },
  {
    key: 'so-dispatch', icon: 'local_shipping', label: 'Ready to dispatch', owner: 'Dispatch Desk', perms: ['outbound.edit'], slaDays: 1,
    fetch: c => openSo(c, ['invoiced']),
    docNo: r => r.so_no as string, matter: () => 'Assign transport / courier & dispatch',
    route: r => `/outbound/sales-order?q=${encodeURIComponent(r.so_no as string)}`, ageFrom: r => r.order_date as string | null
  },
  {
    key: 'grn-miro', icon: 'request_quote', label: 'GRN awaiting MIRO', owner: 'Billing', perms: ['inbound.edit', 'inbound.create'], slaDays: 3,
    fetch: c => supabase.from('goods_receipts').select('grn_no,receipt_date').eq('client_id', c)
      .is('posted_at', null).is('sap_miro_ref', null).neq('status', 'cancelled').order('receipt_date').limit(50)
      .then(({ data }) => (data ?? []) as PendingRow[]),
    docNo: r => r.grn_no as string, matter: () => 'Add the SAP MIRO reference',
    route: () => '/inbound/receive', ageFrom: r => r.receipt_date as string | null
  },
  {
    key: 'grn-post', icon: 'move_to_inbox', label: 'GRN to post', owner: 'Warehouse Manager', perms: ['inbound.post', 'inbound.approve'], slaDays: 1,
    fetch: c => supabase.from('goods_receipts').select('grn_no,receipt_date').eq('client_id', c)
      .eq('status', 'completed').is('posted_at', null).order('receipt_date').limit(50)
      .then(({ data }) => (data ?? []) as PendingRow[]),
    docNo: r => r.grn_no as string, matter: () => 'Post received stock to inventory',
    route: () => '/inbound/receive', ageFrom: r => r.receipt_date as string | null
  },
  {
    key: 'challan-draft', icon: 'receipt', label: 'Challans to issue', owner: 'Warehouse', perms: ['outbound.post', 'outbound.approve'], slaDays: 1,
    fetch: c => supabase.from('delivery_challans').select('challan_no,challan_date').eq('client_id', c)
      .eq('status', 'draft').order('challan_date').limit(50).then(({ data }) => (data ?? []) as PendingRow[]),
    docNo: r => r.challan_no as string, matter: () => 'Confirm dispatch — deduct stock + gate pass',
    route: r => `/outbound/delivery-challan?q=${encodeURIComponent(r.challan_no as string)}`, ageFrom: r => r.challan_date as string | null
  },
  {
    key: 'challan-cn', icon: 'qr_code', label: 'CN missing', owner: 'Dispatch Desk', perms: ['outbound.edit'], slaDays: 2,
    fetch: c => supabase.from('delivery_challans').select('challan_no,challan_date').eq('client_id', c)
      .eq('delivery_method', 'courier').not('posted_at', 'is', null).is('courier_tracking_no', null)
      .neq('status', 'cancelled').order('challan_date').limit(50).then(({ data }) => (data ?? []) as PendingRow[]),
    docNo: r => r.challan_no as string, matter: () => 'Add courier CN / tracking number',
    route: r => `/outbound/delivery-challan?q=${encodeURIComponent(r.challan_no as string)}`, ageFrom: r => r.challan_date as string | null
  },
  {
    key: 'pod-missing', icon: 'task_alt', label: 'POD not received', owner: 'Delivery Follow-up', perms: ['outbound.edit'], slaDays: 5,
    fetch: async c => {
      const [{ data: chs }, { data: pods }] = await Promise.all([
        supabase.from('delivery_challans').select('id,challan_no,challan_date').eq('client_id', c)
          .not('posted_at', 'is', null).neq('status', 'cancelled').order('challan_date', { ascending: false }).limit(100),
        supabase.from('proof_of_delivery').select('challan_id').eq('client_id', c)
      ])
      const has = new Set((pods ?? []).map(p => p.challan_id))
      return ((chs ?? []).filter(x => !has.has(x.id))) as PendingRow[]
    },
    docNo: r => r.challan_no as string, matter: () => 'Collect customer POD for this delivery',
    route: () => '/outbound/pod-upload', ageFrom: r => r.challan_date as string | null
  },
  {
    key: 'pr-open', icon: 'assignment', label: 'Requisition to receive', owner: 'Inbound', perms: ['inbound.create', 'inbound.edit'], slaDays: 7,
    fetch: c => supabase.from('purchase_requisitions').select('pr_no,order_date').eq('client_id', c)
      .in('status', ['pending', 'approved']).order('order_date').limit(50).then(({ data }) => (data ?? []) as PendingRow[]),
    docNo: r => r.pr_no as string, matter: () => 'Goods expected — receive against this requisition',
    route: () => '/inbound/receive', ageFrom: r => r.order_date as string | null
  },
  {
    key: 'count-draft', icon: 'fact_check', label: 'Counts to post', owner: 'Inventory Officer', perms: ['inventory.adjust'], slaDays: 2,
    // stock_counts isn't in the generated schema types yet, so this leg keeps
    // an untyped client call; the row itself is still typed as PendingRow.
    fetch: c => (supabase as any).from('stock_counts').select('doc_no,count_date,count_type').eq('client_id', c)
      .eq('status', 'draft').order('count_date').limit(50).then(({ data }: { data: PendingRow[] | null }) => data ?? []),
    docNo: r => r.doc_no as string, matter: () => 'Complete & post the stock count',
    route: r => r.count_type === 'physical' ? '/inventory/physical-verification' : '/inventory/cycle-count',
    ageFrom: r => r.count_date as string | null
  }
]

async function evaluate(clientId: string, rules: PendingRule[]): Promise<PendingMatter[]> {
  const settled = await Promise.allSettled(rules.map(async rule => {
    const rows = await rule.fetch(clientId)
    return rows.map((r): PendingMatter => {
      const age = days(rule.ageFrom(r))
      return {
        rule: rule.key, icon: rule.icon, label: rule.label,
        docNo: rule.docNo(r), matter: rule.matter(r), route: rule.route(r),
        owner: rule.owner, slaDays: rule.slaDays,
        ageDays: age, overdue: rule.slaDays != null && age > rule.slaDays
      }
    })
  }))
  return settled.flatMap(s => s.status === 'fulfilled' ? s.value : [])
    .sort((a, b) => Number(b.overdue) - Number(a.overdue) || b.ageDays - a.ageDays)
}

// Every rule the current user owns (dashboard / My Tasks).
export function fetchPendingMatters(clientId: string, can: (p: string) => boolean, isAdmin: boolean) {
  return evaluate(clientId, PENDING_RULES.filter(r => isAdmin || r.perms.some(p => can(p))))
}

// Every pending matter regardless of owner — the manager's report view.
export function fetchAllPendingMatters(clientId: string) {
  return evaluate(clientId, PENDING_RULES)
}
