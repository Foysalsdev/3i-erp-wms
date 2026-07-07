-- A delivery's billing party and the physical delivery destination are often
-- different (bill the head office, ship to a branch store). The challan already
-- carries bill_to_address; add ship_to_address so the printed challan can show
-- a proper Bill-To / Ship-To pair like a standard ERP dispatch document.
alter table public.delivery_challans add column if not exists ship_to_address text;
