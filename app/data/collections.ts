"use client";

import { getOrders, saveOrder, type OrderRecord } from "./store";
import { getCustomers } from "./central";


// ===== COLLECTION TYPES =====

export type CollectionType = "po-batch" | "produk" | "campaign" | "ready-stock" | "kelas" | "custom";

export type CollectionStatus = "aktif" | "selesai" | "draft" | "arsip";

export type Collection = {
  id: string;
  name: string;
  type: CollectionType;
  status: CollectionStatus;
  icon: string;
  color: string;
  description?: string;
  owner?: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null; // soft delete
};

export type CollectionOrder = {
  id: string;
  collectionId: string;
  orderId: string;
  addedAt: number;
};

// ===== COLLECTION TYPE METADATA =====

export const collectionTypeInfo: Record<CollectionType, { name: string; emoji: string; desc: string }> = {
  "po-batch": { name: "PO Batch", emoji: "📦", desc: "Pre-order per batch produksi" },
  "produk": { name: "Produk", emoji: "🛍️", desc: "Kumpulan order untuk produk tertentu" },
  "campaign": { name: "Campaign", emoji: "📣", desc: "Order dari kampanye promosi" },
  "ready-stock": { name: "Ready Stock", emoji: "✅", desc: "Order produk ready stock" },
  "kelas": { name: "Kelas", emoji: "🎓", desc: "Order dari kelas / pelatihan" },
  "custom": { name: "Custom", emoji: "✨", desc: "Collection khusus" },
};

export const collectionStatusInfo: Record<CollectionStatus, { name: string; emoji: string }> = {
  "aktif": { name: "Aktif", emoji: "🟢" },
  "selesai": { name: "Selesai", emoji: "✅" },
  "draft": { name: "Draft", emoji: "📝" },
  "arsip": { name: "Arsip", emoji: "📁" },
};

export const collectionColors = [
  "#745034", "#667248", "#9b6a3d", "#59703d", "#966339",
  "#7a6757", "#8a5a44", "#5d7a8a", "#6d5d8a", "#8a6d5d",
];

export const collectionIcons = ["📦", "🛍️", "📣", "✅", "🎓", "✨", "📚", "🧕", "🖤", "🧤", "🧦", "🌸", "🚚", "💰", "🎈", "📖", "🐝", "🕌", "🌍", "🔤"];

// ===== STORAGE KEYS =====

const KEYS = {
  collections: "umayasla_collections",
  collectionOrders: "umayasla_collection_orders",
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

// ===== SEED COLLECTIONS =====

export const seedCollections: Collection[] = [
  {
    id: "col-po-batch-8",
    name: "PO Batch 8",
    type: "po-batch",
    status: "aktif",
    icon: "📦",
    color: "#745034",
    description: "Pre-order Amna Jilbab Batch 8",
    owner: "Rizki Muhammad",
    tags: ["amna", "jilbab", "po"],
    createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now(),
    deletedAt: null,
  },
  {
    id: "col-po-batch-7",
    name: "PO Batch 7",
    type: "po-batch",
    status: "selesai",
    icon: "📦",
    color: "#667248",
    description: "Pre-order Amna Jilbab Batch 7",
    owner: "Rizki Muhammad",
    tags: ["amna", "jilbab", "po"],
    createdAt: Date.now() - 60 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
    deletedAt: null,
  },
  {
    id: "col-linen-spray",
    name: "Linen Spray",
    type: "produk",
    status: "aktif",
    icon: "🌸",
    color: "#9b6a3d",
    description: "Order Linen Spray",
    owner: "Rizki Muhammad",
    tags: ["aksesoris", "linen"],
    createdAt: Date.now() - 45 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now(),
    deletedAt: null,
  },
  {
    id: "col-manset",
    name: "Manset",
    type: "produk",
    status: "aktif",
    icon: "🧤",
    color: "#59703d",
    description: "Order Handsock / Manset",
    owner: "Rizki Muhammad",
    tags: ["aksesoris", "handsock"],
    createdAt: Date.now() - 40 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now(),
    deletedAt: null,
  },
  {
    id: "col-kaos-kaki",
    name: "Kaos Kaki",
    type: "produk",
    status: "aktif",
    icon: "🧦",
    color: "#966339",
    description: "Order Kaos Kaki",
    owner: "Rizki Muhammad",
    tags: ["aksesoris", "kaos-kaki"],
    createdAt: Date.now() - 35 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now(),
    deletedAt: null,
  },
  {
    id: "col-buku",
    name: "Buku",
    type: "produk",
    status: "aktif",
    icon: "📚",
    color: "#7a6757",
    description: "Order Buku Parenting & Boardbook",
    owner: "Rizki Muhammad",
    tags: ["buku", "parenting", "boardbook"],
    createdAt: Date.now() - 50 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now(),
    deletedAt: null,
  },
  {
    id: "col-ready-stock",
    name: "Ready Stock",
    type: "ready-stock",
    status: "aktif",
    icon: "✅",
    color: "#5d7a8a",
    description: "Order produk ready stock",
    owner: "Rizki Muhammad",
    tags: ["ready", "stock"],
    createdAt: Date.now() - 25 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now(),
    deletedAt: null,
  },
  {
    id: "col-rooted-play",
    name: "Rooted Play",
    type: "campaign",
    status: "draft",
    icon: "📣",
    color: "#6d5d8a",
    description: "Kampanye Rooted Play",
    owner: "Rizki Muhammad",
    tags: ["campaign", "rooted"],
    createdAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now(),
    deletedAt: null,
  },
];

// ===== COLLECTION STORE =====

export function getCollections(): Collection[] {
  const list = load<Collection[]>(KEYS.collections, seedCollections);
  return list.filter(c => c.deletedAt === null);
}

export function getAllCollections(): Collection[] {
  return load<Collection[]>(KEYS.collections, seedCollections);
}

export function saveCollections(list: Collection[]) {
  save(KEYS.collections, list);
}

export function getCollection(id: string): Collection | null {
  return getCollections().find(c => c.id === id) || null;
}

export function addCollection(collection: Collection): Collection[] {
  const list = getAllCollections();
  const updated = [...list, collection];
  saveCollections(updated);
  return updated;
}

export function updateCollection(collection: Collection): Collection[] {
  const list = getAllCollections();
  const updated = list.map(c => c.id === collection.id ? { ...collection, updatedAt: Date.now() } : c);
  saveCollections(updated);
  return updated;
}

// Soft delete: hanya menandai deletedAt, tidak menghapus data
export function softDeleteCollection(id: string): Collection[] {
  const list = getAllCollections();
  const updated = list.map(c => c.id === id ? { ...c, deletedAt: Date.now() } : c);
  saveCollections(updated);
  return updated;
}

// Hard delete: hanya untuk collection kosong (tanpa order)
export function hardDeleteCollection(id: string): Collection[] {
  const list = getAllCollections();
  const updated = list.filter(c => c.id !== id);
  saveCollections(updated);
  // Hapus juga relasi CollectionOrder
  const rels = getCollectionOrders().filter(r => r.collectionId !== id);
  save(KEYS.collectionOrders, rels);
  return updated;
}

// ===== COLLECTION ORDER STORE =====

export function getCollectionOrders(): CollectionOrder[] {
  return load<CollectionOrder[]>(KEYS.collectionOrders, []);
}

export function saveCollectionOrders(list: CollectionOrder[]) {
  save(KEYS.collectionOrders, list);
}

// Order yang terhubung ke sebuah collection
export function getOrdersForCollection(collectionId: string): OrderRecord[] {
  const rels = getCollectionOrders().filter(r => r.collectionId === collectionId);
  const orders = getOrders();
  return rels
    .map(r => orders.find(o => o.id === r.orderId))
    .filter((o): o is OrderRecord => Boolean(o));
}

// Tambah order ke collection (tanpa duplikasi)
export function addOrderToCollection(collectionId: string, orderId: string): CollectionOrder[] {
  const rels = getCollectionOrders();
  if (rels.some(r => r.collectionId === collectionId && r.orderId === orderId)) {
    return rels;
  }
  const updated = [...rels, { id: "colord-" + Date.now(), collectionId, orderId, addedAt: Date.now() }];
  saveCollectionOrders(updated);
  return updated;
}

// Hapus order dari collection
export function removeOrderFromCollection(collectionId: string, orderId: string): CollectionOrder[] {
  const rels = getCollectionOrders();
  const updated = rels.filter(r => !(r.collectionId === collectionId && r.orderId === orderId));
  saveCollectionOrders(updated);
  return updated;
}

// ===== COLLECTION STATS =====

export type CollectionStats = {
  totalOrders: number;
  totalCustomers: number;
  totalItems: number;
  totalOutstanding: number;
  totalPayment: number;
  totalShipment: number;
  draftOrders: number;
  unlinkedCustomers: number;
  shipmentProgress: number; // persen
};

export function getCollectionStats(collectionId: string): CollectionStats {
  const orders = getOrdersForCollection(collectionId);
  const totalOrders = orders.length;
  const totalItems = orders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.qty, 0), 0);
  const totalOutstanding = orders
    .filter(o => o.status !== "paid")
    .reduce((sum, o) => sum + (o.total - o.dp), 0);
  const totalPayment = orders.reduce((sum, o) => sum + o.dp, 0);
  const draftOrders = orders.filter(o => o.status === "draft").length;
  const unlinkedCustomers = orders.filter(o => !o.customerId).length;
  const totalCustomers = new Set(orders.map(o => o.customerId).filter(Boolean)).size;
  const shipped = orders.filter(o => o.status === "paid").length;
  const shipmentProgress = totalOrders > 0 ? Math.round((shipped / totalOrders) * 100) : 0;

  return {
    totalOrders,
    totalCustomers,
    totalItems,
    totalOutstanding,
    totalPayment,
    totalShipment: shipped,
    draftOrders,
    unlinkedCustomers,
    shipmentProgress,
  };
}

// ===== CUSTOMER MATCHING =====
// Saat order dibuat dari Collection, sistem mencoba mencocokkan customer
// berdasarkan: Customer ID → WhatsApp → Email → Nama (fuzzy)

export function matchCustomerId(name: string, phone: string): string | null {
  const customers = getCustomers();
  if (customers.length === 0) return null;


  // 1. Match by phone (normalized)
  if (phone) {
    const normalizedPhone = phone.replace(/[^0-9]/g, "");
    const byPhone = customers.find(c => {
      const cPhone = (c.phone || "").replace(/[^0-9]/g, "");
      return cPhone && normalizedPhone && cPhone === normalizedPhone;
    });
    if (byPhone) return byPhone.id;
  }

  // 2. Match by name (exact or fuzzy)
  if (name) {
    const normalizedName = name.toLowerCase().trim();
    const byName = customers.find(c => {
      const cName = c.name.toLowerCase().trim();
      const cWaName = c.waName.toLowerCase().trim();
      return cName === normalizedName || cWaName === normalizedName;
    });
    if (byName) return byName.id;

    // Fuzzy: partial match
    const fuzzy = customers.find(c => {
      const cName = c.name.toLowerCase().trim();
      const cWaName = c.waName.toLowerCase().trim();
      return cName.includes(normalizedName) || normalizedName.includes(cName) ||
             cWaName.includes(normalizedName) || normalizedName.includes(cWaName);
    });
    if (fuzzy) return fuzzy.id;
  }

  return null;
}

// ===== CREATE ORDER FROM COLLECTION =====
// Membuat order baru dan langsung menghubungkannya ke collection.
// Customer boleh belum ada (customerId = null, customer_name = input manual).

export function createOrderInCollection(
  collectionId: string,
  data: {
    customerName: string;
    phone?: string;
    productName: string;
    productEmoji?: string;
    qty: number;
    price: number;
    note?: string;
  }
): OrderRecord | null {
  const now = new Date();
  const orderId = "ORD-" + Date.now();
  const orderNumber = "ORD/" + now.getFullYear() + "/" + String(now.getMonth() + 1).padStart(2, "0") + "/" + String(now.getDate()).padStart(2, "0") + "-" + String(Math.floor(1000 + Math.random() * 9000));

  // Coba cocokkan customer
  const customerId = matchCustomerId(data.customerName, data.phone || "");

  const order: OrderRecord = {
    id: orderId,
    number: orderNumber,
    date: now.toISOString(),
    customer: data.customerName,
    customerId: customerId || null,
    phone: data.phone || "",
    address: "",
    items: [{
      id: "item-" + Date.now(),
      productId: "",
      name: data.productName,
      emoji: data.productEmoji || "📦",
      qty: data.qty,
      price: data.price,
      hpp: 0,
      feeMarketer: 0,
      discount: 0,
    }],
    discountType: "nominal",
    discountValue: 0,
    discountAmount: 0,
    ongkir: 0,
    ongkirLabel: "",
    dp: 0,
    note: data.note || "",
    marketerId: null,
    marketerName: null,
    totalFee: 0,
    subtotal: data.price * data.qty,
    total: data.price * data.qty,
    status: "draft",
    createdAt: Date.now(),
  };

  saveOrder(order);
  addOrderToCollection(collectionId, orderId);
  return order;
}
