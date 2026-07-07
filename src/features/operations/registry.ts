import type { Column } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { createElement } from 'react'

// ---------------------------------------------------------------------------
// Operational document modules (GRN, Putaway, Picking, Dispatch, Transport,
// Billing). Config-driven like the Masters registry: each entry describes a
// header-level register with an auto-generated document number, a status
// workflow and a relation-aware create/edit form.
// ---------------------------------------------------------------------------

export type OpFieldType = 'text' | 'number' | 'select' | 'textarea' | 'date' | 'relation' | 'image'

export interface OpRelation { table: string; code: string; name?: string }

// Relations the operational forms can link to (existing master/op tables).
export const OP_RELATIONS: Record<string, OpRelation> = {
  suppliers:         { table: 'suppliers', code: 'supplier_code', name: 'name' },
  customers:         { table: 'customers', code: 'customer_code', name: 'name' },
  warehouses:        { table: 'warehouses', code: 'code', name: 'name' },
  locations:         { table: 'locations', code: 'location_code' },
  vehicles:          { table: 'vehicles', code: 'vehicle_number', name: 'vehicle_type' },
  transport_vendors: { table: 'transport_vendors', code: 'vendor_code', name: 'name' },
  goods_receipts:    { table: 'goods_receipts', code: 'grn_no' },
  pick_lists:        { table: 'pick_lists', code: 'pick_no' },
  dispatches:        { table: 'dispatches', code: 'dispatch_no' },
  delivery_challans: { table: 'delivery_challans', code: 'challan_no' },
  sales_orders:      { table: 'sales_orders', code: 'so_no' },
  drivers:           { table: 'drivers', code: 'driver_code', name: 'name' },
  couriers:          { table: 'couriers', code: 'courier_code', name: 'name' },
  trips:             { table: 'trips', code: 'trip_no' }
}

export interface OpFieldDef {
  name: string
  label: string
  type: OpFieldType
  required?: boolean
  options?: string[]
  relation?: keyof typeof OP_RELATIONS
  placeholder?: string
  span2?: boolean
}

export interface StatusDef { value: string; label: string; tone: 'positive' | 'negative' | 'neutral' | 'info' | 'critical' }

export interface OpDef {
  key: string            // route tab key
  module: string         // sidebar module key (inbound/outbound/transport/finance)
  table: string
  docType: string        // doc_type passed to app.next_document_number
  numberField: string    // column holding the generated document number
  title: string
  singular: string
  icon: string
  permission: string     // permission prefix: inbound/outbound/transport/finance
  statuses: StatusDef[]
  openStatuses: string[] // statuses counted as pending/open on the dashboard
  fields: OpFieldDef[]
  listColumns: Column<any>[]
  searchFields: string[]
  // When set, the list shows a Print action that renders the header via the
  // matching PDF layout. 'gatepass' uses the security gate-pass template.
  pdf?: 'gatepass' | 'document'
}

const statusTone = (statuses: StatusDef[]) => (row: any) => {
  const s = statuses.find(x => x.value === row.status)
  return createElement(Badge, { tone: s?.tone ?? 'neutral' }, s?.label ?? row.status)
}

const S = {
  draft:       { value: 'draft', label: 'Draft', tone: 'neutral' as const },
  pending:     { value: 'pending', label: 'Pending', tone: 'critical' as const },
  inProgress:  { value: 'in_progress', label: 'In Progress', tone: 'info' as const },
  completed:   { value: 'completed', label: 'Completed', tone: 'positive' as const },
  cancelled:   { value: 'cancelled', label: 'Cancelled', tone: 'negative' as const },
  picking:     { value: 'picking', label: 'Picking', tone: 'info' as const },
  picked:      { value: 'picked', label: 'Picked', tone: 'info' as const },
  loaded:      { value: 'loaded', label: 'Loaded', tone: 'info' as const },
  dispatched:  { value: 'dispatched', label: 'Dispatched', tone: 'info' as const },
  delivered:   { value: 'delivered', label: 'Delivered', tone: 'positive' as const },
  open:        { value: 'open', label: 'Open', tone: 'critical' as const },
  allocated:   { value: 'allocated', label: 'Allocated', tone: 'info' as const },
  booked:      { value: 'booked', label: 'Booked', tone: 'info' as const },
  assigned:    { value: 'assigned', label: 'Assigned', tone: 'info' as const },
  inTransit:   { value: 'in_transit', label: 'In Transit', tone: 'info' as const },
  closed:      { value: 'closed', label: 'Closed', tone: 'positive' as const },
  billed:      { value: 'billed', label: 'Billed', tone: 'info' as const },
  paid:        { value: 'paid', label: 'Paid', tone: 'positive' as const },
  approved:    { value: 'approved', label: 'Approved', tone: 'info' as const },
  verified:    { value: 'verified', label: 'Verified', tone: 'info' as const },
  disputed:    { value: 'disputed', label: 'Disputed', tone: 'negative' as const },
  packed:      { value: 'packed', label: 'Packed', tone: 'positive' as const },
  issued:      { value: 'issued', label: 'Issued', tone: 'info' as const },
  exited:      { value: 'exited', label: 'Exited', tone: 'positive' as const },
  received:    { value: 'received', label: 'Received', tone: 'positive' as const }
}

export const OPERATIONS: Record<string, OpDef> = {
  grn: {
    key: 'grn', module: 'inbound', table: 'goods_receipts', docType: 'GRN', numberField: 'grn_no',
    title: 'Goods Receipt Note', singular: 'GRN', icon: 'inventory', permission: 'inbound',
    statuses: [S.draft, S.pending, S.completed, S.cancelled], openStatuses: ['draft', 'pending', 'completed'],
    searchFields: ['grn_no', 'reference_no'],
    fields: [
      { name: 'supplier_id', label: 'Supplier', type: 'relation', relation: 'suppliers' },
      { name: 'warehouse_id', label: 'Warehouse', type: 'relation', relation: 'warehouses' },
      { name: 'reference_no', label: 'PO / Invoice Reference', type: 'text' },
      { name: 'receipt_date', label: 'Receipt Date', type: 'date', required: true },
      { name: 'total_items', label: 'Total Items', type: 'number' },
      { name: 'total_qty', label: 'Total Quantity', type: 'number' },
      { name: 'status', label: 'Status', type: 'select', options: ['draft', 'pending', 'completed', 'cancelled'], required: true },
      { name: 'remarks', label: 'Remarks', type: 'textarea', span2: true }
    ],
    listColumns: []
  },
  putaway: {
    key: 'putaway', module: 'inbound', table: 'putaway_tasks', docType: 'PUT', numberField: 'task_no',
    title: 'Putaway Task', singular: 'Putaway', icon: 'move_to_inbox', permission: 'inbound',
    statuses: [S.pending, S.inProgress, S.completed, S.cancelled], openStatuses: ['pending', 'in_progress'],
    searchFields: ['task_no', 'assigned_to'],
    fields: [
      { name: 'grn_id', label: 'Source GRN', type: 'relation', relation: 'goods_receipts' },
      { name: 'warehouse_id', label: 'Warehouse', type: 'relation', relation: 'warehouses' },
      { name: 'location_id', label: 'Target Location', type: 'relation', relation: 'locations' },
      { name: 'total_qty', label: 'Total Quantity', type: 'number' },
      { name: 'assigned_to', label: 'Assigned To', type: 'text' },
      { name: 'status', label: 'Status', type: 'select', options: ['pending', 'in_progress', 'completed', 'cancelled'], required: true },
      { name: 'remarks', label: 'Remarks', type: 'textarea', span2: true }
    ],
    listColumns: []
  },
  'purchase-return': {
    key: 'purchase-return', module: 'inbound', table: 'purchase_returns', docType: 'PRET', numberField: 'doc_no',
    title: 'Purchase Return', singular: 'Purchase Return', icon: 'assignment_return', permission: 'inbound',
    statuses: [S.draft, S.pending, S.approved, S.completed, S.cancelled], openStatuses: ['draft', 'pending', 'approved'],
    searchFields: ['doc_no', 'reason'],
    fields: [
      { name: 'supplier_id', label: 'Supplier', type: 'relation', relation: 'suppliers' },
      { name: 'warehouse_id', label: 'Warehouse', type: 'relation', relation: 'warehouses' },
      { name: 'grn_id', label: 'Source GRN', type: 'relation', relation: 'goods_receipts' },
      { name: 'return_date', label: 'Return Date', type: 'date', required: true },
      { name: 'total_qty', label: 'Total Quantity', type: 'number' },
      { name: 'reason', label: 'Reason', type: 'text', span2: true },
      { name: 'status', label: 'Status', type: 'select', options: ['draft', 'pending', 'approved', 'completed', 'cancelled'], required: true },
      { name: 'remarks', label: 'Remarks', type: 'textarea', span2: true }
    ],
    listColumns: []
  },
  'supplier-invoice': {
    key: 'supplier-invoice', module: 'inbound', table: 'supplier_invoices', docType: 'SINV', numberField: 'doc_no',
    title: 'Supplier Invoice', singular: 'Supplier Invoice', icon: 'request_quote', permission: 'inbound',
    statuses: [S.draft, S.pending, S.verified, S.paid, S.disputed, S.cancelled], openStatuses: ['draft', 'pending', 'verified', 'disputed'],
    searchFields: ['doc_no', 'supplier_invoice_no'],
    fields: [
      { name: 'supplier_id', label: 'Supplier', type: 'relation', relation: 'suppliers' },
      { name: 'supplier_invoice_no', label: 'Supplier Invoice No', type: 'text' },
      { name: 'grn_id', label: 'Linked GRN', type: 'relation', relation: 'goods_receipts' },
      { name: 'invoice_date', label: 'Invoice Date', type: 'date', required: true },
      { name: 'due_date', label: 'Due Date', type: 'date' },
      { name: 'amount', label: 'Amount', type: 'number' },
      { name: 'tax', label: 'Tax', type: 'number' },
      { name: 'total', label: 'Total', type: 'number' },
      { name: 'status', label: 'Status', type: 'select', options: ['draft', 'pending', 'verified', 'paid', 'disputed', 'cancelled'], required: true },
      { name: 'remarks', label: 'Remarks', type: 'textarea', span2: true }
    ],
    listColumns: []
  },
  picking: {
    key: 'picking', module: 'outbound', table: 'pick_lists', docType: 'PICK', numberField: 'pick_no',
    title: 'Pick List', singular: 'Pick List', icon: 'shopping_cart_checkout', permission: 'outbound',
    statuses: [S.pending, S.picking, S.picked, S.completed, S.cancelled], openStatuses: ['pending', 'picking', 'picked'],
    searchFields: ['pick_no', 'reference_no'],
    fields: [
      { name: 'customer_id', label: 'Customer', type: 'relation', relation: 'customers' },
      { name: 'warehouse_id', label: 'Warehouse', type: 'relation', relation: 'warehouses' },
      { name: 'reference_no', label: 'Sales Order Reference', type: 'text' },
      { name: 'total_qty', label: 'Total Quantity', type: 'number' },
      { name: 'assigned_to', label: 'Assigned To', type: 'text' },
      { name: 'status', label: 'Status', type: 'select', options: ['pending', 'picking', 'picked', 'completed', 'cancelled'], required: true },
      { name: 'remarks', label: 'Remarks', type: 'textarea', span2: true }
    ],
    listColumns: []
  },
  dispatch: {
    key: 'dispatch', module: 'outbound', table: 'dispatches', docType: 'DISP', numberField: 'dispatch_no',
    title: 'Dispatch', singular: 'Dispatch', icon: 'local_shipping', permission: 'outbound',
    statuses: [S.pending, S.loaded, S.dispatched, S.delivered, S.cancelled], openStatuses: ['pending', 'loaded'],
    searchFields: ['dispatch_no'],
    fields: [
      { name: 'customer_id', label: 'Customer', type: 'relation', relation: 'customers' },
      { name: 'warehouse_id', label: 'Warehouse', type: 'relation', relation: 'warehouses' },
      { name: 'pick_list_id', label: 'Source Pick List', type: 'relation', relation: 'pick_lists' },
      { name: 'vehicle_id', label: 'Vehicle', type: 'relation', relation: 'vehicles' },
      { name: 'dispatch_date', label: 'Dispatch Date', type: 'date', required: true },
      { name: 'total_qty', label: 'Total Quantity', type: 'number' },
      { name: 'status', label: 'Status', type: 'select', options: ['pending', 'loaded', 'dispatched', 'delivered', 'cancelled'], required: true },
      { name: 'remarks', label: 'Remarks', type: 'textarea', span2: true }
    ],
    listColumns: []
  },
  packing: {
    key: 'packing', module: 'outbound', table: 'packing_tasks', docType: 'PACK', numberField: 'pack_no',
    title: 'Packing', singular: 'Packing Task', icon: 'package_2', permission: 'outbound',
    statuses: [S.pending, S.picking, S.packed, S.cancelled], openStatuses: ['pending', 'picking'],
    searchFields: ['pack_no'],
    fields: [
      { name: 'sales_order_id', label: 'Sales Order', type: 'relation', relation: 'sales_orders' },
      { name: 'customer_id', label: 'Customer', type: 'relation', relation: 'customers' },
      { name: 'warehouse_id', label: 'Warehouse', type: 'relation', relation: 'warehouses' },
      { name: 'total_packages', label: 'Total Packages', type: 'number' },
      { name: 'total_qty', label: 'Total Quantity', type: 'number' },
      { name: 'status', label: 'Status', type: 'select', options: ['pending', 'packing', 'packed', 'cancelled'], required: true },
      { name: 'remarks', label: 'Remarks', type: 'textarea', span2: true }
    ],
    listColumns: []
  },
  'delivery-challan': {
    key: 'delivery-challan', module: 'outbound', table: 'delivery_challans', docType: 'DC', numberField: 'challan_no',
    title: 'Delivery Challan', singular: 'Delivery Challan', icon: 'receipt', permission: 'outbound',
    statuses: [S.draft, S.issued, S.delivered, S.cancelled], openStatuses: ['draft', 'issued'],
    searchFields: ['challan_no'],
    fields: [
      { name: 'customer_id', label: 'Customer', type: 'relation', relation: 'customers' },
      { name: 'dispatch_id', label: 'Dispatch', type: 'relation', relation: 'dispatches' },
      { name: 'vehicle_id', label: 'Vehicle', type: 'relation', relation: 'vehicles' },
      { name: 'challan_date', label: 'Challan Date', type: 'date', required: true },
      { name: 'total_qty', label: 'Total Quantity', type: 'number' },
      { name: 'status', label: 'Status', type: 'select', options: ['draft', 'issued', 'delivered', 'cancelled'], required: true },
      { name: 'remarks', label: 'Remarks', type: 'textarea', span2: true }
    ],
    listColumns: []
  },
  'gate-pass': {
    key: 'gate-pass', module: 'outbound', table: 'gate_passes', docType: 'GP', numberField: 'gate_pass_no',
    title: 'Gate Pass', singular: 'Gate Pass', icon: 'door_front', permission: 'outbound', pdf: 'gatepass',
    statuses: [S.pending, S.issued, S.exited, S.cancelled], openStatuses: ['pending', 'issued'],
    searchFields: ['gate_pass_no', 'driver_name'],
    fields: [
      { name: 'challan_id', label: 'Delivery Challan', type: 'relation', relation: 'delivery_challans' },
      { name: 'vehicle_id', label: 'Vehicle', type: 'relation', relation: 'vehicles' },
      { name: 'driver_name', label: 'Driver Name', type: 'text' },
      { name: 'gate_out_date', label: 'Gate Out Date', type: 'date', required: true },
      { name: 'purpose', label: 'Purpose', type: 'text', span2: true },
      { name: 'status', label: 'Status', type: 'select', options: ['pending', 'issued', 'exited', 'cancelled'], required: true },
      { name: 'remarks', label: 'Remarks', type: 'textarea', span2: true },
      // Filled by the vehicle-loading scan (see DeliveryChallan.tsx's "Load &
      // Scan Vehicle" action) — not meant to be hand-typed, but left editable
      // here like every other field in case of a correction.
      { name: 'gate_in_time', label: 'Gate In Time (loading started)', type: 'text' },
      { name: 'gate_out_time', label: 'Gate Out Time (loading finished)', type: 'text' },
      { name: 'loaded_serial_count', label: 'Serials Loaded', type: 'number' }
    ],
    listColumns: []
  },
  'pod-upload': {
    key: 'pod-upload', module: 'outbound', table: 'proof_of_delivery', docType: 'POD', numberField: 'pod_no',
    title: 'Customer POD', singular: 'POD', icon: 'task_alt', permission: 'outbound',
    statuses: [S.pending, S.received, S.disputed], openStatuses: ['pending'],
    searchFields: ['pod_no', 'received_by'],
    fields: [
      { name: 'challan_id', label: 'Delivery Challan', type: 'relation', relation: 'delivery_challans' },
      { name: 'customer_id', label: 'Customer', type: 'relation', relation: 'customers' },
      { name: 'delivery_date', label: 'Delivery Date', type: 'date', required: true },
      { name: 'received_by', label: 'Received By', type: 'text' },
      { name: 'pod_url', label: 'POD Photo / Document', type: 'image', span2: true },
      { name: 'status', label: 'Status', type: 'select', options: ['pending', 'received', 'disputed'], required: true },
      { name: 'remarks', label: 'Remarks', type: 'textarea', span2: true }
    ],
    listColumns: []
  },
  'transport-request': {
    key: 'transport-request', module: 'transport', table: 'transport_requests', docType: 'TR', numberField: 'request_no',
    title: 'Transport Request', singular: 'Transport Request', icon: 'assignment', permission: 'transport',
    statuses: [S.open, S.assigned, S.inTransit, S.completed, S.closed, S.cancelled], openStatuses: ['open', 'assigned', 'in_transit'],
    searchFields: ['request_no', 'origin', 'destination'],
    fields: [
      { name: 'transport_vendor_id', label: 'Transport Vendor', type: 'relation', relation: 'transport_vendors' },
      { name: 'vehicle_id', label: 'Vehicle', type: 'relation', relation: 'vehicles' },
      { name: 'origin', label: 'Origin', type: 'text' },
      { name: 'destination', label: 'Destination', type: 'text' },
      { name: 'request_date', label: 'Request Date', type: 'date', required: true },
      { name: 'required_date', label: 'Required Date', type: 'date' },
      { name: 'status', label: 'Status', type: 'select', options: ['open', 'assigned', 'in_transit', 'completed', 'closed', 'cancelled'], required: true },
      { name: 'remarks', label: 'Remarks', type: 'textarea', span2: true }
    ],
    listColumns: []
  },
  'vehicle-allocation': {
    key: 'vehicle-allocation', module: 'transport', table: 'vehicle_allocations', docType: 'VALLOC', numberField: 'allocation_no',
    title: 'Vehicle Allocation', singular: 'Allocation', icon: 'local_shipping', permission: 'transport',
    statuses: [S.allocated, S.inTransit, S.delivered, S.closed, S.cancelled], openStatuses: ['allocated', 'in_transit'],
    searchFields: ['allocation_no'],
    fields: [
      { name: 'so_id', label: 'Sales Order', type: 'relation', relation: 'sales_orders' },
      { name: 'transport_vendor_id', label: 'Transport Vendor', type: 'relation', relation: 'transport_vendors' },
      { name: 'vehicle_id', label: 'Vehicle', type: 'relation', relation: 'vehicles' },
      { name: 'driver_id', label: 'Driver', type: 'relation', relation: 'drivers' },
      { name: 'allocation_date', label: 'Allocation Date', type: 'date', required: true },
      { name: 'status', label: 'Status', type: 'select', options: ['allocated', 'in_transit', 'delivered', 'closed', 'cancelled'], required: true },
      { name: 'remarks', label: 'Remarks', type: 'textarea', span2: true }
    ],
    listColumns: []
  },
  'trip': {
    key: 'trip', module: 'transport', table: 'trips', docType: 'TRIP', numberField: 'trip_no',
    title: 'Trip Management', singular: 'Trip', icon: 'route', permission: 'transport',
    statuses: [S.open, S.inTransit, S.completed, S.closed, S.cancelled], openStatuses: ['open', 'in_transit'],
    searchFields: ['trip_no', 'origin', 'destination'],
    fields: [
      { name: 'vehicle_id', label: 'Vehicle', type: 'relation', relation: 'vehicles' },
      { name: 'driver_id', label: 'Driver', type: 'relation', relation: 'drivers' },
      { name: 'transport_vendor_id', label: 'Transport Vendor', type: 'relation', relation: 'transport_vendors' },
      { name: 'origin', label: 'Origin', type: 'text' },
      { name: 'destination', label: 'Destination', type: 'text' },
      { name: 'trip_date', label: 'Trip Date', type: 'date', required: true },
      { name: 'status', label: 'Status', type: 'select', options: ['open', 'in_transit', 'completed', 'closed', 'cancelled'], required: true },
      { name: 'remarks', label: 'Remarks', type: 'textarea', span2: true }
    ],
    listColumns: []
  },
  'courier': {
    key: 'courier', module: 'transport', table: 'courier_shipments', docType: 'CSHIP', numberField: 'shipment_no',
    title: 'Courier Management', singular: 'Courier Shipment', icon: 'local_post_office', permission: 'transport',
    statuses: [S.booked, S.inTransit, S.delivered, S.closed, S.cancelled], openStatuses: ['booked', 'in_transit'],
    searchFields: ['shipment_no', 'tracking_no'],
    fields: [
      { name: 'courier_id', label: 'Courier', type: 'relation', relation: 'couriers' },
      { name: 'so_id', label: 'Sales Order', type: 'relation', relation: 'sales_orders' },
      { name: 'tracking_no', label: 'Tracking No', type: 'text' },
      { name: 'charge', label: 'Charge', type: 'number' },
      { name: 'dispatch_date', label: 'Dispatch Date', type: 'date', required: true },
      { name: 'status', label: 'Status', type: 'select', options: ['booked', 'in_transit', 'delivered', 'closed', 'cancelled'], required: true },
      { name: 'remarks', label: 'Remarks', type: 'textarea', span2: true }
    ],
    listColumns: []
  },
  'trip-closure': {
    key: 'trip-closure', module: 'transport', table: 'trip_closures', docType: 'TCLOSE', numberField: 'closure_no',
    title: 'Trip Closure', singular: 'Trip Closure', icon: 'task_alt', permission: 'transport',
    statuses: [S.closed, S.verified, S.cancelled], openStatuses: ['closed'],
    searchFields: ['closure_no'],
    fields: [
      { name: 'trip_id', label: 'Trip', type: 'relation', relation: 'trips' },
      { name: 'end_date', label: 'End Date', type: 'date' },
      { name: 'actual_km', label: 'Actual KM', type: 'number' },
      { name: 'fuel_cost', label: 'Fuel Cost', type: 'number' },
      { name: 'other_expenses', label: 'Other Expenses', type: 'number' },
      { name: 'status', label: 'Status', type: 'select', options: ['closed', 'verified', 'cancelled'], required: true },
      { name: 'remarks', label: 'Remarks', type: 'textarea', span2: true }
    ],
    listColumns: []
  },
  'pod-collection': {
    key: 'pod-collection', module: 'transport', table: 'pod_collections', docType: 'PODC', numberField: 'pod_no',
    title: 'POD Collection', singular: 'POD', icon: 'fact_check', permission: 'transport',
    statuses: [S.received, S.verified, S.disputed], openStatuses: ['received'],
    searchFields: ['pod_no', 'received_by'],
    fields: [
      { name: 'so_id', label: 'Sales Order', type: 'relation', relation: 'sales_orders' },
      { name: 'trip_id', label: 'Trip', type: 'relation', relation: 'trips' },
      { name: 'received_by', label: 'Received By', type: 'text' },
      { name: 'received_date', label: 'Received Date', type: 'date', required: true },
      { name: 'status', label: 'Status', type: 'select', options: ['received', 'verified', 'disputed'], required: true },
      { name: 'remarks', label: 'Remarks', type: 'textarea', span2: true }
    ],
    listColumns: []
  },
  'billing': {
    key: 'billing', module: 'transport', table: 'transport_bills', docType: 'TBILL', numberField: 'bill_no',
    title: 'Transport Bill', singular: 'Transport Bill', icon: 'receipt_long', permission: 'transport',
    statuses: [S.draft, S.pending, S.billed, S.paid, S.cancelled], openStatuses: ['draft', 'pending', 'billed'],
    searchFields: ['bill_no'],
    fields: [
      { name: 'transport_vendor_id', label: 'Transport Vendor', type: 'relation', relation: 'transport_vendors' },
      { name: 'trip_id', label: 'Trip', type: 'relation', relation: 'trips' },
      { name: 'bill_date', label: 'Bill Date', type: 'date', required: true },
      { name: 'due_date', label: 'Due Date', type: 'date' },
      { name: 'amount', label: 'Amount', type: 'number' },
      { name: 'tax', label: 'Tax', type: 'number' },
      { name: 'total', label: 'Total', type: 'number' },
      { name: 'status', label: 'Status', type: 'select', options: ['draft', 'pending', 'billed', 'paid', 'cancelled'], required: true },
      { name: 'remarks', label: 'Remarks', type: 'textarea', span2: true }
    ],
    listColumns: []
  },
  'freight-cost': {
    key: 'freight-cost', module: 'transport', table: 'freight_costs', docType: 'FRT', numberField: 'doc_no',
    title: 'Freight Cost', singular: 'Freight Cost', icon: 'paid', permission: 'transport',
    statuses: [S.draft, S.verified, S.billed, S.cancelled], openStatuses: ['draft', 'verified'],
    searchFields: ['doc_no', 'origin', 'destination'],
    fields: [
      { name: 'trip_id', label: 'Trip', type: 'relation', relation: 'trips' },
      { name: 'vehicle_id', label: 'Vehicle', type: 'relation', relation: 'vehicles' },
      { name: 'origin', label: 'Origin', type: 'text' },
      { name: 'destination', label: 'Destination', type: 'text' },
      { name: 'cost_date', label: 'Cost Date', type: 'date', required: true },
      { name: 'freight_amount', label: 'Freight Amount', type: 'number' },
      { name: 'fuel_cost', label: 'Fuel Cost', type: 'number' },
      { name: 'toll_cost', label: 'Toll Cost', type: 'number' },
      { name: 'other_cost', label: 'Other Cost', type: 'number' },
      { name: 'total_cost', label: 'Total Cost', type: 'number' },
      { name: 'status', label: 'Status', type: 'select', options: ['draft', 'verified', 'billed', 'cancelled'], required: true },
      { name: 'remarks', label: 'Remarks', type: 'textarea', span2: true }
    ],
    listColumns: []
  }
}

// Build the standard list columns (doc no + relevant fields + status) for a def.
export function opColumns(def: OpDef): Column<any>[] {
  const cols: Column<any>[] = [
    { key: def.numberField, header: 'Document No', accessor: (r: any) => r[def.numberField], sortable: true, className: 'font-medium' }
  ]
  // Show up to three meaningful non-status fields as plain columns.
  def.fields.filter(f => !['textarea', 'image'].includes(f.type) && f.name !== 'status').slice(0, 3).forEach(f => {
    if (f.type === 'relation') {
      cols.push({ key: f.name, header: f.label, accessor: (r: any) => r.__rel?.[f.name] ?? '—', render: (r: any) => r.__rel?.[f.name] ?? '—', sortable: true })
    } else {
      cols.push({ key: f.name, header: f.label, accessor: (r: any) => r[f.name] ?? '—', sortable: true })
    }
  })
  cols.push({ key: 'status', header: 'Status', accessor: (r: any) => r.status ?? '—', render: statusTone(def.statuses), sortable: true })
  return cols
}

// Operations grouped by sidebar module, for rendering each module's tabs.
export const OPS_BY_MODULE: Record<string, OpDef[]> = Object.values(OPERATIONS).reduce((acc, def) => {
  (acc[def.module] ??= []).push(def)
  return acc
}, {} as Record<string, OpDef[]>)
