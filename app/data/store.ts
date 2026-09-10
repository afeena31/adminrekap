"use client";

import { products as seedProducts, determineRekening, type Product } from "./products";
import { type CustomerAddress } from "./customers";
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



// ===== STORAGE KEYS =====

const KEYS = {
  products: "umayasla_products",
  orders: "umayasla_orders",
  fees: "umayasla_fees",
  marketers: "umayasla_marketers",
  warehouses: "umayasla_warehouses",
  inventory: "umayasla_inventory",
  invoiceCounter: "umayasla_invoice_counter",
  addresses: "umayasla_addresses",
  batchNames: "umayasla_batch_names",
  payments: "umayasla_payments",
};



// ===== LOCAL STORAGE HELPERS =====

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

// ===== PRODUCT STORE (Tahap 4 migrasi backend — Supabase) =====
// Baca lewat RPC get_products() (Tahap 1, supabase/schema.sql), BUKAN query
// tabel langsung — RPC itu sendiri yg strip kolom modal/HPP/fee marketer
// server-side kalau pemanggilnya role "admin" (dicek dari tabel profiles),
// jadi data cost BENERAN gak pernah sampai ke browser Admin, bukan cuma
// disembunyikan di UI (itu baru Tahap 7). Tulis (add/update/delete) ke
// tabel langsung — RLS "products_write_owner_only" cuma izinin role Owner;
// Admin yg nyoba nulis bakal ditolak Supabase sendiri (proteksi di
// database, bukan nunggu UI-nya dikunci di Tahap 7).

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
  };
}

function productToRow(product: Product) {
  return {
    name: product.name, category: product.category, price: product.price,
    original_price: product.originalPrice ?? null, description: product.description ?? null,
    emoji: product.emoji, badge: product.badge ?? null, variants: product.variants ?? null,
    modal_kotor: product.modalKotor ?? null, biaya_operasional: product.biayaOperasional ?? null,
    hpp: product.hpp ?? null, fee_marketer: product.feeMarketer ?? null,
    discount_default: product.discountDefault ?? null, discount_type: product.discountType ?? null,
    active: product.active !== false, default_collection_ids: product.defaultCollectionIds ?? null,
  };
}

export async function getProducts(): Promise<Product[]> {
  const { data, error } = await supabase.rpc("get_products");
  if (error) { console.error("[getProducts]", error.message); return []; }
  return ((data || []) as Record<string, unknown>[]).map(mapProductRow);
}

export async function addProduct(product: Product): Promise<Product[]> {
  const { error } = await supabase.from("products").insert({ id: product.id, ...productToRow(product) });
  if (error) console.error("[addProduct]", error.message);
  return getProducts();
}

export async function updateProduct(product: Product): Promise<Product[]> {
  const { error } = await supabase.from("products").update(productToRow(product)).eq("id", product.id);
  if (error) console.error("[updateProduct]", error.message);
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
  const orders = getOrders().filter(o => o.marketerId === marketerId);
  const closingCount = orders.length;
  const orderCount = orders.length;
  const omzet = orders.reduce((sum, o) => sum + o.total, 0);
  const fee = orders.reduce((sum, o) => sum + (o.totalFee || 0), 0);
  const outstanding = orders
    .filter(o => o.status !== "paid")
    .reduce((sum, o) => sum + (o.total - o.dp), 0);
  const customers = Array.from(new Set(orders.map(o => o.customer).filter(Boolean)));
  return { marketer, closingCount, orderCount, omzet, fee, outstanding, customers };
}


// ===== ADDRESS STORE =====
// Alamat pengiriman disimpan permanen di localStorage (key yang sama dipakai
// central.ts's addAddress/getCustomerAddresses — lihat app/data/central.ts).

export function getSavedAddresses(): CustomerAddress[] {
  return load<CustomerAddress[]>(KEYS.addresses, []);
}

// Semua alamat tersimpan untuk satu customer
export function getCustomerAddresses(customerId: string): CustomerAddress[] {
  return getSavedAddresses().filter(a => a.customerId === customerId);
}

// Simpan alamat baru secara permanen
export function saveAddress(address: CustomerAddress): CustomerAddress[] {
  const list = getSavedAddresses();
  const updated = [...list, address];
  save(KEYS.addresses, updated);
  return updated;
}

// Hapus alamat yang tersimpan (hanya yang disimpan user, bukan seed)
export function deleteSavedAddress(id: string): CustomerAddress[] {
  const list = getSavedAddresses();
  const updated = list.filter(a => a.id !== id);
  save(KEYS.addresses, updated);
  return updated;
}

// ===== ORDER STORE =====

export function getOrders(): OrderRecord[] {
  return load<OrderRecord[]>(KEYS.orders, []);
}


export function saveOrder(order: OrderRecord): OrderRecord[] {
  const list = getOrders();
  const updated = [order, ...list];
  save(KEYS.orders, updated);
  return updated;
}

// Ambil satu order berdasarkan ID
export function getOrderById(id: string): OrderRecord | undefined {
  return getOrders().find(o => o.id === id);
}

// Semua order milik satu customer — dipakai profil customer (tab Order, dsb.)
export function getOrdersForCustomer(customerId: string): OrderRecord[] {
  return getOrders().filter(o => o.customerId === customerId);
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

// Perbarui order yang sudah ada (misal saat edit order)
export function updateOrder(order: OrderRecord): OrderRecord[] {
  const list = getOrders();
  const updated = list.map(o => (o.id === order.id ? order : o));
  save(KEYS.orders, updated);
  return updated;
}

// Ubah tahap produksi/pengiriman SATU item, tanpa harus buka form Order
// lengkap dulu — dipakai dari kartu produk di profil customer (RealProductCard,
// panels.tsx) supaya admin bisa klik-ubah langsung dari situ.
export function updateItemStage(orderId: string, itemId: string, patch: { productionStage?: ProductionStage; shipmentStage?: ShipmentStage }): OrderRecord | null {
  const order = getOrderById(orderId);
  if (!order) return null;
  const updated: OrderRecord = {
    ...order,
    items: order.items.map(it => (it.id === itemId ? { ...it, ...patch } : it)),
  };
  updateOrder(updated);
  return updated;
}

// Hapus order permanen. Pemanggil (order/page.tsx) bertanggung jawab juga
// membersihkan data terkait (removeFeeForOrder, removeOrderFromAllCollections)
// supaya tidak ada fee/collection yang nyangkut menunjuk ke order yang sudah hilang.
export function deleteOrder(id: string): OrderRecord[] {
  const updated = getOrders().filter(o => o.id !== id);
  save(KEYS.orders, updated);
  return updated;
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

// Sama seperti getProducts() — seedFees (fee dari order contoh, mis. "Order
// Siti Aisyah") TIDAK dipakai sebagai default. Tanpa ini, halaman Fee bisa
// menampilkan angka fiktif ("Belum Diambil Rp 35.000") di device manapun
// yang belum pernah menulis ke localStorage sama sekali, padahal customer &
// marketer contoh sudah lama dihapus.
export function getFees(): FeeRecord[] {
  return load<FeeRecord[]>(KEYS.fees, []);
}


// Satu order = maksimal satu FeeRecord. Sebelumnya tiap kali order (dengan
// marketer+fee) disimpan — termasuk tiap kali diEDIT — fungsi ini menambah
// entri BARU tanpa pernah mengecek entri lama punya order yang sama, jadi
// fee marketer dobel/tripel/dst di halaman Fee tiap order-nya diedit ulang.
// Sekarang: kalau order itu sudah pernah punya FeeRecord, perbarui entri yang
// sama (pakai id lama) — status "sudah-diambil"/paidDate yang sudah tercatat
// TIDAK ikut ter-reset, cuma nominal/item fee-nya yang disegarkan.
export function saveFee(fee: FeeRecord): FeeRecord[] {
  const list = getFees();
  const existing = list.find(f => f.orderId === fee.orderId);
  const merged: FeeRecord = existing
    ? { ...fee, id: existing.id, status: existing.status, paidDate: existing.paidDate, createdAt: existing.createdAt }
    : fee;
  const filtered = list.filter(f => f.orderId !== fee.orderId);
  const updated = [merged, ...filtered];
  save(KEYS.fees, updated);
  return updated;
}

// Dipakai saat order diedit sampai marketer/fee-nya dihapus — supaya fee lama
// dari kondisi sebelumnya gak nyangkut selamanya di halaman Fee.
export function removeFeeForOrder(orderId: string): FeeRecord[] {
  const updated = getFees().filter(f => f.orderId !== orderId);
  save(KEYS.fees, updated);
  return updated;
}

export function saveFees(list: FeeRecord[]) {
  save(KEYS.fees, list);
}

export function updateFeeStatus(id: string, status: "belum-diambil" | "sudah-diambil", paidDate: string | null, note?: string): FeeRecord[] {
  const list = getFees();
  const updated = list.map(f => f.id === id ? { ...f, status, paidDate, note: note ?? f.note } : f);
  save(KEYS.fees, updated);
  return updated;
}

// Koreksi manual nominal fee (mis. kesepakatan berubah setelah tercatat) —
// mengganti rincian item dengan satu baris "Penyesuaian manual" supaya
// breakdown-nya gak menyesatkan (nggak nyisa angka lama yang beda dari total).
export function updateFeeAmount(id: string, totalFee: number, note?: string): FeeRecord[] {
  const list = getFees();
  const updated = list.map(f => f.id === id ? {
    ...f,
    totalFee,
    items: [{ productName: "Penyesuaian manual", qty: 1, feePerUnit: totalFee, feeTotal: totalFee }],
    note: note ?? f.note,
  } : f);
  save(KEYS.fees, updated);
  return updated;
}

export function deleteFee(id: string): FeeRecord[] {
  const updated = getFees().filter(f => f.id !== id);
  save(KEYS.fees, updated);
  return updated;
}

// ===== PAYMENT STORE (riwayat transfer masuk, per top up) =====

export function getPayments(): PaymentRecord[] {
  return load<PaymentRecord[]>(KEYS.payments, []);
}

export function getPaymentsForOrder(orderId: string): PaymentRecord[] {
  return getPayments().filter(p => p.orderId === orderId);
}

export function addPayment(payment: PaymentRecord): PaymentRecord[] {
  const updated = [payment, ...getPayments()];
  save(KEYS.payments, updated);
  return updated;
}

export function deletePayment(id: string): PaymentRecord[] {
  const updated = getPayments().filter(p => p.id !== id);
  save(KEYS.payments, updated);
  return updated;
}

export function markPaymentWithdrawn(id: string, status: "belum-ditarik" | "sudah-ditarik", dateWithdrawn: string | null): PaymentRecord[] {
  const updated = getPayments().map(p => p.id === id ? { ...p, status, dateWithdrawn } : p);
  save(KEYS.payments, updated);
  return updated;
}

// Dipanggil saat order dihapus permanen — supaya riwayat pembayaran gak
// nyangkut menunjuk order yang sudah tidak ada (pola sama dgn removeFeeForOrder).
export function removePaymentsForOrder(orderId: string): PaymentRecord[] {
  const updated = getPayments().filter(p => p.orderId !== orderId);
  save(KEYS.payments, updated);
  return updated;
}

// Satu fungsi INTI utk "catat top up masuk" — dipakai bareng oleh form Edit
// Order (Riwayat Pembayaran) DAN tombol pintas "Catat Pembayaran" di
// Dashboard/profil customer, supaya keduanya benar-benar satu sistem yang
// sama (bukan 2 jalur terpisah yang bisa nyimpang kayak bug yang pernah
// ditemukan sebelumnya). order.dp bertambah + satu baris PaymentRecord baru.
export function recordPaymentForOrder(order: OrderRecord, amount: number, note?: string): { updatedOrder: OrderRecord; payment: PaymentRecord } {
  const updatedOrder: OrderRecord = { ...order, dp: order.dp + amount };
  updateOrder(updatedOrder);
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
  addPayment(payment);
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

// ===== INVOICE NUMBER =====


// ===== BATCH PRODUKSI (nama batch saja — dipilih saat bikin order Amna) =====

export function getBatchNames(): string[] {
  return load<string[]>(KEYS.batchNames, ["Batch 7", "Batch 8"]);
}

export function addBatchName(name: string): string[] {
  const list = getBatchNames();
  if (list.includes(name)) return list;
  const updated = [...list, name];
  save(KEYS.batchNames, updated);
  return updated;
}

export function getNextInvoiceNumber(): string {
  const counter = load<number>(KEYS.invoiceCounter, 1000);
  const next = counter + 1;
  save(KEYS.invoiceCounter, next);
  const now = new Date();
  return `INV/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")}-${next}`;
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
