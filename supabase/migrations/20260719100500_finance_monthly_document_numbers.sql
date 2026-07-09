-- Dedicated monthly-reset numbering for the Finance module's new ID formats
-- (EXP-YYYYMM-00001, IV-YYYYMM-00001, HOS-YYYYMM-00001). Separate from the
-- shared app.next_document_number (daily reset, DDMMYY, used by Sales Order
-- etc.) so this doesn't touch or risk any other module's numbering.
create table public.finance_document_sequences (
  client_id uuid not null references public.clients(id) on delete cascade,
  prefix text not null,
  year_month text not null,
  next_number int not null default 1,
  primary key (client_id, prefix, year_month)
);

alter table public.finance_document_sequences enable row level security;
create policy finance_document_sequences_select on public.finance_document_sequences for select
  using (app.has_client_access(client_id));

create or replace function app.next_finance_document_number(p_client uuid, p_prefix text)
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_ym  text := to_char(current_date, 'YYYYMM');
  v_seq public.finance_document_sequences;
  v_num int;
begin
  if not exists (select 1 from public.clients where id = p_client) then
    raise exception 'Unknown client %', p_client;
  end if;

  select * into v_seq from public.finance_document_sequences
    where client_id = p_client and prefix = p_prefix and year_month = v_ym for update;

  if not found then
    insert into public.finance_document_sequences(client_id, prefix, year_month, next_number)
    values (p_client, p_prefix, v_ym, 1)
    returning * into v_seq;
  end if;

  v_num := v_seq.next_number;
  update public.finance_document_sequences set next_number = next_number + 1
    where client_id = p_client and prefix = p_prefix and year_month = v_ym;

  return p_prefix || '-' || v_ym || '-' || lpad(v_num::text, 5, '0');
end;
$function$;
