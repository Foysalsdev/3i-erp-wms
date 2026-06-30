-- Gate passes and PODs were linking to the now-unused `dispatches` table.
-- The live outbound flow creates delivery_challans, so link to that instead.
alter table public.gate_passes
  add column if not exists challan_id uuid references public.delivery_challans(id);

alter table public.proof_of_delivery
  add column if not exists challan_id uuid references public.delivery_challans(id);

create index if not exists gate_passes_challan_id_idx on public.gate_passes (challan_id);
create index if not exists proof_of_delivery_challan_id_idx on public.proof_of_delivery (challan_id);
