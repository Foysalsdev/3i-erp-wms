-- The delivery challan captured transporter/courier as free text
-- (transport_vendor, courier_name), with no relation to the Transporter/
-- Courier masters. transporter_id already existed but was unused by the UI;
-- courier_id didn't exist at all. Add it so couriers can be linked the same
-- way transporters are.
alter table public.delivery_challans add column if not exists courier_id uuid references public.couriers(id);
