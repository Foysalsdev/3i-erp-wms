-- Couriers bill per piece (unlike transport, which is per trip): keep the
-- agreed per-unit rate on the courier master so challans can compute the bill.
alter table public.couriers add column if not exists rate_per_unit numeric not null default 0;

-- Cost of getting one challan delivered: courier mode = qty x rate (editable),
-- transport mode = the trip charge entered manually.
alter table public.delivery_challans add column if not exists delivery_cost numeric;
