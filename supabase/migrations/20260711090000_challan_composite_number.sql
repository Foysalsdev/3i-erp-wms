-- Challan numbers now encode three things in one all-numeric, barcode-friendly
-- string: the last 5 digits of the SAP invoice, this challan's ordinal within
-- that invoice (2-digit), and the client's running all-time challan serial
-- (5-digit). e.g. invoice 8815005505, 1st challan for it, 147th overall ->
-- 05505 01 00147 -> "055050100147". Invoice is mandatory (enforced here and in
-- the form). The running serial uses a dedicated non-resetting document_sequences
-- row (doc_type 'DC_SERIAL'), locked FOR UPDATE so it stays atomic and unique
-- even if two challans share the same invoice/ordinal.
create or replace function app.next_challan_number(p_client uuid, p_invoice text)
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_inv5  text;
  v_per   int;
  v_total bigint;
  v_seq   public.document_sequences;
begin
  if not exists (select 1 from public.clients where id = p_client) then
    raise exception 'Unknown client %', p_client;
  end if;
  if p_invoice is null or btrim(p_invoice) = '' then
    raise exception 'Invoice number is required to generate a challan number';
  end if;

  -- last 5 numeric digits of the invoice, left-padded to 5
  v_inv5 := lpad(right(regexp_replace(p_invoice, '[^0-9]', '', 'g'), 5), 5, '0');

  -- this challan's ordinal within the same invoice (1st, 2nd, ...)
  select count(*) + 1 into v_per
    from public.delivery_challans
    where client_id = p_client and invoice_no = p_invoice;

  -- running all-time challan serial for this client (never resets); seed a new
  -- counter from the existing challan count so it continues sensibly.
  select * into v_seq from public.document_sequences
    where client_id = p_client and doc_type = 'DC_SERIAL' for update;
  if not found then
    insert into public.document_sequences(client_id, doc_type, prefix, next_number, padding, last_date)
    values (p_client, 'DC_SERIAL', 'DC',
            (select count(*) + 1 from public.delivery_challans where client_id = p_client),
            5, current_date)
    returning * into v_seq;
  end if;
  v_total := v_seq.next_number;
  update public.document_sequences set next_number = next_number + 1 where id = v_seq.id;

  return v_inv5 || lpad(v_per::text, 2, '0') || lpad(v_total::text, 5, '0');
end;
$function$;

grant execute on function app.next_challan_number(uuid, text) to authenticated;
