-- Two problems, one fix:
--
-- 1. app.post_delivery_challan(uuid) already existed but was dead/broken —
--    left over from an earlier schema (it referenced delivery_challan_items
--    .dc_id, delivery_challans.so_id/doc_no and status='posted', none of
--    which exist any more; see delivery_challan_items.challan_id/so_item_id,
--    delivery_challans.sales_order_id/challan_no and status 'issued' in the
--    current schema). Calling it would simply error, which is presumably why
--    nothing ever called it.
-- 2. The frontend never called it anyway: DeliveryChallan.tsx issue() posts
--    one app.post_stock_movement call per line straight from the browser,
--    with no shared transaction. If a multi-line challan had a later line
--    run out of stock, that line's RPC correctly raised (post_stock_movement
--    rejects negative quantity) and issue() aborted — but the earlier lines
--    had already deducted real stock, the challan was never marked issued,
--    and retrying would deduct those earlier lines a second time. Same class
--    of bug already fixed for transfers in app.post_stock_transfer.
--
-- Replace the stale function with a correct one matching the live schema,
-- doing every line + the gate pass + the SO/serial updates in one
-- transaction, and point the frontend at it instead of the per-line loop.
-- (Dropped first: CREATE OR REPLACE can't rename the old p_dc parameter.)
drop function if exists app.post_delivery_challan(uuid);
drop function if exists public.post_delivery_challan(uuid);

-- Returns the generated gate-pass number (or null) so the caller can show it
-- in the success toast, same as the old per-line client-side flow did.
create or replace function app.post_delivery_challan(p_challan_id uuid)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  c public.delivery_challans;
  it record;
  serial_list text[] := '{}';
  gp_no text;
  v_all_done boolean;
  v_dispatch_time text;
begin
  select * into c from public.delivery_challans where id = p_challan_id for update;
  if not found then
    raise exception 'Challan not found';
  end if;

  if not app.has_permission('inventory.adjust', c.client_id) then
    raise exception 'Access denied: inventory.adjust permission required';
  end if;

  if c.posted_at is not null then
    raise exception 'This challan is already issued & stock deducted';
  end if;
  if c.warehouse_id is null then
    raise exception 'Set a warehouse on the challan before issuing';
  end if;
  if not exists (select 1 from public.delivery_challan_items where challan_id = p_challan_id) then
    raise exception 'Add line items before issuing';
  end if;

  for it in select * from public.delivery_challan_items where challan_id = p_challan_id loop
    if it.product_id is null or it.qty is null or it.qty <= 0 then
      continue;
    end if;
    -- Raises (and rolls back this whole function, including earlier lines
    -- already posted in this same loop) if this line would drive stock
    -- negative — the atomicity the old per-line client loop didn't have.
    perform app.post_stock_movement(
      c.client_id, it.product_id, c.warehouse_id, it.location_id,
      coalesce(it.stock_status, 'good'), 0, it.qty, 'DELIVERY',
      'delivery_challan', c.id::text, c.challan_no, it.serial_no,
      'Challan ' || c.challan_no || case when c.invoice_no is not null then ' - Invoice ' || c.invoice_no else '' end
    );
    if it.serial_no is not null then
      serial_list := array_append(serial_list, it.serial_no);
    end if;
    if it.so_item_id is not null then
      update public.sales_order_items set delivered_qty = delivered_qty + it.qty where id = it.so_item_id;
    end if;
  end loop;

  if array_length(serial_list, 1) > 0 then
    update public.serial_numbers set status = 'delivered', reference_no = c.challan_no
      where client_id = c.client_id and serial_no = any(serial_list);
  end if;

  if c.sales_order_id is not null then
    select (count(*) > 0) and bool_and(delivered_qty >= qty) into v_all_done
      from public.sales_order_items where so_id = c.sales_order_id;
    update public.sales_orders set status = case when v_all_done then 'delivered' else 'dispatched' end
      where id = c.sales_order_id;
  end if;

  gp_no := app.next_document_number(c.client_id, 'GP');
  if gp_no is not null then
    insert into public.gate_passes(client_id, gate_pass_no, challan_id, vehicle_id, driver_name, transporter_id, gate_out_date, status, purpose)
    values (c.client_id, gp_no, c.id, c.vehicle_id, c.driver_name, c.transporter_id, current_date, 'issued',
      'Delivery - Challan ' || c.challan_no || case when c.invoice_no is not null then ', Invoice ' || c.invoice_no else '' end);
  end if;

  -- Dispatch time is a free-text display field (see DeliveryChallanPDF.tsx),
  -- not parsed elsewhere — approximate the browser's previous DD/MM/YY h:mm AM format.
  v_dispatch_time := coalesce(c.dispatch_time, to_char(now(), 'DD/MM/YY') || ' ' || trim(to_char(now(), 'FMHH12:MI AM')));

  update public.delivery_challans
    set posted_at = now(), status = 'issued', dispatch_time = v_dispatch_time
    where id = c.id;

  return gp_no;
end;
$$;

create or replace function public.post_delivery_challan(p_challan_id uuid)
returns text
language sql
security definer
set search_path to 'pg_catalog', 'public'
as $$ select app.post_delivery_challan(p_challan_id); $$;

-- The drop above wiped the ACL that 20_revoke_anon_execute_on_post_rpcs put
-- on this function. A fresh CREATE FUNCTION on this project's public schema
-- comes back with EXECUTE granted directly to anon/authenticated/service_role
-- (Supabase's default privileges) — revoking from PUBLIC alone doesn't touch
-- that direct anon grant, so both have to be revoked explicitly. Verified
-- against pg_proc.proacl after applying: ends up identical to the correctly
-- hardened siblings (post_grn, post_putaway), i.e. no anon access.
revoke execute on function public.post_delivery_challan(uuid) from public;
revoke execute on function public.post_delivery_challan(uuid) from anon;
