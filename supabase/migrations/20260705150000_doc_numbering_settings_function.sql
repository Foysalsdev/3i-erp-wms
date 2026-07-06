-- Settings → Document Numbering: let users with settings.edit change the
-- prefix/padding of their client's document number ranges, without opening
-- direct UPDATE on document_sequences (next_number stays server-managed so
-- a user can't wind a counter back onto already-issued numbers).
create or replace function app.update_doc_numbering(p_client uuid, p_doc_type text, p_prefix text, p_padding int)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not (app.is_platform_admin() or app.has_permission('settings.edit', p_client)) then
    raise exception 'Not allowed to change document numbering for this client';
  end if;
  if p_padding is null or p_padding < 3 or p_padding > 8 then
    raise exception 'Padding must be between 3 and 8 digits';
  end if;
  if p_prefix is null or length(trim(p_prefix)) = 0 or length(trim(p_prefix)) > 8
     or trim(p_prefix) !~ '^[A-Za-z0-9]+$' then
    raise exception 'Prefix must be 1-8 letters/digits';
  end if;

  insert into public.document_sequences(client_id, doc_type, prefix, next_number, padding, last_date)
  values (p_client, p_doc_type, upper(trim(p_prefix)), 1, p_padding, current_date)
  on conflict (client_id, doc_type)
  do update set prefix = excluded.prefix, padding = excluded.padding;
end;
$$;

grant execute on function app.update_doc_numbering(uuid, text, text, int) to authenticated;
