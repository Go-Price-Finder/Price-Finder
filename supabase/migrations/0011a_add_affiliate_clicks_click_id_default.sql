alter table public.affiliate_clicks
  alter column click_id set default gen_random_uuid()::text;