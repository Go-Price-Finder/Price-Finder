alter table public.current_prices
  add constraint current_prices_product_id_fkey
  foreign key (product_id) references public.products (id) on delete cascade;