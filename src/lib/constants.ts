// Sidebar = 12 main modules; each fans out into tabs/business functions.
export interface NavTab { key: string; label: string }
export interface NavModule {
  key: string; label: string; icon: string; path: string
  permission?: string; tabs?: NavTab[]
}

export const MODULES: NavModule[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'dashboard', path: '/dashboard', permission: 'dashboard.view' },
  { key: 'masters', label: 'Masters', icon: 'inventory_2', path: '/masters', permission: 'masters.view', tabs: [
    { key: 'products', label: 'SKU / Product' }, { key: 'customers', label: 'Customer' },
    { key: 'suppliers', label: 'Supplier' }, { key: 'transport-vendors', label: 'Transport Vendor' },
    { key: 'warehouses', label: 'Warehouse' }, { key: 'locations', label: 'Location' },
    { key: 'assets', label: 'Asset' }, { key: 'non-inventory', label: 'Non-Inventory' }
  ]},
  { key: 'inventory', label: 'Inventory', icon: 'warehouse', path: '/inventory', permission: 'inventory.view', tabs: [
    { key: 'dashboard', label: 'Dashboard' }, { key: 'stock', label: 'Stock' },
    { key: 'ledger', label: 'Ledger' }, { key: 'snapshot', label: 'Snapshot' },
    { key: 'serials', label: 'Serial Tracking' }, { key: 'damaged', label: 'Damaged Stock' },
    { key: 'quarantine', label: 'Quarantine Stock' }
  ]},
  { key: 'inbound', label: 'Inbound Operations', icon: 'login', path: '/inbound', permission: 'inbound.view', tabs: [
    { key: 'purchase-order', label: 'Purchase Order' }, { key: 'grn', label: 'GRN' },
    { key: 'putaway', label: 'Putaway' }, { key: 'purchase-return', label: 'Purchase Return' }
  ]},
  { key: 'outbound', label: 'Outbound Operations', icon: 'logout', path: '/outbound', permission: 'outbound.view', tabs: [
    { key: 'sales-order', label: 'Sales Order' }, { key: 'picking', label: 'Picking' },
    { key: 'packing', label: 'Packing' }, { key: 'delivery-challan', label: 'Delivery Challan' },
    { key: 'gate-pass', label: 'Gate Pass' }
  ]},
  { key: 'reverse', label: 'Reverse Logistics', icon: 'undo', path: '/reverse', permission: 'reverse.view', tabs: [
    { key: 'sales-return', label: 'Sales Return' }, { key: 'exchange', label: 'Exchange' },
    { key: 'replacement', label: 'Replacement' }
  ]},
  { key: 'transport', label: 'Transport & Logistics', icon: 'local_shipping', path: '/transport', permission: 'transport.view', tabs: [
    { key: 'transport-request', label: 'Transport Request' }, { key: 'trip', label: 'Trip Management' },
    { key: 'courier', label: 'Courier' }, { key: 'billing', label: 'Transport Billing' }
  ]},
  { key: 'asset', label: 'Asset & Non-Inventory', icon: 'category', path: '/asset', permission: 'asset.view', tabs: [
    { key: 'asset-master', label: 'Asset Master' }, { key: 'non-inventory', label: 'Non-Inventory Items' },
    { key: 'assignment', label: 'Asset Assignment' }, { key: 'transfer', label: 'Asset Transfer' },
    { key: 'maintenance', label: 'Asset Maintenance' }, { key: 'disposal', label: 'Asset Disposal' },
    { key: 'reports', label: 'Asset Reports' }
  ]},
  { key: 'finance', label: 'Finance', icon: 'payments', path: '/finance', permission: 'finance.view', tabs: [
    { key: 'expense', label: 'Expense' }, { key: 'client-billing', label: 'Client Billing' },
    { key: 'invoice', label: 'Invoice' }, { key: 'ledger', label: 'Ledger' },
    { key: 'reports', label: 'Financial Reports' }
  ]},
  { key: 'hr', label: 'HR & Administration', icon: 'groups', path: '/hr', permission: 'hr.view', tabs: [
    { key: 'employee', label: 'Employee' }, { key: 'attendance', label: 'Attendance' },
    { key: 'payroll', label: 'Payroll' }, { key: 'tasks', label: 'Tasks' },
    { key: 'users', label: 'User Management' }, { key: 'roles', label: 'Role Management' },
    { key: 'audit', label: 'Audit Logs' }
  ]},
  { key: 'reports', label: 'Reports & Analytics', icon: 'analytics', path: '/reports', permission: 'reports.view', tabs: [
    { key: 'inventory', label: 'Inventory Reports' }, { key: 'inbound', label: 'Inbound Reports' },
    { key: 'outbound', label: 'Outbound Reports' }, { key: 'transport', label: 'Transport Reports' },
    { key: 'financial', label: 'Financial Reports' }, { key: 'kpi', label: 'KPI Dashboard' }
  ]},
  { key: 'settings', label: 'Settings', icon: 'settings', path: '/settings', permission: 'settings.view' }
]

export const STOCK_STATUS = {
  good: { label: 'Good', tone: 'positive' as const },
  damaged: { label: 'Damaged', tone: 'negative' as const },
  quarantine: { label: 'Quarantine', tone: 'critical' as const }
}
