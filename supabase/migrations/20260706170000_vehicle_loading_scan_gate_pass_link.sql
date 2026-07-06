-- Second scan of the workflow: at vehicle loading, re-scan each unit and
-- match it against what was reserved during the first (picking) scan, then
-- tag the matched serials to this specific gate pass and record when the
-- loading scan started/finished as the vehicle's gate in/out time.
alter table public.gate_passes
  add column gate_in_time text,
  add column loaded_serial_count integer not null default 0;

alter table public.serial_numbers
  add column gate_pass_id uuid references public.gate_passes(id);
