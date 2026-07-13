-- Single-client conversion, step 1/3: rewrite every RLS policy to drop the
-- client dimension while PRESERVING permission checks.
--   app.has_client_access(client_id)                              -> true
--   has_client_access(client_id) AND has_permission('X',client_id)-> has_permission('X')
-- is_platform_admin / hr.role.manage / user_id policies are untouched.
do $mig$
declare
  r record;
  v_qual text;
  v_check text;
  v_roles text;
begin
  create temp table _pol_snapshot on commit drop as
    select schemaname, tablename, policyname, permissive, cmd, roles, qual, with_check
    from pg_policies where schemaname = 'public';

  for r in select * from _pol_snapshot loop
    v_qual := r.qual;
    v_check := r.with_check;

    if v_qual is not null then
      v_qual := replace(v_qual, 'app.has_client_access(client_id) AND ', '');
      v_qual := regexp_replace(v_qual, 'app\.has_permission\((''[^'']+''::text), client_id\)', 'app.has_permission(\1)', 'g');
      v_qual := replace(v_qual, 'app.has_client_access(client_id)', 'true');
    end if;
    if v_check is not null then
      v_check := replace(v_check, 'app.has_client_access(client_id) AND ', '');
      v_check := regexp_replace(v_check, 'app\.has_permission\((''[^'']+''::text), client_id\)', 'app.has_permission(\1)', 'g');
      v_check := replace(v_check, 'app.has_client_access(client_id)', 'true');
    end if;

    -- Safety: abort the whole migration if any client_id reference survives.
    if (v_qual is not null and v_qual like '%client_id%')
       or (v_check is not null and v_check like '%client_id%') then
      raise exception 'Residual client_id in policy % on %: using=[%] check=[%]',
        r.policyname, r.tablename, v_qual, v_check;
    end if;

    v_roles := (select string_agg(quote_ident(x), ',') from unnest(r.roles) x);

    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
    execute format('create policy %I on public.%I as %s for %s to %s %s %s',
      r.policyname, r.tablename,
      case when r.permissive = 'PERMISSIVE' then 'permissive' else 'restrictive' end,
      r.cmd, v_roles,
      case when v_qual is not null then 'using (' || v_qual || ')' else '' end,
      case when v_check is not null then 'with check (' || v_check || ')' else '' end
    );
  end loop;
end
$mig$;
