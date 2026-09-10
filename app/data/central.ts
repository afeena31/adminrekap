"use client";

import { supabase } from "./supabaseClient";
// Dipakai HANYA oleh hardDeleteCustomer() di bawah, buat cek transaksi asli.
import { getOrders as getStoreOrders, getPayments as getStorePayments } from "./store";

// =====================================================================
// CENTRAL DATA LAYER — UmayasLa
// =====================================================================
// Riwayat: file ini dulu (s/d 2026-09-11) adalah "Operational State Engine"
// besar (~6600 baris) — Order/OrderItem/Payment/Shipment shadow + mesin
// kondisi 10-state (getPrimaryCondition dkk) + puluhan aksi operasional
// (startProduction, createShipment, dst). Riset sebelum Tahap 6 migrasi
// backend (Supabase) menemukan SELURUH sistem itu 0% dipakai UI manapun
// (grep app/*.tsx, nol hasil) dan bagian yang "kelihatan" jalan (Dashboard
// Work Queue) ternyata jalan di atas data default/kosong (production status
// hardcode, Payment gak pernah diisi) — bukan cuma "belum tersambung", tapi
// emang gak akurat. Dashboard Work Queue dibangun ulang dari order ASLI
// (app/page.tsx), dan seluruh Operational State Engine (beserta jembatan
// sync-nya ke store.ts) dihapus total di Tahap 8 (2026-09-11) — riwayat
// lengkapnya ada di git log kalau suatu saat perlu dirujuk ulang.
//
// Sisa file ini SEKARANG cuma 1 modul: Customer & Address (Tahap 5 migrasi
// backend, Supabase) + Cadangan Data (backup/restore). Ini SATU-SATUNYA
// bagian yang masih dipakai app manapun — data BERSAMA Owner+Admin.
// =====================================================================

export type Customer = {
  id: string;
  name: string;
  waName: string;
  phone: string;
  receiver: string;
  receiverPhone: string;
  city: string;
  since: string;
  notes: string[];
  createdAt: number;
  deletedAt: number | null; // soft delete
  initials?: string;
  defaultAddressId?: string | null;
};

export type Address = {
  id: string;
  customerId: string;
  label: string;
  recipientName: string;
  phone: string;
  address: string;
  landmark?: string;
  courier?: string;
  note?: string;
  isDefault: boolean;
};

const KEYS = {
  customers: "umayasla_customers",
  addresses: "umayasla_addresses",
  backupPrefix: "umayasla_backup_",
};

// =====================================================================
// BACKUP — aman, non-destruktif
// =====================================================================
// Sebelum migrasi apa pun, seluruh localStorage disalin ke key backup.
// Tidak menghapus / meng-overwrite key lama.

// Customer & Alamat sudah pindah ke Supabase (Tahap 5 migrasi backend) —
// data BERSAMA, dipakai Owner+Admin dari device masing-masing. Supaya
// "Cadangan Data" tetap jadi jaring pengaman yang bisa dipercaya (sesuai
// keputusan eksplisit user, 2026-09-11: backup HARUS tetap mencakup
// Customer/Alamat walau sekarang lintas-device), snapshot-nya disatukan
// dengan localStorage lokal di bawah KEYS.customers/KEYS.addresses yang
// SAMA — jadi listBackups()/restoreBackup() di bawah gak perlu tau bedanya.
// PENTING: karena datanya bersama, "Pulihkan Cadangan" dari device MANAPUN
// akan menimpa data Customer/Alamat utk SEMUA orang (Owner & Admin), bukan
// cuma device yang mengklik — beda dari sebelumnya yang cuma lokal.
export async function backupLocalStorage(): Promise<string> {
  if (typeof window === "undefined") return "";
  const timestamp = Date.now();
  const backupKey = KEYS.backupPrefix + timestamp;
  const snapshot: Record<string, unknown> = {};
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key) {
      try {
        snapshot[key] = JSON.parse(window.localStorage.getItem(key) || "null");
      } catch {
        snapshot[key] = window.localStorage.getItem(key);
      }
    }
  }
  const [customers, addresses] = await Promise.all([getAllCustomers(), getAddresses()]);
  snapshot[KEYS.customers] = customers;
  snapshot[KEYS.addresses] = addresses;
  window.localStorage.setItem(backupKey, JSON.stringify(snapshot));
  return backupKey;
}

export type BackupInfo = { key: string; timestamp: number; customerCount: number };

// Daftar semua cadangan yang pernah dibuat backupLocalStorage(), terbaru dulu.
// customerCount dihitung dari isi cadangan itu sendiri (bukan data sekarang),
// supaya kelihatan cadangan mana yang paling relevan buat dipulihkan.
export function listBackups(): BackupInfo[] {
  if (typeof window === "undefined") return [];
  const backups: BackupInfo[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key || !key.startsWith(KEYS.backupPrefix)) continue;
    const timestamp = Number(key.slice(KEYS.backupPrefix.length));
    if (!Number.isFinite(timestamp)) continue;
    let customerCount = 0;
    try {
      const raw = window.localStorage.getItem(key);
      const snapshot = raw ? JSON.parse(raw) : null;
      const customers = snapshot?.[KEYS.customers];
      if (Array.isArray(customers)) customerCount = customers.filter((c: { deletedAt?: unknown }) => !c?.deletedAt).length;
    } catch {
      // Cadangan gak kebaca — tetap ditampilkan, cuma jumlah customernya "?".
      customerCount = -1;
    }
    backups.push({ key, timestamp, customerCount });
  }
  return backups.sort((a, b) => b.timestamp - a.timestamp);
}

// Samakan Customer/Alamat di Supabase persis dengan isi snapshot (dipanggil
// dari restoreBackup) — hapus yang gak ada di snapshot, upsert semua yang
// ada di snapshot. Urutan PENTING karena FK addresses.customer_id ->
// customers.id: hapus address dulu (anak) baru customer (induk) saat
// menghapus; upsert customer dulu baru address saat menulis balik.
async function restoreCustomersAndAddresses(snapshot: Record<string, unknown>) {
  const snapshotCustomers = (Array.isArray(snapshot[KEYS.customers]) ? snapshot[KEYS.customers] : []) as Customer[];
  const snapshotAddresses = (Array.isArray(snapshot[KEYS.addresses]) ? snapshot[KEYS.addresses] : []) as Address[];
  const snapshotCustomerIds = new Set(snapshotCustomers.map(c => c.id));
  const snapshotAddressIds = new Set(snapshotAddresses.map(a => a.id));

  const [currentCustomers, currentAddresses] = await Promise.all([getAllCustomers(), getAddresses()]);

  const addressIdsToDelete = currentAddresses.filter(a => !snapshotAddressIds.has(a.id)).map(a => a.id);
  const customerIdsToDelete = currentCustomers.filter(c => !snapshotCustomerIds.has(c.id)).map(c => c.id);

  if (addressIdsToDelete.length > 0) {
    await supabase.from("addresses").delete().in("id", addressIdsToDelete);
  }
  if (customerIdsToDelete.length > 0) {
    // "on delete cascade" (schema.sql) otomatis ikut bersihin address milik
    // customer ini kalau ada yang kelewat dari penghapusan address di atas.
    await supabase.from("customers").delete().in("id", customerIdsToDelete);
  }
  if (snapshotCustomers.length > 0) {
    await supabase.from("customers").upsert(snapshotCustomers.map(customerToRow));
  }
  if (snapshotAddresses.length > 0) {
    await supabase.from("addresses").upsert(snapshotAddresses.map(addressToRow));
  }
}

// Pulihkan SATU cadangan — timpa localStorage & Customer/Alamat Supabase
// sekarang dengan isi cadangan itu. Kondisi SEBELUM restore ikut dicadangkan
// dulu secara otomatis, jadi restore juga tidak menghilangkan apa pun secara
// permanen. PERINGATAN: Customer/Alamat data BERSAMA (Supabase) — restore
// dari device manapun menimpa data itu utk SEMUA orang.
export async function restoreBackup(backupKey: string): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const raw = window.localStorage.getItem(backupKey);
  if (!raw) return false;
  let snapshot: Record<string, unknown>;
  try {
    snapshot = JSON.parse(raw);
  } catch {
    return false;
  }
  await backupLocalStorage();
  // Hapus dulu key yang ADA SEKARANG tapi TIDAK ADA di snapshot lama (mis.
  // data yang baru dibuat setelah cadangan itu diambil) — sebelumnya restore
  // cuma menimpa key yang KEBETULAN sama dengan snapshot, jadi data baru yang
  // dibuat setelah backup TIDAK PERNAH ikut terhapus walau user pulihkan
  // cadangan yang lebih lama — bukan "pulihkan ke kondisi backup" yang
  // sebenarnya, cuma "gabungkan sebagian balik". Cadangan LAIN (key
  // berawalan backupPrefix) tetap dijaga, tidak ikut dihapus. KEYS.customers/
  // KEYS.addresses DILEWATI di sini (bukan localStorage lagi) — ditangani
  // terpisah lewat restoreCustomersAndAddresses ke Supabase di bawah.
  const snapshotKeys = new Set(Object.keys(snapshot));
  const currentKeys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key) currentKeys.push(key);
  }
  for (const key of currentKeys) {
    if (key.startsWith(KEYS.backupPrefix)) continue;
    if (key === KEYS.customers || key === KEYS.addresses) continue;
    if (!snapshotKeys.has(key)) window.localStorage.removeItem(key);
  }
  for (const [key, value] of Object.entries(snapshot)) {
    if (key.startsWith(KEYS.backupPrefix)) continue;
    if (key === KEYS.customers || key === KEYS.addresses) continue;
    if (value === null || value === undefined) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
    }
  }
  await restoreCustomersAndAddresses(snapshot);
  return true;
}

// =====================================================================
// CUSTOMER & ADDRESS (Tahap 5 migrasi backend — Supabase)
// =====================================================================
// Data BERSAMA (bukan cost-sensitive) — RLS "all_authenticated" biasa,
// query tabel langsung. Sudah ada di Supabase sejak migrasi Tahap 3.

function mapCustomerRow(c: Record<string, unknown>): Customer {
  return {
    id: c.id as string,
    name: c.name as string,
    waName: c.wa_name as string,
    phone: c.phone as string,
    receiver: c.receiver as string,
    receiverPhone: c.receiver_phone as string,
    city: c.city as string,
    since: c.since as string,
    notes: (c.notes as string[]) ?? [],
    createdAt: Number(c.created_at),
    deletedAt: c.deleted_at == null ? null : Number(c.deleted_at),
    initials: (c.initials as string) ?? undefined,
    defaultAddressId: (c.default_address_id as string) ?? undefined,
  };
}

function customerToRow(customer: Customer) {
  return {
    id: customer.id, name: customer.name, wa_name: customer.waName, phone: customer.phone,
    receiver: customer.receiver, receiver_phone: customer.receiverPhone, city: customer.city,
    since: customer.since, notes: customer.notes || [], created_at: customer.createdAt,
    deleted_at: customer.deletedAt, initials: customer.initials ?? null,
    default_address_id: customer.defaultAddressId ?? null,
  };
}

function mapAddressRow(a: Record<string, unknown>): Address {
  return {
    id: a.id as string,
    customerId: a.customer_id as string,
    label: a.label as string,
    recipientName: a.recipient_name as string,
    phone: a.phone as string,
    address: a.address as string,
    landmark: (a.landmark as string) ?? undefined,
    courier: (a.courier as string) ?? undefined,
    note: (a.note as string) ?? undefined,
    isDefault: a.is_default as boolean,
  };
}

function addressToRow(address: Address) {
  return {
    id: address.id, customer_id: address.customerId, label: address.label,
    recipient_name: address.recipientName, phone: address.phone, address: address.address,
    landmark: address.landmark ?? null, courier: address.courier ?? null,
    note: address.note ?? null, is_default: address.isDefault,
  };
}

export async function getAllCustomers(): Promise<Customer[]> {
  const { data, error } = await supabase.from("customers").select("*").order("created_at", { ascending: false });
  if (error) { console.error("[getAllCustomers]", error.message); return []; }
  return ((data || []) as Record<string, unknown>[]).map(mapCustomerRow);
}

export async function getCustomers(): Promise<Customer[]> {
  return (await getAllCustomers()).filter(c => c.deletedAt === null);
}

export async function getCustomer(id: string): Promise<Customer | undefined> {
  const { data, error } = await supabase.from("customers").select("*").eq("id", id).maybeSingle();
  if (error) { console.error("[getCustomer]", error.message); return undefined; }
  return data ? mapCustomerRow(data as Record<string, unknown>) : undefined;
}

export async function addCustomer(customer: Customer): Promise<Customer[]> {
  const { error } = await supabase.from("customers").upsert(customerToRow(customer));
  if (error) { console.error("[addCustomer]", error.message); throw new Error(error.message); }
  return getAllCustomers();
}

export async function updateCustomer(customer: Customer): Promise<Customer[]> {
  const { error } = await supabase.from("customers").update(customerToRow(customer)).eq("id", customer.id);
  if (error) { console.error("[updateCustomer]", error.message); throw new Error(error.message); }
  return getAllCustomers();
}

// Soft delete: hanya menandai deletedAt, transaksi historis tetap utuh.
export async function softDeleteCustomer(id: string): Promise<Customer[]> {
  const { error } = await supabase.from("customers").update({ deleted_at: Date.now() }).eq("id", id);
  if (error) console.error("[softDeleteCustomer]", error.message);
  return getAllCustomers();
}

// Hard delete: hanya untuk customer TANPA transaksi (order/payment). Dicek
// dari data ASLI (store.ts, Supabase).
export async function hardDeleteCustomer(id: string): Promise<{ ok: boolean; reason?: string }> {
  const [orders, payments] = await Promise.all([getStoreOrders(), getStorePayments()]);
  const hasOrder = orders.some(o => o.customerId === id);
  const hasPayment = payments.some(p => p.customerId === id);
  if (hasOrder || hasPayment) {
    return { ok: false, reason: "Customer memiliki transaksi. Gunakan soft delete (arsip)." };
  }
  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) { console.error("[hardDeleteCustomer]", error.message); return { ok: false, reason: error.message }; }
  return { ok: true };
}

export async function getAddresses(): Promise<Address[]> {
  const { data, error } = await supabase.from("addresses").select("*");
  if (error) { console.error("[getAddresses]", error.message); return []; }
  return ((data || []) as Record<string, unknown>[]).map(mapAddressRow);
}

export async function getCustomerAddresses(customerId: string): Promise<Address[]> {
  const { data, error } = await supabase.from("addresses").select("*").eq("customer_id", customerId);
  if (error) { console.error("[getCustomerAddresses]", error.message); return []; }
  return ((data || []) as Record<string, unknown>[]).map(mapAddressRow);
}

export async function addAddress(address: Address): Promise<Address[]> {
  const { error } = await supabase.from("addresses").upsert(addressToRow(address));
  if (error) { console.error("[addAddress]", error.message); throw new Error(error.message); }
  return getAddresses();
}

export async function updateAddress(address: Address): Promise<Address[]> {
  const { error } = await supabase.from("addresses").update(addressToRow(address)).eq("id", address.id);
  if (error) { console.error("[updateAddress]", error.message); throw new Error(error.message); }
  return getAddresses();
}

export async function deleteAddress(id: string): Promise<Address[]> {
  const { error } = await supabase.from("addresses").delete().eq("id", id);
  if (error) console.error("[deleteAddress]", error.message);
  return getAddresses();
}
