-- Create families table
create table public.families (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Users to families mapping
create table public.user_families (
  user_id uuid references auth.users not null,
  family_id uuid references public.families not null,
  primary key (user_id, family_id)
);

-- Areas (Corredores)
create table public.areas (
  id uuid default gen_random_uuid() primary key,
  family_id uuid references public.families not null,
  name text not null,
  order_index integer not null default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Products Catalog
create table public.products (
  id uuid default gen_random_uuid() primary key,
  family_id uuid references public.families not null,
  area_id uuid references public.areas not null,
  name text not null,
  thumbnail_url text,
  order_index integer default 0 not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Shopping List Items
create table public.list_items (
  id uuid default gen_random_uuid() primary key,
  family_id uuid references public.families not null,
  product_id uuid references public.products not null,
  quantity text default '1',
  is_purchased boolean default false,
  added_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Setup RLS (Row Level Security) - Basic Setup for testing
alter table public.families enable row level security;
create policy "Enable all for authenticated users" on public.families for all to authenticated using (true);

alter table public.user_families enable row level security;
create policy "Enable all for authenticated users" on public.user_families for all to authenticated using (true);

alter table public.areas enable row level security;
create policy "Enable all for authenticated users" on public.areas for all to authenticated using (true);

alter table public.products enable row level security;
create policy "Enable all for authenticated users" on public.products for all to authenticated using (true);

alter table public.list_items enable row level security;
create policy "Enable all for authenticated users" on public.list_items for all to authenticated using (true);

-- Create storage bucket for thumbnails
insert into storage.buckets (id, name, public) values ('thumbnails', 'thumbnails', true);
create policy "Public Access" on storage.objects for select using ( bucket_id = 'thumbnails' );
create policy "Auth Insert" on storage.objects for insert to authenticated with check ( bucket_id = 'thumbnails' );
