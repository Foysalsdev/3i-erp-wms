-- The finance/challan/settings numbering RPCs existed only in the "app"
-- schema, which anon/authenticated cannot reach through PostgREST
-- ("permission denied for schema app"). Every call from the UI failed:
-- challan issue and HO submission threw, finalized expenses were saved with
-- a NULL doc_no, and Settings -> Document Numbering could not save.
-- Expose them through SECURITY DEFINER wrappers in public — the same pattern
-- every other posting RPC already uses — and while here, add the missing
-- client-access check to public.next_document_number (it previously let any
-- signed-in user advance any client's sequences cross-tenant).

create or replace function public.next_document_number(p_client uuid, p_doc_type text)
returns text
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
begin
  if not app.has_client_access(p_client) then
    raise exception 'Access denied for client %', p_client;
  end if;
  return app.next_document_number(p_client, p_doc_type);
end;
$$;

create or replace function public.next_finance_document_number(p_client uuid, p_prefix text)
returns text
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
begin
  if not app.has_client_access(p_client) then
    raise exception 'Access denied for client %', p_client;
  end if;
  return app.next_finance_document_number(p_client, p_prefix);
end;
$$;

create or replace function public.next_challan_number(p_client uuid, p_invoice text)
returns text
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
begin
  if not app.has_client_access(p_client) then
    raise exception 'Access denied for client %', p_client;
  end if;
  return app.next_challan_number(p_client, p_invoice);
end;
$$;

-- app.update_doc_numbering enforces settings.edit / platform-admin itself.
create or replace function public.update_doc_numbering(p_client uuid, p_doc_type text, p_prefix text, p_padding int)
returns void
language sql
security definer
set search_path to 'pg_catalog', 'public'
as $$
  select app.update_doc_numbering(p_client, p_doc_type, p_prefix, p_padding);
$$;

-- Signed-in users only; nothing for anon.
revoke execute on function public.next_document_number(uuid, text) from public, anon;
revoke execute on function public.next_finance_document_number(uuid, text) from public, anon;
revoke execute on function public.next_challan_number(uuid, text) from public, anon;
revoke execute on function public.update_doc_numbering(uuid, text, text, int) from public, anon;
grant execute on function public.next_document_number(uuid, text) to authenticated, service_role;
grant execute on function public.next_finance_document_number(uuid, text) to authenticated, service_role;
grant execute on function public.next_challan_number(uuid, text) to authenticated, service_role;
grant execute on function public.update_doc_numbering(uuid, text, text, int) to authenticated, service_role;

-- Defense in depth: strip stray EXECUTE grants (some were granted to PUBLIC)
-- from app-schema business functions. Clients must go through the public
-- wrappers, which run as the function owner; missing schema USAGE already
-- blocked direct calls, this makes the grants say so too.
revoke execute on function app.next_challan_number(uuid, text) from public, anon, authenticated;
revoke execute on function app.next_document_number(uuid, text) from public, anon, authenticated;
revoke execute on function app.update_doc_numbering(uuid, text, text, int) from public, anon, authenticated;
revoke execute on function app.post_exchange(uuid) from public, anon, authenticated;
revoke execute on function app.post_grn(uuid) from public, anon, authenticated;
revoke execute on function app.post_purchase_return(uuid) from public, anon, authenticated;
revoke execute on function app.post_putaway(uuid) from public, anon, authenticated;
revoke execute on function app.post_replacement(uuid) from public, anon, authenticated;
revoke execute on function app.post_sales_return(uuid) from public, anon, authenticated;
revoke execute on function app.post_stock_movement(uuid, uuid, uuid, uuid, text, numeric, numeric, text, text, text, text, text, text) from public, anon, authenticated;
