"use client";

import { products as seedProducts, type Product } from "./products";
import { customersData, type CustomerAddress } from "./customers";


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
  note: string;
  marketerId: string | null;
  marketerName: string | null;
  totalFee: number;
  subtotal: number;
  total: number;
  status: "draft" | "confirmed" | "paid";
  batch?: string;          // batch produksi (misal "Batch 7") untuk order Amna Jilbab
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

// ===== PRODUCT STORE =====

export function getProducts(): Product[] {
  return load<Product[]>(KEYS.products, seedProducts);
}

export function saveProducts(list: Product[]) {
  save(KEYS.products, list);
}

export function addProduct(product: Product): Product[] {
  const list = getProducts();
  const updated = [...list, product];
  saveProducts(updated);
  return updated;
}

export function updateProduct(product: Product): Product[] {
  const list = getProducts();
  const updated = list.map(p => (p.id === product.id ? product : p));
  saveProducts(updated);
  return updated;
}

export function deleteProduct(id: string): Product[] {
  const list = getProducts();
  const updated = list.filter(p => p.id !== id);
  saveProducts(updated);
  return updated;
}

// ===== MARKETER STORE =====

export function getMarketers(): Marketer[] {
  return load<Marketer[]>(KEYS.marketers, defaultMarketers);
}

export function saveMarketers(list: Marketer[]) {
  save(KEYS.marketers, list);
}

// Marketer aktif (muncul di dropdown order baru)
export function getActiveMarketers(): Marketer[] {
  return getMarketers().filter(m => m.status === "aktif");
}

// Tambah marketer baru. Jika saveToMaster=false, marketer hanya dipakai
// pada order ini dan TIDAK disimpan ke database master.
export function addMarketer(marketer: Marketer, saveToMaster: boolean): Marketer[] {
  if (saveToMaster) {
    const list = getMarketers();
    const updated = [...list, marketer];
    saveMarketers(updated);
    return updated;
  }
  // Tidak disimpan ke master; hanya dikembalikan untuk dipakai pada order ini
  return getMarketers();
}

// Perbarui data marketer (profil, status, fee, dll)
export function updateMarketer(marketer: Marketer): Marketer[] {
  const list = getMarketers();
  const updated = list.map(m => (m.id === marketer.id ? marketer : m));
  saveMarketers(updated);
  return updated;
}

// Hapus marketer dari master (hanya jika tidak ada order terkait)
export function deleteMarketer(id: string): Marketer[] {
  const list = getMarketers();
  const updated = list.filter(m => m.id !== id);
  saveMarketers(updated);
  return updated;
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

export function getMarketerStats(marketerId: string): MarketerStats | null {
  const marketer = getMarketers().find(m => m.id === marketerId);
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
// Alamat pengiriman disimpan permanen di localStorage.
// Alamat seed (dari customers.ts) digabung dengan alamat yang disimpan user.

export function getSavedAddresses(): CustomerAddress[] {
  return load<CustomerAddress[]>(KEYS.addresses, []);
}

// Semua alamat untuk satu customer (seed + tersimpan)
export function getCustomerAddresses(customerId: string): CustomerAddress[] {
  const seed = customersData.find(c => c.id === customerId)?.addresses || [];
  const saved = getSavedAddresses().filter(a => a.customerId === customerId);
  return [...seed, ...saved];
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

// Perbarui order yang sudah ada (misal saat edit order)
export function updateOrder(order: OrderRecord): OrderRecord[] {
  const list = getOrders();
  const updated = list.map(o => (o.id === order.id ? order : o));
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

export function getFees(): FeeRecord[] {
  return load<FeeRecord[]>(KEYS.fees, seedFees);
}


export function saveFee(fee: FeeRecord): FeeRecord[] {
  const list = getFees();
  const updated = [fee, ...list];
  save(KEYS.fees, updated);
  return updated;
}

export function updateFeeStatus(id: string, status: "belum-diambil" | "sudah-diambil", paidDate: string | null, note?: string): FeeRecord[] {
  const list = getFees();
  const updated = list.map(f => f.id === id ? { ...f, status, paidDate, note: note ?? f.note } : f);
  save(KEYS.fees, updated);
  return updated;
}

// ===== WAREHOUSE STORE =====

export function getWarehouses(): Warehouse[] {
  return load<Warehouse[]>(KEYS.warehouses, defaultWarehouses);
}

export function saveWarehouses(list: Warehouse[]) {
  save(KEYS.warehouses, list);
}

export function addWarehouse(warehouse: Warehouse): Warehouse[] {
  const list = getWarehouses();
  const updated = [...list, warehouse];
  saveWarehouses(updated);
  return updated;
}

export function updateWarehouse(warehouse: Warehouse): Warehouse[] {
  const list = getWarehouses();
  const updated = list.map(w => (w.id === warehouse.id ? warehouse : w));
  saveWarehouses(updated);
  return updated;
}

export function deleteWarehouse(id: string): Warehouse[] {
  const list = getWarehouses();
  const updated = list.filter(w => w.id !== id);
  saveWarehouses(updated);
  // Hapus juga inventory yang terkait gudang tersebut
  const inv = getInventory().filter(i => i.warehouseId !== id);
  save(KEYS.inventory, inv);
  return updated;
}

// ===== INVENTORY STORE =====

export function getInventory(): Inventory[] {
  return load<Inventory[]>(KEYS.inventory, []);
}

export function saveInventory(list: Inventory[]) {
  save(KEYS.inventory, list);
}

// Inventory untuk satu produk (di semua gudang)
export function getInventoryForProduct(productId: string): Inventory[] {
  return getInventory().filter(i => i.productId === productId);
}

// Inventory untuk satu gudang (semua produk)
export function getInventoryByWarehouse(warehouseId: string): Inventory[] {
  return getInventory().filter(i => i.warehouseId === warehouseId);
}

// Total stok (on hand) sebuah produk di semua gudang
export function getTotalStock(productId: string): number {
  return getInventoryForProduct(productId).reduce((sum, i) => sum + i.stockOnHand, 0);
}

// Total available sebuah produk di semua gudang
export function getTotalAvailable(productId: string): number {
  return getInventoryForProduct(productId).reduce((sum, i) => sum + inventoryAvailable(i), 0);
}

export function addInventory(inv: Inventory): Inventory[] {
  const list = getInventory();
  const updated = [...list, inv];
  saveInventory(updated);
  return updated;
}

export function updateInventory(inv: Inventory): Inventory[] {
  const list = getInventory();
  const updated = list.map(i => (i.id === inv.id ? inv : i));
  saveInventory(updated);
  return updated;
}

// Kurangi stok on hand dari gudang tertentu (saat order dibuat)
export function deductStock(productId: string, warehouseId: string, qty: number): Inventory[] {
  const list = getInventory();
  const updated = list.map(i => {
    if (i.productId === productId && i.warehouseId === warehouseId) {
      return { ...i, stockOnHand: Math.max(0, i.stockOnHand - qty) };
    }
    return i;
  });
  saveInventory(updated);
  return updated;
}

// Tambah reserved ke gudang tertentu (saat order di-reserve)
export function reserveStock(productId: string, warehouseId: string, qty: number): Inventory[] {
  const list = getInventory();
  const updated = list.map(i => {
    if (i.productId === productId && i.warehouseId === warehouseId) {
      return { ...i, reserved: i.reserved + qty };
    }
    return i;
  });
  saveInventory(updated);
  return updated;
}

// ===== INVOICE NUMBER =====


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
