-- The acknowledgement line printed above the receiver's signature on the
-- challan used to be hard-coded. Store it per challan so it can be edited on
-- the form (pre-filled, with the user's last edit remembered) and so a reprint
-- reproduces exactly the note that challan was issued with.
alter table public.delivery_challans add column if not exists print_note text;
