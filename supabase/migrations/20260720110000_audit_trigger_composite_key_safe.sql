-- app.audit_trigger() read old.id/new.id directly, which crashes on audited
-- tables that have no `id` column (composite PKs): role_permissions,
-- user_clients. Any DELETE/INSERT there aborted; callers that swallowed the
-- failed delete then collided on the pkey on re-insert ("duplicate key").
-- Derive the record id from the row jsonb instead, with a composite fallback
-- for id-less tables. Behaviour is identical for tables that do have `id`.
create or replace function app.audit_trigger()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_client uuid;
  v_old jsonb := null;
  v_new jsonb := null;
  v_id text;
begin
  if (tg_op = 'DELETE') then v_old := to_jsonb(old);
  elsif (tg_op = 'INSERT') then v_new := to_jsonb(new);
  else v_old := to_jsonb(old); v_new := to_jsonb(new);
  end if;

  v_id := coalesce(
    v_new->>'id', v_old->>'id',
    case tg_table_name
      when 'role_permissions' then
        coalesce(v_new->>'role_id', v_old->>'role_id') || ':' || coalesce(v_new->>'permission_id', v_old->>'permission_id')
      when 'user_clients' then
        coalesce(v_new->>'user_id', v_old->>'user_id') || ':' || coalesce(v_new->>'client_id', v_old->>'client_id')
      else null
    end
  );

  v_client := coalesce((v_new->>'client_id')::uuid, (v_old->>'client_id')::uuid);

  insert into public.audit_logs(client_id, table_name, record_id, action, old_data, new_data, changed_by)
  values (v_client, tg_table_name, v_id, tg_op, v_old, v_new, auth.uid());

  if (tg_op = 'DELETE') then return old; else return new; end if;
end;
$function$;
