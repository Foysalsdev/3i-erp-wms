-- Sibling stock-posting RPCs (post_grn, post_putaway, post_stock_movement,
-- etc.) already have anon revoked; post_stock_transfer was missed when it
-- was added. Its grant came from the bare PUBLIC entry (=X), not a direct
-- anon grant, so "revoke ... from anon" alone is a no-op (anon inherits
-- execute through PUBLIC) — confirmed via pg_proc.proacl. Revoke from
-- PUBLIC outright to match the correctly-hardened siblings.
revoke execute on function public.post_stock_transfer(uuid, uuid, uuid, uuid, uuid, uuid, text, numeric, text, text) from public;
revoke execute on function public.post_stock_transfer(uuid, uuid, uuid, uuid, uuid, uuid, text, numeric, text, text) from anon;
