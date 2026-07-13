-- Single-client conversion, step 2b/3: post_* document posters (drop
-- has_client_access checks and client_id args) + public RPC wrappers + grants.
create or replace function app.post_asset_allocation(p_id uuid) returns void
language plpgsql security definer set search_path to 'public' as $$
declare r public.asset_allocations; v_name text;
begin
  select * into r from public.asset_allocations where id = p_id for update;
  if not found then raise exception 'Allocation not found'; end if;
  if r.status = 'posted' then raise exception 'Already posted'; end if;
  select name into v_name from public.employees where id = r.employee_id;
  update public.assets set status = 'in_use', assigned_to = coalesce(v_name, r.department, assigned_to) where id = r.asset_id;
  update public.asset_allocations set status = 'posted' where id = p_id;
end $$;

create or replace function app.post_asset_disposal(p_id uuid) returns void
language plpgsql security definer set search_path to 'public' as $$
declare r public.asset_disposals;
begin
  select * into r from public.asset_disposals where id = p_id for update;
  if not found then raise exception 'Disposal not found'; end if;
  if r.status = 'posted' then raise exception 'Already posted'; end if;
  update public.assets set status = 'disposed', assigned_to = null where id = r.asset_id;
  update public.asset_disposals set status = 'posted' where id = p_id;
end $$;

create or replace function app.post_asset_maintenance(p_id uuid) returns void
language plpgsql security definer set search_path to 'public' as $$
declare r public.asset_maintenance;
begin
  select * into r from public.asset_maintenance where id = p_id for update;
  if not found then raise exception 'Maintenance not found'; end if;
  if r.status = 'posted' then raise exception 'Already posted'; end if;
  update public.assets set status = 'active' where id = r.asset_id and status <> 'disposed';
  update public.asset_maintenance set status = 'posted' where id = p_id;
end $$;

create or replace function app.post_asset_transfer(p_id uuid) returns void
language plpgsql security definer set search_path to 'public' as $$
declare r public.asset_transfers;
begin
  select * into r from public.asset_transfers where id = p_id for update;
  if not found then raise exception 'Transfer not found'; end if;
  if r.status = 'posted' then raise exception 'Already posted'; end if;
  update public.assets set location = coalesce(r.to_location, location),
    warehouse_id = coalesce(r.to_warehouse_id, warehouse_id) where id = r.asset_id;
  update public.asset_transfers set status = 'posted' where id = p_id;
end $$;

create or replace function app.post_exchange(p_ex uuid) returns void
language plpgsql security definer set search_path to 'public' as $$
declare e public.exchanges; it public.exchange_items;
begin
  select * into e from public.exchanges where id = p_ex for update;
  if not found then raise exception 'Exchange not found'; end if;
  if e.status = 'posted' then raise exception 'Already posted'; end if;
  for it in select * from public.exchange_items where exchange_id = p_ex loop
    perform app.post_stock_movement(it.product_id, e.warehouse_id, it.location_id,
      it.stock_status, case when it.direction='in' then it.qty else 0 end,
      case when it.direction='out' then it.qty else 0 end,
      'EXCHANGE', 'EXC', e.id::text, e.doc_no, null, coalesce(it.reason,'Exchange'));
  end loop;
  update public.exchanges set status = 'posted' where id = p_ex;
end $$;

create or replace function app.post_grn(p_grn uuid) returns void
language plpgsql security definer set search_path to 'public' as $$
declare g public.grns; it public.grn_items;
begin
  select * into g from public.grns where id = p_grn for update;
  if not found then raise exception 'GRN not found'; end if;
  if g.status = 'posted' then raise exception 'GRN already posted'; end if;
  for it in select * from public.grn_items where grn_id = p_grn loop
    perform app.post_stock_movement(it.product_id, g.warehouse_id, it.location_id,
      it.stock_status, it.received_qty, 0, 'GRN', 'GRN', g.id::text, g.doc_no, null, 'Goods receipt');
    if g.po_id is not null then
      update public.purchase_order_items set received_qty = received_qty + it.received_qty
        where po_id = g.po_id and product_id = it.product_id;
    end if;
  end loop;
  if g.po_id is not null then
    update public.purchase_orders po set status =
      case when not exists (select 1 from public.purchase_order_items i where i.po_id = po.id and i.received_qty < i.qty)
        then 'received' else 'posted' end
    where po.id = g.po_id;
  end if;
  update public.grns set status = 'posted' where id = p_grn;
end $$;

create or replace function app.post_ni_transaction(p_id uuid) returns void
language plpgsql security definer set search_path to 'public' as $$
declare r public.ni_transactions; v_cur numeric;
begin
  select * into r from public.ni_transactions where id = p_id for update;
  if not found then raise exception 'Transaction not found'; end if;
  if r.status = 'posted' then raise exception 'Already posted'; end if;
  select current_qty into v_cur from public.non_inventory_items where id = r.ni_item_id for update;
  if v_cur is null then raise exception 'Non-inventory item not found'; end if;
  if r.qty > v_cur then raise exception 'Insufficient quantity (have %, need %)', v_cur, r.qty; end if;
  update public.non_inventory_items set current_qty = current_qty - r.qty where id = r.ni_item_id;
  update public.ni_transactions set status = 'posted' where id = p_id;
end $$;

create or replace function app.post_purchase_return(p_ret uuid) returns void
language plpgsql security definer set search_path to 'public' as $$
declare r public.purchase_returns; it public.purchase_return_items;
begin
  select * into r from public.purchase_returns where id = p_ret for update;
  if not found then raise exception 'Return not found'; end if;
  if r.status = 'posted' then raise exception 'Return already posted'; end if;
  for it in select * from public.purchase_return_items where return_id = p_ret loop
    perform app.post_stock_movement(it.product_id, r.warehouse_id, it.location_id,
      it.stock_status, 0, it.qty, 'PURCHASE_RETURN', 'PRTN', r.id::text, r.doc_no, null, coalesce(it.reason,'Purchase return'));
  end loop;
  update public.purchase_returns set status = 'posted' where id = p_ret;
end $$;

create or replace function app.post_putaway(p_pa uuid) returns void
language plpgsql security definer set search_path to 'public' as $$
declare pa public.putaways; it public.putaway_items;
begin
  select * into pa from public.putaways where id = p_pa for update;
  if not found then raise exception 'Putaway not found'; end if;
  if pa.status = 'posted' then raise exception 'Putaway already posted'; end if;
  for it in select * from public.putaway_items where putaway_id = p_pa loop
    if it.from_location_id is not null then
      perform app.post_stock_movement(it.product_id, pa.warehouse_id, it.from_location_id,
        it.stock_status, 0, it.qty, 'PUTAWAY', 'PUTAWAY', pa.id::text, pa.doc_no, null, 'Putaway out');
    end if;
    perform app.post_stock_movement(it.product_id, pa.warehouse_id, it.to_location_id,
      it.stock_status, it.qty, 0, 'PUTAWAY', 'PUTAWAY', pa.id::text, pa.doc_no, null, 'Putaway in');
  end loop;
  update public.putaways set status = 'posted' where id = p_pa;
end $$;

create or replace function app.post_refurbishment(p_rf uuid) returns void
language plpgsql security definer set search_path to 'public' as $$
declare r public.refurbishments; it public.refurbishment_items;
begin
  select * into r from public.refurbishments where id = p_rf for update;
  if not found then raise exception 'Refurbishment not found'; end if;
  if r.status = 'posted' then raise exception 'Already posted'; end if;
  for it in select * from public.refurbishment_items where refurb_id = p_rf loop
    if coalesce(it.qty,0) <= 0 then continue; end if;
    perform app.post_stock_movement(it.product_id, r.warehouse_id, it.location_id,
      it.from_status, 0, it.qty, 'REFURBISHMENT', 'RFB', r.id::text, r.doc_no, null, coalesce(it.reason, 'Refurbishment'));
    if it.to_status <> 'scrap' then
      perform app.post_stock_movement(it.product_id, r.warehouse_id, it.location_id,
        it.to_status, it.qty, 0, 'REFURBISHMENT', 'RFB', r.id::text, r.doc_no, null, coalesce(it.reason, 'Refurbishment'));
    end if;
  end loop;
  update public.refurbishments set status = 'posted' where id = p_rf;
end $$;

create or replace function app.post_replacement(p_rep uuid) returns void
language plpgsql security definer set search_path to 'public' as $$
declare r public.replacements; it public.replacement_items;
begin
  select * into r from public.replacements where id = p_rep for update;
  if not found then raise exception 'Replacement not found'; end if;
  if r.status = 'posted' then raise exception 'Already posted'; end if;
  for it in select * from public.replacement_items where replacement_id = p_rep loop
    perform app.post_stock_movement(it.product_id, r.warehouse_id, it.location_id,
      it.stock_status, case when it.direction='in' then it.qty else 0 end,
      case when it.direction='out' then it.qty else 0 end,
      'REPLACEMENT', 'RPL', r.id::text, r.doc_no, null, coalesce(it.reason,'Replacement'));
  end loop;
  update public.replacements set status = 'posted' where id = p_rep;
end $$;

create or replace function app.post_return_inspection(p_ri uuid) returns void
language plpgsql security definer set search_path to 'public' as $$
declare r public.return_inspections; it public.return_inspection_items;
begin
  select * into r from public.return_inspections where id = p_ri for update;
  if not found then raise exception 'Return inspection not found'; end if;
  if r.status = 'posted' then raise exception 'Already posted'; end if;
  for it in select * from public.return_inspection_items where ri_id = p_ri loop
    if coalesce(it.qty,0) <= 0 then continue; end if;
    perform app.post_stock_movement(it.product_id, r.warehouse_id, it.location_id,
      it.from_status, 0, it.qty, 'RETURN_INSPECTION', 'RINS', r.id::text, r.doc_no, null, coalesce(it.reason, 'Return inspection'));
    if it.to_status <> 'scrap' then
      perform app.post_stock_movement(it.product_id, r.warehouse_id, it.location_id,
        it.to_status, it.qty, 0, 'RETURN_INSPECTION', 'RINS', r.id::text, r.doc_no, null, coalesce(it.reason, 'Return inspection'));
    end if;
  end loop;
  update public.return_inspections set status = 'posted' where id = p_ri;
end $$;

create or replace function app.post_sales_return(p_srn uuid) returns void
language plpgsql security definer set search_path to 'public' as $$
declare r public.sales_returns; it public.sales_return_items;
begin
  select * into r from public.sales_returns where id = p_srn for update;
  if not found then raise exception 'Sales return not found'; end if;
  if r.status = 'posted' then raise exception 'Already posted'; end if;
  for it in select * from public.sales_return_items where srn_id = p_srn loop
    perform app.post_stock_movement(it.product_id, r.warehouse_id, it.location_id,
      it.stock_status, it.qty, 0, 'SALES_RETURN', 'SRN', r.id::text, r.doc_no, null, coalesce(it.reason,'Sales return'));
  end loop;
  update public.sales_returns set status = 'posted' where id = p_srn;
end $$;

create or replace function app.post_stock_count(p_count uuid) returns void
language plpgsql security definer set search_path to 'public' as $$
declare r public.stock_counts; it public.stock_count_items; v_current numeric; v_diff numeric;
begin
  select * into r from public.stock_counts where id = p_count for update;
  if not found then raise exception 'Stock count not found'; end if;
  if r.status = 'posted' then raise exception 'Already posted'; end if;
  for it in select * from public.stock_count_items where count_id = p_count loop
    select coalesce(quantity, 0) into v_current from public.inventory_stock
      where product_id = it.product_id and warehouse_id = r.warehouse_id
        and location_id is not distinct from it.location_id and stock_status = it.stock_status;
    v_current := coalesce(v_current, 0);
    v_diff := coalesce(it.counted_qty,0) - v_current;
    if v_diff = 0 then continue; end if;
    perform app.post_stock_movement(it.product_id, r.warehouse_id, it.location_id, it.stock_status,
      case when v_diff > 0 then v_diff else 0 end,
      case when v_diff < 0 then -v_diff else 0 end,
      'COUNT_ADJUST', 'CNT', r.id::text, r.doc_no, null, r.count_type || ' count variance');
  end loop;
  update public.stock_counts set status = 'posted' where id = p_count;
end $$;

create or replace function app.post_delivery_challan(p_challan_id uuid) returns text
language plpgsql security definer set search_path to 'public' as $$
declare
  c public.delivery_challans; so public.sales_orders; it record;
  serial_list text[] := '{}'; gp_no text;
  v_all_done boolean; v_so_delivered numeric; v_pending numeric; v_inv_remaining numeric;
begin
  select * into c from public.delivery_challans where id = p_challan_id for update;
  if not found then raise exception 'Challan not found'; end if;
  if not app.has_permission('inventory.adjust') then
    raise exception 'Access denied: inventory.adjust permission required';
  end if;
  if c.posted_at is not null then raise exception 'This challan is already issued & stock deducted'; end if;
  if c.warehouse_id is null then raise exception 'Set a warehouse on the challan before issuing'; end if;
  if not exists (select 1 from public.delivery_challan_items where challan_id = p_challan_id) then
    raise exception 'Add line items before issuing';
  end if;
  if c.sales_order_id is not null then
    select * into so from public.sales_orders where id = c.sales_order_id for update;
    if found and so.status in ('draft','pending','rejected') then
      raise exception 'Order % is not approved yet — approval must happen before delivery', so.so_no;
    end if;
  end if;
  for it in select * from public.delivery_challan_items where challan_id = p_challan_id loop
    if it.product_id is null or it.qty is null or it.qty <= 0 then continue; end if;
    if it.so_item_id is not null then
      select qty - delivered_qty into v_pending from public.sales_order_items where id = it.so_item_id;
      if v_pending is not null and it.qty > v_pending then
        raise exception 'Line delivers % but only % is still pending on the order — reduce the challan qty', it.qty, greatest(v_pending, 0);
      end if;
      if c.invoice_id is not null then
        select ii.qty - coalesce((
                 select sum(ci.qty) from public.delivery_challan_items ci
                 join public.delivery_challans dc on dc.id = ci.challan_id
                 where dc.invoice_id = c.invoice_id and dc.id <> c.id
                   and dc.posted_at is not null and ci.so_item_id = it.so_item_id), 0)
          into v_inv_remaining
          from public.so_invoice_items ii
          where ii.invoice_id = c.invoice_id and ii.so_item_id = it.so_item_id;
        if v_inv_remaining is null then
          raise exception 'This product is not on invoice % — non-invoiced quantity cannot go on a delivery challan', c.invoice_no;
        end if;
        if it.qty > v_inv_remaining then
          raise exception 'Invoice % has only % remaining for this product (challan line asks %)', c.invoice_no, greatest(v_inv_remaining, 0), it.qty;
        end if;
      end if;
    end if;
    perform app.post_stock_movement(
      it.product_id, c.warehouse_id, it.location_id, coalesce(it.stock_status, 'good'),
      0, it.qty, 'DELIVERY', 'delivery_challan', c.id::text, c.challan_no, it.serial_no,
      'Challan ' || c.challan_no || case when c.invoice_no is not null then ' - Invoice ' || c.invoice_no else '' end);
    if it.serial_no is not null then serial_list := array_append(serial_list, it.serial_no); end if;
    if it.so_item_id is not null then
      update public.sales_order_items set delivered_qty = delivered_qty + it.qty where id = it.so_item_id;
    end if;
  end loop;
  if array_length(serial_list, 1) > 0 then
    update public.serial_numbers set status = 'delivered', reference_no = c.challan_no
      where serial_no = any(serial_list);
  end if;
  if c.sales_order_id is not null then
    select (count(*) > 0) and bool_and(delivered_qty >= qty), coalesce(sum(delivered_qty), 0)
      into v_all_done, v_so_delivered from public.sales_order_items where so_id = c.sales_order_id;
    update public.sales_orders
      set status = case when v_all_done then 'delivered' else 'dispatched' end, delivered_qty = v_so_delivered
      where id = c.sales_order_id;
  end if;
  gp_no := app.next_document_number('GP');
  if gp_no is not null then
    insert into public.gate_passes(gate_pass_no, challan_id, vehicle_id, driver_name, transporter_id, gate_out_date, status, purpose)
    values (gp_no, c.id, c.vehicle_id, c.driver_name, c.transporter_id, current_date, 'issued',
      'Delivery - Challan ' || c.challan_no || case when c.invoice_no is not null then ', Invoice ' || c.invoice_no else '' end);
  end if;
  update public.delivery_challans set posted_at = now(), status = 'issued', dispatch_time = app.stamp_dispatch_time() where id = c.id;
  return gp_no;
end; $$;

-- ---------- public RPC wrappers (no p_client) ----------
create function public.post_stock_movement(
  p_product uuid, p_warehouse uuid, p_stock_status text, p_qty_in numeric, p_qty_out numeric,
  p_movement_type text, p_location uuid default null, p_reference_type text default 'MANUAL',
  p_reference_id text default null, p_reference_no text default null, p_serial_no text default null, p_remarks text default null)
returns bigint language plpgsql security definer set search_path to 'pg_catalog', 'public' as $$
begin
  if not app.has_permission('inventory.adjust') then
    raise exception 'Access denied: inventory.adjust permission required';
  end if;
  return app.post_stock_movement(p_product, p_warehouse, p_location, p_stock_status,
    p_qty_in, p_qty_out, p_movement_type, p_reference_type, p_reference_id, p_reference_no, p_serial_no, p_remarks);
end; $$;

create function public.post_stock_transfer(
  p_product uuid, p_from_warehouse uuid, p_from_location uuid, p_to_warehouse uuid, p_to_location uuid,
  p_stock_status text, p_qty numeric, p_reference_no text default null, p_remarks text default null)
returns void language sql security definer set search_path to 'pg_catalog', 'public'
as $$ select app.post_stock_transfer(p_product, p_from_warehouse, p_from_location, p_to_warehouse, p_to_location, p_stock_status, p_qty, p_reference_no, p_remarks); $$;

create function public.next_document_number(p_doc_type text)
returns text language sql security definer set search_path to 'pg_catalog', 'public'
as $$ select app.next_document_number(p_doc_type); $$;

create function public.next_finance_document_number(p_prefix text)
returns text language sql security definer set search_path to 'pg_catalog', 'public'
as $$ select app.next_finance_document_number(p_prefix); $$;

create function public.next_challan_number(p_invoice text)
returns text language sql security definer set search_path to 'pg_catalog', 'public'
as $$ select app.next_challan_number(p_invoice); $$;

create function public.update_doc_numbering(p_doc_type text, p_prefix text, p_padding integer)
returns void language sql security definer set search_path to 'pg_catalog', 'public'
as $$ select app.update_doc_numbering(p_doc_type, p_prefix, p_padding); $$;

create or replace function public.adjust_stock_hold(p_stock_id uuid, p_qty numeric, p_hold boolean)
returns void language plpgsql security definer set search_path to 'pg_catalog', 'public' as $$
begin
  if not exists (select 1 from public.inventory_stock where id = p_stock_id) then
    raise exception 'Stock row not found';
  end if;
  if not app.has_permission('inventory.adjust') then
    raise exception 'Access denied: inventory.adjust permission required';
  end if;
  perform app.adjust_stock_hold(p_stock_id, p_qty, p_hold);
end; $$;

-- ---------- grants (recreated functions lose grants) ----------
revoke all on function public.post_stock_movement(uuid, uuid, text, numeric, numeric, text, uuid, text, text, text, text, text) from public, anon;
grant execute on function public.post_stock_movement(uuid, uuid, text, numeric, numeric, text, uuid, text, text, text, text, text) to authenticated;
revoke all on function public.post_stock_transfer(uuid, uuid, uuid, uuid, uuid, text, numeric, text, text) from public, anon;
grant execute on function public.post_stock_transfer(uuid, uuid, uuid, uuid, uuid, text, numeric, text, text) to authenticated;
revoke all on function public.next_document_number(text) from public, anon;
grant execute on function public.next_document_number(text) to authenticated;
revoke all on function public.next_finance_document_number(text) from public, anon;
grant execute on function public.next_finance_document_number(text) to authenticated;
revoke all on function public.next_challan_number(text) from public, anon;
grant execute on function public.next_challan_number(text) to authenticated;
revoke all on function public.update_doc_numbering(text, text, integer) from public, anon;
grant execute on function public.update_doc_numbering(text, text, integer) to authenticated;
grant execute on function app.post_stock_movement(uuid, uuid, uuid, text, numeric, numeric, text, text, text, text, text, text) to authenticated;
grant execute on function app.post_stock_transfer(uuid, uuid, uuid, uuid, uuid, text, numeric, text, text) to authenticated;
grant execute on function app.next_document_number(text) to authenticated;
grant execute on function app.next_finance_document_number(text) to authenticated;
grant execute on function app.next_challan_number(text) to authenticated;
grant execute on function app.update_doc_numbering(text, text, integer) to authenticated;
