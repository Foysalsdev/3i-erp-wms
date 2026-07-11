-- Root-cause fix for duplicate inventory_stock rows. The unique key
-- (client, product, warehouse, location, status) treats NULL locations as
-- distinct, so two concurrent (or repeated) movements for a no-location
-- dimension could each take the "not found -> insert" path in
-- app.post_stock_movement and create parallel rows — observed live: one
-- product had rows of 10 and 20 for the same dimension while the ledger's
-- running balance tracked whichever row each movement happened to hit.
-- (Data already merged in a reconcile pass; ledger carries a RECONCILE entry.)
--
-- 1) Replace the unique key with a NULLS NOT DISTINCT one (PG15+).
-- 2) Rewrite the upsert as INSERT .. ON CONFLICT so it is race-proof.
-- 3) Belt-and-braces: quantity can never go negative at the table level.

alter table public.inventory_stock
  drop constraint if exists inventory_stock_client_id_product_id_warehouse_id_location__key;
alter table public.inventory_stock
  add constraint inventory_stock_dimension_key
  unique nulls not distinct (client_id, product_id, warehouse_id, location_id, stock_status);

alter table public.inventory_stock
  add constraint inventory_stock_quantity_non_negative check (quantity >= 0);

create or replace function app.post_stock_movement(
  p_client uuid, p_product uuid, p_warehouse uuid, p_location uuid,
  p_stock_status text, p_qty_in numeric, p_qty_out numeric, p_movement_type text,
  p_reference_type text default null, p_reference_id text default null,
  p_reference_no text default null, p_serial_no text default null, p_remarks text default null
) returns bigint
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_row     public.inventory_stock;
  v_ledger_id bigint;
begin
  if not app.has_client_access(p_client) then
    raise exception 'Access denied for client %', p_client;
  end if;
  if coalesce(p_qty_in,0) < 0 or coalesce(p_qty_out,0) < 0 then
    raise exception 'Quantities must be non-negative';
  end if;

  -- Update-first: an ON CONFLICT upsert cannot carry a negative delta because
  -- CHECK constraints are evaluated on the proposed row before conflict
  -- resolution. The update path covers every existing dimension atomically;
  -- the insert path only ever runs for a non-negative delta, where ON CONFLICT
  -- safely absorbs a concurrent create of the same dimension.
  begin
    update public.inventory_stock
      set quantity = quantity + coalesce(p_qty_in,0) - coalesce(p_qty_out,0), updated_at = now()
      where client_id = p_client and product_id = p_product and warehouse_id = p_warehouse
        and location_id is not distinct from p_location
        and stock_status = coalesce(p_stock_status,'good')
      returning * into v_row;

    if not found then
      if coalesce(p_qty_in,0) - coalesce(p_qty_out,0) < 0 then
        raise exception 'Insufficient stock: movement would result in negative quantity.';
      end if;
      insert into public.inventory_stock(client_id, product_id, warehouse_id, location_id, stock_status, quantity)
      values (p_client, p_product, p_warehouse, p_location, coalesce(p_stock_status,'good'),
              coalesce(p_qty_in,0) - coalesce(p_qty_out,0))
      on conflict (client_id, product_id, warehouse_id, location_id, stock_status)
      do update set quantity = public.inventory_stock.quantity + excluded.quantity, updated_at = now()
      returning * into v_row;
    end if;
  exception when check_violation then
    -- the quantity >= 0 table constraint fired: friendlier message for the UI
    raise exception 'Insufficient stock: movement would result in negative quantity.';
  end;

  insert into public.inventory_ledger(client_id, product_id, warehouse_id, location_id, stock_status,
        movement_type, qty_in, qty_out, balance_after, reference_type, reference_id, reference_no,
        serial_no, remarks, created_by)
  values (p_client, p_product, p_warehouse, p_location, coalesce(p_stock_status,'good'),
        p_movement_type, coalesce(p_qty_in,0), coalesce(p_qty_out,0), v_row.quantity,
        p_reference_type, p_reference_id, p_reference_no, p_serial_no, p_remarks, auth.uid())
  returning id into v_ledger_id;

  return v_ledger_id;
end;
$function$;
