-- Price Finder — example queries
-- Reference queries the schema in 0001_initial_schema.sql was designed
-- around. None of these need to change as the app grows — they're here to
-- show the indexes are actually earning their keep.

-- All purchases by a user, most recent first.
-- Uses the purchases_user_id_purchased_at_idx composite index directly —
-- no sort step needed, since the index is already stored in that order.
select
  pu.id,
  p.name as product_name,
  pu.retailer,
  pu.amount_spent,
  pu.purchased_at
from public.purchases pu
join public.products p on p.id = pu.product_id
where pu.user_id = $1
order by pu.purchased_at desc;

-- Total spending for a single user.
-- Same composite index covers the WHERE clause; the view below is the
-- same query pre-written for reuse.
select sum(amount_spent) as total_spent
from public.purchases
where user_id = $1;

-- Equivalent, via the convenience view (also returns purchase_count and
-- first/last purchase dates in one call — handy for an account summary
-- page, and the natural input to a future loyalty-tier calculation):
select *
from public.user_spending_summary
where user_id = $1;

-- A user's current wishlist, newest first, with live product info joined
-- in (uses wishlists_user_id_idx).
select
  w.id,
  p.name as product_name,
  p.image_url,
  w.retailer,
  w.price_saved,
  w.created_at
from public.wishlists w
join public.products p on p.id = w.product_id
where w.user_id = $1
order by w.created_at desc;

-- Top spenders overall (e.g. for an internal admin view) — a full-table
-- aggregate, so it scans purchases rather than using the per-user index;
-- fine at moderate scale, worth a materialized view if this table gets
-- large and the report needs to be fast.
select
  u.email,
  s.purchase_count,
  s.total_spent
from public.user_spending_summary s
join public.users u on u.id = s.user_id
order by s.total_spent desc
limit 20;
