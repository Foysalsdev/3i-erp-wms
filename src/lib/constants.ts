// Sidebar = 12 main modules; each fans out into tabs/business functions.
export interface NavTab { key: string; label: string }
export interface NavModule {
  key: string; label: string; icon: string; path: string
  permission?: string; tabs?: NavTab[]
}

export const MODULES: NavModule[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'dashboard', path: '/dashboard', permission: 'dashboard.view', tabs: [
    { key: 'executive', label: 'Executive Dashboard' }, { key: 'operational', label: 'Operational Dashboard' }
  ]},
  { key: 'masters', label: 'Masters', icon: 'inventory_2', path: '/masters', permission: 'masters.view', tabs: [
    { key: 'products', label: 'Product / SKU' }, { key: 'customers', label: 'Customer' },
    { key: 'suppliers', label: 'Supplier' }, { key: 'transporters', label: 'Transport Vendor' },
    { key: 'warehouses', label: 'Warehouse' }, { key: 'locations', label: 'Location' },
    { key: 'assets', label: 'Asset' }, { key: 'non-inventory', label: 'Non-Inventory' }
  ]},
  { key: 'inventory', label: 'Inventory Management', icon: 'warehouse', path: '/inventory', permission: 'inventory.view', tabs: [
    { key: 'stock', label: 'Stock Overview' }, { key: 'ledger', label: 'Inventory Ledger' },
    { key: 'transfer', label: 'Stock Transfer' }, { key: 'adjustment', label: 'Stock Adjustment' },
    { key: 'cycle-count', label: 'Cycle Count' }, { key: 'physical-verification', label: 'Physical Verification' },
    { key: 'damaged', label: 'Damaged Stock' }, { key: 'quarantine', label: 'Quarantine Stock' },
    { key: 'hold', label: 'Hold Stock' }, { key: 'serials', label: 'Serial Tracking' },
    { key: 'batch', label: 'Lot / Batch Tracking' }, { key: 'fifo', label: 'FIFO' }, { key: 'fefo', label: 'FEFO' }
  ]},
  { key: 'inbound', label: 'Inbound Operations', icon: 'login', path: '/inbound', permission: 'inbound.view', tabs: [
    { key: 'purchase-requisition', label: 'Purchase Requisition' }, { key: 'grn', label: 'Goods Receipt Note (GRN)' },
    { key: 'putaway', label: 'Putaway' }, { key: 'purchase-return', label: 'Purchase Return' },
    { key: 'supplier-invoice', label: 'Supplier Invoice' }
  ]},
  { key: 'outbound', label: 'Outbound Operations', icon: 'logout', path: '/outbound', permission: 'outbound.view', tabs: [
    { key: 'sales-order', label: 'Sales Order' },
    { key: 'delivery-challan', label: 'Delivery Challan' }, { key: 'gate-pass', label: 'Gate Pass' },
    { key: 'pod-upload', label: 'Customer POD Upload' }
  ]},
  { key: 'reverse', label: 'Reverse Logistics', icon: 'undo', path: '/reverse', permission: 'reverse.view', tabs: [
    { key: 'sales-return', label: 'Sales Return' }, { key: 'exchange', label: 'Exchange' },
    { key: 'replacement', label: 'Replacement' }, { key: 'refurbishment', label: 'Refurbishment Workflow' },
    { key: 'return-inspection', label: 'Return Inspection' }
  ]},
  { key: 'transport', label: 'Transport & Logistics', icon: 'local_shipping', path: '/transport', permission: 'transport.view', tabs: [
    { key: 'transport-request', label: 'Transport Request' }, { key: 'vehicle-allocation', label: 'Vehicle Allocation' },
    { key: 'trip', label: 'Trip Management' }, { key: 'courier', label: 'Courier Management' },
    { key: 'billing', label: 'Transport Billing' }, { key: 'trip-closure', label: 'Trip Closure' },
    { key: 'pod-collection', label: 'POD Collection' }, { key: 'freight-cost', label: 'Freight Cost Tracking' }
  ]},
  { key: 'asset', label: 'Asset & Non-Inventory', icon: 'category', path: '/asset', permission: 'asset.view', tabs: [
    { key: 'registration', label: 'Asset Registration' }, { key: 'allocation', label: 'Asset Allocation' },
    { key: 'transfer', label: 'Asset Transfer' }, { key: 'maintenance', label: 'Asset Maintenance' },
    { key: 'disposal', label: 'Asset Disposal' }, { key: 'non-inventory-issue', label: 'Non-Inventory Issue' },
    { key: 'non-inventory-consumption', label: 'Non-Inventory Consumption' }, { key: 'history', label: 'Asset History' }
  ]},
  { key: 'finance', label: 'Finance', icon: 'payments', path: '/finance', permission: 'finance.view', tabs: [
    { key: 'customer-billing', label: 'Customer Billing' }, { key: 'transport-billing', label: 'Transport Billing' },
    { key: 'supplier-bills', label: 'Supplier Bills' }, { key: 'expense', label: 'Expense Management' },
    { key: 'credit-notes', label: 'Credit Notes' }, { key: 'debit-notes', label: 'Debit Notes' },
    { key: 'payment-tracking', label: 'Payment Tracking' }, { key: 'financial-dashboard', label: 'Financial Dashboard' }
  ]},
  { key: 'hr', label: 'HR & Administration', icon: 'groups', path: '/hr', permission: 'hr.view', tabs: [
    { key: 'employee', label: 'Employee Master' }, { key: 'department', label: 'Department Master' },
    { key: 'attendance', label: 'Attendance' }, { key: 'leave', label: 'Leave Management' },
    { key: 'employee-asset', label: 'Employee Asset Allocation' }, { key: 'users', label: 'User Management' },
    { key: 'roles', label: 'Role Management' }
  ]},
  { key: 'reports', label: 'Reports & Analytics', icon: 'analytics', path: '/reports', permission: 'reports.view', tabs: [
    { key: 'inventory', label: 'Inventory Reports' }, { key: 'stock-aging', label: 'Stock Aging' },
    { key: 'stock-movement', label: 'Stock Movement' }, { key: 'inventory-valuation', label: 'Inventory Valuation' },
    { key: 'inbound', label: 'Inbound Reports' }, { key: 'outbound', label: 'Outbound Reports' },
    { key: 'outbound-deliveries', label: 'Delivery Register' },
    { key: 'transport', label: 'Transport Reports' }, { key: 'asset', label: 'Asset Reports' },
    { key: 'finance', label: 'Finance Reports' }, { key: 'hr', label: 'HR Reports' },
    { key: 'builder', label: 'Custom Report Builder' }
  ]},
  { key: 'settings', label: 'Settings', icon: 'settings', path: '/settings', permission: 'settings.view', tabs: [
    { key: 'company', label: 'Company Settings' }, { key: 'workflow', label: 'Workflow Settings' },
    { key: 'notifications', label: 'Notification Settings' }, { key: 'barcode', label: 'Barcode Settings' },
    { key: 'print-template', label: 'Print Template Settings' }, { key: 'email-templates', label: 'Email Templates' },
    { key: 'audit', label: 'Audit Logs' }
  ]}
]

export const STOCK_STATUS = {
  good: { label: 'Good', tone: 'positive' as const },
  damaged: { label: 'Damaged', tone: 'negative' as const },
  quarantine: { label: 'Quarantine', tone: 'critical' as const }
}
