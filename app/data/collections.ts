"use client";

import { supabase } from "./supabaseClient";
import { getOrders, saveOrder, type OrderRecord, type OrderItemSnapshot } from "./store";
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

// Tautan per-ITEM (bukan per-order) — satu invoice bisa berisi item dari
// beberapa kategori sekaligus (mis. Amna Jilbab + Kaos Kaki + Boardbook dalam
// SATU order), jadi tiap item ditandai Collection-nya sendiri-sendiri supaya
// "closing per kategori" di Collection Workspace gak ikut menghitung seluruh
// nilai invoice, cuma porsi item yang relevan. Ini TERPISAH dari CollectionOrder
// (order-level) yang masih dipakai apa adanya oleh jembatan Batch Produksi Amna
// (getOrCreateBatchCollection/syncOrderBatchCollection) dan alur "Tambah Order"
// manual di dalam Collection Workspace — keduanya tidak diubah.
export type CollectionOrderItem = {
  id: string;
  collectionId: string;
  orderId: string;
  itemId: string;
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

// ===== KATEGORI MASTER DATA (Afeena & Etalase YasLa) =====
// Daftar Collection resmi sesuai kategori yang diberikan user (urut abjad per
// brand) — dipakai oleh tombol "Muat Kategori Master Data" di /collections.
// BUKAN data demo (id sengaja pakai prefix "col-master-" supaya TIDAK PERNAH
// tumpang tindih dengan id di seedCollections di atas — kalau id-nya sampai
// sama, "Hapus Semua Data Demo" bisa ikut menghapus Collection asli ini,
// sama seperti bug id-collision yang pernah kejadian di katalog produk).
// SENGAJA TIDAK dimuat otomatis — harus diklik manual, sama seperti "Muat
// Katalog Master Data (Non-Buku)" di halaman Katalog.
export const afeenaYaslaMasterCollections: Collection[] = [
  // ===== BRAND AFEENA (urut abjad) =====
  { id: "col-master-amna-batch-8", name: "Amna Batch 8", type: "po-batch", status: "aktif", icon: "🧕", color: collectionColors[0], description: "Kategori produk brand Afeena.", tags: ["afeena", "amna-jilbab"], createdAt: Date.now(), updatedAt: Date.now(), deletedAt: null },
  { id: "col-master-amna-batch-9", name: "Amna Batch 9", type: "po-batch", status: "aktif", icon: "🧕", color: collectionColors[1], description: "Kategori produk brand Afeena.", tags: ["afeena", "amna-jilbab"], createdAt: Date.now(), updatedAt: Date.now(), deletedAt: null },
  { id: "col-master-amna-batch-10", name: "Amna Batch 10", type: "po-batch", status: "aktif", icon: "🧕", color: collectionColors[2], description: "Kategori produk brand Afeena.", tags: ["afeena", "amna-jilbab"], createdAt: Date.now(), updatedAt: Date.now(), deletedAt: null },
  { id: "col-master-kaos-kaki", name: "Kaos Kaki", type: "produk", status: "aktif", icon: "🧦", color: collectionColors[3], description: "Kategori produk brand Afeena.", tags: ["afeena", "aksesoris"], createdAt: Date.now(), updatedAt: Date.now(), deletedAt: null },
  { id: "col-master-linen-spray", name: "Linen Spray", type: "produk", status: "aktif", icon: "🌸", color: collectionColors[4], description: "Kategori produk brand Afeena.", tags: ["afeena", "aksesoris"], createdAt: Date.now(), updatedAt: Date.now(), deletedAt: null },
  { id: "col-master-manset", name: "Manset", type: "produk", status: "aktif", icon: "🧤", color: collectionColors[5], description: "Kategori produk brand Afeena.", tags: ["afeena", "aksesoris"], createdAt: Date.now(), updatedAt: Date.now(), deletedAt: null },
  { id: "col-master-niqab", name: "Niqab", type: "produk", status: "aktif", icon: "🖤", color: collectionColors[6], description: "Kategori produk brand Afeena.", tags: ["afeena", "aksesoris"], createdAt: Date.now(), updatedAt: Date.now(), deletedAt: null },
  // ===== ETALASE YASLA (urut abjad) =====
  { id: "col-master-boardbook-123", name: "Boardbook 123", type: "produk", status: "aktif", icon: "📖", color: collectionColors[7], description: "Kategori produk brand Etalase YasLa.", tags: ["etalase-yasla", "boardbook"], createdAt: Date.now(), updatedAt: Date.now(), deletedAt: null },
  { id: "col-master-boardbook-abc", name: "Boardbook ABC", type: "produk", status: "aktif", icon: "📖", color: collectionColors[8], description: "Kategori produk brand Etalase YasLa.", tags: ["etalase-yasla", "boardbook"], createdAt: Date.now(), updatedAt: Date.now(), deletedAt: null },
  { id: "col-master-boardbook-asaqu-bundling", name: "Boardbook Asaqu Bundling", type: "produk", status: "aktif", icon: "📖", color: collectionColors[9], description: "Kategori produk brand Etalase YasLa.", tags: ["etalase-yasla", "boardbook"], createdAt: Date.now(), updatedAt: Date.now(), deletedAt: null },
  { id: "col-master-boardbook-asmaul-husna-alam-semesta", name: "Boardbook Asmaul Husna seri Alam Semesta", type: "produk", status: "aktif", icon: "📖", color: collectionColors[0], description: "Kategori produk brand Etalase YasLa.", tags: ["etalase-yasla", "boardbook"], createdAt: Date.now(), updatedAt: Date.now(), deletedAt: null },
  { id: "col-master-boardbook-gajah-kecil-malang", name: "Boardbook Gajah Kecil yang Malang", type: "produk", status: "aktif", icon: "📖", color: collectionColors[1], description: "Kategori produk brand Etalase YasLa.", tags: ["etalase-yasla", "boardbook"], createdAt: Date.now(), updatedAt: Date.now(), deletedAt: null },
  { id: "col-master-boardbook-persis-sepertimu", name: "Boardbook Persis Sepertimu", type: "produk", status: "aktif", icon: "📖", color: collectionColors[2], description: "Kategori produk brand Etalase YasLa.", tags: ["etalase-yasla", "boardbook"], createdAt: Date.now(), updatedAt: Date.now(), deletedAt: null },
  { id: "col-master-boardbook-si-pensil-kecil", name: "Boardbook Si Pensil Kecil", type: "produk", status: "aktif", icon: "📖", color: collectionColors[3], description: "Kategori produk brand Etalase YasLa.", tags: ["etalase-yasla", "boardbook"], createdAt: Date.now(), updatedAt: Date.now(), deletedAt: null },
  { id: "col-master-boardbook-who-made-my-day", name: "Boardbook Who Made My Day", type: "produk", status: "aktif", icon: "📖", color: collectionColors[4], description: "Kategori produk brand Etalase YasLa.", tags: ["etalase-yasla", "boardbook"], createdAt: Date.now(), updatedAt: Date.now(), deletedAt: null },
  { id: "col-master-hardbook-marifatullah", name: "HardBook Seri Ma'rifatullah", type: "produk", status: "aktif", icon: "📕", color: collectionColors[5], description: "Kategori produk brand Etalase YasLa.", tags: ["etalase-yasla", "hardbook"], createdAt: Date.now(), updatedAt: Date.now(), deletedAt: null },
  { id: "col-master-seri-sabata", name: "Seri SABATA", type: "produk", status: "aktif", icon: "📚", color: collectionColors[6], description: "Kategori produk brand Etalase YasLa.", tags: ["etalase-yasla"], createdAt: Date.now(), updatedAt: Date.now(), deletedAt: null },
  { id: "col-master-workbook-juz-amma", name: "WorkBook Juz Amma", type: "produk", status: "aktif", icon: "📓", color: collectionColors[7], description: "Kategori produk brand Etalase YasLa.", tags: ["etalase-yasla", "workbook"], createdAt: Date.now(), updatedAt: Date.now(), deletedAt: null },
];

// ===== COLLECTION STORE (Tahap 4 migrasi backend — Supabase) =====
// collections/collection_orders/collection_order_items BUKAN data cost-
// sensitive (gak ada modal/HPP di sini) — RLS-nya "all_authenticated" biasa
// (supabase/schema.sql), jadi query tabel langsung, gak perlu RPC seperti
// Product. Data collection kamu SUDAH ada di Supabase sejak migrasi awal
// (Tahap 3) — ini cuma nyambungin app baca/tulis ke situ, bukan migrasi baru.

function mapCollectionRow(c: Record<string, unknown>): Collection {
  return {
    id: c.id as string,
    name: c.name as string,
    type: c.type as CollectionType,
    status: c.status as CollectionStatus,
    icon: c.icon as string,
    color: c.color as string,
    description: (c.description as string) ?? undefined,
    owner: (c.owner as string) ?? undefined,
    tags: (c.tags as string[]) ?? [],
    createdAt: Number(c.created_at),
    updatedAt: Number(c.updated_at),
    deletedAt: c.deleted_at == null ? null : Number(c.deleted_at),
  };
}

function collectionToRow(collection: Collection) {
  return {
    id: collection.id, name: collection.name, type: collection.type, status: collection.status,
    icon: collection.icon, color: collection.color, description: collection.description ?? null,
    owner: collection.owner ?? null, tags: collection.tags || [],
    created_at: collection.createdAt, updated_at: collection.updatedAt, deleted_at: collection.deletedAt,
  };
}

export async function getAllCollections(): Promise<Collection[]> {
  const { data, error } = await supabase.from("collections").select("*").order("created_at", { ascending: false });
  if (error) { console.error("[getAllCollections]", error.message); return []; }
  return ((data || []) as Record<string, unknown>[]).map(mapCollectionRow);
}

// seedCollections (mis. "PO Batch 7", "Linen Spray") TIDAK dipakai sebagai
// default lagi — itu contoh, bukan Collection asli.
export async function getCollections(): Promise<Collection[]> {
  return (await getAllCollections()).filter(c => c.deletedAt === null);
}

export async function getCollection(id: string): Promise<Collection | null> {
  const { data, error } = await supabase.from("collections").select("*").eq("id", id).maybeSingle();
  if (error) { console.error("[getCollection]", error.message); return null; }
  return data ? mapCollectionRow(data as Record<string, unknown>) : null;
}

export async function addCollection(collection: Collection): Promise<Collection[]> {
  const { error } = await supabase.from("collections").upsert(collectionToRow(collection));
  if (error) { console.error("[addCollection]", error.message); throw new Error(error.message); }
  return getAllCollections();
}

export async function updateCollection(collection: Collection): Promise<Collection[]> {
  const updated = { ...collection, updatedAt: Date.now() };
  const { error } = await supabase.from("collections").update(collectionToRow(updated)).eq("id", collection.id);
  if (error) { console.error("[updateCollection]", error.message); throw new Error(error.message); }
  return getAllCollections();
}

// Soft delete: hanya menandai deletedAt, tidak menghapus data
export async function softDeleteCollection(id: string): Promise<Collection[]> {
  const { error } = await supabase.from("collections").update({ deleted_at: Date.now() }).eq("id", id);
  if (error) console.error("[softDeleteCollection]", error.message);
  return getAllCollections();
}

// Hard delete: hanya untuk collection kosong (tanpa order). Relasi
// CollectionOrder/CollectionOrderItem ikut kehapus otomatis lewat FK
// "on delete cascade" (supabase/schema.sql) — gak perlu bersihkan manual.
export async function hardDeleteCollection(id: string): Promise<Collection[]> {
  const { error } = await supabase.from("collections").delete().eq("id", id);
  if (error) console.error("[hardDeleteCollection]", error.message);
  return getAllCollections();
}

// ===== JEMBATAN BATCH PRODUKSI → COLLECTION "PO BATCH" =====
// Nama batch di halaman Order (mis. "Batch 7", store.ts) dan Collection tipe
// "po-batch" di sini dulu dua sistem terpisah yang tidak saling kenal —
// halaman Order cuma nyimpen batch sebagai label teks bebas, sementara
// Collection Workspace tidak pernah tahu batch itu ada. Fungsi di bawah ini
// menjembatani keduanya: satu Collection "PO Batch" otomatis dibuat/dipakai
// ulang untuk tiap nama batch, dan order yang memakai batch itu otomatis
// tertaut ke situ — supaya Collection Workspace jadi tampilan manajemen
// produksi lintas-customer, tanpa perlu tab/sistem baru yang terpisah lagi.

function slugifyBatchName(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// ID deterministik dari nama batch (mis. "Batch 7" -> "col-po-batch-7") supaya
// selalu cocok dengan Collection "PO Batch 7"/"PO Batch 8" yang sudah ada di
// seed data, bukan bikin duplikat.
export async function getOrCreateBatchCollection(batchName: string): Promise<Collection> {
  const id = "col-po-" + slugifyBatchName(batchName);
  const existing = await getCollection(id);
  if (existing) {
    if (existing.deletedAt !== null) {
      const revived: Collection = { ...existing, deletedAt: null, updatedAt: Date.now() };
      await updateCollection(revived);
      return revived;
    }
    return existing;
  }
  const now = Date.now();
  const collection: Collection = {
    id,
    name: "PO " + batchName,
    type: "po-batch",
    status: "aktif",
    icon: "📦",
    color: collectionColors[0],
    description: `Pre-order produksi ${batchName} (dibuat otomatis dari halaman Order).`,
    tags: ["po", "batch"],
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  await addCollection(collection);
  return collection;
}

// Pastikan order tertaut ke Collection batch yang benar — dipanggil tiap
// order disimpan/diedit dari halaman Order. Kalau batch berubah (atau item
// Amna Jilbab dihapus saat edit, batchName jadi undefined), order dilepas
// dulu dari Collection batch lama sebelum ditautkan ke yang baru.
export async function syncOrderBatchCollection(orderId: string, batchName: string | undefined, previousBatchName?: string): Promise<void> {
  if (previousBatchName && previousBatchName !== batchName) {
    await removeOrderFromCollection("col-po-" + slugifyBatchName(previousBatchName), orderId);
  }
  if (!batchName) return;
  const collection = await getOrCreateBatchCollection(batchName);
  await addOrderToCollection(collection.id, orderId);
}

// ===== COLLECTION ORDER STORE =====

function mapCollectionOrderRow(r: Record<string, unknown>): CollectionOrder {
  return { id: r.id as string, collectionId: r.collection_id as string, orderId: r.order_id as string, addedAt: Number(r.added_at) };
}

export async function getCollectionOrders(): Promise<CollectionOrder[]> {
  const { data, error } = await supabase.from("collection_orders").select("*");
  if (error) { console.error("[getCollectionOrders]", error.message); return []; }
  return ((data || []) as Record<string, unknown>[]).map(mapCollectionOrderRow);
}

// Order yang terhubung ke sebuah collection
export async function getOrdersForCollection(collectionId: string): Promise<OrderRecord[]> {
  const { data, error } = await supabase.from("collection_orders").select("order_id").eq("collection_id", collectionId);
  if (error) { console.error("[getOrdersForCollection]", error.message); return []; }
  const orderIds = new Set((data || []).map(r => r.order_id as string));
  return (await getOrders()).filter(o => orderIds.has(o.id));
}

// Tambah order ke collection (tanpa duplikasi)
export async function addOrderToCollection(collectionId: string, orderId: string): Promise<CollectionOrder[]> {
  const { data: existing } = await supabase.from("collection_orders").select("id").eq("collection_id", collectionId).eq("order_id", orderId).maybeSingle();
  if (!existing) {
    const { error } = await supabase.from("collection_orders").insert({ id: "colord-" + Date.now(), collection_id: collectionId, order_id: orderId, added_at: Date.now() });
    if (error) console.error("[addOrderToCollection]", error.message);
  }
  return getCollectionOrders();
}

// Hapus order dari collection
export async function removeOrderFromCollection(collectionId: string, orderId: string): Promise<CollectionOrder[]> {
  const { error } = await supabase.from("collection_orders").delete().eq("collection_id", collectionId).eq("order_id", orderId);
  if (error) console.error("[removeOrderFromCollection]", error.message);
  return getCollectionOrders();
}

// Lepaskan SEMUA tautan per-item order ini dari SATU collection tertentu
// (beda dari removeItemLinksForOrder di bawah yang melepas dari SEMUA
// collection) — dipakai bareng removeOrderFromCollection saat admin klik
// "Hapus dari collection" di tab Order, supaya order yang cuma tertaut lewat
// Kategori Produk (per-item, bukan lewat "Tambah Order" manual) juga beneran
// lepas, bukan cuma order-level yang gak pernah ada tautannya sejak awal.
export async function removeOrderItemLinksFromCollection(collectionId: string, orderId: string): Promise<CollectionOrderItem[]> {
  const { error } = await supabase.from("collection_order_items").delete().eq("collection_id", collectionId).eq("order_id", orderId);
  if (error) console.error("[removeOrderItemLinksFromCollection]", error.message);
  return getCollectionOrderItems();
}

// Lepaskan order dari SEMUA Collection sekaligus — dipakai saat order itu
// sendiri dihapus permanen, supaya tidak ada Collection yang masih menghitung
// order yang sudah tidak ada.
export async function removeOrderFromAllCollections(orderId: string): Promise<CollectionOrder[]> {
  const { error } = await supabase.from("collection_orders").delete().eq("order_id", orderId);
  if (error) console.error("[removeOrderFromAllCollections]", error.message);
  return getCollectionOrders();
}

// ===== COLLECTION ORDER ITEM STORE (tautan per-item, "Kategori Produk") =====

function mapCollectionOrderItemRow(r: Record<string, unknown>): CollectionOrderItem {
  return { id: r.id as string, collectionId: r.collection_id as string, orderId: r.order_id as string, itemId: r.item_id as string, addedAt: Number(r.added_at) };
}

export async function getCollectionOrderItems(): Promise<CollectionOrderItem[]> {
  const { data, error } = await supabase.from("collection_order_items").select("*");
  if (error) { console.error("[getCollectionOrderItems]", error.message); return []; }
  return ((data || []) as Record<string, unknown>[]).map(mapCollectionOrderItemRow);
}

// Collection mana saja yang sudah ditandai untuk satu item tertentu — dipakai
// buat prefill checkbox saat order dibuka lagi utk diedit.
export async function getCollectionIdsForItem(orderId: string, itemId: string): Promise<string[]> {
  const { data, error } = await supabase.from("collection_order_items").select("collection_id").eq("order_id", orderId).eq("item_id", itemId);
  if (error) { console.error("[getCollectionIdsForItem]", error.message); return []; }
  return (data || []).map(r => r.collection_id as string);
}

// Ganti SELURUH tautan kategori satu item sekaligus (idempotent) — dipanggil
// tiap order disimpan, supaya centang/uncek admin langsung sinkron tanpa perlu
// tambah/hapus manual satu-satu.
export async function setCategoriesForItem(orderId: string, itemId: string, collectionIds: string[]): Promise<void> {
  const { error: delError } = await supabase.from("collection_order_items").delete().eq("order_id", orderId).eq("item_id", itemId);
  if (delError) console.error("[setCategoriesForItem:delete]", delError.message);
  if (collectionIds.length === 0) return;
  const now = Date.now();
  const rows = collectionIds.map(collectionId => ({
    id: "colordit-" + orderId + "-" + itemId + "-" + collectionId,
    collection_id: collectionId,
    order_id: orderId,
    item_id: itemId,
    added_at: now,
  }));
  const { error } = await supabase.from("collection_order_items").insert(rows);
  if (error) console.error("[setCategoriesForItem:insert]", error.message);
}

// Semua item (dari order manapun) yang tertaut ke satu Collection — dipakai
// utk breakdown detail ("kaos kaki closing berapa, siapa saja yang pesan").
export async function getItemLinksForCollection(collectionId: string): Promise<{ order: OrderRecord; item: OrderItemSnapshot }[]> {
  const { data, error } = await supabase.from("collection_order_items").select("order_id, item_id").eq("collection_id", collectionId);
  if (error) { console.error("[getItemLinksForCollection]", error.message); return []; }
  const orders = await getOrders();
  const result: { order: OrderRecord; item: OrderItemSnapshot }[] = [];
  for (const link of (data || [])) {
    const order = orders.find(o => o.id === link.order_id);
    const item = order?.items.find(i => i.id === link.item_id);
    if (order && item) result.push({ order, item });
  }
  return result;
}

// Dipanggil saat order dihapus permanen — sama seperti removeOrderFromAllCollections
// tapi utk tautan per-item.
export async function removeItemLinksForOrder(orderId: string): Promise<CollectionOrderItem[]> {
  const { error } = await supabase.from("collection_order_items").delete().eq("order_id", orderId);
  if (error) console.error("[removeItemLinksForOrder]", error.message);
  return getCollectionOrderItems();
}

function itemSubtotal(item: OrderItemSnapshot): number {
  return (item.finalPrice ?? item.price) * item.qty;
}

// Porsi nilai satu item dari total invoice-nya (dipakai membagi payment/
// outstanding proporsional, karena DP dicatat per-invoice, bukan per-item).
function itemShareOfOrder(order: OrderRecord, item: OrderItemSnapshot): number {
  if (order.subtotal <= 0) return 0;
  return itemSubtotal(item) / order.subtotal;
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

export async function getCollectionStats(collectionId: string): Promise<CollectionStats> {
  const orders = await getOrdersForCollection(collectionId); // legacy: whole-order (batch bridge, tambah order manual)
  const legacyOrderIds = new Set(orders.map(o => o.id));
  // Item-level ("Kategori Produk") — kalau order yang sama KEBETULAN juga
  // sudah tertaut order-level ke Collection ini, item-nya gak ikut dihitung
  // lagi di sini supaya gak dobel.
  const itemLinks = (await getItemLinksForCollection(collectionId)).filter(l => !legacyOrderIds.has(l.order.id));

  const totalOrders = legacyOrderIds.size + new Set(itemLinks.map(l => l.order.id)).size;
  const totalItems = orders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.qty, 0), 0)
    + itemLinks.reduce((sum, l) => sum + l.item.qty, 0);
  const legacyOutstanding = orders.filter(o => o.status !== "paid").reduce((sum, o) => sum + (o.total - o.dp), 0);
  const legacyPayment = orders.reduce((sum, o) => sum + o.dp, 0);
  const itemOutstanding = itemLinks.reduce((sum, l) => {
    if (l.order.status === "paid") return sum;
    return sum + (l.order.total - l.order.dp) * itemShareOfOrder(l.order, l.item);
  }, 0);
  const itemPayment = itemLinks.reduce((sum, l) => sum + l.order.dp * itemShareOfOrder(l.order, l.item), 0);
  // Pembagian proporsional (itemShareOfOrder) menghasilkan pecahan rupiah —
  // dibulatkan supaya gak tampil "Rp 25.789,474" di layar.
  const totalOutstanding = Math.round(legacyOutstanding + itemOutstanding);
  const totalPayment = Math.round(legacyPayment + itemPayment);
  const draftOrders = orders.filter(o => o.status === "draft").length
    + new Set(itemLinks.filter(l => l.order.status === "draft").map(l => l.order.id)).size;
  const unlinkedCustomers = orders.filter(o => !o.customerId).length
    + new Set(itemLinks.filter(l => !l.order.customerId).map(l => l.order.id)).size;
  const totalCustomers = new Set([
    ...orders.map(o => o.customerId).filter(Boolean),
    ...itemLinks.map(l => l.order.customerId).filter(Boolean),
  ]).size;
  const shipped = orders.filter(o => o.status === "paid").length
    + new Set(itemLinks.filter(l => l.order.status === "paid").map(l => l.order.id)).size;
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

export async function matchCustomerId(name: string, phone: string): Promise<string | null> {
  const customers = await getCustomers();
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

export async function createOrderInCollection(
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
): Promise<OrderRecord | null> {
  const now = new Date();
  const orderId = "ORD-" + Date.now();
  const orderNumber = "ORD/" + now.getFullYear() + "/" + String(now.getMonth() + 1).padStart(2, "0") + "/" + String(now.getDate()).padStart(2, "0") + "-" + String(Math.floor(1000 + Math.random() * 9000));

  // Coba cocokkan customer
  const customerId = await matchCustomerId(data.customerName, data.phone || "");

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
  await addOrderToCollection(collectionId, orderId);
  return order;
}
