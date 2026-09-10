import { supabase } from "./supabaseClient";
import { getAllCustomers, getAddresses } from "./central";
import {
  getMarketers, getProducts, getWarehouses, getInventory,
  getOrders, getPayments, getFees, getBatchNames,
} from "./store";
import { getAllCollections, getCollectionOrders, getCollectionOrderItems } from "./collections";

// ===== TAHAP 3: MIGRASI DATA LOCALSTORAGE -> SUPABASE =====
// Dipanggil SEKALI dari device Owner yang punya data bisnis asli. Baca
// SEMUA data dari localStorage device ini (lewat getter yang SAMA persis
// dipakai app sehari-hari -- bukan baca localStorage manual), ubah bentuk
// field ke snake_case sesuai supabase/schema.sql, lalu upsert (insert atau
// update kalau id-nya sudah ada) -- AMAN diklik ulang berkali-kali, gak
// bakal bikin data dobel, karena semua ID dipertahankan APA ADANYA dari
// localStorage (bukan di-generate ulang).
//
// Urutan insert PENTING (foreign key): entity yang dirujuk (warehouses,
// marketers, customers, products, orders) harus masuk duluan sebelum
// entity yang merujuknya (order_items, payments, fees, dst).

// Gudang & Stok sudah pindah ke Supabase duluan (Tahap 4 sebagian jalan) —
// jadi fungsi ini sekarang ASYNC, dan utk 2 entity itu isinya "snapshot
// dari Supabase" bukan murni localStorage lagi. Gak masalah: tombol Export
// tetap berguna sbg cadangan kondisi TERKINI, dan upsert ulang ke Supabase
// (migrateToSupabase di bawah) tetap aman/idempotent kalaupun sebagian data
// ini sumbernya udah Supabase sendiri (upsert baris yang sama ke dirinya
// sendiri, gak ada efek samping).
export async function collectAllLocalData() {
  return {
    customers: getAllCustomers(),
    addresses: getAddresses(),
    marketers: await getMarketers(),
    products: getProducts(),
    warehouses: await getWarehouses(),
    inventory: await getInventory(),
    orders: getOrders(),
    payments: getPayments(),
    fees: getFees(),
    collections: getAllCollections(),
    collectionOrders: getCollectionOrders(),
    collectionOrderItems: getCollectionOrderItems(),
    batchNames: getBatchNames(),
  };
}

export type MigrationStepResult = { label: string; count: number; error: string | null };

async function upsertBatch(table: string, rows: Record<string, unknown>[], conflictColumn: string): Promise<string | null> {
  if (rows.length === 0) return null;
  const { error } = await supabase.from(table).upsert(rows, { onConflict: conflictColumn });
  return error ? error.message : null;
}

export async function migrateToSupabase(
  onProgress?: (step: string) => void
): Promise<MigrationStepResult[]> {
  const data = await collectAllLocalData();
  const results: MigrationStepResult[] = [];

  const run = async (label: string, table: string, rows: Record<string, unknown>[], conflictColumn = "id") => {
    onProgress?.(label);
    const error = await upsertBatch(table, rows, conflictColumn);
    results.push({ label, count: rows.length, error });
  };

  await run("Gudang", "warehouses", data.warehouses.map(w => ({
    id: w.id, name: w.name, code: w.code, active: w.active,
  })));

  await run("Marketer", "marketers", data.marketers.map(m => ({
    id: m.id, name: m.name, phone: m.phone || null, default_fee: m.defaultFee,
    status: m.status, joined_at: m.joinedAt, notes: m.notes || null,
  })));

  await run("Customer", "customers", data.customers.map(c => ({
    id: c.id, name: c.name, wa_name: c.waName, phone: c.phone,
    receiver: c.receiver, receiver_phone: c.receiverPhone, city: c.city,
    since: c.since, notes: c.notes || [], created_at: c.createdAt,
    deleted_at: c.deletedAt, initials: c.initials || null,
    default_address_id: c.defaultAddressId || null,
  })));

  await run("Alamat", "addresses", data.addresses.map(a => ({
    id: a.id, customer_id: a.customerId, label: a.label,
    recipient_name: a.recipientName, phone: a.phone, address: a.address,
    landmark: a.landmark || null, courier: a.courier || null,
    note: a.note || null, is_default: a.isDefault,
  })));

  await run("Produk", "products", data.products.map(p => ({
    id: p.id, name: p.name, category: p.category, price: p.price,
    original_price: p.originalPrice ?? null, description: p.description ?? null,
    emoji: p.emoji, badge: p.badge ?? null, variants: p.variants ?? null,
    modal_kotor: p.modalKotor ?? null, biaya_operasional: p.biayaOperasional ?? null,
    hpp: p.hpp ?? null, fee_marketer: p.feeMarketer ?? null,
    discount_default: p.discountDefault ?? null, discount_type: p.discountType ?? null,
    active: p.active !== false, default_collection_ids: p.defaultCollectionIds ?? null,
  })));

  await run("Order", "orders", data.orders.map(o => ({
    id: o.id, number: o.number, date: o.date, customer: o.customer,
    customer_id: o.customerId, phone: o.phone, address: o.address,
    discount_type: o.discountType, discount_value: o.discountValue,
    discount_amount: o.discountAmount, ongkir: o.ongkir, ongkir_label: o.ongkirLabel,
    dp: o.dp, note: o.note, internal_note: o.internalNote ?? null,
    marketer_id: o.marketerId, marketer_name: o.marketerName,
    total_fee: o.totalFee, subtotal: o.subtotal, total: o.total,
    status: o.status, batch: o.batch ?? null, created_at: o.createdAt,
  })));

  const allItems = data.orders.flatMap(o => o.items.map(item => ({ orderId: o.id, item })));
  await run("Item Order", "order_items", allItems.map(({ orderId, item }) => ({
    id: item.id, order_id: orderId, product_id: item.productId || null,
    name: item.name, emoji: item.emoji, qty: item.qty, price: item.price,
    hpp: item.hpp, fee_marketer: item.feeMarketer, discount: item.discount,
    detail: item.detail ?? null, category: item.category ?? null,
    production_stage: item.productionStage ?? null, shipment_stage: item.shipmentStage ?? null,
    stock_source: item.stockSource ?? null, warehouse_id: item.warehouseId ?? null,
    amna_attrs: (item.size || item.pad || item.fabric || item.color || item.modifications || item.customRequests) ? {
      size: item.size, pad: item.pad, fabric: item.fabric, color: item.color,
      modifications: item.modifications, customRequests: item.customRequests,
      additionalPrice: item.additionalPrice, finalPrice: item.finalPrice,
    } : null,
  })));

  await run("Pembayaran", "payments", data.payments.map(p => ({
    id: p.id, order_id: p.orderId, order_number: p.orderNumber,
    customer_id: p.customerId, customer_name: p.customerName,
    product_summary: p.productSummary, amount: p.amount,
    date_received: p.dateReceived, status: p.status,
    date_withdrawn: p.dateWithdrawn, note: p.note, created_at: p.createdAt,
  })));

  await run("Fee Marketer", "fees", data.fees.map(f => ({
    id: f.id, order_id: f.orderId, order_number: f.orderNumber,
    invoice_number: f.invoiceNumber, marketer_id: f.marketerId,
    marketer_name: f.marketerName, date: f.date, items: f.items,
    total_fee: f.totalFee, status: f.status, paid_date: f.paidDate,
    note: f.note, created_at: f.createdAt,
  })));

  await run("Stok Gudang", "inventory", data.inventory.map(i => ({
    id: i.id, product_id: i.productId, warehouse_id: i.warehouseId,
    stock_on_hand: i.stockOnHand, reserved: i.reserved,
    minimum_stock: i.minimumStock, location: i.location ?? null,
  })));

  await run("Collection", "collections", data.collections.map(c => ({
    id: c.id, name: c.name, type: c.type, status: c.status, icon: c.icon,
    color: c.color, description: c.description ?? null, owner: c.owner ?? null,
    tags: c.tags || [], created_at: c.createdAt, updated_at: c.updatedAt,
    deleted_at: c.deletedAt,
  })));

  await run("Tautan Collection-Order", "collection_orders", data.collectionOrders.map(co => ({
    id: co.id, collection_id: co.collectionId, order_id: co.orderId, added_at: co.addedAt,
  })));

  await run("Tautan Kategori Produk", "collection_order_items", data.collectionOrderItems.map(coi => ({
    id: coi.id, collection_id: coi.collectionId, order_id: coi.orderId,
    item_id: coi.itemId, added_at: coi.addedAt,
  })));

  await run("Nama Batch", "batch_names", data.batchNames.map(name => ({ name })), "name");

  return results;
}
