-- Shorten document numbers (e.g. WHP-SO-2026-00003 -> SO-0107260001): drop the
-- client prefix, bake DDMMYY into the number, and reset the per-day counter
-- instead of per-year, since the date itself now makes the number unique.
alter table public.document_sequences add column if not exists last_date date not null default current_date;

-- New format is a 4-digit daily count, not the old 5-digit yearly count.
update public.document_sequences set padding = 4;

alter table public.document_sequences drop column if exists reset_yearly;
alter table public.document_sequences drop column if exists year;

create or replace function app.next_document_number(p_client uuid, p_doc_type text)
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_seq   public.document_sequences;
  v_today date := current_date;
  v_num   bigint;
begin
  if not exists (select 1 from public.clients where id = p_client) then
    raise exception 'Unknown client %', p_client;
  end if;

  select * into v_seq from public.document_sequences
    where client_id = p_client and doc_type = p_doc_type for update;

  if not found then
    insert into public.document_sequences(client_id, doc_type, prefix, next_number, padding, last_date)
    values (p_client, p_doc_type, p_doc_type, 1, 4, v_today)
    returning * into v_seq;
  end if;

  if v_seq.last_date <> v_today then
    update public.document_sequences set next_number = 1, last_date = v_today
      where id = v_seq.id returning * into v_seq;
  end if;

  v_num := v_seq.next_number;
  update public.document_sequences set next_number = next_number + 1 where id = v_seq.id;

  -- SO-DDMMYYNNNN — no client prefix, date baked into the number, daily-reset count.
  return v_seq.prefix || '-' || to_char(v_today, 'DDMMYY')
         || lpad(v_num::text, v_seq.padding, '0');
end;
$function$;
