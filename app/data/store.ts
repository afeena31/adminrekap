"use client";

import { determineRekening, type Product } from "./products";
import { supabase } from "./supabaseClient";


// ===== TYPES =====

export type MarketerStatus = "aktif" | "tidak-aktif" | "arsip";

export type Marketer = {
  id: string;
  name: string;
  phone?: string;          // No HP (opsional)
  defaultFee: number;      // fee default per unit (Rp)
  status: MarketerStatus;  // aktif / tidak-aktif / arsip
  joinedAt: string;        // tanggal bergabung
  notes?: string;          // catatan (opsional)
};


export type CustomRequest = {
  name: string;
  price: number;
};

// Tahap produksi & pengiriman PER-ITEM (bukan per-order) — satu invoice bisa
// berisi produk dgn progres berbeda-beda (mis. Amna masih Produksi, Kaos
// Kaki sudah Siap Kirim), sama seperti Kategori Produk. Ini tracking ASLI
// pertama utk order asli — sebelumnya cuma ada versi demo (operations.ts,
// ProductStatusCard) yang gak pernah tersambung ke order beneran.
// Rute produksi diperinci sesuai alur kerja nyata (2026-09-08, atas
// permintaan user): PO → Dalam Produksi → Antre QC → Proses QC →
// Antre Packing → Proses Packing. "qc"/"packing" adalah KEY LAMA yang
// dipertahankan (cuma label-nya diperbarui jadi "Proses QC"/"Proses
// Packing") supaya data order lama yang sudah tersimpan gak jadi nyasar ke
// tahap tak dikenal. "siap-kirim" TETAP ada di tipe & info (bukan dihapus)
// supaya order lama dgn tahap ini masih render normal, tapi SENGAJA gak
// dimasukkan ke productionStageOrder lagi (gak muncul lagi sbg pilihan baru
// di dropdown) — sesuai rute baru yang berhenti di "Proses Packing".
export type ProductionStage = "po" | "produksi" | "antre-qc" | "qc" | "antre-packing" | "packing" | "siap-kirim";
export type ShipmentStage = "antre-packing" | "sudah-dipacking" | "proses-resi" | "dalam-pengiriman" | "selesai" | "ditunda" | "retur" | "refund";

export const productionStageOrder: ProductionStage[] = ["po", "produksi", "antre-qc", "qc", "antre-packing", "packing"];
export const productionStageInfo: Record<ProductionStage, { name: string; emoji: string }> = {
  "po": { name: "PO", emoji: "📝" },
  "produksi": { name: "Dalam Produksi", emoji: "🏭" },
  "antre-qc": { name: "Antre QC", emoji: "⏳" },
  "qc": { name: "Proses QC", emoji: "🔍" },
  "antre-packing": { name: "Antre Packing", emoji: "🗂️" },
  "packing": { name: "Proses Packing", emoji: "📦" },
  "siap-kirim": { name: "Siap Kirim", emoji: "✅" },
};

// Rute pengiriman juga diperinci (2026-09-08): Antre Packing → Sudah
// Dipacking → Proses Resi → Terkirim → Selesai. 2 tahap pertama SENGAJA
// tumpang tindih konsepnya dengan tahap akhir Produksi di atas — atas
// penjelasan user: "kadang produk udah ready, tapi belum dipacking...
// kalau produksinya belum siap kirim, maka pengiriman pun statusnya masih
// menunggu ready" — jadi tahap Pengiriman perlu bisa berdiri sendiri
// menunjukkan "belum bisa dikirim krn masih nunggu packing", TANPA admin
// harus cek field Produksi terpisah dulu buat tahu alasannya.
// "dalam-pengiriman"/"ditunda" adalah KEY LAMA (dipertahankan demi data
// lama) yang cuma label-nya diperbarui jadi "Terkirim"/"Dihold".
// "ditunda"/"retur"/"refund" TETAP di luar shipmentStageOrder (linear) —
// status khusus yang bisa terjadi kapan saja, bukan tahap lanjutan.
export const shipmentStageOrder: ShipmentStage[] = ["antre-packing", "sudah-dipacking", "proses-resi", "dalam-pengiriman", "selesai"];
export const shipmentStageInfo: Record<ShipmentStage, { name: string; emoji: string }> = {
  "antre-packing": { name: "Antre Packing", emoji: "🗂️" },
  "sudah-dipacking": { name: "Sudah Dipacking", emoji: "📦" },
  "proses-resi": { name: "Proses Resi", emoji: "🧾" },
  "dalam-pengiriman": { name: "Terkirim", emoji: "🚚" },
  "selesai": { name: "Selesai", emoji: "🎉" },
  "ditunda": { name: "Dihold", emoji: "⏸️" },
  "retur": { name: "Retur", emoji: "↩️" },
  "refund": { name: "Refund", emoji: "💸" },
};

export type OrderItemSnapshot = {
  id: string;
  productId?: string;
  name: string;
  emoji: string;
  qty: number;
  price: number;          // harga jual per unit (snapshot)
  hpp: number;            // HPP per unit (snapshot)
  feeMarketer: number;    // fee per unit (snapshot)
  discount: number;       // diskon per unit (nominal)
  detail?: string;
  category?: string;
  // ===== Atribut terstruktur Amna Jilbab =====
  size?: string;              // M / L / XL / XXL
  pad?: string;               // NonPad / Niqabis
  fabric?: string;            // default: Amna Pitch Black Anti UV
  color?: string;             // default: Pitch Black
  modifications?: string[];   // daftar modifikasi terpilih
  customRequests?: CustomRequest[]; // request khusus (nama + harga)
  additionalPrice?: number;   // total tambahan modifikasi + request
  finalPrice?: number;        // harga akhir per unit
  // ===== Tahap produksi & pengiriman (opsional — undefined = "po", belum diisi) =====
  productionStage?: ProductionStage;
  shipmentStage?: ShipmentStage;
  // ===== Stok (opsional — undefined = "po", TIDAK memotong stok gudang) =====
  // Produk yang sama bisa PO di satu order dan Ready Stock di order lain
  // (mis. Niqab/Manset kadang PO kadang sisa stok jadi ready) — makanya ini
  // ditandai per-ITEM, bukan tetap di level Product. warehouseId cuma
  // relevan kalau stockSource === "ready".
  stockSource?: "ready" | "po";
  warehouseId?: string;
};



export type DiscountType = "percent" | "nominal";

export type OrderRecord = {
  id: string;
  number: string;
  date: string;
  customer: string;
  customerId: string | null;  // relasi ke Customer (nullable untuk "Belum Terhubung")
  phone: string;
  address: string;

  items: OrderItemSnapshot[];
  discountType: DiscountType;
  discountValue: number;
  discountAmount: number;
  ongkir: number;
  ongkirLabel: string;
  dp: number;
  note: string;             // catatan customer — ikut ditampilkan di invoice & pesan WhatsApp
  internalNote?: string;    // catatan internal admin — TIDAK PERNAH dikirim ke customer
  marketerId: string | null;
  marketerName: string | null;
  totalFee: number;
  subtotal: number;
  total: number;
  status: "draft" | "confirmed" | "paid";
  batch?: string;          // batch produksi (misal "Batch 7") untuk order Amna Jilbab
  createdAt: number;
};

// Satu baris = satu transfer yang benar-benar masuk (top up), bukan angka
// kumulatif yang ditimpa — supaya riwayatnya jelas: dari closingan siapa,
// produknya apa, nominal berapa, masuk tanggal berapa, ditarik tanggal berapa
// (pola sama persis dengan FeeRecord: status belum/sudah + tanggal terkait).
export type PaymentRecord = {
  id: string;
  orderId: string;
  orderNumber: string;
  customerId: string | null;
  customerName: string;
  productSummary: string;   // ringkasan item di order ini, mis. "Amna Jilbab L, Kaos Kaki"
  amount: number;
  dateReceived: string;     // tanggal transfer/top up masuk
  status: "belum-ditarik" | "sudah-ditarik";
  dateWithdrawn: string | null;
  note: string;
  createdAt: number;
};

export type FeeRecord = {
  id: string;
  orderId: string;
  orderNumber: string;
  invoiceNumber: string;
  marketerId: string;
  marketerName: string;
  date: string;
  items: { productName: string; qty: number; feePerUnit: number; feeTotal: number }[];
  totalFee: number;
  status: "belum-diambil" | "sudah-diambil";
  paidDate: string | null;
  note: string;
  createdAt: number;
};

// ===== WAREHOUSE & INVENTORY (struktur relasional) =====
// Gudang adalah lokasi penyimpanan stok, BUKAN kategori produk.
// Satu produk dapat berada di banyak gudang tanpa duplikasi produk.

export type Warehouse = {
  id: string;
  name: string;
  code: string;          // kode singkat, misal "PWK", "BKS"
  active: boolean;
};

export type Inventory = {
  id: string;
  productId: string;     // relasi ke Product (bukan variant terpisah)
  warehouseId: string;   // relasi ke Warehouse
  stockOnHand: number;   // stok fisik di gudang
  reserved: number;      // stok yang sudah dipesan/di-reserve
  minimumStock: number;  // batas minimum stok
  location?: string;     // lokasi rak (opsional)
};

// available dihitung otomatis: stockOnHand - reserved
export const inventoryAvailable = (inv: Inventory) => Math.max(0, inv.stockOnHand - inv.reserved);


// ===== WAREHOUSE DATA =====

export const defaultWarehouses: Warehouse[] = [
  { id: "wh-pwk", name: "Gudang Purwakarta", code: "PWK", active: true },
  { id: "wh-bks", name: "Gudang Bekasi", code: "BKS", active: true },
];

// ===== MARKETER DATA =====

export const defaultMarketers: Marketer[] = [
  { id: "mk-1", name: "Febia", defaultFee: 10000, status: "aktif", joinedAt: "2024-01-10" },
  { id: "mk-2", name: "Naqiya", defaultFee: 10000, status: "aktif", joinedAt: "2024-02-15" },
  { id: "mk-3", name: "Salsabila", defaultFee: 10000, status: "aktif", joinedAt: "2024-03-01" },
  { id: "mk-4", name: "Nurul Aulia", defaultFee: 10000, status: "aktif", joinedAt: "2024-04-20" },
  { id: "mk-5", name: "Bu Lina", defaultFee: 10000, status: "aktif", joinedAt: "2024-05-05" },
  { id: "mk-6", name: "Mulia", defaultFee: 10000, status: "aktif", joinedAt: "2024-06-12" },
];



// Semua entitas di file ini sudah pindah ke Supabase (Tahap 4-6 migrasi
// backend) — key localStorage & helper load/save lokal yang dulu ada di
// sini sudah gak dipakai lagi sama sekali, dihapus.

// ===== PRODUCT STORE (Tahap 4 migrasi backend — Supabase) =====
// Baca lewat RPC get_products() (Tahap 1, supabase/schema.sql), BUKAN query
// tabel langsung — RPC itu sendiri yg strip kolom modal/HPP/fee marketer
// server-side kalau pemanggilnya role "admin" (dicek dari tabel profiles),
// jadi data cost BENERAN gak pernah sampai ke browser Admin, bukan cuma
// disembunyikan di UI (itu baru Tahap 7). Tulis (add/update) juga lewat RPC
// (create_product/update_product) — bukan INSERT/UPDATE tabel langsung —
// karena Admin BOLEH nulis kolom aman (judul/kategori/harga/stok/dst) tapi
// kolom cost harus sama sekali gak tersentuh kalau bukan Owner yg manggil;
// RLS tabel `products` sendiri tetap Owner-only (fallback pertahanan kedua
// kalau ada yg nyoba nulis tabel langsung, lewatin RPC ini).

function mapProductRow(p: Record<string, unknown>): Product {
  return {
    id: p.id as string,
    name: p.name as string,
    category: p.category as string,
    price: p.price as number,
    originalPrice: (p.original_price as number) ?? undefined,
    description: (p.description as string) ?? undefined,
    emoji: p.emoji as string,
    badge: (p.badge as string) ?? undefined,
    variants: (p.variants as string[]) ?? undefined,
    modalKotor: (p.modal_kotor as number) ?? undefined,
    biayaOperasional: (p.biaya_operasional as number) ?? undefined,
    hpp: (p.hpp as number) ?? undefined,
    feeMarketer: (p.fee_marketer as number) ?? undefined,
    discountDefault: (p.discount_default as number) ?? undefined,
    discountType: (p.discount_type as "percent" | "nominal") ?? undefined,
    active: p.active as boolean,
    defaultCollectionIds: (p.default_collection_ids as string[]) ?? undefined,
    estimasiReady: (p.estimasi_ready as string) ?? undefined,
    estimasiPembayaran: (p.estimasi_pembayaran as string) ?? undefined,
    beratGram: (p.berat_gram as number) ?? undefined,
  };
}

// Nama parameter di sini HARUS persis sama dgn urutan/nama param RPC
// create_product/update_product di supabase/schema.sql — kalau produk ini
// ditulis Admin, function di sisi database yg akan mengabaikan kolom cost
// (p_modal_kotor dst), bukan kode di sini.
function productToRpcArgs(product: Product) {
  return {
    p_name: product.name, p_category: product.category, p_price: product.price,
    p_original_price: product.originalPrice ?? null, p_description: product.description ?? null,
    p_emoji: product.emoji, p_badge: product.badge ?? null, p_variants: product.variants ?? null,
    p_modal_kotor: product.modalKotor ?? null, p_biaya_operasional: product.biayaOperasional ?? null,
    p_hpp: product.hpp ?? null, p_fee_marketer: product.feeMarketer ?? null,
    p_discount_default: product.discountDefault ?? null, p_discount_type: product.discountType ?? null,
    p_active: product.active !== false, p_default_collection_ids: product.defaultCollectionIds ?? null,
    p_estimasi_ready: product.estimasiReady ?? null, p_estimasi_pembayaran: product.estimasiPembayaran ?? null,
    p_berat_gram: product.beratGram ?? null,
  };
}

export async function getProducts(): Promise<Product[]> {
  const { data, error } = await supabase.rpc("get_products");
  if (error) { console.error("[getProducts]", error.message); return []; }
  return ((data || []) as Record<string, unknown>[]).map(mapProductRow);
}

export async function addProduct(product: Product): Promise<Product[]> {
  const { error } = await supabase.rpc("create_product", { p_id: product.id, ...productToRpcArgs(product) });
  if (error) { console.error("[addProduct]", error.message); throw new Error(error.message); }
  return getProducts();
}

export async function updateProduct(product: Product): Promise<Product[]> {
  const { error } = await supabase.rpc("update_product", { p_id: product.id, ...productToRpcArgs(product) });
  if (error) { console.error("[updateProduct]", error.message); throw new Error(error.message); }
  return getProducts();
}

export async function deleteProduct(id: string): Promise<Product[]> {
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) console.error("[deleteProduct]", error.message);
  // Bersihkan juga Inventory produk ini (pola sama dgn deleteWarehouse) —
  // kalau gak, sisa stok gudangnya nyangkut permanen, dan kalau nanti ada
  // produk baru kebetulan pakai id yang sama, dia bakal "mewarisi" angka
  // stok lama yang gak nyambung. Fire-and-forget (cleanup best-effort,
  // bukan critical-path).
  deleteInventoryForProduct(id);
  return getProducts();
}

async function deleteInventoryForProduct(productId: string): Promise<void> {
  const { error } = await supabase.from("inventory").delete().eq("product_id", productId);
  if (error) console.error("[deleteInventoryForProduct]", error.message);
}

// ===== MARKETER STORE (Tahap 4 migrasi backend — Supabase) =====
// SENGAJA fallback ke defaultMarketers kalau tabel Supabase kosong (bukan
// [] kosong kayak entity lain) — nama marketer (Febia, Naqiya, dst) sudah
// jadi keputusan eksplisit dipertahankan sbg daftar staf asli, BUKAN data
// demo yg perlu dibersihkan (lihat catatan "Update 2026-09-06 x5" di plan).

function mapMarketerRow(m: { id: string; name: string; phone: string | null; default_fee: number; status: string; joined_at: string; notes: string | null }): Marketer {
  return { id: m.id, name: m.name, phone: m.phone ?? undefined, defaultFee: m.default_fee, status: m.status as MarketerStatus, joinedAt: m.joined_at, notes: m.notes ?? undefined };
}

export async function getMarketers(): Promise<Marketer[]> {
  const { data, error } = await supabase.from("marketers").select("*");
  if (error) { console.error("[getMarketers]", error.message); return defaultMarketers; }
  return data.length > 0 ? data.map(mapMarketerRow) : defaultMarketers;
}

// Marketer aktif (muncul di dropdown order baru)
export async function getActiveMarketers(): Promise<Marketer[]> {
  return (await getMarketers()).filter(m => m.status === "aktif");
}

// Tambah marketer baru. Jika saveToMaster=false, marketer hanya dipakai
// pada order ini dan TIDAK disimpan ke database master.
export async function addMarketer(marketer: Marketer, saveToMaster: boolean): Promise<Marketer[]> {
  if (saveToMaster) {
    const { error } = await supabase.from("marketers").insert({ id: marketer.id, name: marketer.name, phone: marketer.phone ?? null, default_fee: marketer.defaultFee, status: marketer.status, joined_at: marketer.joinedAt, notes: marketer.notes ?? null });
    if (error) console.error("[addMarketer]", error.message);
  }
  // Tidak disimpan ke master; hanya dikembalikan untuk dipakai pada order ini
  return getMarketers();
}

// Perbarui data marketer (profil, status, fee, dll)
export async function updateMarketer(marketer: Marketer): Promise<Marketer[]> {
  const { error } = await supabase.from("marketers").update({ name: marketer.name, phone: marketer.phone ?? null, default_fee: marketer.defaultFee, status: marketer.status, joined_at: marketer.joinedAt, notes: marketer.notes ?? null }).eq("id", marketer.id);
  if (error) console.error("[updateMarketer]", error.message);
  return getMarketers();
}

// Hapus marketer dari master (hanya jika tidak ada order terkait)
export async function deleteMarketer(id: string): Promise<Marketer[]> {
  const { error } = await supabase.from("marketers").delete().eq("id", id);
  if (error) console.error("[deleteMarketer]", error.message);
  return getMarketers();
}


// ===== MARKETER STATISTIK =====
export type MarketerStats = {
  marketer: Marketer;
  closingCount: number;   // jumlah closing (order)
  orderCount: number;     // jumlah order
  omzet: number;          // total nilai order
  fee: number;            // total fee
  outstanding: number;    // nilai outstanding (belum dibayar)
  customers: string[];    // daftar customer yang pernah closing
};

export async function getMarketerStats(marketerId: string): Promise<MarketerStats | null> {
  const marketer = (await getMarketers()).find(m => m.id === marketerId);
  if (!marketer) return null;
  const orders = (await getOrders()).filter(o => o.marketerId === marketerId);
  const closingCount = orders.length;
  const orderCount = orders.length;
  const omzet = orders.reduce((sum, o) => sum + o.total, 0);
  // Tahap 7: dihitung dari getFees() (get_fees() RPC, sudah strip total_fee
  // utk Admin sejak Tahap 6), BUKAN dari order.totalFee langsung — order
  // header sengaja TETAP nunjukin total_fee apa adanya (dipakai prefill form
  // Edit Order, lihat catatan di supabase/schema.sql), jadi kalau agregat
  // fee marketer dihitung dari situ, jumlahnya ikut bocor ke Admin walau
  // /fees sendiri sudah disembunyikan.
  const fee = (await getFees()).filter(f => f.marketerId === marketerId).reduce((sum, f) => sum + f.totalFee, 0);
  const outstanding = orders
    .filter(o => o.status !== "paid")
    .reduce((sum, o) => sum + (o.total - o.dp), 0);
  const customers = Array.from(new Set(orders.map(o => o.customer).filter(Boolean)));
  return { marketer, closingCount, orderCount, omzet, fee, outstanding, customers };
}


// Address (alamat pengiriman) pindah sepenuhnya ke central.ts (Tahap 5
// migrasi backend, Supabase) — dulu ada duplikat sederhana di sini yang
// baca/tulis localStorage key yang SAMA dengan central.ts ("umayasla_addresses",
// sekelas hack), sekarang dihapus supaya cuma ada SATU sumber kebenaran.
// Konsumen (order/page.tsx) pakai central.ts's getCustomerAddresses/addAddress.

// ===== ORDER STORE (Tahap 6 migrasi backend — Supabase) =====
// `orders` (header, bukan cost-sensitive) dibaca lewat tabel langsung.
// `order_items` (ada hpp/feeMarketer per-item, sesensitif modal produk)
// dibaca lewat RPC get_order_items() — strip hpp/feeMarketer utk admin,
// sama pola dgn get_products() (Tahap 4). Tulis order_items lewat RPC
// create_order_item/update_order_item/delete_order_item (Admin boleh tulis
// kolom aman, hpp/feeMarketer gak pernah tersentuh kalau bukan Owner).

function orderItemAmnaAttrs(item: OrderItemSnapshot) {
  if (!item.size && !item.pad && !item.fabric && !item.color && !item.modifications && !item.customRequests) return null;
  return {
    size: item.size, pad: item.pad, fabric: item.fabric, color: item.color,
    modifications: item.modifications, customRequests: item.customRequests,
    additionalPrice: item.additionalPrice, finalPrice: item.finalPrice,
  };
}

function orderItemFields(item: OrderItemSnapshot) {
  return {
    p_product_id: item.productId ?? null, p_name: item.name, p_emoji: item.emoji, p_qty: item.qty,
    p_price: item.price, p_hpp: item.hpp, p_fee_marketer: item.feeMarketer, p_discount: item.discount,
    p_detail: item.detail ?? null, p_category: item.category ?? null,
    p_production_stage: item.productionStage ?? null, p_shipment_stage: item.shipmentStage ?? null,
    p_stock_source: item.stockSource ?? null, p_warehouse_id: item.warehouseId ?? null,
    p_amna_attrs: orderItemAmnaAttrs(item),
  };
}

function mapOrderItemRow(r: Record<string, unknown>): OrderItemSnapshot {
  const attrs = (r.amna_attrs as Record<string, unknown> | null) || {};
  return {
    id: r.id as string,
    productId: (r.product_id as string) ?? undefined,
    name: r.name as string,
    emoji: r.emoji as string,
    qty: r.qty as number,
    price: r.price as number,
    hpp: (r.hpp as number) ?? 0,
    feeMarketer: (r.fee_marketer as number) ?? 0,
    discount: r.discount as number,
    detail: (r.detail as string) ?? undefined,
    category: (r.category as string) ?? undefined,
    size: attrs.size as string | undefined,
    pad: attrs.pad as string | undefined,
    fabric: attrs.fabric as string | undefined,
    color: attrs.color as string | undefined,
    modifications: attrs.modifications as string[] | undefined,
    customRequests: attrs.customRequests as CustomRequest[] | undefined,
    additionalPrice: attrs.additionalPrice as number | undefined,
    finalPrice: attrs.finalPrice as number | undefined,
    productionStage: (r.production_stage as ProductionStage) ?? undefined,
    shipmentStage: (r.shipment_stage as ShipmentStage) ?? undefined,
    stockSource: (r.stock_source as "ready" | "po") ?? undefined,
    warehouseId: (r.warehouse_id as string) ?? undefined,
  };
}

// Semua item order, dikelompokkan per order_id — dipakai getOrders()/getOrderById()
// supaya cuma 1 panggilan RPC utk berapapun order yang lagi dimuat.
async function fetchOrderItemsGrouped(orderId?: string): Promise<Map<string, OrderItemSnapshot[]>> {
  const { data, error } = await supabase.rpc("get_order_items", { p_order_id: orderId ?? null });
  const map = new Map<string, OrderItemSnapshot[]>();
  if (error) { console.error("[getOrderItems]", error.message); return map; }
  for (const row of (data || []) as Record<string, unknown>[]) {
    const key = row.order_id as string;
    const list = map.get(key) || [];
    list.push(mapOrderItemRow(row));
    map.set(key, list);
  }
  return map;
}

function mapOrderRow(r: Record<string, unknown>, items: OrderItemSnapshot[]): OrderRecord {
  return {
    id: r.id as string, number: r.number as string, date: r.date as string, customer: r.customer as string,
    customerId: (r.customer_id as string) ?? null, phone: r.phone as string, address: r.address as string,
    items,
    discountType: r.discount_type as DiscountType, discountValue: r.discount_value as number,
    discountAmount: r.discount_amount as number, ongkir: r.ongkir as number, ongkirLabel: r.ongkir_label as string,
    dp: r.dp as number, note: r.note as string, internalNote: (r.internal_note as string) ?? undefined,
    marketerId: (r.marketer_id as string) ?? null, marketerName: (r.marketer_name as string) ?? null,
    totalFee: (r.total_fee as number) ?? 0, subtotal: r.subtotal as number, total: r.total as number,
    status: r.status as OrderRecord["status"], batch: (r.batch as string) ?? undefined,
    createdAt: Number(r.created_at),
  };
}

function orderToRow(order: OrderRecord) {
  return {
    id: order.id, number: order.number, date: order.date, customer: order.customer,
    customer_id: order.customerId, phone: order.phone, address: order.address,
    discount_type: order.discountType, discount_value: order.discountValue, discount_amount: order.discountAmount,
    ongkir: order.ongkir, ongkir_label: order.ongkirLabel, dp: order.dp, note: order.note,
    internal_note: order.internalNote ?? null, marketer_id: order.marketerId, marketer_name: order.marketerName,
    total_fee: order.totalFee, subtotal: order.subtotal, total: order.total, status: order.status,
    batch: order.batch ?? null, created_at: order.createdAt,
  };
}

export async function getOrders(): Promise<OrderRecord[]> {
  const [{ data: orderRows, error }, itemsByOrder] = await Promise.all([
    supabase.from("orders").select("*").order("created_at", { ascending: false }),
    fetchOrderItemsGrouped(),
  ]);
  if (error) { console.error("[getOrders]", error.message); return []; }
  return ((orderRows || []) as Record<string, unknown>[]).map(r => mapOrderRow(r, itemsByOrder.get(r.id as string) || []));
}

export async function saveOrder(order: OrderRecord): Promise<OrderRecord[]> {
  const { error } = await supabase.from("orders").insert(orderToRow(order));
  if (error) { console.error("[saveOrder]", error.message); throw new Error(error.message); }
  for (const item of order.items) {
    const { error: itemError } = await supabase.rpc("create_order_item", { p_id: item.id, p_order_id: order.id, ...orderItemFields(item) });
    if (itemError) console.error("[saveOrder:item]", itemError.message);
  }
  return getOrders();
}

// Ambil satu order berdasarkan ID
export async function getOrderById(id: string): Promise<OrderRecord | undefined> {
  const [{ data: row, error }, itemsByOrder] = await Promise.all([
    supabase.from("orders").select("*").eq("id", id).maybeSingle(),
    fetchOrderItemsGrouped(id),
  ]);
  if (error) { console.error("[getOrderById]", error.message); return undefined; }
  return row ? mapOrderRow(row as Record<string, unknown>, itemsByOrder.get(id) || []) : undefined;
}

// Semua order milik satu customer — dipakai profil customer (tab Order, dsb.)
export async function getOrdersForCustomer(customerId: string): Promise<OrderRecord[]> {
  return (await getOrders()).filter(o => o.customerId === customerId);
}

// Total dibayar & outstanding dari order ASLI seorang customer — dipakai di
// beberapa tempat (situation-strip, kartu metrik, ringkasan tab Payment) yang
// dulu masing-masing baca field customer.paid/customer.outstanding statis
// ("Rp 0" selalu, gak pernah dihitung ulang sejak migrasi ke central.ts).
//
// Dihitung dari DP (order.dp), BUKAN order.status === "paid" — sampai saat
// ini tidak ada satupun alur di aplikasi yang benar-benar mengubah status
// order jadi "paid" (cuma "draft"/"confirmed" yang pernah dipakai), jadi
// pendekatan berbasis status akan selalu menghasilkan Rp 0 walau DP/pelunasan
// sudah dicatat. Kalau nanti ada fitur "Tandai Lunas" yang benar-benar
// mengubah status, order itu otomatis dihitung lunas penuh (bukan cuma DP-nya).
export function computePaymentTotals(orders: OrderRecord[]) {
  const totalPaid = orders.reduce((sum, o) => sum + (o.status === "paid" ? o.total : o.dp), 0);
  const totalOutstanding = orders.reduce((sum, o) => sum + (o.status === "paid" ? 0 : o.total - o.dp), 0);
  return { totalPaid, totalOutstanding };
}

// ===== TAGIH PELUNASAN VIA WHATSAPP =====
// Dipakai dari Action Center (profil customer) & Work Queue (Dashboard) —
// klik "Tagih pelunasan" langsung buka WhatsApp dgn pesan pelunasan siap
// kirim (item, total, sudah dibayar, sisa, rekening), bukan cuma pindah tab.
export function buildPelunasanMessage(order: OrderRecord): string {
  const outstanding = Math.max(0, order.total - order.dp);
  const fmt = (v: number) => "Rp" + v.toLocaleString("id-ID");
  const lines: string[] = [];
  lines.push(`Assalamu'alaikum ${order.customer},`);
  lines.push("");
  lines.push(`Mau info update untuk pesanan ${order.number} ya 🌿`);
  lines.push("");
  order.items.forEach(item => {
    lines.push(`- ${item.name}${item.detail ? ` (${item.detail})` : ""} x${item.qty}`);
  });
  lines.push("");
  lines.push(`Total Tagihan: ${fmt(order.total)}`);
  lines.push(`Sudah Dibayar: ${fmt(order.dp)}`);
  lines.push(`Sisa Pelunasan: ${fmt(outstanding)}`);
  const rek = determineRekening(order.items.map(i => i.category || "lainnya"));
  if (rek) {
    lines.push("");
    lines.push("Pelunasan bisa ditransfer ke:");
    lines.push(rek.name);
    lines.push(rek.bank);
    lines.push(rek.number);
    lines.push("a/n " + rek.owner);
  }
  lines.push("");
  lines.push("Ditunggu konfirmasinya ya, terima kasih 🌸");
  return lines.join("\n");
}

// null kalau nomor HP order kosong — pemanggil harus tangani (mis. tampilkan
// toast "Nomor WA belum ada") daripada buka wa.me tanpa nomor tujuan.
export function getPelunasanWhatsAppUrl(order: OrderRecord): string | null {
  const digits = order.phone.replace(/[^0-9]/g, "");
  if (!digits) return null;
  const waPhone = digits.startsWith("0") ? "62" + digits.slice(1) : digits;
  return `https://wa.me/${waPhone}?text=${encodeURIComponent(buildPelunasanMessage(order))}`;
}

// Perbarui order yang sudah ada (misal saat edit order) — order.items adalah
// daftar item FINAL yang diinginkan (sama seperti kontrak lama), jadi di sini
// direkonsiliasi ke order_items: item lama yg gak ada lagi di-hapus, sisanya
// di-upsert (update kalau id-nya udah ada, create kalau baru).
export async function updateOrder(order: OrderRecord): Promise<OrderRecord[]> {
  const { error } = await supabase.from("orders").update(orderToRow(order)).eq("id", order.id);
  if (error) { console.error("[updateOrder]", error.message); throw new Error(error.message); }
  const existingItems = (await fetchOrderItemsGrouped(order.id)).get(order.id) || [];
  const existingIds = new Set(existingItems.map(i => i.id));
  const newIds = new Set(order.items.map(i => i.id));
  for (const id of existingIds) {
    if (!newIds.has(id)) {
      const { error: delErr } = await supabase.rpc("delete_order_item", { p_id: id });
      if (delErr) console.error("[updateOrder:deleteItem]", delErr.message);
    }
  }
  for (const item of order.items) {
    if (existingIds.has(item.id)) {
      const { error: updErr } = await supabase.rpc("update_order_item", { p_id: item.id, ...orderItemFields(item) });
      if (updErr) console.error("[updateOrder:updateItem]", updErr.message);
    } else {
      const { error: insErr } = await supabase.rpc("create_order_item", { p_id: item.id, p_order_id: order.id, ...orderItemFields(item) });
      if (insErr) console.error("[updateOrder:createItem]", insErr.message);
    }
  }
  return getOrders();
}

// Ubah tahap produksi/pengiriman SATU item, tanpa harus buka form Order
// lengkap dulu — dipakai dari kartu produk di profil customer (RealProductCard,
// panels.tsx) supaya admin bisa klik-ubah langsung dari situ.
export async function updateItemStage(orderId: string, itemId: string, patch: { productionStage?: ProductionStage; shipmentStage?: ShipmentStage }): Promise<OrderRecord | null> {
  const order = await getOrderById(orderId);
  if (!order) return null;
  const item = order.items.find(it => it.id === itemId);
  if (!item) return null;
  const updatedItem = { ...item, ...patch };
  const { error } = await supabase.rpc("update_order_item", { p_id: itemId, ...orderItemFields(updatedItem) });
  if (error) { console.error("[updateItemStage]", error.message); return null; }
  return (await getOrderById(orderId)) ?? null;
}

// Hapus order permanen. order_items ikut kehapus otomatis (FK "on delete
// cascade", supabase/schema.sql). Pemanggil (order/page.tsx) bertanggung
// jawab juga membersihkan data terkait (removeFeeForOrder,
// removeOrderFromAllCollections) supaya tidak ada fee/collection yang
// nyangkut menunjuk ke order yang sudah hilang.
export async function deleteOrder(id: string): Promise<OrderRecord[]> {
  const { error } = await supabase.from("orders").delete().eq("id", id);
  if (error) console.error("[deleteOrder]", error.message);
  return getOrders();
}

// ===== FEE STORE =====

// Seed fee records agar halaman Fee langsung menampilkan data
// saat pertama kali dibuka (sebelum ada order yang dibuat).
export const seedFees: FeeRecord[] = [
  {
    id: "fee-seed-1",
    orderId: "ORD-seed-1",
    orderNumber: "ORD/2026/05/31-1001",
    invoiceNumber: "INV/2026/05/31-1001",
    marketerId: "mk-1",
    marketerName: "Febia",
    date: "31 Mei 2026",
    items: [
      { productName: "Amna Jilbab L · Rits", qty: 1, feePerUnit: 15000, feeTotal: 15000 },
      { productName: "Niqab Aroby Basic", qty: 1, feePerUnit: 10000, feeTotal: 10000 },
    ],
    totalFee: 25000,
    status: "belum-diambil",
    paidDate: null,
    note: "Order Ummu Hakkan",
    createdAt: 1748700000000,
  },
  {
    id: "fee-seed-2",
    orderId: "ORD-seed-2",
    orderNumber: "ORD/2026/05/28-1002",
    invoiceNumber: "INV/2026/05/28-1002",
    marketerId: "mk-3",
    marketerName: "Salsabila",
    date: "28 Mei 2026",
    items: [
      { productName: "Buku Parenting", qty: 2, feePerUnit: 5000, feeTotal: 10000 },
    ],
    totalFee: 10000,
    status: "belum-diambil",
    paidDate: null,
    note: "PO Buku Parenting · Batch 8",
    createdAt: 1748440000000,
  },
  {
    id: "fee-seed-3",
    orderId: "ORD-seed-3",
    orderNumber: "ORD/2026/05/25-1003",
    invoiceNumber: "INV/2026/05/25-1003",
    marketerId: "mk-4",
    marketerName: "Nurul Aulia",
    date: "25 Mei 2026",
    items: [
      { productName: "Amna Jilbab L · Polos", qty: 1, feePerUnit: 15000, feeTotal: 15000 },
      { productName: "Niqab Poni Basic", qty: 1, feePerUnit: 10000, feeTotal: 10000 },
    ],
    totalFee: 25000,
    status: "sudah-diambil",
    paidDate: "2 Juni 2026",
    note: "Order Anggun Gravika",
    createdAt: 1748180000000,
  },
  {
    id: "fee-seed-4",
    orderId: "ORD-seed-4",
    orderNumber: "ORD/2026/05/20-1004",
    invoiceNumber: "INV/2026/05/20-1004",
    marketerId: "mk-2",
    marketerName: "Naqiya",
    date: "20 Mei 2026",
    items: [
      { productName: "Amna Jilbab L · Polos", qty: 1, feePerUnit: 15000, feeTotal: 15000 },
      { productName: "Niqab Aroby Basic", qty: 1, feePerUnit: 10000, feeTotal: 10000 },
    ],
    totalFee: 25000,
    status: "sudah-diambil",
    paidDate: "28 Mei 2026",
    note: "Order Siti Aisyah",
    createdAt: 1747580000000,
  },
];

// ===== FEE STORE (Tahap 6 migrasi backend — Supabase) =====
// `fees` RLS-nya "all_authenticated" (bukan owner-only) — keputusan user
// (2026-09-11): Admin tetap boleh bikin/edit/hapus fee sama seperti
// sekarang, cuma NOMINAL total_fee/items yang tersembunyi saat dibaca
// balik lewat get_fees() RPC (strip utk non-owner, sudah ada sejak Tahap 1).

function mapFeeRow(r: Record<string, unknown>): FeeRecord {
  return {
    id: r.id as string, orderId: r.order_id as string, orderNumber: r.order_number as string,
    invoiceNumber: r.invoice_number as string, marketerId: r.marketer_id as string, marketerName: r.marketer_name as string,
    date: r.date as string, items: (r.items as FeeRecord["items"]) ?? [], totalFee: (r.total_fee as number) ?? 0,
    status: r.status as FeeRecord["status"], paidDate: (r.paid_date as string) ?? null, note: r.note as string,
    createdAt: Number(r.created_at),
  };
}

function feeToRow(f: FeeRecord) {
  return {
    id: f.id, order_id: f.orderId, order_number: f.orderNumber, invoice_number: f.invoiceNumber,
    marketer_id: f.marketerId, marketer_name: f.marketerName, date: f.date, items: f.items,
    total_fee: f.totalFee, status: f.status, paid_date: f.paidDate, note: f.note, created_at: f.createdAt,
  };
}

export async function getFees(): Promise<FeeRecord[]> {
  const { data, error } = await supabase.rpc("get_fees");
  if (error) { console.error("[getFees]", error.message); return []; }
  return ((data || []) as Record<string, unknown>[]).map(mapFeeRow);
}

// Satu order = maksimal satu FeeRecord. Kalau order ini sudah pernah punya
// FeeRecord, perbarui entri yang sama (id/status/paidDate/createdAt lama
// dipertahankan) — cuma nominal/item fee-nya yang disegarkan.
export async function saveFee(fee: FeeRecord): Promise<FeeRecord[]> {
  const { data: existing } = await supabase.from("fees").select("id").eq("order_id", fee.orderId).maybeSingle();
  if (existing) {
    const { error } = await supabase.from("fees").update({
      order_number: fee.orderNumber, invoice_number: fee.invoiceNumber, marketer_id: fee.marketerId,
      marketer_name: fee.marketerName, date: fee.date, items: fee.items, total_fee: fee.totalFee,
    }).eq("id", existing.id);
    if (error) console.error("[saveFee:update]", error.message);
  } else {
    const { error } = await supabase.from("fees").insert(feeToRow(fee));
    if (error) console.error("[saveFee:insert]", error.message);
  }
  return getFees();
}

// Dipakai saat order diedit sampai marketer/fee-nya dihapus — supaya fee lama
// dari kondisi sebelumnya gak nyangkut selamanya di halaman Fee.
export async function removeFeeForOrder(orderId: string): Promise<FeeRecord[]> {
  const { error } = await supabase.from("fees").delete().eq("order_id", orderId);
  if (error) console.error("[removeFeeForOrder]", error.message);
  return getFees();
}

export async function updateFeeStatus(id: string, status: "belum-diambil" | "sudah-diambil", paidDate: string | null, note?: string): Promise<FeeRecord[]> {
  const patch: Record<string, unknown> = { status, paid_date: paidDate };
  if (note !== undefined) patch.note = note;
  const { error } = await supabase.from("fees").update(patch).eq("id", id);
  if (error) console.error("[updateFeeStatus]", error.message);
  return getFees();
}

// Koreksi manual nominal fee (mis. kesepakatan berubah setelah tercatat) —
// mengganti rincian item dengan satu baris "Penyesuaian manual" supaya
// breakdown-nya gak menyesatkan (nggak nyisa angka lama yang beda dari total).
export async function updateFeeAmount(id: string, totalFee: number, note?: string): Promise<FeeRecord[]> {
  const patch: Record<string, unknown> = {
    total_fee: totalFee,
    items: [{ productName: "Penyesuaian manual", qty: 1, feePerUnit: totalFee, feeTotal: totalFee }],
  };
  if (note !== undefined) patch.note = note;
  const { error } = await supabase.from("fees").update(patch).eq("id", id);
  if (error) console.error("[updateFeeAmount]", error.message);
  return getFees();
}

export async function deleteFee(id: string): Promise<FeeRecord[]> {
  const { error } = await supabase.from("fees").delete().eq("id", id);
  if (error) console.error("[deleteFee]", error.message);
  return getFees();
}

// ===== PAYMENT STORE (Tahap 6 migrasi backend — Supabase; riwayat transfer masuk, per top up) =====

function mapPaymentRow(r: Record<string, unknown>): PaymentRecord {
  return {
    id: r.id as string, orderId: r.order_id as string, orderNumber: r.order_number as string,
    customerId: (r.customer_id as string) ?? null, customerName: r.customer_name as string,
    productSummary: r.product_summary as string, amount: r.amount as number,
    dateReceived: r.date_received as string, status: r.status as PaymentRecord["status"],
    dateWithdrawn: (r.date_withdrawn as string) ?? null, note: r.note as string,
    createdAt: Number(r.created_at),
  };
}

function paymentToRow(p: PaymentRecord) {
  return {
    id: p.id, order_id: p.orderId, order_number: p.orderNumber, customer_id: p.customerId,
    customer_name: p.customerName, product_summary: p.productSummary, amount: p.amount,
    date_received: p.dateReceived, status: p.status, date_withdrawn: p.dateWithdrawn, note: p.note,
    created_at: p.createdAt,
  };
}

export async function getPayments(): Promise<PaymentRecord[]> {
  const { data, error } = await supabase.from("payments").select("*").order("created_at", { ascending: false });
  if (error) { console.error("[getPayments]", error.message); return []; }
  return ((data || []) as Record<string, unknown>[]).map(mapPaymentRow);
}

export async function getPaymentsForOrder(orderId: string): Promise<PaymentRecord[]> {
  const { data, error } = await supabase.from("payments").select("*").eq("order_id", orderId);
  if (error) { console.error("[getPaymentsForOrder]", error.message); return []; }
  return ((data || []) as Record<string, unknown>[]).map(mapPaymentRow);
}

// code "23505" = unique_violation (Postgres) — cuma bisa kena di sini dari
// index partial Split Bill Shopee (supabase/schema.sql): 2 device nyaris
// bersamaan nyoba nambah baris "Split Bill Shopee" utk order yang sama.
// Bukan error fatal — anggap baris itu udah ada (device lain menang duluan).
export async function addPayment(payment: PaymentRecord): Promise<PaymentRecord[]> {
  const { error } = await supabase.from("payments").insert(paymentToRow(payment));
  if (error && error.code !== "23505") console.error("[addPayment]", error.message);
  return getPayments();
}

export async function deletePayment(id: string): Promise<PaymentRecord[]> {
  const { error } = await supabase.from("payments").delete().eq("id", id);
  if (error) console.error("[deletePayment]", error.message);
  return getPayments();
}

export async function markPaymentWithdrawn(id: string, status: "belum-ditarik" | "sudah-ditarik", dateWithdrawn: string | null): Promise<PaymentRecord[]> {
  const { error } = await supabase.from("payments").update({ status, date_withdrawn: dateWithdrawn }).eq("id", id);
  if (error) console.error("[markPaymentWithdrawn]", error.message);
  return getPayments();
}

// Dipanggil saat order dihapus permanen — supaya riwayat pembayaran gak
// nyangkut menunjuk order yang sudah tidak ada (pola sama dgn removeFeeForOrder).
export async function removePaymentsForOrder(orderId: string): Promise<PaymentRecord[]> {
  const { error } = await supabase.from("payments").delete().eq("order_id", orderId);
  if (error) console.error("[removePaymentsForOrder]", error.message);
  return getPayments();
}

// Satu fungsi INTI utk "catat top up masuk" — dipakai bareng oleh form Edit
// Order (Riwayat Pembayaran) DAN tombol pintas "Catat Pembayaran" di
// Dashboard/profil customer, supaya keduanya benar-benar satu sistem yang
// sama (bukan 2 jalur terpisah yang bisa nyimpang kayak bug yang pernah
// ditemukan sebelumnya). order.dp bertambah + satu baris PaymentRecord baru.
export async function recordPaymentForOrder(order: OrderRecord, amount: number, note?: string): Promise<{ updatedOrder: OrderRecord; payment: PaymentRecord }> {
  const updatedOrder: OrderRecord = { ...order, dp: order.dp + amount };
  await updateOrder(updatedOrder);
  const payment: PaymentRecord = {
    id: "pay-" + Date.now(),
    orderId: order.id,
    orderNumber: order.number,
    customerId: order.customerId,
    customerName: order.customer,
    productSummary: order.items.map(i => i.name).join(", "),
    amount,
    dateReceived: new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }),
    status: "belum-ditarik",
    dateWithdrawn: null,
    note: note || "",
    createdAt: Date.now(),
  };
  await addPayment(payment);
  return { updatedOrder, payment };
}

// ===== WAREHOUSE STORE (Tahap 4 migrasi backend — Supabase, bukan localStorage lagi) =====
// Semua fungsi di bawah sekarang ASYNC (query Supabase). Dipertahankan
// entity-list-return-nya (Warehouse[]/Inventory[]) biar bentuk data yg
// dibaca UI gak berubah, cuma cara ambilnya yg beda. Belum ada UI CRUD
// gudang di app manapun sampai sekarang — kalau nanti dibutuhkan, tinggal
// pakai addWarehouse/updateWarehouse/deleteWarehouse yg sudah siap ini.

function mapWarehouseRow(w: { id: string; name: string; code: string; active: boolean }): Warehouse {
  return { id: w.id, name: w.name, code: w.code, active: w.active };
}

export async function getWarehouses(): Promise<Warehouse[]> {
  const { data, error } = await supabase.from("warehouses").select("*");
  if (error) { console.error("[getWarehouses]", error.message); return defaultWarehouses; }
  return data.length > 0 ? data.map(mapWarehouseRow) : defaultWarehouses;
}

export async function addWarehouse(warehouse: Warehouse): Promise<Warehouse[]> {
  const { error } = await supabase.from("warehouses").insert({ id: warehouse.id, name: warehouse.name, code: warehouse.code, active: warehouse.active });
  if (error) console.error("[addWarehouse]", error.message);
  return getWarehouses();
}

export async function updateWarehouse(warehouse: Warehouse): Promise<Warehouse[]> {
  const { error } = await supabase.from("warehouses").update({ name: warehouse.name, code: warehouse.code, active: warehouse.active }).eq("id", warehouse.id);
  if (error) console.error("[updateWarehouse]", error.message);
  return getWarehouses();
}

export async function deleteWarehouse(id: string): Promise<Warehouse[]> {
  // Inventory milik gudang ini ikut terhapus otomatis (FK "on delete cascade"
  // di supabase/schema.sql) — gak perlu hapus manual dari sini lagi.
  const { error } = await supabase.from("warehouses").delete().eq("id", id);
  if (error) console.error("[deleteWarehouse]", error.message);
  return getWarehouses();
}

// ===== INVENTORY STORE =====

function mapInventoryRow(i: { id: string; product_id: string; warehouse_id: string; stock_on_hand: number; reserved: number; minimum_stock: number; location: string | null }): Inventory {
  return { id: i.id, productId: i.product_id, warehouseId: i.warehouse_id, stockOnHand: i.stock_on_hand, reserved: i.reserved, minimumStock: i.minimum_stock, location: i.location ?? undefined };
}

export async function getInventory(): Promise<Inventory[]> {
  const { data, error } = await supabase.from("inventory").select("*");
  if (error) { console.error("[getInventory]", error.message); return []; }
  return data.map(mapInventoryRow);
}

// Inventory untuk satu produk (di semua gudang)
export async function getInventoryForProduct(productId: string): Promise<Inventory[]> {
  const { data, error } = await supabase.from("inventory").select("*").eq("product_id", productId);
  if (error) { console.error("[getInventoryForProduct]", error.message); return []; }
  return data.map(mapInventoryRow);
}

// Inventory untuk satu gudang (semua produk)
export async function getInventoryByWarehouse(warehouseId: string): Promise<Inventory[]> {
  const { data, error } = await supabase.from("inventory").select("*").eq("warehouse_id", warehouseId);
  if (error) { console.error("[getInventoryByWarehouse]", error.message); return []; }
  return data.map(mapInventoryRow);
}

// Total stok (on hand) sebuah produk di semua gudang
export async function getTotalStock(productId: string): Promise<number> {
  const inv = await getInventoryForProduct(productId);
  return inv.reduce((sum, i) => sum + i.stockOnHand, 0);
}

// Total available sebuah produk di semua gudang
export async function getTotalAvailable(productId: string): Promise<number> {
  const inv = await getInventoryForProduct(productId);
  return inv.reduce((sum, i) => sum + inventoryAvailable(i), 0);
}

export async function addInventory(inv: Inventory): Promise<Inventory[]> {
  const { error } = await supabase.from("inventory").insert({ id: inv.id, product_id: inv.productId, warehouse_id: inv.warehouseId, stock_on_hand: inv.stockOnHand, reserved: inv.reserved, minimum_stock: inv.minimumStock, location: inv.location ?? null });
  if (error) console.error("[addInventory]", error.message);
  return getInventory();
}

export async function updateInventory(inv: Inventory): Promise<Inventory[]> {
  const { error } = await supabase.from("inventory").update({ stock_on_hand: inv.stockOnHand, reserved: inv.reserved, minimum_stock: inv.minimumStock, location: inv.location ?? null }).eq("id", inv.id);
  if (error) console.error("[updateInventory]", error.message);
  return getInventory();
}

// Kurangi stok on hand dari gudang tertentu (saat order dibuat)
export async function deductStock(productId: string, warehouseId: string, qty: number): Promise<void> {
  await adjustStock(productId, warehouseId, -qty);
}

// Set stok on-hand produk di 1 gudang secara langsung — dipakai form
// "Kelola Stok" di Katalog (input stok awal / koreksi manual). Bikin record
// baru kalau belum pernah ada Inventory utk pasangan produk+gudang ini.
export async function setStock(productId: string, warehouseId: string, stockOnHand: number): Promise<void> {
  const { data: existing } = await supabase.from("inventory").select("id").eq("product_id", productId).eq("warehouse_id", warehouseId).maybeSingle();
  const value = Math.max(0, stockOnHand);
  if (existing) {
    const { error } = await supabase.from("inventory").update({ stock_on_hand: value }).eq("id", existing.id);
    if (error) console.error("[setStock]", error.message);
  } else {
    const { error } = await supabase.from("inventory").insert({ id: "inv-" + productId + "-" + warehouseId, product_id: productId, warehouse_id: warehouseId, stock_on_hand: value, reserved: 0, minimum_stock: 0 });
    if (error) console.error("[setStock]", error.message);
  }
}

// Tambah/kurangi stok on-hand (delta boleh negatif) — dipakai saat order
// dengan item "Ready Stock" disimpan (kurangi) atau dihapus/diedit
// (kembalikan). SENGAJA TIDAK di-floor ke 0 di sini (beda dari setStock) —
// kalau admin oversell (qty order > stok fisik yang ada), stockOnHand boleh
// sempat minus di dalam sistem supaya nanti kalau order itu dihapus/qty
// dikurangi, angkanya kembali PERSIS ke nilai semula (bukan malah nambah
// dari 0 yang sudah salah/ke-floor duluan). Tampilan ke admin (badge Katalog,
// pilihan gudang di form Order) tetap gak pernah nunjukin minus karena
// inventoryAvailable()/getTotalAvailable() sendiri yang floor pas ditampilkan.
export async function adjustStock(productId: string, warehouseId: string, delta: number): Promise<void> {
  const { data: existing } = await supabase.from("inventory").select("id, stock_on_hand").eq("product_id", productId).eq("warehouse_id", warehouseId).maybeSingle();
  if (existing) {
    const { error } = await supabase.from("inventory").update({ stock_on_hand: existing.stock_on_hand + delta }).eq("id", existing.id);
    if (error) console.error("[adjustStock]", error.message);
  } else {
    const { error } = await supabase.from("inventory").insert({ id: "inv-" + productId + "-" + warehouseId, product_id: productId, warehouse_id: warehouseId, stock_on_hand: delta, reserved: 0, minimum_stock: 0 });
    if (error) console.error("[adjustStock]", error.message);
  }
}

// Tambah reserved ke gudang tertentu (saat order di-reserve) — TIDAK ADA
// call site di app manapun sampai sekarang, dipertahankan siap pakai.
export async function reserveStock(productId: string, warehouseId: string, qty: number): Promise<void> {
  const { data: existing } = await supabase.from("inventory").select("id, reserved").eq("product_id", productId).eq("warehouse_id", warehouseId).maybeSingle();
  if (existing) {
    const { error } = await supabase.from("inventory").update({ reserved: existing.reserved + qty }).eq("id", existing.id);
    if (error) console.error("[reserveStock]", error.message);
  }
}

// ===== INVOICE NUMBER (Tahap 6 migrasi backend — Supabase) =====
// Counter BERSAMA (bukan lagi per-device) lewat RPC atomic next_invoice_number()
// — cegah Owner & Admin dari 2 device dapat nomor "INV/..." yang sama.
// Ini cuma label kosmetik (preview invoice & FeeRecord.invoiceNumber),
// BUKAN OrderRecord.number (itu tetap angka random lokal, tidak diubah).
export async function getNextInvoiceNumber(): Promise<string> {
  const { data, error } = await supabase.rpc("next_invoice_number");
  if (error) console.error("[getNextInvoiceNumber]", error.message);
  const next = typeof data === "number" ? data : Date.now() % 100000;
  const now = new Date();
  return `INV/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")}-${next}`;
}

// ===== BATCH PRODUKSI (Tahap 6 migrasi backend — Supabase; nama batch
// saja — dipilih saat bikin order Amna) =====

export async function getBatchNames(): Promise<string[]> {
  const { data, error } = await supabase.from("batch_names").select("name").order("name");
  if (error) { console.error("[getBatchNames]", error.message); return ["Batch 7", "Batch 8"]; }
  return data.length > 0 ? data.map(r => r.name as string) : ["Batch 7", "Batch 8"];
}

export async function addBatchName(name: string): Promise<string[]> {
  const { error } = await supabase.from("batch_names").upsert({ name });
  if (error) console.error("[addBatchName]", error.message);
  return getBatchNames();
}

// ===== CALCULATION HELPERS =====

export function calculateDiscount(price: number, type: DiscountType, value: number): number {
  if (value <= 0) return 0;
  if (type === "percent") {
    return Math.round(price * (Math.min(value, 100) / 100));
  }
  return Math.min(value, price);
}

export function calculateProductMetrics(product: Product) {
  const price = product.price || 0;
  const hpp = product.hpp || 0;
  const discount = product.discountDefault || 0;
  const discountType = product.discountType || "percent";
  const discountAmount = calculateDiscount(price, discountType, discount);
  const priceAfterDiscount = price - discountAmount;
  const grossProfit = priceAfterDiscount - hpp;
  return { price, hpp, discountAmount, priceAfterDiscount, grossProfit };
}

// ===== FEE CALCULATION =====

export function calculateOrderFee(items: OrderItemSnapshot[]): number {
  return items.reduce((sum, item) => sum + (item.feeMarketer || 0) * item.qty, 0);
}

// ===== FORMAT =====

export const formatRupiah = (value: number) => "Rp " + value.toLocaleString("id-ID");
