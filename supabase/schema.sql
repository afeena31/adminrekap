-- =====================================================================
-- UmayasLa (adminrekap) — Skema Supabase, Tahap 1
-- =====================================================================
-- Cara pakai: buka project Supabase kamu -> SQL Editor -> paste seluruh
-- isi file ini -> Run. Aman dijalankan sekali di project BARU/kosong.
--
-- Desain ID: semua primary key pakai TEXT (bukan UUID/serial bawaan
-- Supabase) supaya ID yang SUDAH ADA di localStorage kamu sekarang
-- ("ORD-...", "prod-...", "fee-...", dst) bisa dipindah apa adanya di
-- Tahap 3 nanti, tanpa perlu bikin ulang & mengubek-ubek semua relasi.
--
-- Field modal/HPP/biaya operasional/fee marketer TIDAK dibuka lewat
-- akses tabel langsung (lihat bagian "COST-SENSITIVE TABLES" di bawah)
-- -- app HARUS baca lewat RPC function yang otomatis strip field itu
-- kalau pemanggilnya role "admin". Ini yang bikin datanya beneran gak
-- pernah terkirim ke browser Admin (bukan cuma disembunyikan di UI).
-- =====================================================================

-- ===== PROFIL & ROLE =====
-- Satu baris per akun login (Owner atau Admin). id = auth.users.id
-- (dibuat otomatis pas kamu bikin user lewat Supabase Auth).
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin')),
  name text,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- Semua yang login boleh baca daftar profil (perlu buat cek role diri
-- sendiri & tampilkan nama), tapi CUMA baris dirinya sendiri yang boleh
-- diubah, dan bikin baris baru cuma lewat proses admin (lihat catatan
-- di bawah, bukan self-signup bebas).
create policy "profiles_select_all_authenticated" on profiles
  for select using (auth.role() = 'authenticated');

-- Helper: true kalau user yang login sekarang role-nya "owner".
-- SECURITY DEFINER supaya bisa dipanggil dari RLS policy tabel lain
-- tanpa kena RLS profiles itu sendiri (hindari infinite recursion).
create or replace function is_owner()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'owner'
  );
$$;

create or replace function current_role_name()
returns text
language sql
security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid();
$$;

-- ===== HELPER: policy standar utk tabel data bisnis biasa (non-cost) =====
-- Siapapun yang sudah login (Owner ATAUPUN Admin) boleh baca/tulis penuh
-- -- ini data bisnis BERSAMA (customer, order, payment, dst), bukan data
-- privat per-user. Yang dibatasi cuma kolom cost di 3 tabel khusus.

-- ===== CUSTOMERS =====
create table if not exists customers (
  id text primary key,
  name text not null,
  wa_name text not null default '',
  phone text not null default '',
  receiver text not null default '',
  receiver_phone text not null default '',
  city text not null default '',
  since text not null default '',
  notes text[] not null default '{}',
  created_at bigint not null,
  deleted_at bigint,
  initials text,
  default_address_id text
);
alter table customers enable row level security;
create policy "customers_all_authenticated" on customers for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ===== ADDRESSES =====
create table if not exists addresses (
  id text primary key,
  customer_id text not null references customers(id) on delete cascade,
  label text not null default '',
  recipient_name text not null default '',
  phone text not null default '',
  address text not null default '',
  landmark text,
  courier text,
  note text,
  is_default boolean not null default false
);
alter table addresses enable row level security;
create policy "addresses_all_authenticated" on addresses for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ===== MARKETERS =====
create table if not exists marketers (
  id text primary key,
  name text not null,
  phone text,
  default_fee numeric not null default 0,
  status text not null default 'aktif',
  joined_at text not null default '',
  notes text
);
alter table marketers enable row level security;
create policy "marketers_all_authenticated" on marketers for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ===== WAREHOUSES =====
create table if not exists warehouses (
  id text primary key,
  name text not null,
  code text not null default '',
  active boolean not null default true
);
alter table warehouses enable row level security;
create policy "warehouses_all_authenticated" on warehouses for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ===== INVENTORY =====
-- Stok bukan data cost (bukan modal/HPP), jadi boleh diakses langsung.
create table if not exists inventory (
  id text primary key,
  product_id text not null,
  warehouse_id text not null references warehouses(id) on delete cascade,
  stock_on_hand numeric not null default 0,
  reserved numeric not null default 0,
  minimum_stock numeric not null default 0,
  location text,
  unique (product_id, warehouse_id)
);
alter table inventory enable row level security;
create policy "inventory_all_authenticated" on inventory for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ===== ORDERS (header order — TIDAK ada field cost di sini) =====
create table if not exists orders (
  id text primary key,
  number text not null,
  date text not null,
  customer text not null default '',
  customer_id text references customers(id) on delete set null,
  phone text not null default '',
  address text not null default '',
  discount_type text not null default 'percent',
  discount_value numeric not null default 0,
  discount_amount numeric not null default 0,
  ongkir numeric not null default 0,
  ongkir_label text not null default '',
  dp numeric not null default 0,
  note text not null default '',
  internal_note text,
  marketer_id text references marketers(id) on delete set null,
  marketer_name text,
  total_fee numeric not null default 0,
  subtotal numeric not null default 0,
  total numeric not null default 0,
  status text not null default 'confirmed',
  batch text,
  created_at bigint not null
);
alter table orders enable row level security;
create policy "orders_all_authenticated" on orders for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ===== PAYMENTS (Riwayat Pembayaran — bukan data cost) =====
create table if not exists payments (
  id text primary key,
  order_id text not null references orders(id) on delete cascade,
  order_number text not null default '',
  customer_id text references customers(id) on delete set null,
  customer_name text not null default '',
  product_summary text not null default '',
  amount numeric not null default 0,
  date_received text not null default '',
  status text not null default 'belum-ditarik',
  date_withdrawn text,
  note text not null default '',
  created_at bigint not null
);
alter table payments enable row level security;
create policy "payments_all_authenticated" on payments for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ===== COLLECTIONS (Collection Workspace) =====
create table if not exists collections (
  id text primary key,
  name text not null,
  type text not null,
  status text not null default 'aktif',
  icon text not null default '',
  color text not null default '',
  description text,
  owner text,
  tags text[] not null default '{}',
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint
);
alter table collections enable row level security;
create policy "collections_all_authenticated" on collections for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create table if not exists collection_orders (
  id text primary key,
  collection_id text not null references collections(id) on delete cascade,
  order_id text not null references orders(id) on delete cascade,
  added_at bigint not null
);
alter table collection_orders enable row level security;
create policy "collection_orders_all_authenticated" on collection_orders for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- collection_order_items.item_id merujuk ke order_items.id (dibuat di bawah,
-- FK-nya ditambah belakangan lewat ALTER supaya urutan tabel gak muter-muter)
create table if not exists collection_order_items (
  id text primary key,
  collection_id text not null references collections(id) on delete cascade,
  order_id text not null references orders(id) on delete cascade,
  item_id text not null,
  added_at bigint not null
);
alter table collection_order_items enable row level security;
create policy "collection_order_items_all_authenticated" on collection_order_items for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ===== BATCH NAMES (daftar nama batch produksi Amna, teks bebas) =====
create table if not exists batch_names (
  name text primary key
);
alter table batch_names enable row level security;
create policy "batch_names_all_authenticated" on batch_names for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- =====================================================================
-- COST-SENSITIVE TABLES — products, order_items, fees
-- =====================================================================
-- 3 tabel ini menyimpan kolom modal/HPP/fee marketer. TIDAK ada policy
-- SELECT langsung ke tabelnya (RLS aktif tapi SENGAJA tanpa policy READ
-- untuk role biasa) -- satu-satunya jalan baca adalah lewat RPC function
-- di bawah, yang otomatis strip kolom cost kalau pemanggilnya "admin".
-- Ini akan disambungkan ke app di Tahap 4 (products) & Tahap 6
-- (order_items, fees) -- termasuk RPC utk MENULIS data juga, supaya
-- Admin bisa nambah item order tanpa pernah nerima balik nilai hpp-nya.

create table if not exists products (
  id text primary key,
  name text not null,
  category text not null default '',
  price numeric not null default 0,
  original_price numeric,
  description text,
  emoji text not null default '',
  badge text,
  variants text[],
  modal_kotor numeric,
  biaya_operasional numeric,
  hpp numeric,
  fee_marketer numeric,
  discount_default numeric,
  discount_type text,
  active boolean not null default true,
  default_collection_ids text[]
);
alter table products enable row level security;
-- Cuma Owner yang boleh tulis langsung (Admin nulis produk baru lewat RPC
-- di Tahap 4 nanti, biar konsisten -- utk sekarang tabel ini masih kosong,
-- belum dipakai app).
create policy "products_write_owner_only" on products for all
  using (is_owner()) with check (is_owner());

create table if not exists order_items (
  id text primary key,
  order_id text not null references orders(id) on delete cascade,
  product_id text,
  name text not null default '',
  emoji text not null default '',
  qty numeric not null default 1,
  price numeric not null default 0,
  hpp numeric not null default 0,
  fee_marketer numeric not null default 0,
  discount numeric not null default 0,
  detail text,
  category text,
  production_stage text,
  shipment_stage text,
  stock_source text,
  warehouse_id text references warehouses(id) on delete set null,
  -- Atribut terstruktur Amna Jilbab (size/pad/fabric/color/modifications/
  -- customRequests/additionalPrice/finalPrice) -- snapshot, bukan FK ke
  -- produk live, jadi digabung 1 kolom JSONB drpd bikin 8 kolom nullable.
  amna_attrs jsonb
);
alter table order_items enable row level security;
create policy "order_items_write_owner_only" on order_items for all
  using (is_owner()) with check (is_owner());

alter table collection_order_items
  add constraint collection_order_items_item_id_fkey
  foreign key (item_id) references order_items(id) on delete cascade;

create table if not exists fees (
  id text primary key,
  order_id text not null references orders(id) on delete cascade,
  order_number text not null default '',
  invoice_number text not null default '',
  marketer_id text not null references marketers(id) on delete cascade,
  marketer_name text not null default '',
  date text not null default '',
  items jsonb not null default '[]',
  total_fee numeric not null default 0,
  status text not null default 'belum-diambil',
  paid_date text,
  note text not null default '',
  created_at bigint not null
);
alter table fees enable row level security;
create policy "fees_write_owner_only" on fees for all
  using (is_owner()) with check (is_owner());

-- ===== RPC: baca products dgn cost di-strip utk role admin =====
create or replace function get_products()
returns setof jsonb
language sql
security definer
set search_path = public
as $$
  select case when is_owner()
    then to_jsonb(p)
    else to_jsonb(p) - 'modal_kotor' - 'biaya_operasional' - 'hpp' - 'fee_marketer'
  end
  from products p;
$$;

-- ===== RPC: baca order_items 1 order dgn cost di-strip utk admin =====
create or replace function get_order_items(p_order_id text)
returns setof jsonb
language sql
security definer
set search_path = public
as $$
  select case when is_owner()
    then to_jsonb(oi)
    else to_jsonb(oi) - 'hpp' - 'fee_marketer'
  end
  from order_items oi
  where oi.order_id = p_order_id;
$$;

-- ===== RPC: baca semua fees dgn total_fee & rincian item di-strip utk admin =====
create or replace function get_fees()
returns setof jsonb
language sql
security definer
set search_path = public
as $$
  select case when is_owner()
    then to_jsonb(f)
    else (to_jsonb(f) - 'total_fee' - 'items')
      || jsonb_build_object('total_fee', null, 'items', '[]'::jsonb)
  end
  from fees f;
$$;

grant execute on function get_products() to authenticated;
grant execute on function get_order_items(text) to authenticated;
grant execute on function get_fees() to authenticated;
grant execute on function is_owner() to authenticated;
grant execute on function current_role_name() to authenticated;

-- =====================================================================
-- CATATAN UTK SESI SELANJUTNYA (Tahap 4 & 6):
-- RPC di atas baru menutup jalur BACA (SELECT). Jalur TULIS (bikin/edit
-- produk baru, nambah item ke order) utk role Admin juga harus lewat RPC
-- (SECURITY DEFINER function yang nerima input TANPA field cost, ngambil
-- hpp/fee dari Product internal server-side, nulis ke tabel, TANPA balikin
-- nilai cost-nya ke client) -- BELUM dibuat di sini krn bentuk parameter
-- persisnya baru jelas begitu store.ts benar-benar disambungkan ke tabel
-- ini (Tahap 4/6), bukan ditebak sekarang.
-- =====================================================================
