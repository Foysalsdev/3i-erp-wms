-- A transfer was two separate post_stock_movement calls from the browser; if
-- the second failed (network drop, validation) the stock had already left the
-- source and never arrived, silently losing on-hand. Do both legs in one
-- database transaction: either the whole transfer posts or none of it does.
create or replace function app.post_stock_transfer(
  p_client uuid, p_product uuid,
  p_from_warehouse uuid, p_from_location uuid,
  p_to_warehouse uuid, p_to_location uuid,
  p_stock_status text, p_qty numeric,
  p_reference_no text default null, p_remarks text default null
) returns void
language plpgsql security definer set search_path to 'public'
as $$
begin
  if p_qty is null or p_qty <= 0 then
    raise exception 'Quantity must be positive';
  end if;
  if p_from_warehouse = p_to_warehouse and p_from_location is not distinct from p_to_location then
    raise exception 'Source and destination must differ';
  end if;
  perform app.post_stock_movement(p_client, p_product, p_from_warehouse, p_from_location,
    p_stock_status, 0, p_qty, 'TRANSFER', 'TRANSFER', null, p_reference_no, null,
    coalesce(p_remarks, 'Stock transfer (out)'));
  perform app.post_stock_movement(p_client, p_product, p_to_warehouse, p_to_location,
    p_stock_status, p_qty, 0, 'TRANSFER', 'TRANSFER', null, p_reference_no, null,
    coalesce(p_remarks, 'Stock transfer (in)'));
end $$;

create or replace function public.post_stock_transfer(
  p_client uuid, p_product uuid,
  p_from_warehouse uuid, p_from_location uuid,
  p_to_warehouse uuid, p_to_location uuid,
  p_stock_status text, p_qty numeric,
  p_reference_no text default null, p_remarks text default null
) returns void
language sql security definer set search_path to 'pg_catalog', 'public'
as $$ select app.post_stock_transfer(p_client, p_product, p_from_warehouse, p_from_location, p_to_warehouse, p_to_location, p_stock_status, p_qty, p_reference_no, p_remarks); $$;
