# Architecture — 3i ERP + WMS

## Tenancy model (single-tenant)

> **Historical note:** this system was originally multi-tenant — every business
> row carried a `client_id`, membership came from `user_clients`, and RLS gated
> access with `app.has_client_access(client_id)`. It has been converted to a
> **single-tenant** deployment: all `client_id` columns, the `clients` /
> `user_clients` tables and the client switcher were dropped, and RBAC roles are
> now global. The sections below describe the current model.

There is one implicit client. Access is governed purely by **permissions** (dynamic RBAC) plus a `profiles.is_platform_admin` super-admin flag. Isolation is enforced in the database (not just the app) through Row-Level Security.

Helper functions live in the `app` schema and are `SECURITY DEFINER` (so RLS policies can call them without recursion):

```sql
app.is_platform_admin()   -- true if current user is a super-admin (all permissions)
app.has_permission(key)   -- dynamic RBAC check (role → permission), global
-- app.has_client_access(uuid) / app.current_client_ids() remain as no-op stubs
-- (return true / empty) so any legacy reference stays harmless.
```

Typical policy on a business table (reads open to any authenticated user; writes gated by permission):

```sql
create policy products_select on public.products
  for select using ( true );
create policy products_insert on public.products
  for insert with check ( app.has_permission('masters.create') );
-- update / delete mirror the same permission predicate
```

## Dynamic RBAC

```
roles ──< role_permissions >── permissions        (75 permissions: module.action)
  │
user_roles (user_id, role_id, client_id?)          client_id NULL = applies to all clients
```

Seeded roles: `platform_admin`, `client_admin`, `warehouse_manager`, `inventory_officer`, `viewer`. The frontend loads the effective permission set into the Zustand store and gates routes, nav items and action buttons via `useAuth().can('inventory.adjust')`.

## Audit trail

A single generic trigger captures every change:

```sql
create or replace function app.audit_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_client uuid; v_old jsonb; v_new jsonb; v_id text;
begin
  if tg_op='DELETE' then v_old:=to_jsonb(old); v_id:=old.id::text;
  elsif tg_op='INSERT' then v_new:=to_jsonb(new); v_id:=new.id::text;
  else v_old:=to_jsonb(old); v_new:=to_jsonb(new); v_id:=new.id::text; end if;
  v_client := coalesce((v_new->>'client_id')::uuid,(v_old->>'client_id')::uuid);
  insert into public.audit_logs(client_id,table_name,record_id,action,old_data,new_data,changed_by)
  values (v_client,tg_table_name,v_id,tg_op,v_old,v_new,auth.uid());
  if tg_op='DELETE' then return old; else return new; end if;
end $$;
```

It is attached `after insert or update or delete` to every master and transaction table. The UI "Activity" timeline reads from `audit_logs`.

## Client-wise document numbering

```sql
app.next_document_number(p_client uuid, p_doc_type text) returns text
-- locks the per-client sequence row FOR UPDATE, resets yearly,
-- returns e.g.  WHP-GRN-2026-00001
```

Sequences are pre-seeded for PO, GRN, PRTN, SO, PICK, PACK, DC, GP, SRTN, EXC, RPL, TRQ, TRIP, INV, EXP × every client.

## Atomic stock movements

All inventory changes flow through one function so on-hand stock and the immutable ledger can never diverge:

```sql
app.post_stock_movement(
  p_client, p_product, p_warehouse, p_location, p_stock_status,
  p_qty_in, p_qty_out, p_movement_type,
  p_reference_type, p_reference_id, p_reference_no, p_serial_no, p_remarks
) returns bigint  -- ledger id
```

Behaviour: validates client access, then applies the delta update-first (falling back to `INSERT .. ON CONFLICT` for a new dimension, so concurrent movements can never create duplicate rows — the dimension key is `UNIQUE NULLS NOT DISTINCT`, covering NULL locations). Movements that would drive quantity negative are rejected both in the function and by a `quantity >= 0` table constraint, then an `inventory_ledger` row is written with `balance_after`. Stock is split by condition: `good | damaged | quarantine`.

## Data model (tables)

**Tenancy/security:** `clients`, `profiles`, `roles`, `permissions`, `role_permissions`, `user_clients`, `user_roles`
**Cross-cutting:** `audit_logs`, `document_sequences`, `attachments`, `notes`
**Masters:** `products`, `customers`, `customer_addresses`, `suppliers`, `transport_vendors`, `vehicles`, `warehouses`, `locations`, `assets`, `non_inventory_items`
**Inventory:** `inventory_stock`, `inventory_ledger`, `serial_numbers`, `inventory_snapshots`

## Migrations

The schema was applied as ordered migrations to the live project:

```
01_core_tenancy_and_rbac
02_audit_docnumbering_attachments
03_masters
04_inventory
05_seed_clients_roles_permissions
06_fix_function_search_path
07_storage_admin_and_demo_data
08_tighten_media_bucket
```

To pull them into this repo for version control:

```bash
npx supabase link --project-ref kstwbkwbsozaboceksmy
npx supabase db pull          # writes supabase/migrations/*.sql
npm run typegen               # regenerates src/types/database.types.ts
```

## Frontend data flow

```
Supabase (RLS) ──▶ supabase-js client ──▶ hooks (useCollection / rpc)
                                   │
                            Zustand stores (auth, ui)
                                   │
                     feature components (Masters, Inventory, …)
```

Reads are filtered by `client_id` for index efficiency; RLS is the authoritative guard. Writes to stock go through the `app.post_stock_movement` RPC; document creation uses the `app.next_document_number` RPC.
