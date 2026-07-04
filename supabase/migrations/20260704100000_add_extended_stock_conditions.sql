-- Real warehouse conditions beyond good/damaged/quarantine: units returned
-- via replacement, boxes torn / exterior damage, parts pulled from fresh
-- units. Registry lives in src/lib/conditions.ts; only 'good' is saleable.
do $$
declare t text;
begin
  foreach t in array array['inventory_stock','goods_receipt_items','dispatch_items','grn_items'] loop
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_stock_status_check');
    execute format(
      'alter table public.%I add constraint %I check (stock_status = any (array[''good'',''replacement_return'',''box_damaged'',''parts_removed'',''damaged'',''quarantine'']))',
      t, t || '_stock_status_check');
  end loop;
end $$;
