export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      assets: {
        Row: {
          asset_code: string; assigned_to: string | null; category: string | null; client_id: string
          created_at: string; id: string; image_url: string | null; location: string | null; name: string
          purchase_cost: number | null; purchase_date: string | null; serial_number: string | null
          status: string; updated_at: string; warehouse_id: string | null
        }
        Insert: Partial<Database['public']['Tables']['assets']['Row']> & { asset_code: string; client_id: string; name: string }
        Update: Partial<Database['public']['Tables']['assets']['Row']>
        Relationships: []
      }
      goods_receipts: {
        Row: {
          id: string; client_id: string; grn_no: string; supplier_id: string | null; warehouse_id: string | null
          reference_no: string | null; receipt_date: string; total_items: number; total_qty: number
          sap_grn_ref: string | null; sap_miro_ref: string | null
          gate_vehicle_no: string | null; gate_driver: string | null; gate_transporter: string | null; gate_in_at: string | null; billable: boolean
          status: string; remarks: string | null; posted_at: string | null; created_by: string | null; created_at: string; updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['goods_receipts']['Row']> & { client_id: string; grn_no: string }
        Update: Partial<Database['public']['Tables']['goods_receipts']['Row']>
        Relationships: []
      }
      goods_receipt_items: {
        Row: {
          id: string; client_id: string; grn_id: string; product_id: string | null; qty: number
          expected_qty: number; received_qty: number
          unit_price: number; stock_status: string; location_id: string | null; created_at: string; updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['goods_receipt_items']['Row']> & { client_id: string; grn_id: string }
        Update: Partial<Database['public']['Tables']['goods_receipt_items']['Row']>
        Relationships: []
      }
      purchase_requisitions: {
        Row: {
          id: string; client_id: string; pr_no: string; supplier_id: string | null; warehouse_id: string | null
          order_date: string; expected_date: string | null; total_qty: number; total_amount: number
          status: string; remarks: string | null; created_by: string | null; created_at: string; updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['purchase_requisitions']['Row']> & { client_id: string; pr_no: string }
        Update: Partial<Database['public']['Tables']['purchase_requisitions']['Row']>
        Relationships: []
      }
      purchase_requisition_items: {
        Row: {
          id: string; client_id: string; pr_id: string; product_id: string | null; qty: number
          unit_price: number; line_total: number; created_at: string; updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['purchase_requisition_items']['Row']> & { client_id: string; pr_id: string }
        Update: Partial<Database['public']['Tables']['purchase_requisition_items']['Row']>
        Relationships: []
      }
      purchase_returns: {
        Row: {
          id: string; client_id: string; return_no: string; supplier_id: string | null; warehouse_id: string | null
          grn_id: string | null; return_date: string; total_qty: number; reason: string | null
          status: string; remarks: string | null; created_by: string | null; created_at: string; updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['purchase_returns']['Row']> & { client_id: string; return_no: string }
        Update: Partial<Database['public']['Tables']['purchase_returns']['Row']>
        Relationships: []
      }
      supplier_invoices: {
        Row: {
          id: string; client_id: string; doc_no: string; supplier_invoice_no: string | null; supplier_id: string | null
          grn_id: string | null; invoice_date: string; due_date: string | null; amount: number; tax: number; total: number
          status: string; remarks: string | null; created_by: string | null; created_at: string; updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['supplier_invoices']['Row']> & { client_id: string; doc_no: string }
        Update: Partial<Database['public']['Tables']['supplier_invoices']['Row']>
        Relationships: []
      }
      putaway_tasks: {
        Row: {
          id: string; client_id: string; task_no: string; grn_id: string | null; warehouse_id: string | null
          location_id: string | null; total_qty: number; assigned_to: string | null
          status: string; remarks: string | null; created_by: string | null; created_at: string; updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['putaway_tasks']['Row']> & { client_id: string; task_no: string }
        Update: Partial<Database['public']['Tables']['putaway_tasks']['Row']>
        Relationships: []
      }
      pick_lists: {
        Row: {
          id: string; client_id: string; pick_no: string; customer_id: string | null; warehouse_id: string | null
          reference_no: string | null; total_qty: number; assigned_to: string | null
          status: string; remarks: string | null; created_by: string | null; created_at: string; updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['pick_lists']['Row']> & { client_id: string; pick_no: string }
        Update: Partial<Database['public']['Tables']['pick_lists']['Row']>
        Relationships: []
      }
      dispatches: {
        Row: {
          id: string; client_id: string; dispatch_no: string; customer_id: string | null; warehouse_id: string | null
          pick_list_id: string | null; vehicle_id: string | null; sales_order_id: string | null; dispatch_date: string; total_qty: number
          status: string; remarks: string | null; posted_at: string | null; created_by: string | null; created_at: string; updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['dispatches']['Row']> & { client_id: string; dispatch_no: string }
        Update: Partial<Database['public']['Tables']['dispatches']['Row']>
        Relationships: []
      }
      dispatch_items: {
        Row: {
          id: string; client_id: string; dispatch_id: string; product_id: string | null; qty: number
          unit_price: number; stock_status: string; location_id: string | null; created_at: string; updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['dispatch_items']['Row']> & { client_id: string; dispatch_id: string }
        Update: Partial<Database['public']['Tables']['dispatch_items']['Row']>
        Relationships: []
      }
      sales_orders: {
        Row: {
          id: string; client_id: string; so_no: string; customer_id: string | null; warehouse_id: string | null
          reference_no: string | null; order_date: string; required_date: string | null; total_qty: number; total_amount: number
          invoice_no: string | null
          ship_to_id: string | null; ship_to_address: string | null
          sap_so_no: string | null; outbound_delivery_no: string | null; transfer_order_no: string | null; billing_doc_no: string | null
          deposited_amount: number; deposited_date: string | null; payment_status: string; mail_ref: string | null
          assigned_to: string | null
          approved_by: string | null; approved_at: string | null
          rejected_by: string | null; rejected_at: string | null; rejection_reason: string | null
          status: string; remarks: string | null; created_by: string | null; created_at: string; updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['sales_orders']['Row']> & { client_id: string; so_no: string }
        Update: Partial<Database['public']['Tables']['sales_orders']['Row']>
        Relationships: []
      }
      sales_order_items: {
        Row: {
          id: string; client_id: string; so_id: string; product_id: string | null; qty: number
          unit_price: number; line_total: number; delivered_qty: number
          basic_price: number; vat_rate: number; remarks: string | null
          created_at: string; updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['sales_order_items']['Row']> & { client_id: string; so_id: string }
        Update: Partial<Database['public']['Tables']['sales_order_items']['Row']>
        Relationships: []
      }
      packing_tasks: {
        Row: {
          id: string; client_id: string; pack_no: string; sales_order_id: string | null; customer_id: string | null
          warehouse_id: string | null; total_packages: number; total_qty: number
          status: string; remarks: string | null; created_by: string | null; created_at: string; updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['packing_tasks']['Row']> & { client_id: string; pack_no: string }
        Update: Partial<Database['public']['Tables']['packing_tasks']['Row']>
        Relationships: []
      }
      delivery_challans: {
        Row: {
          id: string; client_id: string; challan_no: string; customer_id: string | null; dispatch_id: string | null
          vehicle_id: string | null; warehouse_id: string | null; driver_name: string | null; invoice_no: string | null
          sales_order_id: string | null; po_no: string | null; dispatch_time: string | null; lock_no: string | null; driver_phone: string | null; transport_vendor: string | null; prepared_by: string | null; receiver_name: string | null; receiver_phone: string | null; unloading_point: string | null; bill_to_address: string | null
          delivery_method: string | null; transporter_id: string | null; driver_id: string | null; courier_name: string | null; courier_tracking_no: string | null
          challan_date: string; total_qty: number; posted_at: string | null
          status: string; remarks: string | null; created_by: string | null; created_at: string; updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['delivery_challans']['Row']> & { client_id: string; challan_no: string }
        Update: Partial<Database['public']['Tables']['delivery_challans']['Row']>
        Relationships: []
      }
      delivery_challan_items: {
        Row: {
          id: string; client_id: string; challan_id: string; product_id: string | null; qty: number
          unit_price: number; stock_status: string; location_id: string | null; so_item_id: string | null; remarks: string | null; serial_no: string | null; created_at: string; updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['delivery_challan_items']['Row']> & { client_id: string; challan_id: string }
        Update: Partial<Database['public']['Tables']['delivery_challan_items']['Row']>
        Relationships: []
      }
      gate_passes: {
        Row: {
          id: string; client_id: string; gate_pass_no: string; dispatch_id: string | null; challan_id: string | null; vehicle_id: string | null
          driver_name: string | null; gate_out_date: string; gate_in_time: string | null; gate_out_time: string | null; transporter_id: string | null; purpose: string | null
          loaded_serial_count: number
          status: string; remarks: string | null; created_by: string | null; created_at: string; updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['gate_passes']['Row']> & { client_id: string; gate_pass_no: string }
        Update: Partial<Database['public']['Tables']['gate_passes']['Row']>
        Relationships: []
      }
      proof_of_delivery: {
        Row: {
          id: string; client_id: string; pod_no: string; dispatch_id: string | null; challan_id: string | null; customer_id: string | null
          delivery_date: string; received_by: string | null; pod_url: string | null
          status: string; remarks: string | null; created_by: string | null; created_at: string; updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['proof_of_delivery']['Row']> & { client_id: string; pod_no: string }
        Update: Partial<Database['public']['Tables']['proof_of_delivery']['Row']>
        Relationships: []
      }
      transport_requests: {
        Row: {
          id: string; client_id: string; request_no: string; transport_vendor_id: string | null; vehicle_id: string | null
          origin: string | null; destination: string | null; request_date: string; required_date: string | null
          status: string; remarks: string | null; created_by: string | null; created_at: string; updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['transport_requests']['Row']> & { client_id: string; request_no: string }
        Update: Partial<Database['public']['Tables']['transport_requests']['Row']>
        Relationships: []
      }
      billing_invoices: {
        Row: {
          id: string; client_id: string; invoice_no: string; customer_id: string | null; reference_no: string | null
          invoice_date: string; due_date: string | null; amount: number; tax: number; total: number
          status: string; remarks: string | null; created_by: string | null; created_at: string; updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['billing_invoices']['Row']> & { client_id: string; invoice_no: string }
        Update: Partial<Database['public']['Tables']['billing_invoices']['Row']>
        Relationships: []
      }
      attachments: {
        Row: {
          client_id: string; created_at: string; drive_file_id: string | null; drive_url: string | null
          entity_id: string; entity_type: string; file_name: string; file_size: number | null
          file_type: string | null; id: string; source: string; storage_path: string | null; uploaded_by: string | null
        }
        Insert: Partial<Database['public']['Tables']['attachments']['Row']> & { client_id: string; entity_id: string; entity_type: string; file_name: string }
        Update: Partial<Database['public']['Tables']['attachments']['Row']>
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string; changed_at: string; changed_by: string | null; client_id: string | null
          id: number; new_data: Json | null; old_data: Json | null; record_id: string | null; table_name: string
        }
        Insert: Partial<Database['public']['Tables']['audit_logs']['Row']>
        Update: Partial<Database['public']['Tables']['audit_logs']['Row']>
        Relationships: []
      }
      clients: {
        Row: {
          code: string; created_at: string; doc_prefix: string; id: string; is_internal: boolean
          legal_name: string | null; logo_url: string | null; name: string; primary_color: string | null
          status: string; updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['clients']['Row']> & { code: string; doc_prefix: string; name: string }
        Update: Partial<Database['public']['Tables']['clients']['Row']>
        Relationships: []
      }
      customer_addresses: {
        Row: {
          address: string; address_type: string | null; client_id: string; customer_id: string
          id: string; is_default: boolean; label: string | null
        }
        Insert: Partial<Database['public']['Tables']['customer_addresses']['Row']> & { address: string; client_id: string; customer_id: string }
        Update: Partial<Database['public']['Tables']['customer_addresses']['Row']>
        Relationships: []
      }
      customers: {
        Row: {
          billing_address: string | null; client_id: string; contact_person: string | null; created_at: string
          created_by: string | null; customer_code: string; email: string | null; id: string; logo_url: string | null
          name: string; phone: string | null; shipping_address: string | null; status: string; updated_at: string
          sap_customer_code: string | null; credit_limit: number | null; payment_terms: string | null
        }
        Insert: Partial<Database['public']['Tables']['customers']['Row']> & { client_id: string; customer_code: string; name: string }
        Update: Partial<Database['public']['Tables']['customers']['Row']>
        Relationships: []
      }
      document_sequences: {
        Row: {
          client_id: string; doc_type: string; id: string; next_number: number; padding: number
          prefix: string; last_date: string
        }
        Insert: Partial<Database['public']['Tables']['document_sequences']['Row']> & { client_id: string; doc_type: string; prefix: string }
        Update: Partial<Database['public']['Tables']['document_sequences']['Row']>
        Relationships: []
      }
      inventory_ledger: {
        Row: {
          balance_after: number; client_id: string; created_at: string; created_by: string | null; id: number
          location_id: string | null; movement_type: string; product_id: string; qty_in: number; qty_out: number
          reference_id: string | null; reference_no: string | null; reference_type: string | null
          remarks: string | null; serial_no: string | null; stock_status: string; warehouse_id: string
        }
        Insert: Partial<Database['public']['Tables']['inventory_ledger']['Row']>
        Update: Partial<Database['public']['Tables']['inventory_ledger']['Row']>
        Relationships: []
      }
      inventory_snapshots: {
        Row: {
          client_id: string; created_at: string; id: string; product_id: string; quantity: number
          snapshot_date: string; stock_status: string; warehouse_id: string
        }
        Insert: Partial<Database['public']['Tables']['inventory_snapshots']['Row']> & { client_id: string; product_id: string; warehouse_id: string }
        Update: Partial<Database['public']['Tables']['inventory_snapshots']['Row']>
        Relationships: []
      }
      inventory_stock: {
        Row: {
          client_id: string; id: string; location_id: string | null; product_id: string; quantity: number
          reserved_qty: number; stock_status: string; updated_at: string; warehouse_id: string
        }
        Insert: Partial<Database['public']['Tables']['inventory_stock']['Row']> & { client_id: string; product_id: string; warehouse_id: string }
        Update: Partial<Database['public']['Tables']['inventory_stock']['Row']>
        Relationships: []
      }
      locations: {
        Row: {
          bin: string | null; capacity: number | null; client_id: string; created_at: string; id: string
          location_code: string; rack: string | null; status: string; warehouse_id: string; zone: string | null
        }
        Insert: Partial<Database['public']['Tables']['locations']['Row']> & { client_id: string; location_code: string; warehouse_id: string }
        Update: Partial<Database['public']['Tables']['locations']['Row']>
        Relationships: []
      }
      non_inventory_items: {
        Row: {
          category: string | null; client_id: string; created_at: string; current_qty: number; id: string
          image_url: string | null; item_code: string; name: string; reorder_level: number; status: string
          storage_location: string | null; unit: string; updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['non_inventory_items']['Row']> & { client_id: string; item_code: string; name: string }
        Update: Partial<Database['public']['Tables']['non_inventory_items']['Row']>
        Relationships: []
      }
      notes: {
        Row: {
          body: string; client_id: string; created_at: string; created_by: string | null
          entity_id: string; entity_type: string; id: string
        }
        Insert: Partial<Database['public']['Tables']['notes']['Row']> & { body: string; client_id: string; entity_id: string; entity_type: string }
        Update: Partial<Database['public']['Tables']['notes']['Row']>
        Relationships: []
      }
      permissions: {
        Row: { action: string; description: string | null; id: string; key: string; module: string }
        Insert: Partial<Database['public']['Tables']['permissions']['Row']> & { action: string; key: string; module: string }
        Update: Partial<Database['public']['Tables']['permissions']['Row']>
        Relationships: []
      }
      products: {
        Row: {
          barcode: string | null; brand: string | null; category: string | null; client_id: string
          created_at: string; created_by: string | null; id: string; image_url: string | null
          material_code: string; name: string; restock_level: number; sap_reference_code: string | null
          serial_tracking: boolean; status: string; uom: string; updated_at: string
          warranty_applicable: boolean; warranty_months: number | null; weight: number | null
        }
        Insert: Partial<Database['public']['Tables']['products']['Row']> & { client_id: string; material_code: string; name: string }
        Update: Partial<Database['public']['Tables']['products']['Row']>
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null; created_at: string; email: string | null; full_name: string | null
          id: string; is_platform_admin: boolean; phone: string | null; status: string; updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['profiles']['Row']> & { id: string }
        Update: Partial<Database['public']['Tables']['profiles']['Row']>
        Relationships: []
      }
      role_permissions: {
        Row: { permission_id: string; role_id: string }
        Insert: { permission_id: string; role_id: string }
        Update: Partial<{ permission_id: string; role_id: string }>
        Relationships: []
      }
      roles: {
        Row: { created_at: string; description: string | null; id: string; is_system: boolean; key: string; name: string }
        Insert: Partial<Database['public']['Tables']['roles']['Row']> & { key: string; name: string }
        Update: Partial<Database['public']['Tables']['roles']['Row']>
        Relationships: []
      }
      serial_numbers: {
        Row: {
          client_id: string; created_at: string; id: string; location_id: string | null; product_id: string
          reference_no: string | null; serial_no: string; status: string; updated_at: string
          warehouse_id: string | null; warranty_end: string | null; warranty_start: string | null
          so_item_id: string | null; gate_pass_id: string | null
        }
        Insert: Partial<Database['public']['Tables']['serial_numbers']['Row']> & { client_id: string; product_id: string; serial_no: string }
        Update: Partial<Database['public']['Tables']['serial_numbers']['Row']>
        Relationships: []
      }
      suppliers: {
        Row: {
          address: string | null; client_id: string; contact_person: string | null; created_at: string
          created_by: string | null; email: string | null; id: string; logo_url: string | null; name: string
          phone: string | null; status: string; supplier_code: string; tin_vat: string | null
          trade_license: string | null; updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['suppliers']['Row']> & { client_id: string; supplier_code: string; name: string }
        Update: Partial<Database['public']['Tables']['suppliers']['Row']>
        Relationships: []
      }
      transport_vendors: {
        Row: {
          client_id: string; contact_person: string | null; created_at: string; created_by: string | null
          email: string | null; id: string; name: string; nid: string | null; phone: string | null
          status: string; tin_vat: string | null; trade_license: string | null; updated_at: string; vendor_code: string
        }
        Insert: Partial<Database['public']['Tables']['transport_vendors']['Row']> & { client_id: string; vendor_code: string; name: string }
        Update: Partial<Database['public']['Tables']['transport_vendors']['Row']>
        Relationships: []
      }
      user_clients: {
        Row: { client_id: string; created_at: string; is_default: boolean; user_id: string }
        Insert: Partial<Database['public']['Tables']['user_clients']['Row']> & { client_id: string; user_id: string }
        Update: Partial<Database['public']['Tables']['user_clients']['Row']>
        Relationships: []
      }
      user_roles: {
        Row: { client_id: string | null; created_at: string; id: string; role_id: string; user_id: string }
        Insert: Partial<Database['public']['Tables']['user_roles']['Row']> & { role_id: string; user_id: string }
        Update: Partial<Database['public']['Tables']['user_roles']['Row']>
        Relationships: []
      }
      vehicles: {
        Row: {
          capacity: string | null; client_id: string; created_at: string; driver_name: string | null
          driver_phone: string | null; fitness_expiry: string | null; id: string; insurance_expiry: string | null
          license_expiry: string | null; license_number: string | null; status: string; vehicle_number: string
          vehicle_type: string | null; vendor_id: string
        }
        Insert: Partial<Database['public']['Tables']['vehicles']['Row']> & { client_id: string; vehicle_number: string; vendor_id: string }
        Update: Partial<Database['public']['Tables']['vehicles']['Row']>
        Relationships: []
      }
      warehouses: {
        Row: {
          address: string | null; client_id: string; code: string; contact_person: string | null
          contact_phone: string | null; created_at: string; id: string; manager_name: string | null
          manager_phone: string | null; name: string; status: string; total_area_sqft: number | null
          updated_at: string; warehouse_type: string | null
        }
        Insert: Partial<Database['public']['Tables']['warehouses']['Row']> & { client_id: string; code: string; name: string }
        Update: Partial<Database['public']['Tables']['warehouses']['Row']>
        Relationships: []
      }
      app_settings: {
        Row: {
          id: string; client_id: string; category: string; data: Json
          created_at: string; updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['app_settings']['Row']> & { client_id: string; category: string }
        Update: Partial<Database['public']['Tables']['app_settings']['Row']>
        Relationships: []
      }
      document_templates: {
        Row: {
          id: string; client_id: string; channel: string; code: string; name: string
          subject: string | null; body: string; is_active: boolean
          created_at: string; updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['document_templates']['Row']> & { client_id: string; channel: string; code: string; name: string }
        Update: Partial<Database['public']['Tables']['document_templates']['Row']>
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

type PublicSchema = Database['public']
export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row']
export type TablesInsert<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Update']
