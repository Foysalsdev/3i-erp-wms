-- Single-client conversion, step 3/3: drop client_id everywhere.
-- 1) Add client-free replacements for every (client_id, X) unique / PK.
alter table public.app_settings              add constraint app_settings_category_key unique (category);
alter table public.assets                    add constraint assets_asset_code_key unique (asset_code);
alter table public.customers                 add constraint customers_customer_code_key unique (customer_code);
alter table public.document_sequences        add constraint document_sequences_doc_type_key unique (doc_type);
alter table public.document_templates        add constraint document_templates_channel_code_key unique (channel, code);
alter table public.drivers                   add constraint drivers_driver_code_key unique (driver_code);
alter table public.employees                 add constraint employees_employee_code_key unique (employee_code);
alter table public.finance_budgets           add constraint finance_budgets_year_month_department_key unique (year, month, department);
alter table public.finance_expense_categories add constraint finance_expense_categories_name_key unique (name);
alter table public.finance_ho_submissions    add constraint finance_ho_submissions_submission_no_key unique (submission_no);
alter table public.finance_items             add constraint finance_items_name_key unique (name);
alter table public.finance_monthly_adjustments add constraint finance_monthly_adjustments_year_month_key unique (year, month);
alter table public.finance_requisitions      add constraint finance_requisitions_req_no_key unique (req_no);
alter table public.finance_vendors           add constraint finance_vendors_name_key unique (name);
alter table public.inventory_stock           add constraint inventory_stock_dim_uq unique nulls not distinct (product_id, warehouse_id, location_id, stock_status);
alter table public.locations                 add constraint locations_warehouse_id_location_code_key unique (warehouse_id, location_code);
alter table public.non_inventory_items       add constraint non_inventory_items_item_code_key unique (item_code);
alter table public.products                  add constraint products_material_code_key unique (material_code);
alter table public.serial_numbers            add constraint serial_numbers_product_id_serial_no_key unique (product_id, serial_no);
alter table public.service_providers         add constraint service_providers_code_key unique (code);
alter table public.suppliers                 add constraint suppliers_supplier_code_key unique (supplier_code);
alter table public.transport_vendors         add constraint transport_vendors_vendor_code_key unique (vendor_code);
alter table public.vehicles                  add constraint vehicles_vehicle_number_key unique (vehicle_number);
alter table public.warehouses                add constraint warehouses_code_key unique (code);
alter table public.zones                     add constraint zones_code_key unique (code);
alter table public.user_roles                add constraint user_roles_user_id_role_id_key unique (user_id, role_id);

-- 2) Drop client_id from every table that still has it (except user_clients, dropped whole).
--    CASCADE removes each column's FK to clients, its (client_id, ...) unique/PK, and its indexes.
do $mig$
declare t text;
begin
  for t in
    select table_name from information_schema.columns
    where table_schema = 'public' and column_name = 'client_id' and table_name <> 'user_clients'
    order by table_name
  loop
    execute format('alter table public.%I drop column client_id cascade', t);
  end loop;
end
$mig$;

-- 3) Re-establish the finance sequence PK (client_id dropped from the old composite PK).
alter table public.finance_document_sequences add primary key (prefix, year_month);

-- 4) Drop the tenancy tables entirely.
drop table if exists public.user_clients cascade;
drop table if exists public.clients cascade;
