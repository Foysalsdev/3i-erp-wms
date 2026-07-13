-- Single-client conversion, step 2/3: rewrite every SECURITY DEFINER function
-- to drop the client dimension. Roles become global (has_permission ignores client).

-- ---------- core helpers (same signature -> CREATE OR REPLACE keeps grants) ----------
create or replace function app.has_permission(p_key text, p_client uuid default null)
returns boolean language sql stable security definer set search_path to 'public'
as $$
  select app.is_platform_admin()
    or exists (
      select 1 from public.user_roles ur
      join public.role_permissions rp on rp.role_id = ur.role_id
      join public.permissions pm on pm.id = rp.permission_id
      where ur.user_id = auth.uid() and pm.key = p_key
    );
$$;

create or replace function app.has_client_access(p_client uuid)
returns boolean language sql stable security definer set search_path to 'public'
as $$ select true; $$;

create or replace function app.current_client_ids()
returns uuid[] language sql stable security definer set search_path to 'public'
as $$ select '{}'::uuid[]; $$;

create or replace function app.audit_trigger() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare v_old jsonb := null; v_new jsonb := null; v_id text;
begin
  if tg_op = 'DELETE' then v_old := to_jsonb(old);
  elsif tg_op = 'INSERT' then v_new := to_jsonb(new);
  else v_old := to_jsonb(old); v_new := to_jsonb(new); end if;
  v_id := coalesce(v_new->>'id', v_old->>'id',
    case tg_table_name
      when 'role_permissions' then
        coalesce(v_new->>'role_id', v_old->>'role_id') || ':' || coalesce(v_new->>'permission_id', v_old->>'permission_id')
      else null end);
  insert into public.audit_logs(table_name, record_id, action, old_data, new_data, changed_by)
  values (tg_table_name, v_id, tg_op, v_old, v_new, auth.uid());
  if tg_op = 'DELETE' then return old; else return new; end if;
end; $$;

create or replace function app.check_finance_period_open() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare
  v_date date; v_old date;
  j_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) else null end;
  j_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) else null end;
  locked boolean;
begin
  v_date := coalesce(
    (case when tg_op = 'DELETE' then j_old else j_new end)->>'receipt_date',
    (case when tg_op = 'DELETE' then j_old else j_new end)->>'expense_date',
    (case when tg_op = 'DELETE' then j_old else j_new end)->>'adjustment_date',
    (case when tg_op = 'DELETE' then j_old else j_new end)->>'payment_date')::date;
  if v_date is not null then
    select exists (select 1 from public.finance_monthly_adjustments a
      where a.year = extract(year from v_date)::int and a.month = extract(month from v_date)::int
        and a.submitted_at is not null) into locked;
    if locked then
      raise exception 'Finance period % is submitted (locked). Reopen that month''s statement before changing its transactions.', to_char(v_date, 'Mon YYYY');
    end if;
  end if;
  if tg_op = 'UPDATE' then
    v_old := coalesce(j_old->>'receipt_date', j_old->>'expense_date', j_old->>'adjustment_date', j_old->>'payment_date')::date;
    if v_old is not null and v_old is distinct from v_date then
      select exists (select 1 from public.finance_monthly_adjustments a
        where a.year = extract(year from v_old)::int and a.month = extract(month from v_old)::int
          and a.submitted_at is not null) into locked;
      if locked then raise exception 'Finance period % is submitted (locked).', to_char(v_old, 'Mon YYYY'); end if;
    end if;
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end; $$;

create or replace function app.adjust_stock_hold(p_stock_id uuid, p_qty numeric, p_hold boolean)
returns void language plpgsql security definer set search_path to 'public' as $$
declare s public.inventory_stock;
begin
  select * into s from public.inventory_stock where id = p_stock_id for update;
  if not found then raise exception 'Stock row not found'; end if;
  if coalesce(p_qty,0) <= 0 then raise exception 'Quantity must be positive'; end if;
  if p_hold then
    update public.inventory_stock set reserved_qty = least(coalesce(quantity,0), coalesce(reserved_qty,0) + p_qty) where id = p_stock_id;
  else
    update public.inventory_stock set reserved_qty = greatest(0, coalesce(reserved_qty,0) - p_qty) where id = p_stock_id;
  end if;
end $$;

-- ---------- signature-changing functions: drop old, create new ----------
drop function if exists app.post_stock_movement(uuid, uuid, uuid, uuid, text, numeric, numeric, text, text, text, text, text, text);
drop function if exists app.post_stock_transfer(uuid, uuid, uuid, uuid, uuid, uuid, text, numeric, text, text);
drop function if exists app.next_document_number(uuid, text);
drop function if exists app.next_finance_document_number(uuid, text);
drop function if exists app.next_challan_number(uuid, text);
drop function if exists app.update_doc_numbering(uuid, text, text, integer);
drop function if exists public.post_stock_movement(uuid, uuid, uuid, text, numeric, numeric, text, uuid, text, text, text, text, text);
drop function if exists public.post_stock_transfer(uuid, uuid, uuid, uuid, uuid, uuid, text, numeric, text, text);
drop function if exists public.next_document_number(uuid, text);
drop function if exists public.next_finance_document_number(uuid, text);
drop function if exists public.next_challan_number(uuid, text);
drop function if exists public.update_doc_numbering(uuid, text, text, integer);

create function app.post_stock_movement(
  p_product uuid, p_warehouse uuid, p_location uuid, p_stock_status text,
  p_qty_in numeric, p_qty_out numeric, p_movement_type text,
  p_reference_type text default null, p_reference_id text default null,
  p_reference_no text default null, p_serial_no text default null, p_remarks text default null)
returns bigint language plpgsql security definer set search_path to 'public' as $$
declare v_row public.inventory_stock; v_ledger_id bigint;
begin
  if coalesce(p_qty_in,0) < 0 or coalesce(p_qty_out,0) < 0 then
    raise exception 'Quantities must be non-negative';
  end if;
  begin
    update public.inventory_stock
      set quantity = quantity + coalesce(p_qty_in,0) - coalesce(p_qty_out,0), updated_at = now()
      where product_id = p_product and warehouse_id = p_warehouse
        and location_id is not distinct from p_location
        and stock_status = coalesce(p_stock_status,'good')
      returning * into v_row;
    if not found then
      if coalesce(p_qty_in,0) - coalesce(p_qty_out,0) < 0 then
        raise exception 'Insufficient stock: movement would result in negative quantity.';
      end if;
      insert into public.inventory_stock(product_id, warehouse_id, location_id, stock_status, quantity)
      values (p_product, p_warehouse, p_location, coalesce(p_stock_status,'good'),
              coalesce(p_qty_in,0) - coalesce(p_qty_out,0))
      on conflict (product_id, warehouse_id, location_id, stock_status)
      do update set quantity = public.inventory_stock.quantity + excluded.quantity, updated_at = now()
      returning * into v_row;
    end if;
  exception when check_violation then
    raise exception 'Insufficient stock: movement would result in negative quantity.';
  end;
  insert into public.inventory_ledger(product_id, warehouse_id, location_id, stock_status,
        movement_type, qty_in, qty_out, balance_after, reference_type, reference_id, reference_no,
        serial_no, remarks, created_by)
  values (p_product, p_warehouse, p_location, coalesce(p_stock_status,'good'),
        p_movement_type, coalesce(p_qty_in,0), coalesce(p_qty_out,0), v_row.quantity,
        p_reference_type, p_reference_id, p_reference_no, p_serial_no, p_remarks, auth.uid())
  returning id into v_ledger_id;
  return v_ledger_id;
end $$;

create function app.post_stock_transfer(
  p_product uuid, p_from_warehouse uuid, p_from_location uuid, p_to_warehouse uuid, p_to_location uuid,
  p_stock_status text, p_qty numeric, p_reference_no text default null, p_remarks text default null)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if p_qty is null or p_qty <= 0 then raise exception 'Quantity must be positive'; end if;
  if p_from_warehouse = p_to_warehouse and p_from_location is not distinct from p_to_location then
    raise exception 'Source and destination must differ';
  end if;
  perform app.post_stock_movement(p_product, p_from_warehouse, p_from_location,
    p_stock_status, 0, p_qty, 'TRANSFER', 'TRANSFER', null, p_reference_no, null,
    coalesce(p_remarks, 'Stock transfer (out)'));
  perform app.post_stock_movement(p_product, p_to_warehouse, p_to_location,
    p_stock_status, p_qty, 0, 'TRANSFER', 'TRANSFER', null, p_reference_no, null,
    coalesce(p_remarks, 'Stock transfer (in)'));
end $$;

create function app.next_document_number(p_doc_type text)
returns text language plpgsql security definer set search_path to 'public' as $$
declare v_seq public.document_sequences; v_today date := current_date; v_num bigint;
begin
  select * into v_seq from public.document_sequences where doc_type = p_doc_type for update;
  if not found then
    insert into public.document_sequences(doc_type, prefix, next_number, padding, last_date)
    values (p_doc_type, p_doc_type, 1, 4, v_today) returning * into v_seq;
  end if;
  if v_seq.last_date <> v_today then
    update public.document_sequences set next_number = 1, last_date = v_today where id = v_seq.id returning * into v_seq;
  end if;
  v_num := v_seq.next_number;
  update public.document_sequences set next_number = next_number + 1 where id = v_seq.id;
  return v_seq.prefix || '-' || to_char(v_today, 'DDMMYY') || lpad(v_num::text, v_seq.padding, '0');
end; $$;

create function app.next_finance_document_number(p_prefix text)
returns text language plpgsql security definer set search_path to 'public' as $$
declare v_ym text := to_char(current_date, 'YYYYMM'); v_seq public.finance_document_sequences; v_num int;
begin
  select * into v_seq from public.finance_document_sequences where prefix = p_prefix and year_month = v_ym for update;
  if not found then
    insert into public.finance_document_sequences(prefix, year_month, next_number)
    values (p_prefix, v_ym, 1) returning * into v_seq;
  end if;
  v_num := v_seq.next_number;
  update public.finance_document_sequences set next_number = next_number + 1
    where prefix = p_prefix and year_month = v_ym;
  return p_prefix || '-' || v_ym || '-' || lpad(v_num::text, 5, '0');
end; $$;

create function app.next_challan_number(p_invoice text)
returns text language plpgsql security definer set search_path to 'public' as $$
declare v_inv5 text; v_per int; v_total bigint; v_seq public.document_sequences;
begin
  if p_invoice is null or btrim(p_invoice) = '' then
    raise exception 'Invoice number is required to generate a challan number';
  end if;
  v_inv5 := lpad(right(regexp_replace(p_invoice, '[^0-9]', '', 'g'), 5), 5, '0');
  select count(*) + 1 into v_per from public.delivery_challans where invoice_no = p_invoice;
  select * into v_seq from public.document_sequences where doc_type = 'DC_SERIAL' for update;
  if not found then
    insert into public.document_sequences(doc_type, prefix, next_number, padding, last_date)
    values ('DC_SERIAL', 'DC', (select count(*) + 1 from public.delivery_challans), 5, current_date)
    returning * into v_seq;
  end if;
  v_total := v_seq.next_number;
  update public.document_sequences set next_number = next_number + 1 where id = v_seq.id;
  return v_inv5 || lpad(v_per::text, 2, '0') || lpad(v_total::text, 5, '0');
end; $$;

create function app.update_doc_numbering(p_doc_type text, p_prefix text, p_padding integer)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not app.has_permission('settings.edit') then
    raise exception 'Not allowed to change document numbering';
  end if;
  if p_padding is null or p_padding < 3 or p_padding > 8 then
    raise exception 'Padding must be between 3 and 8 digits';
  end if;
  if p_prefix is null or length(trim(p_prefix)) = 0 or length(trim(p_prefix)) > 8
     or trim(p_prefix) !~ '^[A-Za-z0-9]+$' then
    raise exception 'Prefix must be 1-8 letters/digits';
  end if;
  insert into public.document_sequences(doc_type, prefix, next_number, padding, last_date)
  values (p_doc_type, upper(trim(p_prefix)), 1, p_padding, current_date)
  on conflict (doc_type) do update set prefix = excluded.prefix, padding = excluded.padding;
end; $$;
