export interface DocCols { price?: boolean; location?: boolean; condition?: boolean; fromTo?: boolean; reason?: boolean; direction?: boolean }

export type ExtraRelation = 'transport_vendors' | 'vehicles' | 'drivers' | 'warehouses' | 'customers'
export interface ExtraField {
  name: string; label: string; kind: 'text' | 'select' | 'relation'
  options?: string[]; relation?: ExtraRelation
  showWhen?: { field: string; equals: string }
}

export interface DocConfig {
  key: string
  table: string
  itemTable: string
  itemFK: string
  qtyField: string
  docType: string
  title: string
  singular: string
  icon: string
  dateField: string
  party?: 'supplier' | 'customer'
  partyLabel?: string
  hasExpected?: boolean
  itemCols: DocCols
  showPrice?: boolean
  postRpc?: string
  postParam?: string
  source?: { table: string; itemTable: string; fk: string; label: string; statuses: string[] }
  extraFields?: ExtraField[]
  pdfKind?: 'gatepass'
}

export const DOC_CONFIGS: Record<string, DocConfig> = {
  // ---------------- Inbound ----------------
  'purchase-order': {
    key: 'purchase-order', table: 'purchase_orders', itemTable: 'purchase_order_items', itemFK: 'po_id',
    qtyField: 'qty', docType: 'PO', title: 'Purchase Order', singular: 'PO', icon: 'receipt_long',
    dateField: 'order_date', party: 'supplier', hasExpected: true, itemCols: { price: true }, showPrice: true
  },
  'grn': {
    key: 'grn', table: 'grns', itemTable: 'grn_items', itemFK: 'grn_id',
    qtyField: 'received_qty', docType: 'GRN', title: 'Goods Receipt Note', singular: 'GRN', icon: 'inventory',
    dateField: 'grn_date', party: 'supplier', itemCols: { price: true, location: true, condition: true }, showPrice: true,
    postRpc: 'post_grn', postParam: 'p_grn',
    source: { table: 'purchase_orders', itemTable: 'purchase_order_items', fk: 'po_id', label: 'Load from Purchase Order', statuses: ['posted'] }
  },
  'putaway': {
    key: 'putaway', table: 'putaways', itemTable: 'putaway_items', itemFK: 'putaway_id',
    qtyField: 'qty', docType: 'PUT', title: 'Putaway', singular: 'Putaway', icon: 'move_down',
    dateField: 'putaway_date', itemCols: { fromTo: true, condition: true },
    postRpc: 'post_putaway', postParam: 'p_pa',
    source: { table: 'grns', itemTable: 'grn_items', fk: 'grn_id', label: 'Load from GRN', statuses: ['posted'] }
  },
  'purchase-return': {
    key: 'purchase-return', table: 'purchase_returns', itemTable: 'purchase_return_items', itemFK: 'return_id',
    qtyField: 'qty', docType: 'PRTN', title: 'Purchase Return', singular: 'Return', icon: 'assignment_return',
    dateField: 'return_date', party: 'supplier', itemCols: { price: true, location: true, condition: true, reason: true }, showPrice: true,
    postRpc: 'post_purchase_return', postParam: 'p_ret'
  },
  // ---------------- Outbound ----------------
  'sales-order': {
    key: 'sales-order', table: 'sales_orders', itemTable: 'sales_order_items', itemFK: 'so_id',
    qtyField: 'qty', docType: 'SO', title: 'Sales Order', singular: 'SO', icon: 'shopping_cart',
    dateField: 'order_date', party: 'customer', partyLabel: 'Sold-To Party', hasExpected: true,
    itemCols: { price: true }, showPrice: true,
    extraFields: [
      { name: 'ship_to_id', label: 'Ship-To Party', kind: 'relation', relation: 'customers' },
      { name: 'ship_to_address', label: 'Ship-To Address (if not a registered customer)', kind: 'text' }
    ]
  },
  'picking': {
    key: 'picking', table: 'pickings', itemTable: 'picking_items', itemFK: 'picking_id',
    qtyField: 'qty', docType: 'PICK', title: 'Picking List', singular: 'Pick', icon: 'checklist',
    dateField: 'pick_date', itemCols: { location: true },
    source: { table: 'sales_orders', itemTable: 'sales_order_items', fk: 'so_id', label: 'Load from Sales Order', statuses: ['posted'] }
  },
  'packing': {
    key: 'packing', table: 'packings', itemTable: 'packing_items', itemFK: 'packing_id',
    qtyField: 'qty', docType: 'PACK', title: 'Packing Slip', singular: 'Pack', icon: 'package_2',
    dateField: 'pack_date', itemCols: {},
    source: { table: 'pickings', itemTable: 'picking_items', fk: 'picking_id', label: 'Load from Picking', statuses: ['posted'] }
  },
  'delivery-challan': {
    key: 'delivery-challan', table: 'delivery_challans', itemTable: 'delivery_challan_items', itemFK: 'dc_id',
    qtyField: 'qty', docType: 'DC', title: 'Delivery Challan', singular: 'DC', icon: 'local_shipping',
    dateField: 'dc_date', party: 'customer', itemCols: { price: true, location: true, condition: true }, showPrice: true,
    postRpc: 'post_delivery_challan', postParam: 'p_dc',
    source: { table: 'sales_orders', itemTable: 'sales_order_items', fk: 'so_id', label: 'Load from Sales Order', statuses: ['posted'] },
    extraFields: [
      { name: 'delivery_method', label: 'Delivery Method', kind: 'select', options: ['Transport', 'Courier'] },
      { name: 'transporter_id', label: 'Transporter', kind: 'relation', relation: 'transport_vendors', showWhen: { field: 'delivery_method', equals: 'Transport' } },
      { name: 'vehicle_id', label: 'Vehicle', kind: 'relation', relation: 'vehicles', showWhen: { field: 'delivery_method', equals: 'Transport' } },
      { name: 'driver_id', label: 'Driver', kind: 'relation', relation: 'drivers', showWhen: { field: 'delivery_method', equals: 'Transport' } },
      { name: 'courier_name', label: 'Courier Name', kind: 'text', showWhen: { field: 'delivery_method', equals: 'Courier' } },
      { name: 'courier_tracking_no', label: 'Courier Tracking No', kind: 'text', showWhen: { field: 'delivery_method', equals: 'Courier' } }
    ]
  },
  'gate-pass': {
    key: 'gate-pass', table: 'gate_passes', itemTable: 'gate_pass_items', itemFK: 'gate_pass_id',
    qtyField: 'qty', docType: 'GP', title: 'Gate Pass', singular: 'Gate Pass', icon: 'exit_to_app',
    dateField: 'gate_date', itemCols: {}, pdfKind: 'gatepass',
    source: { table: 'delivery_challans', itemTable: 'delivery_challan_items', fk: 'dc_id', label: 'Load from Delivery Challan', statuses: ['posted'] },
    extraFields: [
      { name: 'transporter_id', label: 'Transporter', kind: 'relation', relation: 'transport_vendors' },
      { name: 'vehicle_id', label: 'Vehicle', kind: 'relation', relation: 'vehicles' },
      { name: 'driver_name', label: 'Driver Name', kind: 'text' },
      { name: 'gate_out_time', label: 'Gate-Out Time', kind: 'text' }
    ]
  },
  // ---------------- Reverse Logistics ----------------
  'sales-return': {
    key: 'sales-return', table: 'sales_returns', itemTable: 'sales_return_items', itemFK: 'srn_id',
    qtyField: 'qty', docType: 'SRN', title: 'Sales Return', singular: 'Sales Return', icon: 'assignment_return',
    dateField: 'return_date', party: 'customer', itemCols: { price: true, location: true, condition: true, reason: true }, showPrice: true,
    postRpc: 'post_sales_return', postParam: 'p_srn',
    source: { table: 'delivery_challans', itemTable: 'delivery_challan_items', fk: 'dc_id', label: 'Load from Delivery Challan', statuses: ['posted'] }
  },
  'exchange': {
    key: 'exchange', table: 'exchanges', itemTable: 'exchange_items', itemFK: 'exchange_id',
    qtyField: 'qty', docType: 'EXC', title: 'Exchange', singular: 'Exchange', icon: 'swap_horiz',
    dateField: 'exchange_date', party: 'customer', itemCols: { location: true, condition: true, direction: true, reason: true },
    postRpc: 'post_exchange', postParam: 'p_ex'
  },
  'replacement': {
    key: 'replacement', table: 'replacements', itemTable: 'replacement_items', itemFK: 'replacement_id',
    qtyField: 'qty', docType: 'RPL', title: 'Replacement', singular: 'Replacement', icon: 'cached',
    dateField: 'replace_date', party: 'customer', itemCols: { location: true, condition: true, direction: true, reason: true },
    postRpc: 'post_replacement', postParam: 'p_rep'
  }
}
