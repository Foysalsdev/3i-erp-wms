-- Attach the generic app.audit_trigger to tables that were missing it.
-- Biggest gaps: inventory_stock (on-hand changed with no trace — one row had
-- already diverged from the ledger with nothing in audit_logs to explain it),
-- serial_numbers (custody chain), and the RBAC/tenancy tables (role or
-- membership changes were invisible). Tenancy tables have no client_id, so
-- their audit rows land with client_id null — readable only by platform
-- admins under the existing audit_read policy.
--
-- Deliberately still excluded: audit_logs itself, the two document-sequence
-- counter tables (one noise row per issued number), inventory_ledger and
-- inventory_snapshots (append-only records that are themselves the trail).
do $$
declare t text;
begin
  foreach t in array array[
    'inventory_stock', 'serial_numbers',
    'clients', 'profiles', 'roles', 'permissions', 'role_permissions', 'user_roles', 'user_clients',
    'trips', 'trip_closures', 'vehicle_allocations', 'pod_collections',
    'couriers', 'courier_rates', 'courier_shipments',
    'attachments', 'notes',
    'exchange_items', 'gate_pass_items', 'grn_items', 'packing_items', 'picking_items',
    'purchase_order_items', 'purchase_return_items', 'putaway_items', 'replacement_items', 'sales_return_items'
  ]
  loop
    execute format('drop trigger if exists t_%I_audit on public.%I', t, t);
    execute format(
      'create trigger t_%I_audit after insert or update or delete on public.%I
       for each row execute function app.audit_trigger()', t, t);
  end loop;
end $$;
