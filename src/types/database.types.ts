export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          category: string
          client_id: string
          created_at: string
          data: Json
          id: string
          updated_at: string
        }
        Insert: {
          category: string
          client_id: string
          created_at?: string
          data?: Json
          id?: string
          updated_at?: string
        }
        Update: {
          category?: string
          client_id?: string
          created_at?: string
          data?: Json
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_allocations: {
        Row: {
          allocation_date: string | null
          asset_id: string | null
          client_id: string
          created_at: string
          created_by: string | null
          department: string | null
          doc_no: string | null
          employee_id: string | null
          expected_return_date: string | null
          id: string
          remarks: string | null
          status: string
          updated_at: string
        }
        Insert: {
          allocation_date?: string | null
          asset_id?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          department?: string | null
          doc_no?: string | null
          employee_id?: string | null
          expected_return_date?: string | null
          id?: string
          remarks?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          allocation_date?: string | null
          asset_id?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          department?: string | null
          doc_no?: string | null
          employee_id?: string | null
          expected_return_date?: string | null
          id?: string
          remarks?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_allocations_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_allocations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_allocations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_disposals: {
        Row: {
          asset_id: string | null
          client_id: string
          created_at: string
          created_by: string | null
          disposal_date: string | null
          disposal_value: number | null
          doc_no: string | null
          id: string
          method: string | null
          reason: string | null
          remarks: string | null
          status: string
          updated_at: string
        }
        Insert: {
          asset_id?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          disposal_date?: string | null
          disposal_value?: number | null
          doc_no?: string | null
          id?: string
          method?: string | null
          reason?: string | null
          remarks?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          asset_id?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          disposal_date?: string | null
          disposal_value?: number | null
          doc_no?: string | null
          id?: string
          method?: string | null
          reason?: string | null
          remarks?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_disposals_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_disposals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_maintenance: {
        Row: {
          asset_id: string | null
          client_id: string
          cost: number | null
          created_at: string
          created_by: string | null
          doc_no: string | null
          id: string
          maintenance_date: string | null
          maintenance_type: string | null
          next_due_date: string | null
          remarks: string | null
          status: string
          updated_at: string
          vendor: string | null
        }
        Insert: {
          asset_id?: string | null
          client_id: string
          cost?: number | null
          created_at?: string
          created_by?: string | null
          doc_no?: string | null
          id?: string
          maintenance_date?: string | null
          maintenance_type?: string | null
          next_due_date?: string | null
          remarks?: string | null
          status?: string
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          asset_id?: string | null
          client_id?: string
          cost?: number | null
          created_at?: string
          created_by?: string | null
          doc_no?: string | null
          id?: string
          maintenance_date?: string | null
          maintenance_type?: string | null
          next_due_date?: string | null
          remarks?: string | null
          status?: string
          updated_at?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_maintenance_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_maintenance_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_transfers: {
        Row: {
          asset_id: string | null
          client_id: string
          created_at: string
          created_by: string | null
          doc_no: string | null
          from_location: string | null
          id: string
          remarks: string | null
          status: string
          to_location: string | null
          to_warehouse_id: string | null
          transfer_date: string | null
          updated_at: string
        }
        Insert: {
          asset_id?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          doc_no?: string | null
          from_location?: string | null
          id?: string
          remarks?: string | null
          status?: string
          to_location?: string | null
          to_warehouse_id?: string | null
          transfer_date?: string | null
          updated_at?: string
        }
        Update: {
          asset_id?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          doc_no?: string | null
          from_location?: string | null
          id?: string
          remarks?: string | null
          status?: string
          to_location?: string | null
          to_warehouse_id?: string | null
          transfer_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_transfers_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_transfers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_transfers_to_warehouse_id_fkey"
            columns: ["to_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          asset_code: string
          assigned_to: string | null
          category: string | null
          client_id: string
          created_at: string
          id: string
          image_url: string | null
          location: string | null
          name: string
          purchase_cost: number | null
          purchase_date: string | null
          serial_number: string | null
          status: string
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          asset_code: string
          assigned_to?: string | null
          category?: string | null
          client_id: string
          created_at?: string
          id?: string
          image_url?: string | null
          location?: string | null
          name: string
          purchase_cost?: number | null
          purchase_date?: string | null
          serial_number?: string | null
          status?: string
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          asset_code?: string
          assigned_to?: string | null
          category?: string | null
          client_id?: string
          created_at?: string
          id?: string
          image_url?: string | null
          location?: string | null
          name?: string
          purchase_cost?: number | null
          purchase_date?: string | null
          serial_number?: string | null
          status?: string
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          client_id: string
          created_at: string
          drive_file_id: string | null
          drive_url: string | null
          entity_id: string
          entity_type: string
          file_name: string
          file_size: number | null
          file_type: string | null
          id: string
          source: string
          storage_path: string | null
          uploaded_by: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          drive_file_id?: string | null
          drive_url?: string | null
          entity_id: string
          entity_type: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          source?: string
          storage_path?: string | null
          uploaded_by?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          drive_file_id?: string | null
          drive_url?: string | null
          entity_id?: string
          entity_type?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          source?: string
          storage_path?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attachments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          client_id: string | null
          id: number
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          client_id?: string | null
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          client_id?: string | null
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_invoices: {
        Row: {
          amount: number
          client_id: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          due_date: string | null
          id: string
          invoice_date: string
          invoice_no: string
          reference_no: string | null
          remarks: string | null
          status: string
          tax: number
          total: number
          updated_at: string
        }
        Insert: {
          amount?: number
          client_id: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_no: string
          reference_no?: string | null
          remarks?: string | null
          status?: string
          tax?: number
          total?: number
          updated_at?: string
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_no?: string
          reference_no?: string | null
          remarks?: string | null
          status?: string
          tax?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          code: string
          created_at: string
          doc_prefix: string
          id: string
          is_internal: boolean
          legal_name: string | null
          logo_url: string | null
          name: string
          primary_color: string | null
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          doc_prefix: string
          id?: string
          is_internal?: boolean
          legal_name?: string | null
          logo_url?: string | null
          name: string
          primary_color?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          doc_prefix?: string
          id?: string
          is_internal?: boolean
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          primary_color?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      courier_rates: {
        Row: {
          category: string
          client_id: string
          courier_id: string
          created_at: string
          id: string
          rate: number
          updated_at: string
        }
        Insert: {
          category: string
          client_id: string
          courier_id: string
          created_at?: string
          id?: string
          rate?: number
          updated_at?: string
        }
        Update: {
          category?: string
          client_id?: string
          courier_id?: string
          created_at?: string
          id?: string
          rate?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courier_rates_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_rates_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_shipments: {
        Row: {
          charge: number | null
          client_id: string
          courier_id: string | null
          created_at: string
          created_by: string | null
          dispatch_date: string
          id: string
          remarks: string | null
          shipment_no: string
          so_id: string | null
          status: string
          tracking_no: string | null
          updated_at: string
        }
        Insert: {
          charge?: number | null
          client_id: string
          courier_id?: string | null
          created_at?: string
          created_by?: string | null
          dispatch_date?: string
          id?: string
          remarks?: string | null
          shipment_no: string
          so_id?: string | null
          status?: string
          tracking_no?: string | null
          updated_at?: string
        }
        Update: {
          charge?: number | null
          client_id?: string
          courier_id?: string | null
          created_at?: string
          created_by?: string | null
          dispatch_date?: string
          id?: string
          remarks?: string | null
          shipment_no?: string
          so_id?: string | null
          status?: string
          tracking_no?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courier_shipments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_shipments_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_shipments_so_id_fkey"
            columns: ["so_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      couriers: {
        Row: {
          client_id: string
          contact_person: string | null
          courier_code: string
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          rate_per_unit: number
          status: string
          tracking_url: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          contact_person?: string | null
          courier_code: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          rate_per_unit?: number
          status?: string
          tracking_url?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          contact_person?: string | null
          courier_code?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          rate_per_unit?: number
          status?: string
          tracking_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "couriers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_addresses: {
        Row: {
          address: string
          address_type: string | null
          client_id: string
          customer_id: string
          id: string
          is_default: boolean
          label: string | null
        }
        Insert: {
          address: string
          address_type?: string | null
          client_id: string
          customer_id: string
          id?: string
          is_default?: boolean
          label?: string | null
        }
        Update: {
          address?: string
          address_type?: string | null
          client_id?: string
          customer_id?: string
          id?: string
          is_default?: boolean
          label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_addresses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          billing_address: string | null
          client_id: string
          contact_person: string | null
          created_at: string
          created_by: string | null
          credit_limit: number | null
          customer_code: string
          email: string | null
          id: string
          logo_url: string | null
          name: string
          payment_terms: string | null
          phone: string | null
          sap_customer_code: string | null
          shipping_address: string | null
          status: string
          updated_at: string
        }
        Insert: {
          billing_address?: string | null
          client_id: string
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit?: number | null
          customer_code: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name: string
          payment_terms?: string | null
          phone?: string | null
          sap_customer_code?: string | null
          shipping_address?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          billing_address?: string | null
          client_id?: string
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit?: number | null
          customer_code?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          payment_terms?: string | null
          phone?: string | null
          sap_customer_code?: string | null
          shipping_address?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_challan_items: {
        Row: {
          challan_id: string
          client_id: string
          created_at: string
          id: string
          location_id: string | null
          product_id: string | null
          qty: number
          remarks: string | null
          serial_no: string | null
          so_item_id: string | null
          stock_status: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          challan_id: string
          client_id: string
          created_at?: string
          id?: string
          location_id?: string | null
          product_id?: string | null
          qty?: number
          remarks?: string | null
          serial_no?: string | null
          so_item_id?: string | null
          stock_status?: string
          unit_price?: number
          updated_at?: string
        }
        Update: {
          challan_id?: string
          client_id?: string
          created_at?: string
          id?: string
          location_id?: string | null
          product_id?: string | null
          qty?: number
          remarks?: string | null
          serial_no?: string | null
          so_item_id?: string | null
          stock_status?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_challan_items_challan_id_fkey"
            columns: ["challan_id"]
            isOneToOne: false
            referencedRelation: "delivery_challans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_challan_items_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_challan_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_challan_items_so_item_id_fkey"
            columns: ["so_item_id"]
            isOneToOne: false
            referencedRelation: "sales_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_challans: {
        Row: {
          bill_to_address: string | null
          challan_date: string
          challan_no: string
          client_id: string
          courier_id: string | null
          courier_name: string | null
          courier_tracking_no: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          delivery_cost: number | null
          delivery_method: string | null
          dispatch_id: string | null
          dispatch_time: string | null
          driver_id: string | null
          driver_name: string | null
          driver_phone: string | null
          id: string
          invoice_no: string | null
          lock_no: string | null
          po_no: string | null
          posted_at: string | null
          prepared_by: string | null
          receiver_name: string | null
          receiver_phone: string | null
          remarks: string | null
          sales_order_id: string | null
          status: string
          total_qty: number
          transport_vendor: string | null
          transporter_id: string | null
          unloading_point: string | null
          updated_at: string
          vehicle_id: string | null
          warehouse_id: string | null
        }
        Insert: {
          bill_to_address?: string | null
          challan_date?: string
          challan_no: string
          client_id: string
          courier_id?: string | null
          courier_name?: string | null
          courier_tracking_no?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          delivery_cost?: number | null
          delivery_method?: string | null
          dispatch_id?: string | null
          dispatch_time?: string | null
          driver_id?: string | null
          driver_name?: string | null
          driver_phone?: string | null
          id?: string
          invoice_no?: string | null
          lock_no?: string | null
          po_no?: string | null
          posted_at?: string | null
          prepared_by?: string | null
          receiver_name?: string | null
          receiver_phone?: string | null
          remarks?: string | null
          sales_order_id?: string | null
          status?: string
          total_qty?: number
          transport_vendor?: string | null
          transporter_id?: string | null
          unloading_point?: string | null
          updated_at?: string
          vehicle_id?: string | null
          warehouse_id?: string | null
        }
        Update: {
          bill_to_address?: string | null
          challan_date?: string
          challan_no?: string
          client_id?: string
          courier_id?: string | null
          courier_name?: string | null
          courier_tracking_no?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          delivery_cost?: number | null
          delivery_method?: string | null
          dispatch_id?: string | null
          dispatch_time?: string | null
          driver_id?: string | null
          driver_name?: string | null
          driver_phone?: string | null
          id?: string
          invoice_no?: string | null
          lock_no?: string | null
          po_no?: string | null
          posted_at?: string | null
          prepared_by?: string | null
          receiver_name?: string | null
          receiver_phone?: string | null
          remarks?: string | null
          sales_order_id?: string | null
          status?: string
          total_qty?: number
          transport_vendor?: string | null
          transporter_id?: string | null
          unloading_point?: string | null
          updated_at?: string
          vehicle_id?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_challans_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_challans_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_challans_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_challans_dispatch_id_fkey"
            columns: ["dispatch_id"]
            isOneToOne: false
            referencedRelation: "dispatches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_challans_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_challans_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_challans_transporter_id_fkey"
            columns: ["transporter_id"]
            isOneToOne: false
            referencedRelation: "transport_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_challans_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_challans_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatch_items: {
        Row: {
          client_id: string
          created_at: string
          dispatch_id: string
          id: string
          location_id: string | null
          product_id: string | null
          qty: number
          stock_status: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          dispatch_id: string
          id?: string
          location_id?: string | null
          product_id?: string | null
          qty?: number
          stock_status?: string
          unit_price?: number
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          dispatch_id?: string
          id?: string
          location_id?: string | null
          product_id?: string | null
          qty?: number
          stock_status?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_items_dispatch_id_fkey"
            columns: ["dispatch_id"]
            isOneToOne: false
            referencedRelation: "dispatches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_items_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatches: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          dispatch_date: string
          dispatch_no: string
          id: string
          pick_list_id: string | null
          posted_at: string | null
          remarks: string | null
          sales_order_id: string | null
          status: string
          total_qty: number
          updated_at: string
          vehicle_id: string | null
          warehouse_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          dispatch_date?: string
          dispatch_no: string
          id?: string
          pick_list_id?: string | null
          posted_at?: string | null
          remarks?: string | null
          sales_order_id?: string | null
          status?: string
          total_qty?: number
          updated_at?: string
          vehicle_id?: string | null
          warehouse_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          dispatch_date?: string
          dispatch_no?: string
          id?: string
          pick_list_id?: string | null
          posted_at?: string | null
          remarks?: string | null
          sales_order_id?: string | null
          status?: string
          total_qty?: number
          updated_at?: string
          vehicle_id?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dispatches_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatches_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatches_pick_list_id_fkey"
            columns: ["pick_list_id"]
            isOneToOne: false
            referencedRelation: "pick_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatches_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatches_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatches_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      document_sequences: {
        Row: {
          client_id: string
          doc_type: string
          id: string
          last_date: string
          next_number: number
          padding: number
          prefix: string
        }
        Insert: {
          client_id: string
          doc_type: string
          id?: string
          last_date?: string
          next_number?: number
          padding?: number
          prefix: string
        }
        Update: {
          client_id?: string
          doc_type?: string
          id?: string
          last_date?: string
          next_number?: number
          padding?: number
          prefix?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_sequences_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      document_templates: {
        Row: {
          body: string
          channel: string
          client_id: string
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          body?: string
          channel: string
          client_id: string
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          channel?: string
          client_id?: string
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_templates_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          client_id: string
          created_at: string
          driver_code: string
          id: string
          license_expiry: string | null
          license_no: string | null
          name: string
          nid: string | null
          phone: string | null
          photo_url: string | null
          status: string
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          driver_code: string
          id?: string
          license_expiry?: string | null
          license_no?: string | null
          name: string
          nid?: string | null
          phone?: string | null
          photo_url?: string | null
          status?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          driver_code?: string
          id?: string
          license_expiry?: string | null
          license_no?: string | null
          name?: string
          nid?: string | null
          phone?: string | null
          photo_url?: string | null
          status?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drivers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drivers_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          client_id: string
          created_at: string
          department: string | null
          designation: string | null
          email: string | null
          employee_code: string
          id: string
          joining_date: string | null
          name: string
          nid: string | null
          phone: string | null
          photo_url: string | null
          reporting_manager: string | null
          role: string | null
          status: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          department?: string | null
          designation?: string | null
          email?: string | null
          employee_code: string
          id?: string
          joining_date?: string | null
          name: string
          nid?: string | null
          phone?: string | null
          photo_url?: string | null
          reporting_manager?: string | null
          role?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          department?: string | null
          designation?: string | null
          email?: string | null
          employee_code?: string
          id?: string
          joining_date?: string | null
          name?: string
          nid?: string | null
          phone?: string | null
          photo_url?: string | null
          reporting_manager?: string | null
          role?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_items: {
        Row: {
          client_id: string
          direction: string
          exchange_id: string
          id: string
          location_id: string | null
          product_id: string
          qty: number
          reason: string | null
          stock_status: string
        }
        Insert: {
          client_id: string
          direction?: string
          exchange_id: string
          id?: string
          location_id?: string | null
          product_id: string
          qty?: number
          reason?: string | null
          stock_status?: string
        }
        Update: {
          client_id?: string
          direction?: string
          exchange_id?: string
          id?: string
          location_id?: string | null
          product_id?: string
          qty?: number
          reason?: string | null
          stock_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "exchange_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchange_items_exchange_id_fkey"
            columns: ["exchange_id"]
            isOneToOne: false
            referencedRelation: "exchanges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchange_items_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchange_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      exchanges: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          doc_no: string | null
          exchange_date: string
          id: string
          remarks: string | null
          status: string
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          doc_no?: string | null
          exchange_date?: string
          id?: string
          remarks?: string | null
          status?: string
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          doc_no?: string | null
          exchange_date?: string
          id?: string
          remarks?: string | null
          status?: string
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exchanges_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchanges_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchanges_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_expense_bills: {
        Row: {
          amount: number
          bill_ref: string | null
          client_id: string
          created_at: string
          expense_id: string
          id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          bill_ref?: string | null
          client_id: string
          created_at?: string
          expense_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          bill_ref?: string | null
          client_id?: string
          created_at?: string
          expense_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_expense_bills_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_expense_bills_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "finance_expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_expense_categories: {
        Row: {
          client_id: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_expense_categories_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_expenses: {
        Row: {
          amount: number
          category_id: string | null
          client_id: string
          created_at: string
          created_by: string | null
          description: string | null
          expense_date: string
          id: string
          payee_name: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          category_id?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_date?: string
          id?: string
          payee_name?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_date?: string
          id?: string
          payee_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "finance_expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_expenses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_fund_receipts: {
        Row: {
          amount: number
          client_id: string
          created_at: string
          created_by: string | null
          id: string
          receipt_date: string
          remarks: string | null
          requisition_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          client_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          receipt_date?: string
          remarks?: string | null
          requisition_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          receipt_date?: string
          remarks?: string | null
          requisition_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_fund_receipts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_fund_receipts_requisition_id_fkey"
            columns: ["requisition_id"]
            isOneToOne: false
            referencedRelation: "finance_requisitions"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_monthly_adjustments: {
        Row: {
          client_id: string
          closing_balance: number
          created_at: string
          created_by: string | null
          id: string
          month: number
          submitted_at: string | null
          total_expense: number
          total_fund_received: number
          updated_at: string
          year: number
        }
        Insert: {
          client_id: string
          closing_balance?: number
          created_at?: string
          created_by?: string | null
          id?: string
          month: number
          submitted_at?: string | null
          total_expense?: number
          total_fund_received?: number
          updated_at?: string
          year: number
        }
        Update: {
          client_id?: string
          closing_balance?: number
          created_at?: string
          created_by?: string | null
          id?: string
          month?: number
          submitted_at?: string | null
          total_expense?: number
          total_fund_received?: number
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "finance_monthly_adjustments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_requisition_lines: {
        Row: {
          amount: number
          client_id: string
          created_at: string
          id: string
          purpose: string
          qty: number | null
          remarks: string | null
          requisition_id: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          client_id: string
          created_at?: string
          id?: string
          purpose: string
          qty?: number | null
          remarks?: string | null
          requisition_id: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string
          id?: string
          purpose?: string
          qty?: number | null
          remarks?: string | null
          requisition_id?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_requisition_lines_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_requisition_lines_requisition_id_fkey"
            columns: ["requisition_id"]
            isOneToOne: false
            referencedRelation: "finance_requisitions"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_requisitions: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          grand_total: number
          id: string
          remarks: string | null
          req_date: string
          req_no: string
          sender_name: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          grand_total?: number
          id?: string
          remarks?: string | null
          req_date?: string
          req_no: string
          sender_name?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          grand_total?: number
          id?: string
          remarks?: string | null
          req_date?: string
          req_no?: string
          sender_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_requisitions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      freight_costs: {
        Row: {
          client_id: string
          cost_date: string | null
          created_at: string
          created_by: string | null
          destination: string | null
          doc_no: string | null
          freight_amount: number | null
          fuel_cost: number | null
          id: string
          origin: string | null
          other_cost: number | null
          remarks: string | null
          status: string
          toll_cost: number | null
          total_cost: number | null
          trip_id: string | null
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          client_id: string
          cost_date?: string | null
          created_at?: string
          created_by?: string | null
          destination?: string | null
          doc_no?: string | null
          freight_amount?: number | null
          fuel_cost?: number | null
          id?: string
          origin?: string | null
          other_cost?: number | null
          remarks?: string | null
          status?: string
          toll_cost?: number | null
          total_cost?: number | null
          trip_id?: string | null
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          client_id?: string
          cost_date?: string | null
          created_at?: string
          created_by?: string | null
          destination?: string | null
          doc_no?: string | null
          freight_amount?: number | null
          fuel_cost?: number | null
          id?: string
          origin?: string | null
          other_cost?: number | null
          remarks?: string | null
          status?: string
          toll_cost?: number | null
          total_cost?: number | null
          trip_id?: string | null
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "freight_costs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_costs_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_costs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      gate_pass_items: {
        Row: {
          client_id: string
          gate_pass_id: string
          id: string
          product_id: string
          qty: number
        }
        Insert: {
          client_id: string
          gate_pass_id: string
          id?: string
          product_id: string
          qty?: number
        }
        Update: {
          client_id?: string
          gate_pass_id?: string
          id?: string
          product_id?: string
          qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "gate_pass_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gate_pass_items_gate_pass_id_fkey"
            columns: ["gate_pass_id"]
            isOneToOne: false
            referencedRelation: "gate_passes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gate_pass_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      gate_passes: {
        Row: {
          challan_id: string | null
          client_id: string
          created_at: string
          created_by: string | null
          dispatch_id: string | null
          driver_name: string | null
          gate_in_time: string | null
          gate_out_date: string
          gate_out_time: string | null
          gate_pass_no: string
          id: string
          loaded_serial_count: number
          purpose: string | null
          remarks: string | null
          status: string
          transporter_id: string | null
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          challan_id?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          dispatch_id?: string | null
          driver_name?: string | null
          gate_in_time?: string | null
          gate_out_date?: string
          gate_out_time?: string | null
          gate_pass_no: string
          id?: string
          loaded_serial_count?: number
          purpose?: string | null
          remarks?: string | null
          status?: string
          transporter_id?: string | null
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          challan_id?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          dispatch_id?: string | null
          driver_name?: string | null
          gate_in_time?: string | null
          gate_out_date?: string
          gate_out_time?: string | null
          gate_pass_no?: string
          id?: string
          loaded_serial_count?: number
          purpose?: string | null
          remarks?: string | null
          status?: string
          transporter_id?: string | null
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gate_passes_challan_id_fkey"
            columns: ["challan_id"]
            isOneToOne: false
            referencedRelation: "delivery_challans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gate_passes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gate_passes_dispatch_id_fkey"
            columns: ["dispatch_id"]
            isOneToOne: false
            referencedRelation: "dispatches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gate_passes_transporter_id_fkey"
            columns: ["transporter_id"]
            isOneToOne: false
            referencedRelation: "transport_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gate_passes_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_receipt_items: {
        Row: {
          client_id: string
          created_at: string
          expected_qty: number
          grn_id: string
          id: string
          location_id: string | null
          product_id: string | null
          qty: number
          received_qty: number
          stock_status: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          expected_qty?: number
          grn_id: string
          id?: string
          location_id?: string | null
          product_id?: string | null
          qty?: number
          received_qty?: number
          stock_status?: string
          unit_price?: number
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          expected_qty?: number
          grn_id?: string
          id?: string
          location_id?: string | null
          product_id?: string | null
          qty?: number
          received_qty?: number
          stock_status?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "goods_receipt_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_items_grn_id_fkey"
            columns: ["grn_id"]
            isOneToOne: false
            referencedRelation: "goods_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_items_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_receipts: {
        Row: {
          billable: boolean
          client_id: string
          created_at: string
          created_by: string | null
          gate_driver: string | null
          gate_in_at: string | null
          gate_transporter: string | null
          gate_vehicle_no: string | null
          grn_no: string
          id: string
          posted_at: string | null
          receipt_date: string
          reference_no: string | null
          remarks: string | null
          sap_grn_ref: string | null
          sap_miro_ref: string | null
          status: string
          supplier_id: string | null
          total_items: number
          total_qty: number
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          billable?: boolean
          client_id: string
          created_at?: string
          created_by?: string | null
          gate_driver?: string | null
          gate_in_at?: string | null
          gate_transporter?: string | null
          gate_vehicle_no?: string | null
          grn_no: string
          id?: string
          posted_at?: string | null
          receipt_date?: string
          reference_no?: string | null
          remarks?: string | null
          sap_grn_ref?: string | null
          sap_miro_ref?: string | null
          status?: string
          supplier_id?: string | null
          total_items?: number
          total_qty?: number
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          billable?: boolean
          client_id?: string
          created_at?: string
          created_by?: string | null
          gate_driver?: string | null
          gate_in_at?: string | null
          gate_transporter?: string | null
          gate_vehicle_no?: string | null
          grn_no?: string
          id?: string
          posted_at?: string | null
          receipt_date?: string
          reference_no?: string | null
          remarks?: string | null
          sap_grn_ref?: string | null
          sap_miro_ref?: string | null
          status?: string
          supplier_id?: string | null
          total_items?: number
          total_qty?: number
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goods_receipts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      grn_items: {
        Row: {
          client_id: string
          grn_id: string
          id: string
          location_id: string | null
          product_id: string
          received_qty: number
          stock_status: string
          unit_price: number
        }
        Insert: {
          client_id: string
          grn_id: string
          id?: string
          location_id?: string | null
          product_id: string
          received_qty?: number
          stock_status?: string
          unit_price?: number
        }
        Update: {
          client_id?: string
          grn_id?: string
          id?: string
          location_id?: string | null
          product_id?: string
          received_qty?: number
          stock_status?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "grn_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grn_items_grn_id_fkey"
            columns: ["grn_id"]
            isOneToOne: false
            referencedRelation: "grns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grn_items_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grn_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      grns: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          doc_no: string | null
          grn_date: string
          id: string
          po_id: string | null
          remarks: string | null
          status: string
          supplier_id: string | null
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          doc_no?: string | null
          grn_date?: string
          id?: string
          po_id?: string | null
          remarks?: string | null
          status?: string
          supplier_id?: string | null
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          doc_no?: string | null
          grn_date?: string
          id?: string
          po_id?: string | null
          remarks?: string | null
          status?: string
          supplier_id?: string | null
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grns_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grns_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grns_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_ledger: {
        Row: {
          balance_after: number
          client_id: string
          created_at: string
          created_by: string | null
          id: number
          location_id: string | null
          movement_type: string
          product_id: string
          qty_in: number
          qty_out: number
          reference_id: string | null
          reference_no: string | null
          reference_type: string | null
          remarks: string | null
          serial_no: string | null
          stock_status: string
          warehouse_id: string
        }
        Insert: {
          balance_after: number
          client_id: string
          created_at?: string
          created_by?: string | null
          id?: never
          location_id?: string | null
          movement_type: string
          product_id: string
          qty_in?: number
          qty_out?: number
          reference_id?: string | null
          reference_no?: string | null
          reference_type?: string | null
          remarks?: string | null
          serial_no?: string | null
          stock_status?: string
          warehouse_id: string
        }
        Update: {
          balance_after?: number
          client_id?: string
          created_at?: string
          created_by?: string | null
          id?: never
          location_id?: string | null
          movement_type?: string
          product_id?: string
          qty_in?: number
          qty_out?: number
          reference_id?: string | null
          reference_no?: string | null
          reference_type?: string | null
          remarks?: string | null
          serial_no?: string | null
          stock_status?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_ledger_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_ledger_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_ledger_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_ledger_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_snapshots: {
        Row: {
          client_id: string
          created_at: string
          id: string
          product_id: string
          quantity: number
          snapshot_date: string
          stock_status: string
          warehouse_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          snapshot_date?: string
          stock_status?: string
          warehouse_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          snapshot_date?: string
          stock_status?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_snapshots_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_snapshots_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_stock: {
        Row: {
          client_id: string
          id: string
          location_id: string | null
          product_id: string
          quantity: number
          reserved_qty: number
          stock_status: string
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          client_id: string
          id?: string
          location_id?: string | null
          product_id: string
          quantity?: number
          reserved_qty?: number
          stock_status?: string
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          client_id?: string
          id?: string
          location_id?: string | null
          product_id?: string
          quantity?: number
          reserved_qty?: number
          stock_status?: string
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_stock_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_stock_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_stock_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          bin: string | null
          capacity: number | null
          client_id: string
          created_at: string
          id: string
          location_code: string
          rack: string | null
          status: string
          warehouse_id: string
          zone: string | null
          zone_id: string | null
        }
        Insert: {
          bin?: string | null
          capacity?: number | null
          client_id: string
          created_at?: string
          id?: string
          location_code: string
          rack?: string | null
          status?: string
          warehouse_id: string
          zone?: string | null
          zone_id?: string | null
        }
        Update: {
          bin?: string | null
          capacity?: number | null
          client_id?: string
          created_at?: string
          id?: string
          location_code?: string
          rack?: string | null
          status?: string
          warehouse_id?: string
          zone?: string | null
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "locations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locations_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locations_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      ni_transactions: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          doc_no: string | null
          id: string
          issued_to: string | null
          ni_item_id: string | null
          qty: number
          remarks: string | null
          status: string
          txn_date: string | null
          txn_type: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          doc_no?: string | null
          id?: string
          issued_to?: string | null
          ni_item_id?: string | null
          qty?: number
          remarks?: string | null
          status?: string
          txn_date?: string | null
          txn_type?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          doc_no?: string | null
          id?: string
          issued_to?: string | null
          ni_item_id?: string | null
          qty?: number
          remarks?: string | null
          status?: string
          txn_date?: string | null
          txn_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ni_transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ni_transactions_ni_item_id_fkey"
            columns: ["ni_item_id"]
            isOneToOne: false
            referencedRelation: "non_inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      non_inventory_items: {
        Row: {
          category: string | null
          client_id: string
          created_at: string
          current_qty: number
          id: string
          image_url: string | null
          item_code: string
          name: string
          reorder_level: number
          status: string
          storage_location: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          client_id: string
          created_at?: string
          current_qty?: number
          id?: string
          image_url?: string | null
          item_code: string
          name: string
          reorder_level?: number
          status?: string
          storage_location?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          client_id?: string
          created_at?: string
          current_qty?: number
          id?: string
          image_url?: string | null
          item_code?: string
          name?: string
          reorder_level?: number
          status?: string
          storage_location?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "non_inventory_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          body: string
          client_id: string
          created_at: string
          created_by: string | null
          entity_id: string
          entity_type: string
          id: string
        }
        Insert: {
          body: string
          client_id: string
          created_at?: string
          created_by?: string | null
          entity_id: string
          entity_type: string
          id?: string
        }
        Update: {
          body?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      packing_items: {
        Row: {
          client_id: string
          id: string
          packing_id: string
          product_id: string
          qty: number
        }
        Insert: {
          client_id: string
          id?: string
          packing_id: string
          product_id: string
          qty?: number
        }
        Update: {
          client_id?: string
          id?: string
          packing_id?: string
          product_id?: string
          qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "packing_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packing_items_packing_id_fkey"
            columns: ["packing_id"]
            isOneToOne: false
            referencedRelation: "packings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packing_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      packing_tasks: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          id: string
          pack_no: string
          remarks: string | null
          sales_order_id: string | null
          status: string
          total_packages: number
          total_qty: number
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          pack_no: string
          remarks?: string | null
          sales_order_id?: string | null
          status?: string
          total_packages?: number
          total_qty?: number
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          pack_no?: string
          remarks?: string | null
          sales_order_id?: string | null
          status?: string
          total_packages?: number
          total_qty?: number
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "packing_tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packing_tasks_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packing_tasks_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packing_tasks_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      packings: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          doc_no: string | null
          id: string
          pack_date: string
          picking_id: string | null
          remarks: string | null
          status: string
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          doc_no?: string | null
          id?: string
          pack_date?: string
          picking_id?: string | null
          remarks?: string | null
          status?: string
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          doc_no?: string | null
          id?: string
          pack_date?: string
          picking_id?: string | null
          remarks?: string | null
          status?: string
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "packings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packings_picking_id_fkey"
            columns: ["picking_id"]
            isOneToOne: false
            referencedRelation: "pickings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packings_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          action: string
          description: string | null
          id: string
          key: string
          module: string
        }
        Insert: {
          action: string
          description?: string | null
          id?: string
          key: string
          module: string
        }
        Update: {
          action?: string
          description?: string | null
          id?: string
          key?: string
          module?: string
        }
        Relationships: []
      }
      pick_lists: {
        Row: {
          assigned_to: string | null
          client_id: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          id: string
          pick_no: string
          reference_no: string | null
          remarks: string | null
          status: string
          total_qty: number
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          pick_no: string
          reference_no?: string | null
          remarks?: string | null
          status?: string
          total_qty?: number
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          pick_no?: string
          reference_no?: string | null
          remarks?: string | null
          status?: string
          total_qty?: number
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pick_lists_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_lists_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_lists_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      picking_items: {
        Row: {
          client_id: string
          id: string
          location_id: string | null
          picking_id: string
          product_id: string
          qty: number
        }
        Insert: {
          client_id: string
          id?: string
          location_id?: string | null
          picking_id: string
          product_id: string
          qty?: number
        }
        Update: {
          client_id?: string
          id?: string
          location_id?: string | null
          picking_id?: string
          product_id?: string
          qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "picking_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_items_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_items_picking_id_fkey"
            columns: ["picking_id"]
            isOneToOne: false
            referencedRelation: "pickings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      pickings: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          doc_no: string | null
          id: string
          pick_date: string
          remarks: string | null
          so_id: string | null
          status: string
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          doc_no?: string | null
          id?: string
          pick_date?: string
          remarks?: string | null
          so_id?: string | null
          status?: string
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          doc_no?: string | null
          id?: string
          pick_date?: string
          remarks?: string | null
          so_id?: string | null
          status?: string
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pickings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pickings_so_id_fkey"
            columns: ["so_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pickings_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      pod_collections: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          id: string
          pod_no: string
          received_by: string | null
          received_date: string
          remarks: string | null
          so_id: string | null
          status: string
          trip_id: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          pod_no: string
          received_by?: string | null
          received_date?: string
          remarks?: string | null
          so_id?: string | null
          status?: string
          trip_id?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          pod_no?: string
          received_by?: string | null
          received_date?: string
          remarks?: string | null
          so_id?: string | null
          status?: string
          trip_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pod_collections_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pod_collections_so_id_fkey"
            columns: ["so_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pod_collections_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          brand: string | null
          capacity_unit: string | null
          capacity_value: number | null
          category: string | null
          china_code: string | null
          client_id: string
          color: string | null
          compressor_type: string | null
          created_at: string
          created_by: string | null
          door_type: string | null
          id: string
          image_url: string | null
          load_type: string | null
          material_code: string
          model: string | null
          name: string
          plant: string | null
          restock_level: number
          sap_reference_code: string | null
          serial_tracking: boolean
          status: string
          uom: string
          updated_at: string
          warranty_applicable: boolean
          warranty_months: number | null
          weight: number | null
        }
        Insert: {
          barcode?: string | null
          brand?: string | null
          capacity_unit?: string | null
          capacity_value?: number | null
          category?: string | null
          china_code?: string | null
          client_id: string
          color?: string | null
          compressor_type?: string | null
          created_at?: string
          created_by?: string | null
          door_type?: string | null
          id?: string
          image_url?: string | null
          load_type?: string | null
          material_code: string
          model?: string | null
          name: string
          plant?: string | null
          restock_level?: number
          sap_reference_code?: string | null
          serial_tracking?: boolean
          status?: string
          uom?: string
          updated_at?: string
          warranty_applicable?: boolean
          warranty_months?: number | null
          weight?: number | null
        }
        Update: {
          barcode?: string | null
          brand?: string | null
          capacity_unit?: string | null
          capacity_value?: number | null
          category?: string | null
          china_code?: string | null
          client_id?: string
          color?: string | null
          compressor_type?: string | null
          created_at?: string
          created_by?: string | null
          door_type?: string | null
          id?: string
          image_url?: string | null
          load_type?: string | null
          material_code?: string
          model?: string | null
          name?: string
          plant?: string | null
          restock_level?: number
          sap_reference_code?: string | null
          serial_tracking?: boolean
          status?: string
          uom?: string
          updated_at?: string
          warranty_applicable?: boolean
          warranty_months?: number | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          designation: string | null
          division: string | null
          email: string | null
          full_name: string | null
          id: string
          is_platform_admin: boolean
          phone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          designation?: string | null
          division?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          is_platform_admin?: boolean
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          designation?: string | null
          division?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_platform_admin?: boolean
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      proof_of_delivery: {
        Row: {
          challan_id: string | null
          client_id: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          delivery_date: string
          dispatch_id: string | null
          id: string
          pod_no: string
          pod_url: string | null
          received_by: string | null
          remarks: string | null
          status: string
          updated_at: string
        }
        Insert: {
          challan_id?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          delivery_date?: string
          dispatch_id?: string | null
          id?: string
          pod_no: string
          pod_url?: string | null
          received_by?: string | null
          remarks?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          challan_id?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          delivery_date?: string
          dispatch_id?: string | null
          id?: string
          pod_no?: string
          pod_url?: string | null
          received_by?: string | null
          remarks?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proof_of_delivery_challan_id_fkey"
            columns: ["challan_id"]
            isOneToOne: false
            referencedRelation: "delivery_challans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proof_of_delivery_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proof_of_delivery_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proof_of_delivery_dispatch_id_fkey"
            columns: ["dispatch_id"]
            isOneToOne: false
            referencedRelation: "dispatches"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          client_id: string
          id: string
          po_id: string
          product_id: string
          qty: number
          received_qty: number
          unit_price: number
        }
        Insert: {
          client_id: string
          id?: string
          po_id: string
          product_id: string
          qty?: number
          received_qty?: number
          unit_price?: number
        }
        Update: {
          client_id?: string
          id?: string
          po_id?: string
          product_id?: string
          qty?: number
          received_qty?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_client_id_fkey1"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_po_id_fkey1"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_product_id_fkey1"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          doc_no: string | null
          expected_date: string | null
          id: string
          order_date: string
          remarks: string | null
          status: string
          supplier_id: string | null
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          doc_no?: string | null
          expected_date?: string | null
          id?: string
          order_date?: string
          remarks?: string | null
          status?: string
          supplier_id?: string | null
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          doc_no?: string | null
          expected_date?: string | null
          id?: string
          order_date?: string
          remarks?: string | null
          status?: string
          supplier_id?: string | null
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_client_id_fkey1"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey1"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_warehouse_id_fkey1"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_requisition_items: {
        Row: {
          client_id: string
          created_at: string
          id: string
          line_total: number
          pr_id: string
          product_id: string | null
          qty: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          line_total?: number
          pr_id: string
          product_id?: string | null
          qty?: number
          unit_price?: number
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          line_total?: number
          pr_id?: string
          product_id?: string | null
          qty?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_po_id_fkey"
            columns: ["pr_id"]
            isOneToOne: false
            referencedRelation: "purchase_requisitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_requisitions: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          expected_date: string | null
          id: string
          order_date: string
          pr_no: string
          remarks: string | null
          status: string
          supplier_id: string | null
          total_amount: number
          total_qty: number
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          expected_date?: string | null
          id?: string
          order_date?: string
          pr_no: string
          remarks?: string | null
          status?: string
          supplier_id?: string | null
          total_amount?: number
          total_qty?: number
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          expected_date?: string | null
          id?: string
          order_date?: string
          pr_no?: string
          remarks?: string | null
          status?: string
          supplier_id?: string | null
          total_amount?: number
          total_qty?: number
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_return_items: {
        Row: {
          client_id: string
          id: string
          location_id: string | null
          product_id: string
          qty: number
          reason: string | null
          return_id: string
          stock_status: string
          unit_price: number
        }
        Insert: {
          client_id: string
          id?: string
          location_id?: string | null
          product_id: string
          qty?: number
          reason?: string | null
          return_id: string
          stock_status?: string
          unit_price?: number
        }
        Update: {
          client_id?: string
          id?: string
          location_id?: string | null
          product_id?: string
          qty?: number
          reason?: string | null
          return_id?: string
          stock_status?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_return_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_return_items_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_return_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_return_items_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "purchase_returns"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_returns: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          doc_no: string | null
          id: string
          remarks: string | null
          return_date: string
          status: string
          supplier_id: string | null
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          doc_no?: string | null
          id?: string
          remarks?: string | null
          return_date?: string
          status?: string
          supplier_id?: string | null
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          doc_no?: string | null
          id?: string
          remarks?: string | null
          return_date?: string
          status?: string
          supplier_id?: string | null
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_returns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_returns_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_returns_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      putaway_items: {
        Row: {
          client_id: string
          from_location_id: string | null
          id: string
          product_id: string
          putaway_id: string
          qty: number
          stock_status: string
          to_location_id: string | null
        }
        Insert: {
          client_id: string
          from_location_id?: string | null
          id?: string
          product_id: string
          putaway_id: string
          qty?: number
          stock_status?: string
          to_location_id?: string | null
        }
        Update: {
          client_id?: string
          from_location_id?: string | null
          id?: string
          product_id?: string
          putaway_id?: string
          qty?: number
          stock_status?: string
          to_location_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "putaway_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "putaway_items_from_location_id_fkey"
            columns: ["from_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "putaway_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "putaway_items_putaway_id_fkey"
            columns: ["putaway_id"]
            isOneToOne: false
            referencedRelation: "putaways"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "putaway_items_to_location_id_fkey"
            columns: ["to_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      putaway_tasks: {
        Row: {
          assigned_to: string | null
          client_id: string
          created_at: string
          created_by: string | null
          grn_id: string | null
          id: string
          location_id: string | null
          remarks: string | null
          status: string
          task_no: string
          total_qty: number
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          grn_id?: string | null
          id?: string
          location_id?: string | null
          remarks?: string | null
          status?: string
          task_no: string
          total_qty?: number
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          grn_id?: string | null
          id?: string
          location_id?: string | null
          remarks?: string | null
          status?: string
          task_no?: string
          total_qty?: number
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "putaway_tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "putaway_tasks_grn_id_fkey"
            columns: ["grn_id"]
            isOneToOne: false
            referencedRelation: "goods_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "putaway_tasks_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "putaway_tasks_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      putaways: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          doc_no: string | null
          grn_id: string | null
          id: string
          putaway_date: string
          remarks: string | null
          status: string
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          doc_no?: string | null
          grn_id?: string | null
          id?: string
          putaway_date?: string
          remarks?: string | null
          status?: string
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          doc_no?: string | null
          grn_id?: string | null
          id?: string
          putaway_date?: string
          remarks?: string | null
          status?: string
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "putaways_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "putaways_grn_id_fkey"
            columns: ["grn_id"]
            isOneToOne: false
            referencedRelation: "grns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "putaways_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      refurbishment_items: {
        Row: {
          client_id: string
          from_status: string
          id: string
          location_id: string | null
          product_id: string
          qty: number
          reason: string | null
          refurb_id: string
          repair_cost: number
          to_status: string
        }
        Insert: {
          client_id: string
          from_status?: string
          id?: string
          location_id?: string | null
          product_id: string
          qty?: number
          reason?: string | null
          refurb_id: string
          repair_cost?: number
          to_status?: string
        }
        Update: {
          client_id?: string
          from_status?: string
          id?: string
          location_id?: string | null
          product_id?: string
          qty?: number
          reason?: string | null
          refurb_id?: string
          repair_cost?: number
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "refurbishment_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refurbishment_items_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refurbishment_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refurbishment_items_refurb_id_fkey"
            columns: ["refurb_id"]
            isOneToOne: false
            referencedRelation: "refurbishments"
            referencedColumns: ["id"]
          },
        ]
      }
      refurbishments: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          doc_no: string | null
          id: string
          refurb_date: string
          remarks: string | null
          status: string
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          doc_no?: string | null
          id?: string
          refurb_date?: string
          remarks?: string | null
          status?: string
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          doc_no?: string | null
          id?: string
          refurb_date?: string
          remarks?: string | null
          status?: string
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "refurbishments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refurbishments_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      replacement_items: {
        Row: {
          client_id: string
          direction: string
          id: string
          location_id: string | null
          product_id: string
          qty: number
          reason: string | null
          replacement_id: string
          stock_status: string
        }
        Insert: {
          client_id: string
          direction?: string
          id?: string
          location_id?: string | null
          product_id: string
          qty?: number
          reason?: string | null
          replacement_id: string
          stock_status?: string
        }
        Update: {
          client_id?: string
          direction?: string
          id?: string
          location_id?: string | null
          product_id?: string
          qty?: number
          reason?: string | null
          replacement_id?: string
          stock_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "replacement_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replacement_items_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replacement_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replacement_items_replacement_id_fkey"
            columns: ["replacement_id"]
            isOneToOne: false
            referencedRelation: "replacements"
            referencedColumns: ["id"]
          },
        ]
      }
      replacements: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          doc_no: string | null
          id: string
          remarks: string | null
          replace_date: string
          status: string
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          doc_no?: string | null
          id?: string
          remarks?: string | null
          replace_date?: string
          status?: string
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          doc_no?: string | null
          id?: string
          remarks?: string | null
          replace_date?: string
          status?: string
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "replacements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replacements_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replacements_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      return_inspection_items: {
        Row: {
          client_id: string
          from_status: string
          id: string
          location_id: string | null
          product_id: string
          qty: number
          reason: string | null
          ri_id: string
          to_status: string
        }
        Insert: {
          client_id: string
          from_status?: string
          id?: string
          location_id?: string | null
          product_id: string
          qty?: number
          reason?: string | null
          ri_id: string
          to_status?: string
        }
        Update: {
          client_id?: string
          from_status?: string
          id?: string
          location_id?: string | null
          product_id?: string
          qty?: number
          reason?: string | null
          ri_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "return_inspection_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_inspection_items_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_inspection_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_inspection_items_ri_id_fkey"
            columns: ["ri_id"]
            isOneToOne: false
            referencedRelation: "return_inspections"
            referencedColumns: ["id"]
          },
        ]
      }
      return_inspections: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          doc_no: string | null
          id: string
          inspection_date: string
          remarks: string | null
          srn_id: string | null
          status: string
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          doc_no?: string | null
          id?: string
          inspection_date?: string
          remarks?: string | null
          srn_id?: string | null
          status?: string
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          doc_no?: string | null
          id?: string
          inspection_date?: string
          remarks?: string | null
          srn_id?: string | null
          status?: string
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "return_inspections_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_inspections_srn_id_fkey"
            columns: ["srn_id"]
            isOneToOne: false
            referencedRelation: "sales_returns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_inspections_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission_id: string
          role_id: string
        }
        Insert: {
          permission_id: string
          role_id: string
        }
        Update: {
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          key: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          key: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          key?: string
          name?: string
        }
        Relationships: []
      }
      sales_order_items: {
        Row: {
          basic_price: number
          client_id: string
          created_at: string
          delivered_qty: number
          id: string
          line_total: number
          product_id: string | null
          qty: number
          remarks: string | null
          so_id: string
          unit_price: number
          updated_at: string
          vat_rate: number
        }
        Insert: {
          basic_price?: number
          client_id: string
          created_at?: string
          delivered_qty?: number
          id?: string
          line_total?: number
          product_id?: string | null
          qty?: number
          remarks?: string | null
          so_id: string
          unit_price?: number
          updated_at?: string
          vat_rate?: number
        }
        Update: {
          basic_price?: number
          client_id?: string
          created_at?: string
          delivered_qty?: number
          id?: string
          line_total?: number
          product_id?: string | null
          qty?: number
          remarks?: string | null
          so_id?: string
          unit_price?: number
          updated_at?: string
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_items_so_id_fkey"
            columns: ["so_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          assigned_to: string | null
          billing_doc_no: string | null
          client_id: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          deposited_amount: number
          deposited_date: string | null
          id: string
          invoice_no: string | null
          mail_ref: string | null
          order_date: string
          outbound_delivery_no: string | null
          payment_status: string
          reference_no: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          remarks: string | null
          required_date: string | null
          sap_so_no: string | null
          ship_to_address: string | null
          ship_to_id: string | null
          so_no: string
          status: string
          total_amount: number
          total_qty: number
          transfer_order_no: string | null
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          assigned_to?: string | null
          billing_doc_no?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          deposited_amount?: number
          deposited_date?: string | null
          id?: string
          invoice_no?: string | null
          mail_ref?: string | null
          order_date?: string
          outbound_delivery_no?: string | null
          payment_status?: string
          reference_no?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          remarks?: string | null
          required_date?: string | null
          sap_so_no?: string | null
          ship_to_address?: string | null
          ship_to_id?: string | null
          so_no: string
          status?: string
          total_amount?: number
          total_qty?: number
          transfer_order_no?: string | null
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          assigned_to?: string | null
          billing_doc_no?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          deposited_amount?: number
          deposited_date?: string | null
          id?: string
          invoice_no?: string | null
          mail_ref?: string | null
          order_date?: string
          outbound_delivery_no?: string | null
          payment_status?: string
          reference_no?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          remarks?: string | null
          required_date?: string | null
          sap_so_no?: string | null
          ship_to_address?: string | null
          ship_to_id?: string | null
          so_no?: string
          status?: string
          total_amount?: number
          total_qty?: number
          transfer_order_no?: string | null
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_ship_to_id_fkey"
            columns: ["ship_to_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_return_items: {
        Row: {
          client_id: string
          id: string
          location_id: string | null
          product_id: string
          qty: number
          reason: string | null
          srn_id: string
          stock_status: string
          unit_price: number
        }
        Insert: {
          client_id: string
          id?: string
          location_id?: string | null
          product_id: string
          qty?: number
          reason?: string | null
          srn_id: string
          stock_status?: string
          unit_price?: number
        }
        Update: {
          client_id?: string
          id?: string
          location_id?: string | null
          product_id?: string
          qty?: number
          reason?: string | null
          srn_id?: string
          stock_status?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_return_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_return_items_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_return_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_return_items_srn_id_fkey"
            columns: ["srn_id"]
            isOneToOne: false
            referencedRelation: "sales_returns"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_returns: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          dc_id: string | null
          doc_no: string | null
          id: string
          remarks: string | null
          return_date: string
          status: string
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          dc_id?: string | null
          doc_no?: string | null
          id?: string
          remarks?: string | null
          return_date?: string
          status?: string
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          dc_id?: string | null
          doc_no?: string | null
          id?: string
          remarks?: string | null
          return_date?: string
          status?: string
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_returns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_returns_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_returns_dc_id_fkey"
            columns: ["dc_id"]
            isOneToOne: false
            referencedRelation: "delivery_challans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_returns_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      serial_numbers: {
        Row: {
          client_id: string
          created_at: string
          gate_pass_id: string | null
          id: string
          location_id: string | null
          product_id: string
          reference_no: string | null
          serial_no: string
          so_item_id: string | null
          status: string
          updated_at: string
          warehouse_id: string | null
          warranty_end: string | null
          warranty_start: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          gate_pass_id?: string | null
          id?: string
          location_id?: string | null
          product_id: string
          reference_no?: string | null
          serial_no: string
          so_item_id?: string | null
          status?: string
          updated_at?: string
          warehouse_id?: string | null
          warranty_end?: string | null
          warranty_start?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          gate_pass_id?: string | null
          id?: string
          location_id?: string | null
          product_id?: string
          reference_no?: string | null
          serial_no?: string
          so_item_id?: string | null
          status?: string
          updated_at?: string
          warehouse_id?: string | null
          warranty_end?: string | null
          warranty_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "serial_numbers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "serial_numbers_gate_pass_id_fkey"
            columns: ["gate_pass_id"]
            isOneToOne: false
            referencedRelation: "gate_passes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "serial_numbers_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "serial_numbers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "serial_numbers_so_item_id_fkey"
            columns: ["so_item_id"]
            isOneToOne: false
            referencedRelation: "sales_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "serial_numbers_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      service_providers: {
        Row: {
          address: string | null
          client_id: string
          code: string
          contact_person: string | null
          created_at: string
          email: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          service_type: string | null
          status: string
          tin_vat: string | null
          trade_license: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          client_id: string
          code: string
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          service_type?: string | null
          status?: string
          tin_vat?: string | null
          trade_license?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          client_id?: string
          code?: string
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          service_type?: string | null
          status?: string
          tin_vat?: string | null
          trade_license?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_providers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_count_items: {
        Row: {
          client_id: string
          count_id: string
          counted_qty: number
          id: string
          location_id: string | null
          product_id: string
          stock_status: string
          system_qty: number
        }
        Insert: {
          client_id: string
          count_id: string
          counted_qty?: number
          id?: string
          location_id?: string | null
          product_id: string
          stock_status?: string
          system_qty?: number
        }
        Update: {
          client_id?: string
          count_id?: string
          counted_qty?: number
          id?: string
          location_id?: string | null
          product_id?: string
          stock_status?: string
          system_qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_count_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_count_items_count_id_fkey"
            columns: ["count_id"]
            isOneToOne: false
            referencedRelation: "stock_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_count_items_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_count_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_counts: {
        Row: {
          client_id: string
          count_date: string
          count_type: string
          created_at: string
          created_by: string | null
          doc_no: string | null
          id: string
          remarks: string | null
          status: string
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          client_id: string
          count_date?: string
          count_type?: string
          created_at?: string
          created_by?: string | null
          doc_no?: string | null
          id?: string
          remarks?: string | null
          status?: string
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          client_id?: string
          count_date?: string
          count_type?: string
          created_at?: string
          created_by?: string | null
          doc_no?: string | null
          id?: string
          remarks?: string | null
          status?: string
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_counts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_counts_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_invoices: {
        Row: {
          amount: number
          client_id: string
          created_at: string
          created_by: string | null
          doc_no: string
          due_date: string | null
          grn_id: string | null
          id: string
          invoice_date: string
          remarks: string | null
          status: string
          supplier_id: string | null
          supplier_invoice_no: string | null
          tax: number
          total: number
          updated_at: string
        }
        Insert: {
          amount?: number
          client_id: string
          created_at?: string
          created_by?: string | null
          doc_no: string
          due_date?: string | null
          grn_id?: string | null
          id?: string
          invoice_date?: string
          remarks?: string | null
          status?: string
          supplier_id?: string | null
          supplier_invoice_no?: string | null
          tax?: number
          total?: number
          updated_at?: string
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string
          created_by?: string | null
          doc_no?: string
          due_date?: string | null
          grn_id?: string | null
          id?: string
          invoice_date?: string
          remarks?: string | null
          status?: string
          supplier_id?: string | null
          supplier_invoice_no?: string | null
          tax?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_invoices_grn_id_fkey"
            columns: ["grn_id"]
            isOneToOne: false
            referencedRelation: "goods_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          client_id: string
          contact_person: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          logo_url: string | null
          name: string
          payment_terms: string | null
          phone: string | null
          status: string
          supplier_code: string
          tin_vat: string | null
          trade_license: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          client_id: string
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name: string
          payment_terms?: string | null
          phone?: string | null
          status?: string
          supplier_code: string
          tin_vat?: string | null
          trade_license?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          client_id?: string
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          payment_terms?: string | null
          phone?: string | null
          status?: string
          supplier_code?: string
          tin_vat?: string | null
          trade_license?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_bills: {
        Row: {
          amount: number | null
          bill_date: string | null
          bill_no: string | null
          client_id: string
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          remarks: string | null
          status: string
          tax: number | null
          total: number | null
          transport_vendor_id: string | null
          trip_id: string | null
          updated_at: string
        }
        Insert: {
          amount?: number | null
          bill_date?: string | null
          bill_no?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          remarks?: string | null
          status?: string
          tax?: number | null
          total?: number | null
          transport_vendor_id?: string | null
          trip_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number | null
          bill_date?: string | null
          bill_no?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          remarks?: string | null
          status?: string
          tax?: number | null
          total?: number | null
          transport_vendor_id?: string | null
          trip_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transport_bills_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_bills_transport_vendor_id_fkey"
            columns: ["transport_vendor_id"]
            isOneToOne: false
            referencedRelation: "transport_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_bills_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_requests: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          destination: string | null
          id: string
          origin: string | null
          remarks: string | null
          request_date: string
          request_no: string
          required_date: string | null
          status: string
          transport_vendor_id: string | null
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          destination?: string | null
          id?: string
          origin?: string | null
          remarks?: string | null
          request_date?: string
          request_no: string
          required_date?: string | null
          status?: string
          transport_vendor_id?: string | null
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          destination?: string | null
          id?: string
          origin?: string | null
          remarks?: string | null
          request_date?: string
          request_no?: string
          required_date?: string | null
          status?: string
          transport_vendor_id?: string | null
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transport_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_requests_transport_vendor_id_fkey"
            columns: ["transport_vendor_id"]
            isOneToOne: false
            referencedRelation: "transport_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_requests_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_vendors: {
        Row: {
          client_id: string
          contact_person: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string
          nid: string | null
          phone: string | null
          status: string
          tin_vat: string | null
          trade_license: string | null
          updated_at: string
          vendor_code: string
        }
        Insert: {
          client_id: string
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          nid?: string | null
          phone?: string | null
          status?: string
          tin_vat?: string | null
          trade_license?: string | null
          updated_at?: string
          vendor_code: string
        }
        Update: {
          client_id?: string
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          nid?: string | null
          phone?: string | null
          status?: string
          tin_vat?: string | null
          trade_license?: string | null
          updated_at?: string
          vendor_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "transport_vendors_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_closures: {
        Row: {
          actual_km: number | null
          client_id: string
          closure_no: string
          created_at: string
          created_by: string | null
          end_date: string | null
          fuel_cost: number | null
          id: string
          other_expenses: number | null
          remarks: string | null
          status: string
          trip_id: string | null
          updated_at: string
        }
        Insert: {
          actual_km?: number | null
          client_id: string
          closure_no: string
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          fuel_cost?: number | null
          id?: string
          other_expenses?: number | null
          remarks?: string | null
          status?: string
          trip_id?: string | null
          updated_at?: string
        }
        Update: {
          actual_km?: number | null
          client_id?: string
          closure_no?: string
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          fuel_cost?: number | null
          id?: string
          other_expenses?: number | null
          remarks?: string | null
          status?: string
          trip_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_closures_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_closures_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          destination: string | null
          driver_id: string | null
          id: string
          origin: string | null
          remarks: string | null
          status: string
          transport_vendor_id: string | null
          trip_date: string
          trip_no: string
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          destination?: string | null
          driver_id?: string | null
          id?: string
          origin?: string | null
          remarks?: string | null
          status?: string
          transport_vendor_id?: string | null
          trip_date?: string
          trip_no: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          destination?: string | null
          driver_id?: string | null
          id?: string
          origin?: string | null
          remarks?: string | null
          status?: string
          transport_vendor_id?: string | null
          trip_date?: string
          trip_no?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trips_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_transport_vendor_id_fkey"
            columns: ["transport_vendor_id"]
            isOneToOne: false
            referencedRelation: "transport_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_clients: {
        Row: {
          client_id: string
          created_at: string
          is_default: boolean
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          is_default?: boolean
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          is_default?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_clients_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_clients_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          client_id: string | null
          created_at: string
          id: string
          role_id: string
          user_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          id?: string
          role_id: string
          user_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          id?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_allocations: {
        Row: {
          allocation_date: string
          allocation_no: string
          client_id: string
          created_at: string
          created_by: string | null
          driver_id: string | null
          id: string
          remarks: string | null
          so_id: string | null
          status: string
          transport_vendor_id: string | null
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          allocation_date?: string
          allocation_no: string
          client_id: string
          created_at?: string
          created_by?: string | null
          driver_id?: string | null
          id?: string
          remarks?: string | null
          so_id?: string | null
          status?: string
          transport_vendor_id?: string | null
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          allocation_date?: string
          allocation_no?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          driver_id?: string | null
          id?: string
          remarks?: string | null
          so_id?: string | null
          status?: string
          transport_vendor_id?: string | null
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_allocations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_allocations_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_allocations_so_id_fkey"
            columns: ["so_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_allocations_transport_vendor_id_fkey"
            columns: ["transport_vendor_id"]
            isOneToOne: false
            referencedRelation: "transport_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_allocations_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          capacity: string | null
          client_id: string
          created_at: string
          driver_name: string | null
          driver_phone: string | null
          fitness_expiry: string | null
          id: string
          insurance_expiry: string | null
          license_expiry: string | null
          license_number: string | null
          photo_url: string | null
          status: string
          vehicle_number: string
          vehicle_type: string | null
          vendor_id: string | null
        }
        Insert: {
          capacity?: string | null
          client_id: string
          created_at?: string
          driver_name?: string | null
          driver_phone?: string | null
          fitness_expiry?: string | null
          id?: string
          insurance_expiry?: string | null
          license_expiry?: string | null
          license_number?: string | null
          photo_url?: string | null
          status?: string
          vehicle_number: string
          vehicle_type?: string | null
          vendor_id?: string | null
        }
        Update: {
          capacity?: string | null
          client_id?: string
          created_at?: string
          driver_name?: string | null
          driver_phone?: string | null
          fitness_expiry?: string | null
          id?: string
          insurance_expiry?: string | null
          license_expiry?: string | null
          license_number?: string | null
          photo_url?: string | null
          status?: string
          vehicle_number?: string
          vehicle_type?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "transport_vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          address: string | null
          client_id: string
          code: string
          contact_person: string | null
          contact_phone: string | null
          created_at: string
          id: string
          manager_name: string | null
          manager_phone: string | null
          name: string
          status: string
          total_area_sqft: number | null
          updated_at: string
          warehouse_type: string | null
        }
        Insert: {
          address?: string | null
          client_id: string
          code: string
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          manager_name?: string | null
          manager_phone?: string | null
          name: string
          status?: string
          total_area_sqft?: number | null
          updated_at?: string
          warehouse_type?: string | null
        }
        Update: {
          address?: string | null
          client_id?: string
          code?: string
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          manager_name?: string | null
          manager_phone?: string | null
          name?: string
          status?: string
          total_area_sqft?: number | null
          updated_at?: string
          warehouse_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      zones: {
        Row: {
          client_id: string
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
          status: string
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          client_id: string
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          status?: string
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          client_id?: string
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          status?: string
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zones_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zones_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      adjust_stock_hold: {
        Args: { p_hold: boolean; p_qty: number; p_stock_id: string }
        Returns: undefined
      }
      next_document_number: {
        Args: { p_client: string; p_doc_type: string }
        Returns: string
      }
      post_asset_allocation: { Args: { p_id: string }; Returns: undefined }
      post_asset_disposal: { Args: { p_id: string }; Returns: undefined }
      post_asset_maintenance: { Args: { p_id: string }; Returns: undefined }
      post_asset_transfer: { Args: { p_id: string }; Returns: undefined }
      post_delivery_challan: { Args: { p_challan_id: string }; Returns: string }
      post_exchange: { Args: { p_ex: string }; Returns: undefined }
      post_grn: { Args: { p_grn: string }; Returns: undefined }
      post_ni_transaction: { Args: { p_id: string }; Returns: undefined }
      post_purchase_return: { Args: { p_ret: string }; Returns: undefined }
      post_putaway: { Args: { p_pa: string }; Returns: undefined }
      post_refurbishment: { Args: { p_rf: string }; Returns: undefined }
      post_replacement: { Args: { p_rep: string }; Returns: undefined }
      post_return_inspection: { Args: { p_ri: string }; Returns: undefined }
      post_sales_return: { Args: { p_srn: string }; Returns: undefined }
      post_stock_count: { Args: { p_count: string }; Returns: undefined }
      post_stock_movement: {
        Args: {
          p_client: string
          p_location?: string
          p_movement_type: string
          p_product: string
          p_qty_in: number
          p_qty_out: number
          p_reference_id?: string
          p_reference_no?: string
          p_reference_type?: string
          p_remarks?: string
          p_serial_no?: string
          p_stock_status: string
          p_warehouse: string
        }
        Returns: number
      }
      post_stock_transfer: {
        Args: {
          p_client: string
          p_from_location: string
          p_from_warehouse: string
          p_product: string
          p_qty: number
          p_reference_no?: string
          p_remarks?: string
          p_stock_status: string
          p_to_location: string
          p_to_warehouse: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
