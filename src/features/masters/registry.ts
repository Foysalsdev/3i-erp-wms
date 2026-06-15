import type { Column } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { createElement } from 'react'

export type FieldType = 'text' | 'number' | 'select' | 'checkbox' | 'textarea' | 'date' | 'image'
export type RelationKey = 'warehouses' | 'transport_vendors' | 'vehicles' | 'zones'

export const RELATIONS: Record<RelationKey, { table: string; code: string; name: string }> = {
  warehouses:        { table: 'warehouses', code: 'code', name: 'name' },
  transport_vendors: { table: 'transport_vendors', code: 'vendor_code', name: 'name' },
  vehicles:          { table: 'vehicles', code: 'vehicle_number', name: 'vehicle_type' },
  zones:             { table: 'zones', code: 'code', name: 'name' }
}

export interface FieldDef {
  name: string
  label: string
  type: FieldType
  required?: boolean
  options?: string[]
  relation?: RelationKey
  placeholder?: string
  span2?: boolean
  help?: string
}

export interface MasterDef {
  key: string
  table: string
  title: string
  singular: string
  icon: string
  codeField: string
  nameField: string
  subField?: string
  imageField?: string
  fields: FieldDef[]
  listColumns: Column<any>[]
  searchFields: string[]
}

const statusBadge = (row: any) =>
  createElement(Badge, { tone: ['active', 'in_use'].includes(row.status) ? 'positive' : 'neutral' }, row.status)

const UOM = ['PCS', 'BOX', 'CTN', 'SET', 'KG', 'LTR']
const STATUS = ['active', 'inactive']
const TERMS = ['Advance', 'Net 7', 'Net 15', 'Net 30', 'Net 45', 'Net 60']

export const MASTERS: Record<string, MasterDef> = {
  products: {
    key: 'products', table: 'products', title: 'SKU / Product Master', singular: 'Product',
    icon: 'inventory_2', codeField: 'material_code', nameField: 'name', subField: 'brand', imageField: 'image_url',
    searchFields: ['name', 'material_code', 'barcode', 'model'],
    fields: [
      { name: 'image_url', label: 'Product Image', type: 'image' },
      { name: 'material_code', label: 'Material Code / SAP Reference Code', type: 'text', required: true, help: 'Single primary product reference (no separate SKU/Model code)' },
      { name: 'name', label: 'Material Description / Product Name', type: 'text', required: true, span2: true },
      { name: 'brand', label: 'Brand', type: 'text' },
      { name: 'model', label: 'Model', type: 'text' },
      { name: 'category', label: 'Category', type: 'text' },
      { name: 'uom', label: 'UOM', type: 'select', options: UOM, required: true },
      { name: 'weight', label: 'Weight (kg)', type: 'number' },
      { name: 'barcode', label: 'Barcode / QR Code', type: 'text', help: 'Linked to Material Code' },
      { name: 'serial_tracking', label: 'Serial Tracking', type: 'checkbox' },
      { name: 'warranty_applicable', label: 'Warranty Applicable', type: 'checkbox' },
      { name: 'warranty_months', label: 'Warranty (months)', type: 'number' },
      { name: 'restock_level', label: 'Re-Stock Level (Low Stock Alert)', type: 'number' },
      { name: 'status', label: 'Status', type: 'select', options: STATUS, required: true }
    ],
    listColumns: [
      { key: 'material_code', header: 'Material Code', accessor: r => r.material_code, sortable: true, className: 'font-medium' },
      { key: 'name', header: 'Product', accessor: r => r.name, sortable: true },
      { key: 'brand', header: 'Brand', accessor: r => r.brand },
      { key: 'model', header: 'Model', accessor: r => r.model },
      { key: 'uom', header: 'UOM', accessor: r => r.uom },
      { key: 'serial', header: 'Serial', render: r => r.serial_tracking ? createElement(Badge, { tone: 'info' }, 'Tracked') : '—' },
      { key: 'status', header: 'Status', render: statusBadge }
    ]
  },
  customers: {
    key: 'customers', table: 'customers', title: 'Customer Master', singular: 'Customer',
    icon: 'badge', codeField: 'customer_code', nameField: 'name', subField: 'contact_person', imageField: 'logo_url',
    searchFields: ['name', 'customer_code', 'sap_customer_code', 'email', 'phone'],
    fields: [
      { name: 'logo_url', label: 'Company Logo', type: 'image' },
      { name: 'customer_code', label: 'Customer Code', type: 'text', required: true },
      { name: 'sap_customer_code', label: 'SAP Customer Code', type: 'text' },
      { name: 'name', label: 'Company / Customer Name', type: 'text', required: true, span2: true },
      { name: 'contact_person', label: 'Contact Person', type: 'text' },
      { name: 'phone', label: 'Phone', type: 'text' },
      { name: 'email', label: 'Email', type: 'text' },
      { name: 'billing_address', label: 'Billing Address', type: 'textarea', span2: true },
      { name: 'shipping_address', label: 'Shipping Address', type: 'textarea', span2: true },
      { name: 'credit_limit', label: 'Credit Limit', type: 'number' },
      { name: 'payment_terms', label: 'Payment Terms', type: 'select', options: TERMS },
      { name: 'status', label: 'Status', type: 'select', options: STATUS, required: true }
    ],
    listColumns: [
      { key: 'customer_code', header: 'Code', accessor: r => r.customer_code, sortable: true, className: 'font-medium' },
      { key: 'name', header: 'Customer', accessor: r => r.name, sortable: true },
      { key: 'contact_person', header: 'Contact', accessor: r => r.contact_person },
      { key: 'phone', header: 'Phone', accessor: r => r.phone },
      { key: 'payment_terms', header: 'Terms', accessor: r => r.payment_terms },
      { key: 'status', header: 'Status', render: statusBadge }
    ]
  },
  suppliers: {
    key: 'suppliers', table: 'suppliers', title: 'Supplier Master', singular: 'Supplier',
    icon: 'inventory', codeField: 'supplier_code', nameField: 'name', subField: 'contact_person', imageField: 'logo_url',
    searchFields: ['name', 'supplier_code', 'email'],
    fields: [
      { name: 'logo_url', label: 'Supplier Logo', type: 'image' },
      { name: 'supplier_code', label: 'Supplier Code', type: 'text', required: true },
      { name: 'name', label: 'Company Name', type: 'text', required: true, span2: true },
      { name: 'contact_person', label: 'Contact Person', type: 'text' },
      { name: 'phone', label: 'Phone', type: 'text' },
      { name: 'email', label: 'Email', type: 'text' },
      { name: 'address', label: 'Address', type: 'textarea', span2: true },
      { name: 'trade_license', label: 'Trade License', type: 'text' },
      { name: 'tin_vat', label: 'TIN / VAT', type: 'text' },
      { name: 'payment_terms', label: 'Payment Terms', type: 'select', options: TERMS },
      { name: 'status', label: 'Status', type: 'select', options: STATUS, required: true }
    ],
    listColumns: [
      { key: 'supplier_code', header: 'Code', accessor: r => r.supplier_code, sortable: true, className: 'font-medium' },
      { key: 'name', header: 'Supplier', accessor: r => r.name, sortable: true },
      { key: 'contact_person', header: 'Contact', accessor: r => r.contact_person },
      { key: 'tin_vat', header: 'TIN/VAT', accessor: r => r.tin_vat },
      { key: 'status', header: 'Status', render: statusBadge }
    ]
  },
  employees: {
    key: 'employees', table: 'employees', title: 'Employee Master', singular: 'Employee',
    icon: 'groups', codeField: 'employee_code', nameField: 'name', subField: 'designation', imageField: 'photo_url',
    searchFields: ['name', 'employee_code', 'phone', 'email', 'department'],
    fields: [
      { name: 'photo_url', label: 'Employee Photo', type: 'image' },
      { name: 'employee_code', label: 'Employee ID', type: 'text', required: true },
      { name: 'name', label: 'Name', type: 'text', required: true, span2: true },
      { name: 'designation', label: 'Designation', type: 'text' },
      { name: 'department', label: 'Department', type: 'select', options: ['Operations', 'Inventory', 'Logistics', 'Finance', 'HR', 'IT', 'Admin'] },
      { name: 'phone', label: 'Phone', type: 'text' },
      { name: 'email', label: 'Email', type: 'text' },
      { name: 'nid', label: 'NID', type: 'text' },
      { name: 'joining_date', label: 'Joining Date', type: 'date' },
      { name: 'reporting_manager', label: 'Reporting Manager', type: 'text' },
      { name: 'role', label: 'Role', type: 'text' },
      { name: 'status', label: 'Status', type: 'select', options: STATUS, required: true }
    ],
    listColumns: [
      { key: 'employee_code', header: 'ID', accessor: r => r.employee_code, sortable: true, className: 'font-medium' },
      { key: 'name', header: 'Name', accessor: r => r.name, sortable: true },
      { key: 'designation', header: 'Designation', accessor: r => r.designation },
      { key: 'department', header: 'Department', accessor: r => r.department },
      { key: 'phone', header: 'Phone', accessor: r => r.phone },
      { key: 'status', header: 'Status', render: statusBadge }
    ]
  },
  transporters: {
    key: 'transporters', table: 'transport_vendors', title: 'Transporter Master', singular: 'Transporter',
    icon: 'local_shipping', codeField: 'vendor_code', nameField: 'name', subField: 'contact_person',
    searchFields: ['name', 'vendor_code', 'phone'],
    fields: [
      { name: 'vendor_code', label: 'Transporter Code', type: 'text', required: true },
      { name: 'name', label: 'Transporter Name', type: 'text', required: true, span2: true },
      { name: 'contact_person', label: 'Contact Person', type: 'text' },
      { name: 'phone', label: 'Phone', type: 'text' },
      { name: 'email', label: 'Email', type: 'text' },
      { name: 'nid', label: 'NID', type: 'text' },
      { name: 'trade_license', label: 'Trade License', type: 'text' },
      { name: 'tin_vat', label: 'TIN / VAT', type: 'text' },
      { name: 'status', label: 'Status', type: 'select', options: STATUS, required: true }
    ],
    listColumns: [
      { key: 'vendor_code', header: 'Code', accessor: r => r.vendor_code, sortable: true, className: 'font-medium' },
      { key: 'name', header: 'Transporter', accessor: r => r.name, sortable: true },
      { key: 'contact_person', header: 'Contact', accessor: r => r.contact_person },
      { key: 'phone', header: 'Phone', accessor: r => r.phone },
      { key: 'status', header: 'Status', render: statusBadge }
    ]
  },
  drivers: {
    key: 'drivers', table: 'drivers', title: 'Driver Master', singular: 'Driver',
    icon: 'badge', codeField: 'driver_code', nameField: 'name', subField: 'phone', imageField: 'photo_url',
    searchFields: ['name', 'driver_code', 'phone', 'license_no'],
    fields: [
      { name: 'photo_url', label: 'Driver Photo', type: 'image' },
      { name: 'driver_code', label: 'Driver ID', type: 'text', required: true },
      { name: 'name', label: 'Name', type: 'text', required: true, span2: true },
      { name: 'phone', label: 'Phone', type: 'text' },
      { name: 'nid', label: 'NID', type: 'text' },
      { name: 'license_no', label: 'Driving License No', type: 'text' },
      { name: 'license_expiry', label: 'License Expiry', type: 'date' },
      { name: 'vehicle_id', label: 'Assigned Vehicle', type: 'select', relation: 'vehicles' },
      { name: 'status', label: 'Status', type: 'select', options: STATUS, required: true }
    ],
    listColumns: [
      { key: 'driver_code', header: 'ID', accessor: r => r.driver_code, sortable: true, className: 'font-medium' },
      { key: 'name', header: 'Driver', accessor: r => r.name, sortable: true },
      { key: 'phone', header: 'Phone', accessor: r => r.phone },
      { key: 'license_no', header: 'License', accessor: r => r.license_no },
      { key: 'status', header: 'Status', render: statusBadge }
    ]
  },
  vehicles: {
    key: 'vehicles', table: 'vehicles', title: 'Vehicle Master', singular: 'Vehicle',
    icon: 'directions_car', codeField: 'vehicle_number', nameField: 'vehicle_number', subField: 'vehicle_type', imageField: 'photo_url',
    searchFields: ['vehicle_number', 'vehicle_type', 'capacity'],
    fields: [
      { name: 'photo_url', label: 'Vehicle Photo', type: 'image' },
      { name: 'vehicle_number', label: 'Vehicle Number', type: 'text', required: true },
      { name: 'vehicle_type', label: 'Vehicle Type', type: 'select', options: ['Covered Van', 'Pickup', 'Truck', 'Mini Truck', 'Trailer', 'Van'] },
      { name: 'capacity', label: 'Capacity', type: 'text' },
      { name: 'vendor_id', label: 'Transporter', type: 'select', relation: 'transport_vendors' },
      { name: 'insurance_expiry', label: 'Insurance Expiry', type: 'date' },
      { name: 'fitness_expiry', label: 'Fitness Expiry', type: 'date' },
      { name: 'status', label: 'Status', type: 'select', options: STATUS, required: true }
    ],
    listColumns: [
      { key: 'vehicle_number', header: 'Vehicle No', accessor: r => r.vehicle_number, sortable: true, className: 'font-medium' },
      { key: 'vehicle_type', header: 'Type', accessor: r => r.vehicle_type },
      { key: 'capacity', header: 'Capacity', accessor: r => r.capacity },
      { key: 'status', header: 'Status', render: statusBadge }
    ]
  },
  warehouses: {
    key: 'warehouses', table: 'warehouses', title: 'Warehouse Master', singular: 'Warehouse',
    icon: 'warehouse', codeField: 'code', nameField: 'name', subField: 'manager_name',
    searchFields: ['name', 'code', 'manager_name'],
    fields: [
      { name: 'code', label: 'Warehouse Code', type: 'text', required: true },
      { name: 'name', label: 'Warehouse Name', type: 'text', required: true, span2: true },
      { name: 'warehouse_type', label: 'Warehouse Type', type: 'select', options: ['Distribution', 'Storage', 'Cold Storage', 'Cross-Dock', 'Returns'] },
      { name: 'manager_name', label: 'Warehouse Manager Name', type: 'text' },
      { name: 'manager_phone', label: 'Warehouse Manager Contact Number', type: 'text' },
      { name: 'contact_person', label: 'Contact Person Name', type: 'text' },
      { name: 'contact_phone', label: 'Contact Person Number', type: 'text' },
      { name: 'address', label: 'Address', type: 'textarea', span2: true },
      { name: 'total_area_sqft', label: 'Total Area (Sq. Ft.)', type: 'number' },
      { name: 'status', label: 'Status', type: 'select', options: STATUS, required: true }
    ],
    listColumns: [
      { key: 'code', header: 'Code', accessor: r => r.code, sortable: true, className: 'font-medium' },
      { key: 'name', header: 'Warehouse', accessor: r => r.name, sortable: true },
      { key: 'warehouse_type', header: 'Type', accessor: r => r.warehouse_type },
      { key: 'manager_name', header: 'Manager', accessor: r => r.manager_name },
      { key: 'total_area_sqft', header: 'Area (sqft)', accessor: r => r.total_area_sqft },
      { key: 'status', header: 'Status', render: statusBadge }
    ]
  },
  zones: {
    key: 'zones', table: 'zones', title: 'Zone Master', singular: 'Zone',
    icon: 'grid_view', codeField: 'code', nameField: 'name', subField: 'description',
    searchFields: ['code', 'name'],
    fields: [
      { name: 'warehouse_id', label: 'Warehouse', type: 'select', relation: 'warehouses', required: true },
      { name: 'code', label: 'Zone Code', type: 'text', required: true },
      { name: 'name', label: 'Zone Name', type: 'text', required: true, span2: true },
      { name: 'description', label: 'Description', type: 'textarea', span2: true },
      { name: 'status', label: 'Status', type: 'select', options: STATUS, required: true }
    ],
    listColumns: [
      { key: 'code', header: 'Code', accessor: r => r.code, sortable: true, className: 'font-medium' },
      { key: 'name', header: 'Zone', accessor: r => r.name, sortable: true },
      { key: 'status', header: 'Status', render: statusBadge }
    ]
  },
  locations: {
    key: 'locations', table: 'locations', title: 'Bin / Location Master', singular: 'Location',
    icon: 'pin_drop', codeField: 'location_code', nameField: 'location_code', subField: 'rack',
    searchFields: ['location_code', 'rack', 'bin'],
    fields: [
      { name: 'warehouse_id', label: 'Warehouse', type: 'select', relation: 'warehouses', required: true },
      { name: 'zone_id', label: 'Zone', type: 'select', relation: 'zones' },
      { name: 'rack', label: 'Rack', type: 'text' },
      { name: 'bin', label: 'Bin', type: 'text' },
      { name: 'location_code', label: 'Location Code', type: 'text', required: true },
      { name: 'capacity', label: 'Capacity', type: 'number' },
      { name: 'status', label: 'Status', type: 'select', options: STATUS, required: true }
    ],
    listColumns: [
      { key: 'location_code', header: 'Location Code', accessor: r => r.location_code, sortable: true, className: 'font-medium' },
      { key: 'rack', header: 'Rack', accessor: r => r.rack },
      { key: 'bin', header: 'Bin', accessor: r => r.bin },
      { key: 'capacity', header: 'Capacity', accessor: r => r.capacity },
      { key: 'status', header: 'Status', render: statusBadge }
    ]
  },
  'service-providers': {
    key: 'service-providers', table: 'service_providers', title: 'Service Provider Master', singular: 'Service Provider',
    icon: 'engineering', codeField: 'code', nameField: 'name', subField: 'service_type', imageField: 'logo_url',
    searchFields: ['name', 'code', 'service_type'],
    fields: [
      { name: 'logo_url', label: 'Logo', type: 'image' },
      { name: 'code', label: 'Provider Code', type: 'text', required: true },
      { name: 'name', label: 'Provider Name', type: 'text', required: true, span2: true },
      { name: 'service_type', label: 'Service Type', type: 'select', options: ['Repair & Warranty', 'Installation', 'Calibration', 'Transport', 'Cleaning', 'Other'] },
      { name: 'contact_person', label: 'Contact Person', type: 'text' },
      { name: 'phone', label: 'Phone', type: 'text' },
      { name: 'email', label: 'Email', type: 'text' },
      { name: 'address', label: 'Address', type: 'textarea', span2: true },
      { name: 'trade_license', label: 'Trade License', type: 'text' },
      { name: 'tin_vat', label: 'TIN / VAT', type: 'text' },
      { name: 'status', label: 'Status', type: 'select', options: STATUS, required: true }
    ],
    listColumns: [
      { key: 'code', header: 'Code', accessor: r => r.code, sortable: true, className: 'font-medium' },
      { key: 'name', header: 'Provider', accessor: r => r.name, sortable: true },
      { key: 'service_type', header: 'Service', accessor: r => r.service_type },
      { key: 'phone', header: 'Phone', accessor: r => r.phone },
      { key: 'status', header: 'Status', render: statusBadge }
    ]
  },
  assets: {
    key: 'assets', table: 'assets', title: 'Asset Master', singular: 'Asset',
    icon: 'category', codeField: 'asset_code', nameField: 'name', subField: 'category', imageField: 'image_url',
    searchFields: ['name', 'asset_code', 'serial_number'],
    fields: [
      { name: 'image_url', label: 'Asset Image', type: 'image' },
      { name: 'asset_code', label: 'Asset Code', type: 'text', required: true },
      { name: 'name', label: 'Asset Name', type: 'text', required: true, span2: true },
      { name: 'category', label: 'Asset Category', type: 'select', options: ['IT Equipment', 'Furniture', 'Tools', 'Safety Equipment', 'Warehouse Equipment', 'Office Asset', 'Vehicle'] },
      { name: 'serial_number', label: 'Serial Number', type: 'text' },
      { name: 'purchase_date', label: 'Purchase Date', type: 'date' },
      { name: 'purchase_cost', label: 'Purchase Cost', type: 'number' },
      { name: 'assigned_to', label: 'Assigned To', type: 'text' },
      { name: 'location', label: 'Location', type: 'text' },
      { name: 'status', label: 'Status', type: 'select', options: ['active', 'in_use', 'maintenance', 'disposed', 'inactive'], required: true }
    ],
    listColumns: [
      { key: 'asset_code', header: 'Code', accessor: r => r.asset_code, sortable: true, className: 'font-medium' },
      { key: 'name', header: 'Asset', accessor: r => r.name, sortable: true },
      { key: 'category', header: 'Category', accessor: r => r.category },
      { key: 'assigned_to', header: 'Assigned To', accessor: r => r.assigned_to },
      { key: 'status', header: 'Status', render: statusBadge }
    ]
  },
  'non-inventory': {
    key: 'non-inventory', table: 'non_inventory_items', title: 'Non-Inventory Master', singular: 'Non-Inventory Item',
    icon: 'shopping_basket', codeField: 'item_code', nameField: 'name', subField: 'category', imageField: 'image_url',
    searchFields: ['name', 'item_code'],
    fields: [
      { name: 'image_url', label: 'Item Image', type: 'image' },
      { name: 'item_code', label: 'Item Code', type: 'text', required: true },
      { name: 'name', label: 'Item Name', type: 'text', required: true, span2: true },
      { name: 'category', label: 'Category', type: 'select', options: ['Consumables', 'Stationery', 'Cleaning Materials', 'Safety Equipment', 'Tools', 'Other'] },
      { name: 'unit', label: 'Unit', type: 'select', options: UOM, required: true },
      { name: 'reorder_level', label: 'Reorder Level', type: 'number' },
      { name: 'current_qty', label: 'Current Qty', type: 'number' },
      { name: 'storage_location', label: 'Storage Location', type: 'text' },
      { name: 'status', label: 'Status', type: 'select', options: STATUS, required: true }
    ],
    listColumns: [
      { key: 'item_code', header: 'Code', accessor: r => r.item_code, sortable: true, className: 'font-medium' },
      { key: 'name', header: 'Item', accessor: r => r.name, sortable: true },
      { key: 'category', header: 'Category', accessor: r => r.category },
      { key: 'current_qty', header: 'Qty', accessor: r => r.current_qty },
      { key: 'status', header: 'Status', render: statusBadge }
    ]
  }
}

export const MASTER_ORDER = [
  'products', 'customers', 'suppliers', 'employees', 'transporters', 'drivers', 'vehicles',
  'warehouses', 'zones', 'locations', 'service-providers', 'assets', 'non-inventory'
]
