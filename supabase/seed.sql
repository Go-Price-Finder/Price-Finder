-- Price Finder — seed data
-- Populates public.products from the same catalog the frontend currently
-- ships as mock data (lib/data.ts), so wishlists/purchases created against
-- this schema have real products to reference. Safe to re-run.

insert into public.products (id, name, category, image_url) values
  ('p1', 'Aria Linen Sofa, 3-Seater', 'Furniture', 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?q=80&w=800&auto=format&fit=crop'),
  ('p2', 'Nordic Oak Coffee Table', 'Furniture', 'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?q=80&w=800&auto=format&fit=crop'),
  ('p3', 'Wireless Noise-Cancelling Headphones', 'Electronics', 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=800&auto=format&fit=crop'),
  ('p4', 'Ceramic Table Lamp, Warm White', 'Home Decor', 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?q=80&w=800&auto=format&fit=crop'),
  ('p5', 'Everyday Leather Tote Bag', 'Fashion', 'https://images.unsplash.com/photo-1591561954557-26941169b49e?q=80&w=800&auto=format&fit=crop'),
  ('p6', 'Stainless Pour-Over Coffee Set', 'Kitchen', 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?q=80&w=800&auto=format&fit=crop'),
  ('p7', 'Minimalist Running Sneakers', 'Sportswear', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=800&auto=format&fit=crop'),
  ('p8', 'Handwoven Wool Throw Blanket', 'Home Decor', 'https://images.unsplash.com/photo-1580301762395-83c5d0e3e3c3?q=80&w=800&auto=format&fit=crop'),
  ('p9', 'Mechanical Keyboard, Hot-Swappable', 'Electronics', 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?q=80&w=800&auto=format&fit=crop'),
  ('p10', 'Hand-Thrown Ceramic Vase Set', 'Home Decor', 'https://images.unsplash.com/photo-1578500494198-246f612d3b3d?q=80&w=800&auto=format&fit=crop')
on conflict (id) do update
  set name = excluded.name,
      category = excluded.category,
      image_url = excluded.image_url;
