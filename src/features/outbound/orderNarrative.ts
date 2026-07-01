// Friendly, past-tense narrative per sales-order status, for the Overview's
// customer-style timeline. Distinct from OUTBOUND_STAGES in workflow.ts, which
// groups statuses coarsely for the forward-looking "what's next" WorkflowPanel.
export interface StatusNarrative { label: string; icon: string; description: string }

export const SO_STATUS_NARRATIVE: Record<string, StatusNarrative> = {
  draft: { label: 'Order Placed', icon: 'shopping_cart', description: 'Sales order created and pending approval.' },
  pending: { label: 'Order Placed', icon: 'shopping_cart', description: 'Sales order created and pending approval.' },
  approved: { label: 'Confirmed', icon: 'task_alt', description: 'Order approved — ready for picking.' },
  picking: { label: 'Picking', icon: 'shopping_cart_checkout', description: 'Warehouse is picking & scanning items.' },
  packed: { label: 'Packed', icon: 'inventory_2', description: 'Items packed and ready for invoicing.' },
  invoiced: { label: 'Invoiced', icon: 'receipt', description: 'SAP invoice recorded — ready to dispatch.' },
  dispatched: { label: 'Dispatched', icon: 'local_shipping', description: 'Shipment dispatched for delivery.' },
  delivered: { label: 'Delivered', icon: 'home', description: 'Customer has received the order.' },
  closed: { label: 'Closed', icon: 'lock', description: 'Order closed.' }
}

// Order in which reached statuses are displayed (oldest → newest).
export const SO_STATUS_ORDER = ['draft', 'pending', 'approved', 'picking', 'packed', 'invoiced', 'dispatched', 'delivered', 'closed']
