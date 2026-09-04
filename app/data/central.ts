"use client";

// =====================================================================
// CENTRAL DATA LAYER — UmayasLa
// =====================================================================
// Satu-satunya sumber data terpusat untuk seluruh aplikasi.
// Semua entity disimpan sebagai array relasional di localStorage.
// UI TIDAK membuat data bisnis sendiri — hanya membaca dari store ini.
//
// Prinsip:
// - Tidak ada seed dummy. Jika localStorage kosong → [] / empty state.
// - Setiap entity punya id unik + relasi via foreign key.
// - Tidak ada dua field yang menyimpan fakta yang sama.
// - Status waktu (overdue/today/upcoming) dihitung dinamis, tidak disimpan.
// =====================================================================

// =====================================================================
// ENUM STATUS
// =====================================================================

// Lifecycle order (bukan production/fulfillment/shipment/payment)
export type OrderStatus = "draft" | "confirmed" | "cancelled" | "completed";

// Status produksi batch (batas maksimum yang diperbolehkan)
export type BatchStatus = "planned" | "produksi" | "qc" | "selesai";

// Status produksi item customer (kondisi aktual, validated ≤ batch)
export type ProductionStatus =
  | "belum-ready"
  | "masih-diproduksi"
  | "proses-qc"
  | "ready-gudang";

// Status packing item
export type FulfillmentStatus =
  | "belum-siap"
  | "siap-packing"
  | "sudah-packing"
  | "menunggu-kurir";

// Status pengiriman shipment
export type ShipmentStatus =
  | "belum-dibuat"
  | "dalam-pengiriman"
  | "terkirim"
  | "bermasalah"
  | "retur"
  | "selesai";

// Status pembayaran (derived dari Payment + PaymentDue)
export type PaymentStatus =
  | "belum-bayar"
  | "dp"
  | "lunas-sebagian"
  | "lunas"
  | "refund"
  | "bermasalah";

// Status PaymentDue
export type PaymentDueStatus = "pending" | "paid";

// Status Task
export type TaskStatus = "pending" | "done";

// Status FulfillmentAllocation (derived dari ShipmentItem)
export type AllocationStatus = "allocated" | "shipped";

// =====================================================================
// ENTITY TYPES
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
  // Lossless backfill dari customers.ts (Phase 11B) — disalin persis dari
  // legacy source, TIDAK dihitung / diinfer.
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

export type Order = {
  id: string;
  number: string; // nomor invoice/order
  customerId: string;
  date: string;
  phone: string;
  address: string;
  discountType: "percent" | "nominal";
  discountValue: number;
  discountAmount: number;
  ongkir: number;
  ongkirLabel: string;
  dp: number;
  note: string;
  marketerId: string | null;
  status: OrderStatus;
  subtotal: number;
  total: number;
  totalFee: number;
  createdAt: number;
  // Prioritas owner (action operasional). Bukan derived — keputusan manual.
  priority?: boolean;
};


export type OrderItem = {
  id: string;
  orderId: string;
  productId: string;
  variantId?: string;
  productName: string;
  emoji: string;
  qty: number;
  price: number; // harga jual per unit (snapshot)
  discount: number; // diskon per unit
  subtotal: number;
  hpp: number; // HPP per unit (snapshot)
  feeMarketer: number; // fee per unit (snapshot)
  batchId: string | null; // null = ready stock
  productionStatus: ProductionStatus;
  fulfillmentStatus: FulfillmentStatus;
  // ===== snapshot konfigurasi customer (bukan SKU) =====
  size?: string;
  pad?: string;
  fabric?: string;
  color?: string;
  poni?: string;
  rits?: string;
  modifications?: string[];
  customRequests?: { name: string; price: number }[];
  additionalPrice?: number;
  finalPrice?: number;
};

export type Product = {
  id: string;
  name: string;
  category: string;
  emoji: string;
  description?: string;
  active: boolean;
  // Default fulfillment warehouse (HANYA untuk membuat allocation awal).
  // Bukan sumber kebenaran actual warehouse — actual berasal dari
  // FulfillmentAllocation.warehouseId.
  defaultWarehouseId?: string;
  createdAt: number;
};

export type Variant = {
  id: string;
  productId: string;
  sku: string;
  name: string;
  size?: string;
  price: number;
  hpp: number;
  feeMarketer: number;
};

export type Batch = {
  id: string;
  name: string;
  status: BatchStatus;
  estimatedReady: string | null; // target (boleh berubah)
  actualReadyAt: string | null; // diisi saat benar-benar ready
  progress: number; // 0-100
  productId?: string;
  createdAt: number;
};

export type Payment = {
  id: string;
  orderId: string;
  amount: number;
  paidDate: string;
  note?: string;
  createdAt: number;
};

export type PaymentDue = {
  id: string;
  orderId: string;
  amount: number;
  dueDate: string;
  status: PaymentDueStatus;
  note?: string;
  createdAt: number;
};

// =====================================================================
// PAYMENT ENGINE — PAYMENT FACT + PAYMENT ALLOCATION (PHASE 1)
// =====================================================================
// Payment adalah ACTUAL MONEY RECEIVED — fakta "uang sebesar X benar-benar
// diterima customer pada waktu Y." Payment BUKAN status pembayaran, snapshot
// DP, order status, marketer fee, atau shipment status.
//
// PENTING (legacy safety):
//   - Entity `Payment` (order-scoped) di atas TETAP utuh dan dipakai oleh
//     consumer legacy (getPaidAmount, getOutstanding, getPaymentStatus,
//     getCustomerWorkspace, recordPayment, dll). TIDAK diubah di Phase 1.
//   - Payment Engine memakai entity BARU `PaymentFact` (customer-scoped)
//     sebagai fondasi target source of truth. Consumer belum dipindahkan.
//   - Tidak ada data migration. Tidak ada dummy/seed.
//
// Alokasi:
//   - Satu PaymentFact dapat memiliki banyak PaymentAllocation.
//   - Allocation mengarah ke obligation via abstraction `PaymentAllocationTarget`
//     (Product Obligation / Shipping Obligation). Obligation final belum
//     diimplementasikan (Phase 2/4) → hanya referensi abstraction yang
//     kompatibel, TIDAK mengimplementasikan Phase 2/4 sekarang.
//   - Suggestion BUKAN fakta. Hanya allocation yang dikonfirmasi owner
//     menjadi confirmed fact.
// =====================================================================

// Payment Fact — actual money received (customer-scoped)
export type PaymentFact = {
  id: string;
  customerId: string;
  amount: number;
  receivedAt: string; // ISO timestamp saat uang benar-benar diterima
  method?: string; // metode pembayaran / reference (jika tersedia)
  reference?: string; // reference eksternal (jika diperlukan)
  note?: string;
  createdAt: number;
  updatedAt: number;
};

// Jenis obligation yang dapat menjadi target allocation.
// Product Obligation / Shipping Obligation belum diimplementasikan final
// (Phase 2/4) → hanya abstraction/reference yang kompatibel.
export type PaymentAllocationTargetType = "product-obligation" | "shipping-obligation";

// Target allocation — reference ke obligation yang relevan.
export type PaymentAllocationTarget = {
  type: PaymentAllocationTargetType;
  // Reference ke obligation. Karena Product/Shipping Obligation belum
  // diimplementasikan (Phase 2/4), ini adalah key/reference yang stabil.
  referenceId: string;
  // Label manusiawi untuk provenance (opsional).
  label?: string;
};

// Provenance allocation — "uang ini dialokasikan untuk apa dan kenapa?"
export type PaymentAllocationProvenance = {
  reason: string; // alasan alokasi
  source: "suggestion" | "owner-manual"; // asal keputusan
};

// Payment Allocation — CONFIRMED FACT (hanya yang dikonfirmasi owner).
export type PaymentAllocation = {
  id: string;
  paymentId: string;
  target: PaymentAllocationTarget;
  amount: number;
  provenance: PaymentAllocationProvenance;
  confirmedAt: number;
  createdAt: number;
  updatedAt: number;
};

// Payment Allocation Suggestion — BUKAN fakta. Transient, menunggu review owner.
export type PaymentAllocationSuggestion = {
  id: string;
  paymentId: string;
  target: PaymentAllocationTarget;
  amount: number;
  reason: string;
  priority: number; // 1 = tertinggi
  createdAt: number;
};

// =====================================================================
// SHIPPING OBLIGATION (PHASE 4)
// =====================================================================
// Shipping Obligation adalah kewajiban FINANSIAL customer untuk membayar
// biaya pengiriman tertentu. TERPISAH dari:
//   - Product Obligation (kewajiban produk)
//   - PaymentFact / PaymentAllocation (actual payment)
//   - Shipment (konsekuensi operasional pengiriman)
//
// Aturan final:
//   - Ongkir boleh BELUM DIKETAHUI saat Order dibuat → amount = null (UNKNOWN).
//   - Ongkir boleh diketahui kemudian (owner memasukkan nominal manual).
//   - Satu Order dapat memiliki LEBIH DARI SATU Shipping Obligation
//     (mis. per warehouse / per pengiriman operasional).
//   - Shipping Obligation TIDAK membutuhkan Shipment untuk dibuat / menerima
//     payment. Bisa ada sebelum Shipment.
//   - amount = null (UNKNOWN) TIDAK dianggap Rp0, TIDAK dianggap paid,
//     TIDAK dianggap settled. Jangan menebak nominal.
//   - warehouseId = actual warehouse (dari FulfillmentAllocation), BUKAN
//     Product.defaultWarehouseId. Jika belum diketahui → undefined.
//   - courier boleh belum diketahui → undefined. Jangan menebak.
//   - Tidak ada automatic courier pricing / tarif eksternal. Owner memasukkan
//     nominal ongkir secara manual.
// =====================================================================
export type ShippingObligation = {
  id: string;
  orderId: string;
  customerId: string;
  // Nominal ongkir. null = UNKNOWN (belum diketahui). Bukan Rp0.
  amount: number | null;
  // Actual warehouse terkait kewajiban ongkir (dari FulfillmentAllocation).
  // Jika belum diketahui → undefined.
  warehouseId?: string;
  // Courier jika sudah diketahui. Jika belum → undefined. Jangan menebak.
  courier?: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
};

// =====================================================================
// PROMISED PAYMENT (PHASE 5)
// =====================================================================
// Promised Payment adalah JANJI/komitmen customer untuk membayar di masa
// depan. TERPISAH dari:
//   - PaymentFact (actual money received) — Promise ≠ Payment.
//   - PaymentAllocation (confirmed allocation) — Promise ≠ Allocation.
//   - Product Obligation / Shipping Obligation — Promise tidak mengubah
//     kewajiban, outstanding, atau payment gate.
//   - Deposit — Promise tidak menghasilkan Deposit (Deposit hanya berasal
//     dari actual PaymentFact yang belum dialokasikan).
//
// Aturan final:
//   - Promise hanya menyimpan: customerId, promisedDate, promised amount
//     (jika diketahui), intended obligation (jika diketahui), note/reference,
//     createdAt, updatedAt.
//   - Jika intended obligation belum diketahui → null/undefined. JANGAN
//     menebak allocation.
//   - Promise TIDAK membuat PaymentFact, TIDAK membuat PaymentAllocation,
//     TIDAK mengubah Product/Shipping Obligation, TIDAK membuat customer
//     LUNAS, TIDAK mengubah payment gate, TIDAK membuat packing/shipment
//     diperbolehkan.
//   - Hanya actual PaymentFact + confirmed allocation yang memengaruhi
//     payment settlement.
//   - promisedDate disimpan eksplisit. TIDAK ada automatic tolerance window,
//     grace period, atau overdue buffer.
//   - Customer dapat memiliki LEBIH DARI SATU promised payment.
//   - Promise lama TIDAK dihapus hanya karena promise baru dibuat.
//   - Promise lateness hanya historical/operational signal — TIDAK otomatis
//     cancel/refund/forfeit/release stock/block/blacklist/mark paid.
// =====================================================================
export type PromisedPayment = {
  id: string;
  customerId: string;
  // Tanggal janji bayar (eksplisit, YYYY-MM-DD). Tidak ada tolerance window.
  promisedDate: string;
  // Nominal yang dijanjikan. null = belum diketahui. Jangan menebak.
  amount: number | null;
  // Intended obligation (INTENT saja, bukan allocation). Boleh null/undefined
  // jika belum diketahui. JANGAN menebak allocation dari intent ini.
  intendedObligation?: PaymentAllocationTarget;
  note?: string;
  reference?: string;
  createdAt: number;
  updatedAt: number;
};

// =====================================================================
// CANCELLATION + FINANCIAL RESOLUTION (PHASE 6)
// =====================================================================
// Cancellation adalah HISTORICAL FACT bahwa order/item dibatalkan. TERPISAH
// dari PaymentFact / PaymentAllocation / Deposit / Refund.
//
// Aturan final:
//   - Cancellation TIDAK menghapus PaymentFact / PaymentAllocation / histori.
//   - Cancellation TIDAK otomatis menentukan satu hasil universal (hangus /
//     refund / deposit / reallocate). Owner menentukan resolution manual.
//   - Cancellation dapat terjadi pada seluruh Order ATAU satu/beberapa
//     OrderItem. Satu item dibatalkan TIDAK membatalkan item lain.
//   - Reason adalah KONTEKS, bukan penentu otomatis refund.
//   - Jika resolution belum ditentukan → PENDING_OWNER_RESOLUTION.
//   - Cancellation TIDAK menghapus PromisedPayment (janji tetap histori).
//   - Cancellation TIDAK menghapus Shipping Obligation.
//   - Cancellation TIDAK melakukan inventory mutation / shipment / packing.
//   - Marketer fee TIDAK dihitung di Phase 6 — hanya outcome disediakan.
// =====================================================================

// Alasan pembatalan (konteks, bukan penentu otomatis refund).
export type CancellationReason =
  | "CUSTOMER_REQUEST"
  | "CUSTOMER_UDZUR"
  | "YASLA_ERROR"
  | "OWNER_DECISION"
  | "OTHER";

// Level pembatalan: seluruh order atau satu item.
export type CancellationLevel = "order" | "item";

// Status cancellation (historical fact).
//   active   → tercatat, belum tentu resolved
//   cancelled→ dibatalkan (bukan lagi active obligation)
//   resolved → resolution owner sudah ditentukan
export type CancellationStatus = "active" | "cancelled" | "resolved";

// Resolution yang dapat dipilih owner (owner-controlled, TIDAK otomatis).
export type CancellationResolutionType =
  | "FORFEITED" // hangus — tidak kembali jadi deposit
  | "REFUNDED" // refund — financial event terpisah
  | "MOVED_TO_DEPOSIT" // jadi deposit customer (resolution record; deposit derived)
  | "REALLOCATED" // dipindah ke target lain (resolution record; allocation TIDAK otomatis)
  | "OWNER_MANUAL"; // keputusan manual owner lainnya

// Cancellation — historical fact bahwa order/item dibatalkan.
export type Cancellation = {
  id: string;
  orderId: string;
  customerId: string;
  level: CancellationLevel; // "order" | "item"
  orderItemId?: string; // wajib jika level === "item"
  reason: CancellationReason;
  note?: string;
  status: CancellationStatus;
  createdAt: number;
  updatedAt: number;
};

// Cancellation Resolution — keputusan owner terhadap allocation yang
// terdampak. Ini adalah CONTROLLED/MANUAL abstraction yang AMAN:
//   - TIDAK menghapus / mengubah PaymentAllocation.
//   - TIDAK membuat PaymentAllocation baru (reallocate TIDAK otomatis).
//   - TIDAK membuat Deposit baru (deposit tetap derived dari unallocated).
//   - TIDAK membuat Refund otomatis (refund adalah event terpisah).
// Resolution hanya MENCATAT keputusan owner + provenance.
export type CancellationResolution = {
  id: string;
  cancellationId: string;
  // Allocation yang terdampak (jika ada). Tidak dihapus — hanya direferensikan.
  allocationId?: string;
  // Obligation target yang terdampak (jika applicable).
  target?: PaymentAllocationTarget;
  resolution: CancellationResolutionType;
  amount: number; // nominal yang terdampak resolution ini
  // Untuk REFUNDED: referensi ke Refund event (dibuat terpisah oleh owner).
  refundId?: string;
  // Untuk REALLOCATED: target tujuan (INTENT owner). Allocation baru TIDAK
  // dibuat otomatis — hanya dicatat sebagai keputusan.
  reallocatedTo?: PaymentAllocationTarget;
  // Untuk MOVED_TO_DEPOSIT: mencatat original allocation → cancellation →
  // amount released → deposit resolution. Deposit balance tetap derived.
  note?: string;
  createdAt: number;
  updatedAt: number;
};

// Refund — financial event/fact TERPISAH. Bukan negative payment.
// Tidak menghapus PaymentFact. Owner menentukan nominal refund.
export type Refund = {
  id: string;
  customerId: string;
  paymentId: string; // original PaymentFact (tidak diubah / dihapus)
  allocationId?: string; // allocation terdampak (jika applicable)
  target?: PaymentAllocationTarget; // obligation terdampak (jika applicable)
  amount: number;
  reason: string;
  provenance: "owner-manual"; // refund selalu keputusan owner
  createdAt: number;
};

export type Warehouse = {


  id: string;
  name: string;
  code: string;
  active: boolean;
};

export type FulfillmentAllocation = {
  id: string;
  orderItemId: string;
  warehouseId: string;
  quantity: number;
  // PHASE 8: owner-controlled release (cancellation resolution). Saat terisi,
  // allocation dianggap dilepaskan sehingga stock kembali ke AVAILABLE.
  // TIDAK menghapus histori allocation.
  releasedAt?: number;
};

export type Shipment = {
  id: string;
  status: ShipmentStatus;
  courier: string;
  shippedAt: string | null;
  createdAt: number;
};

export type ShipmentItem = {
  id: string;
  shipmentId: string;
  orderItemId: string;
  fulfillmentAllocationId: string;
  quantity: number;
};

export type Resi = {
  id: string;
  shipmentId: string;
  number: string;
  courier: string;
  status: string;
  date: string;
};

export type Marketer = {
  id: string;
  name: string;
  phone?: string;
  defaultFee: number;
  status: "aktif" | "tidak-aktif" | "arsip";
  joinedAt: string;
  notes?: string;
};

export type Fee = {
  id: string;
  orderId: string;
  marketerId: string;
  items: { productName: string; qty: number; feePerUnit: number; feeTotal: number }[];
  totalFee: number;
  status: "belum-diambil" | "sudah-diambil";
  paidDate: string | null;
  note?: string;
  createdAt: number;
};

// =====================================================================
// MARKETER FEE ENGINE (PHASE 7)
// =====================================================================
// Marketer Fee adalah kompensasi marketer atas penjualan. TERPISAH dari:
//   - PaymentFact / PaymentAllocation (actual payment) — fee BUKAN payment.
//   - Order.totalFee (legacy field) — tetap utuh, dipakai consumer legacy.
//   - Fee (legacy entity, order-scoped) — tetap utuh, dipakai consumer legacy.
//
// Aturan final:
//   - Fee dihitung DERIVED dari OrderItem.feeMarketer (snapshot per unit) × qty,
//     lalu disesuaikan dengan outcome cancellation (Phase 6):
//       normal  → fee penuh
//       half    → 50% dari fee normal item tersebut
//       zero    → 0 (refund karena udzur / kesalahan YasLa)
//       pending → fee ditahan (belum dihitung sebagai confirmed)
//   - computeMarketerFeeForOrder adalah PURE/DERIVED — TIDAK menyimpan apa pun,
//     TIDAK mengubah Order / OrderItem / Payment / legacy Fee.
//   - Hanya confirmMarketerFee (owner-controlled) yang membuat MarketerFee fact.
//   - Owner boleh menerima hasil komputasi ATAU menyesuaikan nominal (adjustment).
//   - Fee TIDAK otomatis dibuat saat order dibuat / payment diterima.
//   - Fee TIDAK menghitung dari payment. Fee dihitung dari snapshot item.
//   - Tidak ada dummy/seed. Tidak ada migration. Consumer belum dipindahkan.
// =====================================================================

// Outcome fee per item (derived dari CancellationFeeOutcome Phase 6).
export type MarketerFeeItemOutcome = "normal" | "half" | "zero" | "pending";

// Marketer Fee — CONFIRMED FACT (hanya yang dikonfirmasi owner).
export type MarketerFee = {
  id: string;
  orderId: string;
  marketerId: string;
  // Per-item breakdown (derived dari OrderItem.feeMarketer + cancellation outcome).
  items: {
    orderItemId: string;
    productName: string;
    qty: number;
    feePerUnit: number; // snapshot per unit
    baseFee: number; // feePerUnit * qty (normal, sebelum outcome)
    outcome: MarketerFeeItemOutcome;
    feeAmount: number; // fee final item setelah outcome
  }[];
  totalFee: number; // sum(feeAmount)
  status: "belum-diambil" | "sudah-diambil";
  paidDate: string | null;
  note?: string;
  provenance: "owner-confirmed" | "owner-manual";
  createdAt: number;
  updatedAt: number;
};

export type Collection = {

  id: string;
  name: string;
  type: string;
  status: string;
  icon: string;
  color: string;
  description?: string;
  owner?: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
};

export type CollectionOrder = {
  id: string;
  collectionId: string;
  orderId: string;
  addedAt: number;
};

export type Activity = {
  id: string;
  customerId: string;
  orderId?: string;
  type: string;
  title: string;
  desc?: string;
  time: string;
  createdAt: number;
};

export type Task = {
  id: string;
  title: string;
  date: string;
  time?: string;
  type: string;
  status: TaskStatus;
  note?: string;
  customerId?: string;
  orderId?: string;
  orderItemId?: string;
  batchId?: string;
  shipmentId?: string;
  createdAt: number;
  completedAt?: string;
};

// =====================================================================
// INVENTORY (stok per gudang)
// =====================================================================
// Stok fisik produk/variant di sebuah warehouse. Terhubung ke Warehouse
// via warehouseId. Bukan sumber kebenaran actual fulfillment — itu tetap
// FulfillmentAllocation.warehouseId.

export type Inventory = {
  id: string;
  warehouseId: string;
  productId: string;
  variantId?: string;
  quantity: number;
  updatedAt: number;
};

// =====================================================================
// SHIPPING PREFERENCE (business data, bukan UI state)
// =====================================================================
// Nilai final yang dikunci:
//   - Belum Ditentukan
//   - Tunggu Lengkap
//   - Kirim Sebagian
// Scope: customer-level (orderId = null) + optional order-level override.

export type ShippingPreferenceValue = "belum-ditentukan" | "tunggu-lengkap" | "kirim-sebagian";

export type ShippingPreference = {
  id: string;
  customerId: string;
  value: ShippingPreferenceValue;
  // null = customer-level; terisi = override untuk order tertentu
  orderId: string | null;
  updatedAt: number;
};

// =====================================================================
// FULFILLMENT DECISION (keputusan operasional owner)
// =====================================================================
// Konsep TERPISAH dari ShippingPreference.
//   ShippingPreference  → belum-ditentukan | tunggu-lengkap | kirim-sebagian
//   FulfillmentDecision → keputusan owner terhadap kandidat shipment:
//                         gabungkan | kirim-terpisah | tunda | hold | release
// Scope: customer-level (orderId = null) + optional order-level override.
// hold/release adalah action operasional terpisah (alasan disimpan di note).

export type FulfillmentDecisionValue =
  | "gabungkan"
  | "kirim-terpisah"
  | "tunda"
  | "hold"
  | "release";

export type FulfillmentDecision = {
  id: string;
  customerId: string;
  // null = customer-level; terisi = override untuk order tertentu
  orderId: string | null;
  value: FulfillmentDecisionValue;
  note?: string;
  updatedAt: number;
};

// =====================================================================
// STORAGE KEYS
// =====================================================================


const KEYS = {
  customers: "umayasla_customers",
  addresses: "umayasla_addresses",
  // Order/OrderItem central memakai key TERPISAH dari store.ts (umayasla_orders)
  // untuk menghindari konflik shape (OrderRecord vs Order). store.ts tetap
  // pemilik umayasla_orders; central membaca salinan materialized-nya.
  orders: "umayasla_central_orders",
  orderItems: "umayasla_central_order_items",
  products: "umayasla_products",
  variants: "umayasla_variants",
  batches: "umayasla_batches",
  payments: "umayasla_payments",
  paymentDues: "umayasla_payment_dues",
  // Payment Engine (Phase 1) — key TERPISAH dari legacy `payments`.
  // PaymentFact adalah fondasi target source of truth; consumer legacy
  // belum dipindahkan. Tidak ada migration.
  paymentFacts: "umayasla_payment_facts",
  paymentAllocations: "umayasla_payment_allocations",
  paymentAllocationSuggestions: "umayasla_payment_allocation_suggestions",
  // Shipping Obligation (Phase 4) — kewajiban finansial ongkir, TERPISAH
  // dari Shipment. Bisa ada sebelum Shipment. Tidak ada migration.
  shippingObligations: "umayasla_shipping_obligations",
  // Promised Payment (Phase 5) — janji/komitmen customer untuk membayar.
  // TERPISAH dari PaymentFact (actual). Tidak ada migration.
  promisedPayments: "umayasla_promised_payments",
  // Cancellation (Phase 6) — historical fact bahwa order/item dibatalkan.
  // TERPISAH dari PaymentFact / PaymentAllocation / Deposit / Refund.
  // Tidak menghapus histori. Tidak ada migration.
  cancellations: "umayasla_cancellations",
  // Cancellation Resolution (Phase 6) — keputusan owner terhadap allocation
  // yang terdampak. Owner-controlled, TIDAK otomatis. Tidak ada migration.
  cancellationResolutions: "umayasla_cancellation_resolutions",
  // Refund (Phase 6) — financial event/fact terpisah. Bukan negative payment.
  // Tidak menghapus PaymentFact. Tidak ada migration.
  refunds: "umayasla_refunds",
  // Marketer Fee (Phase 7) — CONFIRMED fee fact (owner-confirmed). TERPISAH
  // dari legacy `fees` (umayasla_fees) yang dipakai consumer legacy. Fee
  // dihitung DERIVED dari OrderItem.feeMarketer + cancellation outcome.
  // Tidak ada migration. Consumer belum dipindahkan.
  marketerFees: "umayasla_marketer_fees",
  warehouses: "umayasla_warehouses",




  allocations: "umayasla_allocations",
  shipments: "umayasla_shipments",
  shipmentItems: "umayasla_shipment_items",
  resis: "umayasla_resis",
  marketers: "umayasla_marketers",
  fees: "umayasla_fees",
  collections: "umayasla_collections",
  collectionOrders: "umayasla_collection_orders",
  activities: "umayasla_activities",
  tasks: "umayasla_tasks",
  inventory: "umayasla_inventory",
  shippingPreferences: "umayasla_shipping_preferences",
  fulfillmentDecisions: "umayasla_fulfillment_decisions",
  backupPrefix: "umayasla_backup_",
};


// =====================================================================
// LOCAL STORAGE HELPERS
// =====================================================================

function load<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function save<T>(key: string, value: T[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

// =====================================================================
// BACKUP — aman, non-destruktif
// =====================================================================
// Sebelum migrasi apa pun, seluruh localStorage disalin ke key backup.
// Tidak menghapus / meng-overwrite key lama.

export function backupLocalStorage(): string {
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
  window.localStorage.setItem(backupKey, JSON.stringify(snapshot));
  return backupKey;
}

// =====================================================================
// GENERIC CRUD
// =====================================================================

function getAll<T>(key: string): T[] {
  return load<T>(key);
}

function saveAll<T>(key: string, list: T[]) {
  save(key, list);
}

function addOne<T extends { id: string }>(key: string, item: T): T[] {
  const list = getAll<T>(key);
  const updated = [...list, item];
  saveAll(key, updated);
  return updated;
}

function updateOne<T extends { id: string }>(key: string, item: T): T[] {
  const list = getAll<T>(key);
  const updated = list.map(x => (x.id === item.id ? item : x));
  saveAll(key, updated);
  return updated;
}

function removeOne<T extends { id: string }>(key: string, id: string): T[] {
  const list = getAll<T>(key);
  const updated = list.filter(x => x.id !== id);
  saveAll(key, updated);
  return updated;
}

function getById<T extends { id: string }>(key: string, id: string): T | undefined {
  return getAll<T>(key).find(x => x.id === id);
}

// =====================================================================
// CUSTOMER
// =====================================================================

export function getCustomers(): Customer[] {
  return getAll<Customer>(KEYS.customers).filter(c => c.deletedAt === null);
}

export function getAllCustomers(): Customer[] {
  return getAll<Customer>(KEYS.customers);
}

export function getCustomer(id: string): Customer | undefined {
  return getById<Customer>(KEYS.customers, id);
}

export function addCustomer(customer: Customer): Customer[] {
  return addOne(KEYS.customers, customer);
}

export function updateCustomer(customer: Customer): Customer[] {
  return updateOne(KEYS.customers, customer);
}

// Soft delete: hanya menandai deletedAt, transaksi historis tetap utuh.
export function softDeleteCustomer(id: string): Customer[] {
  const list = getAll<Customer>(KEYS.customers);
  const updated = list.map(c => (c.id === id ? { ...c, deletedAt: Date.now() } : c));
  saveAll(KEYS.customers, updated);
  return updated;
}

// Hard delete: hanya untuk customer TANPA transaksi (order/payment/shipment).
export function hardDeleteCustomer(id: string): { ok: boolean; reason?: string } {
  const hasOrder = getOrders().some(o => o.customerId === id);
  const hasPayment = getPayments().some(p => {
    const order = getOrder(p.orderId);
    return order?.customerId === id;
  });
  const hasShipment = getShipments().some(s => {
    const items = getShipmentItemsForShipment(s.id);

    return items.some(si => {
      const oi = getOrderItem(si.orderItemId);
      const order = oi ? getOrder(oi.orderId) : undefined;
      return order?.customerId === id;
    });
  });
  if (hasOrder || hasPayment || hasShipment) {
    return { ok: false, reason: "Customer memiliki transaksi. Gunakan soft delete (arsip)." };
  }
  removeOne<Customer>(KEYS.customers, id);
  return { ok: true };
}

// =====================================================================
// ADDRESS
// =====================================================================

export function getAddresses(): Address[] {
  return getAll<Address>(KEYS.addresses);
}

export function getCustomerAddresses(customerId: string): Address[] {
  return getAddresses().filter(a => a.customerId === customerId);
}

export function addAddress(address: Address): Address[] {
  return addOne(KEYS.addresses, address);
}

export function updateAddress(address: Address): Address[] {
  return updateOne(KEYS.addresses, address);
}

export function deleteAddress(id: string): Address[] {
  return removeOne<Address>(KEYS.addresses, id);
}

// =====================================================================
// ORDER
// =====================================================================

export function getOrders(): Order[] {
  // PHASE 2: pastikan order dari sistem transaksi (store.ts) tersedia di central.
  // Idempotent & non-destruktif — hanya mematerialisasi yang belum ada.
  syncOrdersFromStore();
  return getAll<Order>(KEYS.orders);
}


export function getOrder(id: string): Order | undefined {
  return getById<Order>(KEYS.orders, id);
}

export function getOrdersForCustomer(customerId: string): Order[] {
  return getOrders().filter(o => o.customerId === customerId);
}

export function addOrder(order: Order): Order[] {
  return addOne(KEYS.orders, order);
}

export function updateOrder(order: Order): Order[] {
  return updateOne(KEYS.orders, order);
}

export function deleteOrder(id: string): Order[] {
  // Hapus juga item, payment, paymentDue terkait
  const items = getOrderItems().filter(i => i.orderId !== id);

  saveAll(KEYS.orderItems, items);
  const payments = getPayments().filter(p => p.orderId !== id);
  saveAll(KEYS.payments, payments);
  const dues = getPaymentDues().filter(d => d.orderId !== id);
  saveAll(KEYS.paymentDues, dues);
  return removeOne<Order>(KEYS.orders, id);
}

// =====================================================================
// ORDER ITEM
// =====================================================================

export function getOrderItems(): OrderItem[] {
  return getAll<OrderItem>(KEYS.orderItems);
}

export function getOrderItem(id: string): OrderItem | undefined {
  return getById<OrderItem>(KEYS.orderItems, id);
}

export function getItemsForOrder(orderId: string): OrderItem[] {
  return getOrderItems().filter(i => i.orderId === orderId);
}

export function addOrderItem(item: OrderItem): OrderItem[] {
  return addOne(KEYS.orderItems, item);
}

export function updateOrderItem(item: OrderItem): OrderItem[] {
  return updateOne(KEYS.orderItems, item);
}

export function deleteOrderItem(id: string): OrderItem[] {
  return removeOne<OrderItem>(KEYS.orderItems, id);
}

// =====================================================================
// PRODUCTION STATUS CONSTRAINT
// =====================================================================
// Batch.status memberi batas maksimum; OrderItem.productionStatus adalah
// kondisi aktual. Store menolak nilai yang melampaui tahap batch.

const BATCH_STATUS_ORDER: Record<BatchStatus, number> = {
  planned: 0,
  produksi: 1,
  qc: 2,
  selesai: 3,
};

const PRODUCTION_STATUS_ORDER: Record<ProductionStatus, number> = {
  "belum-ready": 0,
  "masih-diproduksi": 1,
  "proses-qc": 2,
  "ready-gudang": 3,
};

// Status produksi yang diizinkan untuk setiap tahap batch
const ALLOWED_PRODUCTION: Record<BatchStatus, ProductionStatus[]> = {
  planned: ["belum-ready"],
  produksi: ["belum-ready", "masih-diproduksi"],
  qc: ["masih-diproduksi", "proses-qc"],
  selesai: ["ready-gudang"],
};

// Validasi: apakah productionStatus diizinkan untuk batch status tertentu
export function isProductionStatusAllowed(batchStatus: BatchStatus, productionStatus: ProductionStatus): boolean {
  return ALLOWED_PRODUCTION[batchStatus].includes(productionStatus);
}

// Validasi OrderItem terhadap batch-nya. Return error message atau null.
export function validateOrderItemProduction(item: OrderItem): string | null {
  if (!item.batchId) {
    // Ready stock: harus ready-gudang
    if (item.productionStatus !== "ready-gudang") {
      return "Produk ready stock harus berstatus ready-gudang.";
    }
    return null;
  }
  const batch = getBatch(item.batchId);
  if (!batch) return null;
  if (!isProductionStatusAllowed(batch.status, item.productionStatus)) {
    return `Status produksi "${item.productionStatus}" tidak diizinkan untuk batch "${batch.name}" (${batch.status}).`;
  }
  return null;
}

// =====================================================================
// PRODUCT
// =====================================================================

export function getProducts(): Product[] {
  return getAll<Product>(KEYS.products);
}

export function getProduct(id: string): Product | undefined {
  return getById<Product>(KEYS.products, id);
}

export function addProduct(product: Product): Product[] {
  return addOne(KEYS.products, product);
}

export function updateProduct(product: Product): Product[] {
  return updateOne(KEYS.products, product);
}

export function deleteProduct(id: string): Product[] {
  return removeOne<Product>(KEYS.products, id);
}

// =====================================================================
// VARIANT
// =====================================================================

export function getVariants(): Variant[] {
  return getAll<Variant>(KEYS.variants);
}

export function getVariantsForProduct(productId: string): Variant[] {
  return getVariants().filter(v => v.productId === productId);
}

export function getVariant(id: string): Variant | undefined {
  return getById<Variant>(KEYS.variants, id);
}

export function addVariant(variant: Variant): Variant[] {
  return addOne(KEYS.variants, variant);
}

export function updateVariant(variant: Variant): Variant[] {
  return updateOne(KEYS.variants, variant);
}

export function deleteVariant(id: string): Variant[] {
  return removeOne<Variant>(KEYS.variants, id);
}

// =====================================================================
// BATCH
// =====================================================================

export function getBatches(): Batch[] {
  return getAll<Batch>(KEYS.batches);
}

export function getBatch(id: string): Batch | undefined {
  return getById<Batch>(KEYS.batches, id);
}

export function addBatch(batch: Batch): Batch[] {
  return addOne(KEYS.batches, batch);
}

export function updateBatch(batch: Batch): Batch[] {
  return updateOne(KEYS.batches, batch);
}

export function deleteBatch(id: string): Batch[] {
  return removeOne<Batch>(KEYS.batches, id);
}

// =====================================================================
// PAYMENT (actual) + PAYMENT DUE (jadwal)
// =====================================================================

export function getPayments(): Payment[] {
  return getAll<Payment>(KEYS.payments);
}

export function getPaymentsForOrder(orderId: string): Payment[] {
  return getPayments().filter(p => p.orderId === orderId);
}

export function addPayment(payment: Payment): Payment[] {
  return addOne(KEYS.payments, payment);
}

export function updatePayment(payment: Payment): Payment[] {
  return updateOne(KEYS.payments, payment);
}

export function deletePayment(id: string): Payment[] {
  return removeOne<Payment>(KEYS.payments, id);
}

export function getPaymentDues(): PaymentDue[] {
  return getAll<PaymentDue>(KEYS.paymentDues);
}

export function getPaymentDuesForOrder(orderId: string): PaymentDue[] {
  return getPaymentDues().filter(d => d.orderId === orderId);
}

export function addPaymentDue(due: PaymentDue): PaymentDue[] {
  return addOne(KEYS.paymentDues, due);
}

export function updatePaymentDue(due: PaymentDue): PaymentDue[] {
  return updateOne(KEYS.paymentDues, due);
}

export function deletePaymentDue(id: string): PaymentDue[] {
  return removeOne<PaymentDue>(KEYS.paymentDues, id);
}

// =====================================================================
// PAYMENT ENGINE — PAYMENT FACT + PAYMENT ALLOCATION (PHASE 1)
// =====================================================================
// Payment adalah ACTUAL MONEY RECEIVED (fakta). Payment BUKAN status
// pembayaran / snapshot DP / order status / marketer fee / shipment status.
//
// Alokasi:
//   - Satu PaymentFact dapat memiliki banyak PaymentAllocation.
//   - Allocation mengarah ke obligation via PaymentAllocationTarget
//     (Product Obligation / Shipping Obligation). Obligation final belum
//     diimplementasikan (Phase 2/4) → hanya abstraction/reference.
//   - Suggestion BUKAN fakta. Hanya allocation yang dikonfirmasi owner
//     menjadi confirmed fact.
//
// Overpayment:
//   total payment - total confirmed allocation = unallocated amount.
//   Jika > 0 → dipertahankan sebagai unallocated (dipakai Phase 3 Deposit).
//   TIDAK otomatis dialokasikan ke order lain. Deposit Engine TIDAK dibuat.
//
// CRITICAL RULES:
//   - Payment boleh belum dialokasikan seluruhnya.
//   - Payment boleh dialokasikan ke beberapa target.
//   - Satu target dapat menerima beberapa payment allocation.
//   - Allocation tidak boleh melebihi payment amount.
//   - Confirmed allocation tidak berubah diam-diam.
//   - Histori payment tidak dihapus.
//   - Payment TIDAK menjadi "paid" hanya karena record dibuat.
// =====================================================================

// ---------------------------------------------------------------------
// PAYMENT FACT CRUD
// ---------------------------------------------------------------------

export function getPaymentFacts(): PaymentFact[] {
  return getAll<PaymentFact>(KEYS.paymentFacts);
}

export function getPaymentFact(id: string): PaymentFact | undefined {
  return getById<PaymentFact>(KEYS.paymentFacts, id);
}

export function getPaymentFactsForCustomer(customerId: string): PaymentFact[] {
  return getPaymentFacts().filter(p => p.customerId === customerId);
}

// Catat payment fact — actual money received. Tidak mengubah status order.
export function addPaymentFact(input: {
  customerId: string;
  amount: number;
  receivedAt: string;
  method?: string;
  reference?: string;
  note?: string;
}): { ok: boolean; reason?: string; payment?: PaymentFact } {
  if (!input.customerId) return { ok: false, reason: "customerId wajib diisi." };
  if (!(input.amount > 0)) return { ok: false, reason: "Jumlah payment harus lebih dari 0." };
  if (!input.receivedAt) return { ok: false, reason: "receivedAt wajib diisi." };

  const now = Date.now();
  const payment: PaymentFact = {
    id: "pfact-" + now + "-" + Math.random().toString(36).slice(2, 7),
    customerId: input.customerId,
    amount: input.amount,
    receivedAt: input.receivedAt,
    method: input.method,
    reference: input.reference,
    note: input.note,
    createdAt: now,
    updatedAt: now,
  };
  addOne(KEYS.paymentFacts, payment);
  return { ok: true, payment };
}

// ---------------------------------------------------------------------
// PAYMENT ALLOCATION CRUD (confirmed facts)
// ---------------------------------------------------------------------

export function getPaymentAllocations(): PaymentAllocation[] {
  return getAll<PaymentAllocation>(KEYS.paymentAllocations);
}

export function getPaymentAllocation(id: string): PaymentAllocation | undefined {
  return getById<PaymentAllocation>(KEYS.paymentAllocations, id);
}

export function getPaymentAllocationsForPayment(paymentId: string): PaymentAllocation[] {
  return getPaymentAllocations().filter(a => a.paymentId === paymentId);
}

export function getPaymentAllocationsForTarget(target: PaymentAllocationTarget): PaymentAllocation[] {
  return getPaymentAllocations().filter(
    a => a.target.type === target.type && a.target.referenceId === target.referenceId
  );
}

// Total confirmed allocation untuk sebuah payment
export function getConfirmedAllocationTotal(paymentId: string): number {
  return getPaymentAllocationsForPayment(paymentId).reduce((sum, a) => sum + a.amount, 0);
}

// Unallocated amount = total payment - total confirmed allocation.
// Jika > 0 → dipertahankan sebagai unallocated (Phase 3 Deposit). Tidak
// otomatis dialokasikan.
export function getUnallocatedAmount(paymentId: string): number {
  const payment = getPaymentFact(paymentId);
  if (!payment) return 0;
  return Math.max(0, payment.amount - getConfirmedAllocationTotal(paymentId));
}

// ---------------------------------------------------------------------
// ALLOCATION SUGGESTION (BUKAN fakta — transient, menunggu review owner)
// ---------------------------------------------------------------------

export function getPaymentAllocationSuggestions(): PaymentAllocationSuggestion[] {
  return getAll<PaymentAllocationSuggestion>(KEYS.paymentAllocationSuggestions);
}

export function getPaymentAllocationSuggestionsForPayment(paymentId: string): PaymentAllocationSuggestion[] {
  return getPaymentAllocationSuggestions()
    .filter(s => s.paymentId === paymentId)
    .sort((a, b) => a.priority - b.priority);
}

export function addPaymentAllocationSuggestion(suggestion: PaymentAllocationSuggestion): PaymentAllocationSuggestion[] {
  return addOne(KEYS.paymentAllocationSuggestions, suggestion);
}

export function clearPaymentAllocationSuggestions(paymentId: string): PaymentAllocationSuggestion[] {
  const list = getPaymentAllocationSuggestions().filter(s => s.paymentId !== paymentId);
  saveAll(KEYS.paymentAllocationSuggestions, list);
  return list;
}

// ---------------------------------------------------------------------
// ALLOCATION PRIORITY (untuk suggestion)
// ---------------------------------------------------------------------
// Priority (1 = tertinggi):
//   1. yang sudah / akan siap dipenuhi
//   2. kewajiban lebih mendesak
//   3. kewajiban tertua
// JANGAN pakai nominal terkecil / FIFO nominal. Owner tetap final.
// Karena Product/Shipping Obligation belum diimplementasikan (Phase 2/4),
// suggestion dibuat dari daftar obligation yang disediakan caller dengan
// metadata readiness/urgency/age. Caller (Phase 2/4) yang menyediakan
// obligation list; Phase 1 hanya mengurutkan sesuai priority rule.

export type ObligationCandidate = {
  target: PaymentAllocationTarget;
  amount: number;
  ready: boolean; // sudah / akan siap dipenuhi
  urgent: boolean; // kewajiban lebih mendesak
  age: number; // umur kewajiban (ms) — tertua lebih tinggi
};

// Urutkan obligation sesuai allocation priority rule.
export function sortObligationsByPriority(candidates: ObligationCandidate[]): ObligationCandidate[] {
  return [...candidates].sort((a, b) => {
    // 1. yang sudah / akan siap dipenuhi
    if (a.ready !== b.ready) return a.ready ? -1 : 1;
    // 2. kewajiban lebih mendesak
    if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
    // 3. kewajiban tertua
    return b.age - a.age;
  });
}

// Buat suggestion dari daftar obligation (dalam urutan priority).
// Suggestion BUKAN fakta — hanya kandidat untuk review owner.
// Tidak melebihi unallocated amount payment.
export function buildAllocationSuggestions(
  paymentId: string,
  candidates: ObligationCandidate[]
): PaymentAllocationSuggestion[] {
  const payment = getPaymentFact(paymentId);
  if (!payment) return [];
  const unallocated = getUnallocatedAmount(paymentId);
  if (unallocated <= 0) return [];

  const ordered = sortObligationsByPriority(candidates);
  const suggestions: PaymentAllocationSuggestion[] = [];
  let remaining = unallocated;

  for (const cand of ordered) {
    if (remaining <= 0) break;
    const amount = Math.min(cand.amount, remaining);
    if (amount <= 0) continue;
    suggestions.push({
      id: "psug-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
      paymentId,
      target: cand.target,
      amount,
      reason: cand.ready
        ? "Kewajiban siap dipenuhi"
        : cand.urgent
          ? "Kewajiban mendesak"
          : "Kewajiban tertua",
      priority: suggestions.length + 1,
      createdAt: Date.now(),
    });
    remaining -= amount;
  }

  return suggestions;
}

// ---------------------------------------------------------------------
// OWNER REVIEW / CONFIRMATION
// ---------------------------------------------------------------------
// Owner dapat:
//   - menerima suggestion
//   - mengubah nominal
//   - mengubah target
//   - membagi ke beberapa target
// Hanya allocation yang dikonfirmasi owner menjadi confirmed fact.
// Confirmed allocation TIDAK berubah diam-diam (immutable setelah dibuat).

// Konfirmasi satu allocation (dari suggestion atau manual owner).
// Validation: total confirmed allocation tidak boleh melebihi payment amount.
export function confirmPaymentAllocation(input: {
  paymentId: string;
  target: PaymentAllocationTarget;
  amount: number;
  reason: string;
  source: "suggestion" | "owner-manual";
}): { ok: boolean; reason?: string; allocation?: PaymentAllocation } {
  const payment = getPaymentFact(input.paymentId);
  if (!payment) return { ok: false, reason: "Payment tidak ditemukan." };
  if (!(input.amount > 0)) return { ok: false, reason: "Jumlah allocation harus lebih dari 0." };
  if (!input.target.referenceId) return { ok: false, reason: "Target allocation wajib diisi." };

  const currentTotal = getConfirmedAllocationTotal(input.paymentId);
  if (currentTotal + input.amount > payment.amount) {
    return {
      ok: false,
      reason: `Allocation melebihi payment. Total allocation (${currentTotal + input.amount}) > payment (${payment.amount}).`,
    };
  }

  // PHASE 2: allocation ke product obligation tidak boleh melebihi kewajiban
  // item. Hanya divalidasi jika target merujuk OrderItem yang benar-benar ada
  // (menjaga Product Obligation integrity; tidak mengubah allocation ke target
  // abstrak yang belum punya obligation).
  if (input.target.type === "product-obligation") {
    const item = getOrderItem(input.target.referenceId);
    if (item) {
      const remaining = getProductObligationRemaining(input.target.referenceId);
      if (input.amount > remaining) {
        return {
          ok: false,
          reason: `Allocation melebihi kewajiban item. Sisa kewajiban item (${remaining}) < allocation (${input.amount}).`,
        };
      }
    }
  }

  // PHASE 4: allocation ke shipping obligation tidak boleh melebihi kewajiban
  // ongkir. Hanya divalidasi jika Shipping Obligation benar-benar ada.
  //   - amount diketahui → allocation ≤ remaining (over-allocation ditolak).
  //   - amount UNKNOWN (null) → ditolak (tidak bisa menentukan ceiling;
  //     jangan menebak / jangan membuat nominal palsu).
  //   - obligation belum ada → target abstrak, tidak divalidasi (konsisten
  //     dengan Phase 1 untuk target yang belum punya obligation).
  if (input.target.type === "shipping-obligation") {
    const shipping = getShippingObligation(input.target.referenceId);
    if (shipping) {
      if (shipping.amount === null) {
        return {
          ok: false,
          reason: "Allocation ke shipping obligation ditolak: nominal ongkir belum diketahui (UNKNOWN).",
        };
      }
      const remaining = getShippingObligationRemaining(input.target.referenceId);
      if (remaining !== null && input.amount > remaining) {
        return {
          ok: false,
          reason: `Allocation melebihi kewajiban ongkir. Sisa kewajiban ongkir (${remaining}) < allocation (${input.amount}).`,
        };
      }
    }
  }

  const now = Date.now();
  const allocation: PaymentAllocation = {

    id: "palloc-" + now + "-" + Math.random().toString(36).slice(2, 7),
    paymentId: input.paymentId,
    target: input.target,
    amount: input.amount,
    provenance: {
      reason: input.reason,
      source: input.source,
    },
    confirmedAt: now,
    createdAt: now,
    updatedAt: now,
  };
  addOne(KEYS.paymentAllocations, allocation);
  return { ok: true, allocation };
}

// Konfirmasi beberapa allocation sekaligus (owner menerima / mengedit
// suggestion, termasuk membagi ke beberapa target). Seluruh batch
// divalidasi terhadap payment amount sebelum disimpan (atomic).
export function confirmPaymentAllocations(inputs: {
  paymentId: string;
  items: {
    target: PaymentAllocationTarget;
    amount: number;
    reason: string;
    source: "suggestion" | "owner-manual";
  }[];
}): { ok: boolean; reason?: string; allocations?: PaymentAllocation[] } {
  const payment = getPaymentFact(inputs.paymentId);
  if (!payment) return { ok: false, reason: "Payment tidak ditemukan." };
  if (inputs.items.length === 0) return { ok: false, reason: "Tidak ada allocation untuk dikonfirmasi." };

  const currentTotal = getConfirmedAllocationTotal(inputs.paymentId);
  const requestedTotal = inputs.items.reduce((sum, it) => sum + it.amount, 0);
  if (currentTotal + requestedTotal > payment.amount) {
    return {
      ok: false,
      reason: `Allocation melebihi payment. Total (${currentTotal + requestedTotal}) > payment (${payment.amount}).`,
    };
  }

  // PHASE 2: validasi allocation ke product obligation (kumulatif dalam batch).
  // Hanya divalidasi jika target merujuk OrderItem yang benar-benar ada.
  const targetTotals = new Map<string, number>();
  for (const it of inputs.items) {
    if (it.target.type === "product-obligation") {
      const item = getOrderItem(it.target.referenceId);
      if (item) {
        const key = it.target.referenceId;
        const prior = targetTotals.get(key) ?? 0;
        const remaining = getProductObligationRemaining(key) - prior;
        if (it.amount > remaining) {
          return {
            ok: false,
            reason: `Allocation melebihi kewajiban item. Sisa kewajiban item (${remaining}) < allocation (${it.amount}).`,
          };
        }
        targetTotals.set(key, prior + it.amount);
      }
    }
  }

  // PHASE 4: validasi allocation ke shipping obligation (kumulatif dalam batch).
  // Hanya divalidasi jika Shipping Obligation benar-benar ada.
  //   - amount diketahui → allocation ≤ remaining (over-allocation ditolak).
  //   - amount UNKNOWN (null) → ditolak (tidak bisa menentukan ceiling).
  //   - obligation belum ada → target abstrak, tidak divalidasi.
  const shippingTotals = new Map<string, number>();
  for (const it of inputs.items) {
    if (it.target.type === "shipping-obligation") {
      const shipping = getShippingObligation(it.target.referenceId);
      if (shipping) {
        if (shipping.amount === null) {
          return {
            ok: false,
            reason: "Allocation ke shipping obligation ditolak: nominal ongkir belum diketahui (UNKNOWN).",
          };
        }
        const key = it.target.referenceId;
        const prior = shippingTotals.get(key) ?? 0;
        const remaining = getShippingObligationRemaining(key);
        if (remaining !== null && it.amount > remaining - prior) {
          return {
            ok: false,
            reason: `Allocation melebihi kewajiban ongkir. Sisa kewajiban ongkir (${remaining - prior}) < allocation (${it.amount}).`,
          };
        }
        shippingTotals.set(key, prior + it.amount);
      }
    }
  }

  const now = Date.now();
  const allocations: PaymentAllocation[] = inputs.items.map(it => ({

    id: "palloc-" + now + "-" + Math.random().toString(36).slice(2, 7),
    paymentId: inputs.paymentId,
    target: it.target,
    amount: it.amount,
    provenance: {
      reason: it.reason,
      source: it.source,
    },
    confirmedAt: now,
    createdAt: now,
    updatedAt: now,
  }));

  for (const alloc of allocations) {
    addOne(KEYS.paymentAllocations, alloc);
  }
  return { ok: true, allocations };
}

// =====================================================================
// PRODUCT OBLIGATION (PHASE 2)
// =====================================================================
// Product Obligation merepresentasikan "customer memiliki kewajiban
// membayar harga item ini." Basis fakta = snapshot harga OrderItem
// (subtotal = finalPrice * qty). TIDAK membuat data harga baru dan TIDAK
// menduplikasi harga — memakai snapshot OrderItem yang sudah ada.
//
// Source of truth:
//   ACTUAL PAYMENT        → PaymentFact (Phase 1)
//   PAYMENT ALLOCATION    → PaymentAllocation (Phase 1)
//   PRODUCT OBLIGATION    → OrderItem snapshot (subtotal)
//   PRODUCT OUTSTANDING   → derived = obligation − confirmed allocations
//   PAYMENT GATE          → derived dari outstanding
//
// Jangan menghitung outstanding dari legacy customer.paid/outstanding,
// order.dp, order.status, ProductStatusCard.paymentStatus, atau UI state.
// Gunakan confirmed PaymentAllocation dari Payment Engine.
//
// Payment gate adalah DERIVED — bukan mutable source-of-truth field.
//   outstanding > 0 → NOT LUNAS
//   outstanding ≤ 0 → LUNAS
// =====================================================================

// Payment gate per item (derived, bukan mutable source-of-truth).
export type ProductPaymentGate = "LUNAS" | "NOT-LUNAS";

// Obligation amount sebuah OrderItem = snapshot harga (subtotal).
// Basis fakta dari OrderItem yang sudah ada — tidak menduplikasi harga.
export function getProductObligationAmount(orderItemId: string): number {
  const item = getOrderItem(orderItemId);
  if (!item) return 0;
  return item.subtotal ?? 0;
}

// Total confirmed PaymentAllocation ke sebuah OrderItem (product obligation).
// Satu item dapat menerima banyak allocation dari banyak payment.
export function getConfirmedProductAllocationTotal(orderItemId: string): number {
  const target: PaymentAllocationTarget = {
    type: "product-obligation",
    referenceId: orderItemId,
  };
  return getPaymentAllocationsForTarget(target).reduce((sum, a) => sum + a.amount, 0);
}

// Outstanding item = obligation − confirmed allocation. Clamp ≥ 0.
// Jika hasil ≤ 0 → item LUNAS. Jika > 0 → item BELUM LUNAS.
export function getProductOutstanding(orderItemId: string): number {
  return Math.max(0, getProductObligationAmount(orderItemId) - getConfirmedProductAllocationTotal(orderItemId));
}

// Payment gate per item (derived). outstanding ≤ 0 → LUNAS.
export function getProductPaymentGate(orderItemId: string): ProductPaymentGate {
  return getProductOutstanding(orderItemId) <= 0 ? "LUNAS" : "NOT-LUNAS";
}

// Apakah item sudah lunas (derived).
export function isProductObligationSettled(orderItemId: string): boolean {
  return getProductPaymentGate(orderItemId) === "LUNAS";
}

// Sisa obligation yang masih dapat menerima allocation (untuk suggestion
// dan validasi over-allocation terhadap target obligation).
export function getProductObligationRemaining(orderItemId: string): number {
  return getProductOutstanding(orderItemId);
}

// =====================================================================
// PRODUCT OBLIGATION SUMMARY (derived, per order)
// =====================================================================
// Menyediakan derived summary tanpa membuat UI baru dan tanpa mengubah
// legacy order summary. Tidak ada entity baru — semua dihitung dari
// OrderItem + confirmed PaymentAllocation.
export type ProductObligationSummary = {
  orderId: string;
  totalObligation: number;
  totalConfirmedAllocation: number;
  totalOutstanding: number;
  itemCount: number;
  settledCount: number; // item lunas
  unsettledCount: number; // item belum lunas
  items: {
    orderItemId: string;
    productName: string;
    obligation: number;
    confirmedAllocation: number;
    outstanding: number;
    paymentGate: ProductPaymentGate;
  }[];
};

export function getProductObligationSummary(orderId: string): ProductObligationSummary {
  const items = getItemsForOrder(orderId);
  const rows = items.map(item => {
    const obligation = getProductObligationAmount(item.id);
    const confirmedAllocation = getConfirmedProductAllocationTotal(item.id);
    const outstanding = Math.max(0, obligation - confirmedAllocation);
    return {
      orderItemId: item.id,
      productName: item.productName,
      obligation,
      confirmedAllocation,
      outstanding,
      paymentGate: (outstanding <= 0 ? "LUNAS" : "NOT-LUNAS") as ProductPaymentGate,
    };
  });
  return {
    orderId,
    totalObligation: rows.reduce((s, r) => s + r.obligation, 0),
    totalConfirmedAllocation: rows.reduce((s, r) => s + r.confirmedAllocation, 0),
    totalOutstanding: rows.reduce((s, r) => s + r.outstanding, 0),
    itemCount: rows.length,
    settledCount: rows.filter(r => r.paymentGate === "LUNAS").length,
    unsettledCount: rows.filter(r => r.paymentGate === "NOT-LUNAS").length,
    items: rows,
  };
}

// =====================================================================
// DEPOSIT / UNAPPLIED BALANCE (PHASE 3)
// =====================================================================
// Deposit adalah "uang customer yang sudah benar-benar diterima tetapi
// belum dialokasikan ke kewajiban tertentu." Deposit BUKAN discount,
// payment palsu, outstanding, refund, marketer fee, order status,
// shipping obligation, atau product obligation.
//
// Source of truth (TIDAK membuat duplicate payment fact / payment baru):
//   ACTUAL PAYMENT        → PaymentFact (Phase 1)
//   CONFIRMED ALLOCATION  → PaymentAllocation (Phase 1)
//   UNAPPLIED / DEPOSIT   → derived = PaymentFact − confirmed allocations
//
// Deposit adalah DERIVED — tidak disimpan sebagai entity mutable yang bisa
// out-of-sync. Setiap deposit dapat ditelusuri ke PaymentFact asal
// (provenance: customerId + paymentId + amount). Tidak ada orphan deposit.
//
// RULES:
//   - Deposit TIDAK otomatis dialokasikan ke order/item lain.
//   - Deposit TIDAK dihitung sebagai payment tambahan (no double count).
//   - Deposit adalah CUSTOMER-OWNED balance (tidak terikat ke satu order).
//   - Unallocated amount BUKAN error — hanya saldo milik customer.
//   - Tidak ada automatic usage / refund / cancellation di Phase 3.
// =====================================================================

// Deposit per source payment (derived). Provenance lengkap ke PaymentFact.
export type DepositSource = {
  paymentId: string;
  customerId: string;
  amount: number; // unallocated amount dari payment ini
  receivedAt: string; // kapan uang diterima (dari PaymentFact)
  createdAt: number; // kapan payment dicatat
};

// Deposit balance customer (derived, aggregate).
export type CustomerDepositBalance = {
  customerId: string;
  total: number; // total available deposit customer
  sources: DepositSource[]; // per-payment provenance (traceable)
};

// Deposit untuk satu payment = unallocated amount payment tersebut.
// Jika payment tidak ada → 0. Tidak pernah negatif.
export function getDepositForPayment(paymentId: string): number {
  return getUnallocatedAmount(paymentId);
}

// Deposit source untuk satu payment (provenance lengkap). Jika payment
// tidak ada atau tidak ada sisa → null (tidak ada orphan deposit).
export function getDepositSourceForPayment(paymentId: string): DepositSource | null {
  const payment = getPaymentFact(paymentId);
  if (!payment) return null;
  const amount = getUnallocatedAmount(paymentId);
  if (amount <= 0) return null;
  return {
    paymentId: payment.id,
    customerId: payment.customerId,
    amount,
    receivedAt: payment.receivedAt,
    createdAt: payment.createdAt,
  };
}

// Semua deposit source milik customer (per payment, traceable).
// Hanya payment yang masih punya sisa unallocated yang muncul.
export function getDepositSourcesForCustomer(customerId: string): DepositSource[] {
  return getPaymentFactsForCustomer(customerId)
    .map(p => getDepositSourceForPayment(p.id))
    .filter((s): s is DepositSource => s !== null);
}

// Total available deposit customer = jumlah seluruh unallocated amount
// dari semua payment customer. Tidak double-count: deposit hanyalah bagian
// payment yang belum dialokasikan, bukan payment tambahan.
export function getCustomerDepositTotal(customerId: string): number {
  return getDepositSourcesForCustomer(customerId).reduce((sum, s) => sum + s.amount, 0);
}

// Deposit balance customer (aggregate + provenance per source payment).
export function getCustomerDepositBalance(customerId: string): CustomerDepositBalance {
  const sources = getDepositSourcesForCustomer(customerId);
  return {
    customerId,
    total: sources.reduce((sum, s) => sum + s.amount, 0),
    sources,
  };
}

// =====================================================================
// DERIVED: PAYMENT / OUTSTANDING
// =====================================================================




// Total yang sudah dibayar (actual) untuk sebuah order
export function getPaidAmount(orderId: string): number {
  return getPaymentsForOrder(orderId).reduce((sum, p) => sum + p.amount, 0);
}

// Outstanding = total order - total dibayar
export function getOutstanding(orderId: string): number {
  const order = getOrder(orderId);
  if (!order) return 0;
  return Math.max(0, order.total - getPaidAmount(orderId));
}

// Payment status derived dari outstanding
export function getPaymentStatus(orderId: string): PaymentStatus {
  const order = getOrder(orderId);
  if (!order) return "belum-bayar";
  const paid = getPaidAmount(orderId);
  if (paid <= 0) return "belum-bayar";
  if (paid >= order.total) return "lunas";
  if (paid === order.dp) return "dp";
  return "lunas-sebagian";
}

// Apakah PaymentDue overdue (dihitung dinamis)
export function isPaymentDueOverdue(due: PaymentDue): boolean {
  if (due.status === "paid") return false;
  const outstanding = getOutstanding(due.orderId);
  if (outstanding <= 0) return false;
  const today = new Date();
  const dueDate = new Date(due.dueDate);
  return dueDate < today;
}

// =====================================================================
// WAREHOUSE
// =====================================================================

export function getWarehouses(): Warehouse[] {
  return getAll<Warehouse>(KEYS.warehouses);
}

export function getWarehouse(id: string): Warehouse | undefined {
  return getById<Warehouse>(KEYS.warehouses, id);
}

export function addWarehouse(warehouse: Warehouse): Warehouse[] {
  return addOne(KEYS.warehouses, warehouse);
}

export function updateWarehouse(warehouse: Warehouse): Warehouse[] {
  return updateOne(KEYS.warehouses, warehouse);
}

export function deleteWarehouse(id: string): Warehouse[] {
  return removeOne<Warehouse>(KEYS.warehouses, id);
}

// =====================================================================
// INVENTORY (stok per gudang)
// =====================================================================
// Stok fisik produk/variant di sebuah warehouse. Terhubung ke Warehouse
// via warehouseId. Bukan sumber kebenaran actual fulfillment — itu tetap
// FulfillmentAllocation.warehouseId.

export function getInventory(): Inventory[] {
  return getAll<Inventory>(KEYS.inventory);
}

export function getInventoryForWarehouse(warehouseId: string): Inventory[] {
  return getInventory().filter(i => i.warehouseId === warehouseId);
}

export function getInventoryForProduct(productId: string): Inventory[] {
  return getInventory().filter(i => i.productId === productId);
}

export function getInventoryForVariant(variantId: string): Inventory[] {
  return getInventory().filter(i => i.variantId === variantId);
}

export function addInventory(item: Inventory): Inventory[] {
  return addOne(KEYS.inventory, item);
}

export function updateInventory(item: Inventory): Inventory[] {
  return updateOne(KEYS.inventory, item);
}

export function deleteInventory(id: string): Inventory[] {
  return removeOne<Inventory>(KEYS.inventory, id);
}

// Total stok sebuah produk di semua gudang
export function getTotalStock(productId: string): number {
  return getInventoryForProduct(productId).reduce((sum, i) => sum + i.quantity, 0);
}

// Stok sebuah produk di gudang tertentu
export function getStockAtWarehouse(warehouseId: string, productId: string): number {
  return getInventoryForWarehouse(warehouseId)
    .filter(i => i.productId === productId)
    .reduce((sum, i) => sum + i.quantity, 0);
}

// =====================================================================
// SHIPPING PREFERENCE (business data, bukan UI state)
// =====================================================================
// Nilai final: belum-ditentukan | tunggu-lengkap | kirim-sebagian.
// Scope: customer-level (orderId = null) + optional order-level override.

export function getShippingPreferences(): ShippingPreference[] {
  return getAll<ShippingPreference>(KEYS.shippingPreferences);
}

// Preference customer-level (orderId = null)
export function getCustomerShippingPreference(customerId: string): ShippingPreference | undefined {
  return getShippingPreferences().find(p => p.customerId === customerId && p.orderId === null);
}

// Preference order-level override (jika ada)
export function getOrderShippingPreference(orderId: string): ShippingPreference | undefined {
  return getShippingPreferences().find(p => p.orderId === orderId);
}

// Preference efektif untuk sebuah order: override order > customer-level
export function getEffectiveShippingPreference(customerId: string, orderId: string): ShippingPreferenceValue {
  const orderPref = getOrderShippingPreference(orderId);
  if (orderPref) return orderPref.value;
  const customerPref = getCustomerShippingPreference(customerId);
  if (customerPref) return customerPref.value;
  return "belum-ditentukan";
}

// Set customer-level preference (upsert)
export function setCustomerShippingPreference(customerId: string, value: ShippingPreferenceValue): ShippingPreference[] {
  const existing = getCustomerShippingPreference(customerId);
  if (existing) {
    return updateShippingPreference({ ...existing, value, updatedAt: Date.now() });
  }
  return addShippingPreference({
    id: "shipref-" + Date.now(),
    customerId,
    value,
    orderId: null,
    updatedAt: Date.now(),
  });
}

// Set order-level override (upsert)
export function setOrderShippingPreference(orderId: string, customerId: string, value: ShippingPreferenceValue): ShippingPreference[] {
  const existing = getOrderShippingPreference(orderId);
  if (existing) {
    return updateShippingPreference({ ...existing, value, updatedAt: Date.now() });
  }
  return addShippingPreference({
    id: "shipref-" + Date.now(),
    customerId,
    value,
    orderId,
    updatedAt: Date.now(),
  });
}

export function addShippingPreference(pref: ShippingPreference): ShippingPreference[] {
  return addOne(KEYS.shippingPreferences, pref);
}

export function updateShippingPreference(pref: ShippingPreference): ShippingPreference[] {
  return updateOne(KEYS.shippingPreferences, pref);
}

export function deleteShippingPreference(id: string): ShippingPreference[] {
  return removeOne<ShippingPreference>(KEYS.shippingPreferences, id);
}

// =====================================================================
// FULFILLMENT ALLOCATION
// =====================================================================

export function getAllocations(): FulfillmentAllocation[] {
  return getAll<FulfillmentAllocation>(KEYS.allocations);
}

export function getAllocationsForItem(orderItemId: string): FulfillmentAllocation[] {
  return getAllocations().filter(a => a.orderItemId === orderItemId);
}

export function getAllocationsForWarehouse(warehouseId: string): FulfillmentAllocation[] {
  return getAllocations().filter(a => a.warehouseId === warehouseId);
}

export function addAllocation(allocation: FulfillmentAllocation): FulfillmentAllocation[] {
  return addOne(KEYS.allocations, allocation);
}

export function updateAllocation(allocation: FulfillmentAllocation): FulfillmentAllocation[] {
  return updateOne(KEYS.allocations, allocation);
}

export function deleteAllocation(id: string): FulfillmentAllocation[] {
  return removeOne<FulfillmentAllocation>(KEYS.allocations, id);
}

// Total quantity yang dialokasikan untuk sebuah order item
export function getAllocatedQuantity(orderItemId: string): number {
  return getAllocationsForItem(orderItemId).reduce((sum, a) => sum + a.quantity, 0);
}

// Status allocation (derived dari ShipmentItem)
export function getAllocationStatus(allocationId: string): AllocationStatus {
  const shipped = getShipmentItems().some(si => si.fulfillmentAllocationId === allocationId);
  return shipped ? "shipped" : "allocated";
}

// =====================================================================
// SHIPMENT + SHIPMENT ITEM (partial shipment)
// =====================================================================

export function getShipments(): Shipment[] {
  return getAll<Shipment>(KEYS.shipments);
}

export function getShipment(id: string): Shipment | undefined {
  return getById<Shipment>(KEYS.shipments, id);
}

export function addShipment(shipment: Shipment): Shipment[] {
  return addOne(KEYS.shipments, shipment);
}

export function updateShipment(shipment: Shipment): Shipment[] {
  return updateOne(KEYS.shipments, shipment);
}

export function deleteShipment(id: string): Shipment[] {
  return removeOne<Shipment>(KEYS.shipments, id);
}

export function getShipmentItems(): ShipmentItem[] {
  return getAll<ShipmentItem>(KEYS.shipmentItems);
}

export function getShipmentItemsForShipment(shipmentId: string): ShipmentItem[] {
  return getShipmentItems().filter(si => si.shipmentId === shipmentId);
}

export function addShipmentItem(item: ShipmentItem): ShipmentItem[] {
  return addOne(KEYS.shipmentItems, item);
}

export function updateShipmentItem(item: ShipmentItem): ShipmentItem[] {
  return updateOne(KEYS.shipmentItems, item);
}

export function deleteShipmentItem(id: string): ShipmentItem[] {
  return removeOne<ShipmentItem>(KEYS.shipmentItems, id);
}

// =====================================================================
// PARTIAL SHIPMENT VALIDATION
// =====================================================================
// ShipmentItem.quantity tidak boleh melebihi allocation.quantity.

export function validateShipmentItem(item: ShipmentItem): string | null {
  const allocation = getById<FulfillmentAllocation>(KEYS.allocations, item.fulfillmentAllocationId);
  if (!allocation) return "Allocation tidak ditemukan.";
  if (item.quantity > allocation.quantity) {
    return `Quantity shipment (${item.quantity}) melebihi allocation (${allocation.quantity}).`;
  }
  // Total yang sudah dikirim dari allocation ini tidak boleh melebihi allocation
  const alreadyShipped = getShipmentItems()
    .filter(si => si.fulfillmentAllocationId === item.fulfillmentAllocationId && si.id !== item.id)
    .reduce((sum, si) => sum + si.quantity, 0);
  if (alreadyShipped + item.quantity > allocation.quantity) {
    return `Total shipment melebihi allocation (${allocation.quantity}).`;
  }
  return null;
}

// =====================================================================
// DERIVED: ORDERS FOR SHIPMENT (dari ShipmentItem, bukan ShipmentOrder)
// =====================================================================

export function getOrdersForShipment(shipmentId: string): Order[] {
  const items = getShipmentItemsForShipment(shipmentId);
  const orderIds = new Set<string>();
  for (const si of items) {
    const oi = getOrderItem(si.orderItemId);
    if (oi) orderIds.add(oi.orderId);
  }
  return getOrders().filter(o => orderIds.has(o.id));
}

// OrderItems yang dikirim dalam shipment
export function getOrderItemsForShipment(shipmentId: string): OrderItem[] {
  const items = getShipmentItemsForShipment(shipmentId);
  return items
    .map(si => getOrderItem(si.orderItemId))
    .filter((oi): oi is OrderItem => Boolean(oi));
}

// =====================================================================
// RESI (multi-resi per shipment)
// =====================================================================

export function getResis(): Resi[] {
  return getAll<Resi>(KEYS.resis);
}

export function getResisForShipment(shipmentId: string): Resi[] {
  return getResis().filter(r => r.shipmentId === shipmentId);
}

export function addResi(resi: Resi): Resi[] {
  return addOne(KEYS.resis, resi);
}

export function updateResi(resi: Resi): Resi[] {
  return updateOne(KEYS.resis, resi);
}

export function deleteResi(id: string): Resi[] {
  return removeOne<Resi>(KEYS.resis, id);
}

// =====================================================================
// MARKETER
// =====================================================================

export function getMarketers(): Marketer[] {
  return getAll<Marketer>(KEYS.marketers);
}

export function getMarketer(id: string): Marketer | undefined {
  return getById<Marketer>(KEYS.marketers, id);
}

export function getActiveMarketers(): Marketer[] {
  return getMarketers().filter(m => m.status === "aktif");
}

export function addMarketer(marketer: Marketer): Marketer[] {
  return addOne(KEYS.marketers, marketer);
}

export function updateMarketer(marketer: Marketer): Marketer[] {
  return updateOne(KEYS.marketers, marketer);
}

export function deleteMarketer(id: string): Marketer[] {
  return removeOne<Marketer>(KEYS.marketers, id);
}

// =====================================================================
// FEE
// =====================================================================

export function getFees(): Fee[] {
  return getAll<Fee>(KEYS.fees);
}

export function getFeesForMarketer(marketerId: string): Fee[] {
  return getFees().filter(f => f.marketerId === marketerId);
}

export function getFeesForOrder(orderId: string): Fee[] {
  return getFees().filter(f => f.orderId === orderId);
}

export function addFee(fee: Fee): Fee[] {
  return addOne(KEYS.fees, fee);
}

export function updateFee(fee: Fee): Fee[] {
  return updateOne(KEYS.fees, fee);
}

export function deleteFee(id: string): Fee[] {
  return removeOne<Fee>(KEYS.fees, id);
}

// =====================================================================
// MARKETER FEE ENGINE (PHASE 7)
// =====================================================================
// Marketer Fee adalah kompensasi marketer atas penjualan. TERPISAH dari:
//   - PaymentFact / PaymentAllocation (actual payment) — fee BUKAN payment.
//   - Order.totalFee (legacy field) — tetap utuh, dipakai consumer legacy.
//   - Fee (legacy entity, order-scoped) — tetap utuh, dipakai consumer legacy.
//
// Aturan final:
//   - Fee dihitung DERIVED dari OrderItem.feeMarketer (snapshot per unit) × qty,
//     lalu disesuaikan dengan outcome cancellation (Phase 6):
//       normal  → fee penuh
//       half    → 50% dari fee normal item tersebut
//       zero    → 0 (refund karena udzur / kesalahan YasLa)
//       pending → fee ditahan (belum dihitung sebagai confirmed)
//   - computeMarketerFeeForOrder adalah PURE/DERIVED — TIDAK menyimpan apa pun,
//     TIDAK mengubah Order / OrderItem / Payment / legacy Fee.
//   - Hanya confirmMarketerFee (owner-controlled) yang membuat MarketerFee fact.
//   - Owner boleh menerima hasil komputasi ATAU menyesuaikan nominal (adjustment).
//   - Fee TIDAK otomatis dibuat saat order dibuat / payment diterima.
//   - Fee TIDAK menghitung dari payment. Fee dihitung dari snapshot item.
//   - Tidak ada dummy/seed. Tidak ada migration. Consumer belum dipindahkan.
// =====================================================================

// ---------------------------------------------------------------------
// MARKETER FEE CRUD (confirmed facts)
// ---------------------------------------------------------------------

export function getMarketerFees(): MarketerFee[] {
  return getAll<MarketerFee>(KEYS.marketerFees);
}

export function getMarketerFee(id: string): MarketerFee | undefined {
  return getById<MarketerFee>(KEYS.marketerFees, id);
}

export function getMarketerFeesForMarketer(marketerId: string): MarketerFee[] {
  return getMarketerFees().filter(f => f.marketerId === marketerId);
}

export function getMarketerFeesForOrder(orderId: string): MarketerFee[] {
  return getMarketerFees().filter(f => f.orderId === orderId);
}

// ---------------------------------------------------------------------
// MARKETER FEE COMPUTATION (PURE / DERIVED — TIDAK menyimpan apa pun)
// ---------------------------------------------------------------------
// Menghitung fee per item dari OrderItem.feeMarketer (snapshot per unit) × qty,
// lalu menyesuaikan dengan outcome cancellation (Phase 6):
//   normal  → fee penuh (feePerUnit * qty)
//   half    → 50% dari fee normal item tersebut
//   zero    → 0
//   pending → fee ditahan (feeAmount = 0 untuk confirmed; ditandai pending)
//
// Fungsi ini TIDAK menyimpan apa pun, TIDAK mengubah Order / OrderItem /
// Payment / legacy Fee. Murni derived — aman dipanggil kapan saja.
// Jika order tidak ditemukan → null. Jika order tidak punya marketer →
// null (tidak ada fee tanpa marketer).
export type ComputedMarketerFee = {
  orderId: string;
  marketerId: string;
  items: {
    orderItemId: string;
    productName: string;
    qty: number;
    feePerUnit: number;
    baseFee: number; // feePerUnit * qty (normal, sebelum outcome)
    outcome: MarketerFeeItemOutcome;
    feeAmount: number; // fee final item setelah outcome
  }[];
  totalFee: number; // sum(feeAmount) — hanya item normal/half/zero
  pendingFee: number; // sum fee item yang masih pending (belum confirmed)
};

export function computeMarketerFeeForOrder(orderId: string): ComputedMarketerFee | null {
  const order = getOrder(orderId);
  if (!order) return null;
  if (!order.marketerId) return null;

  const items = getItemsForOrder(orderId);
  const rows = items.map(item => {
    const feePerUnit = item.feeMarketer ?? 0;
    const qty = item.qty ?? 0;
    const baseFee = feePerUnit * qty;
    const outcome = getCancellationFeeOutcome(item.id).feeOutcomeHint;
    let feeAmount = 0;
    if (outcome === "normal") feeAmount = baseFee;
    else if (outcome === "half") feeAmount = Math.round(baseFee / 2);
    else if (outcome === "zero") feeAmount = 0;
    // pending → feeAmount = 0 (belum dihitung sebagai confirmed)
    return {
      orderItemId: item.id,
      productName: item.productName,
      qty,
      feePerUnit,
      baseFee,
      outcome,
      feeAmount,
    };
  });

  const totalFee = rows.reduce((sum, r) => sum + r.feeAmount, 0);
  const pendingFee = rows
    .filter(r => r.outcome === "pending")
    .reduce((sum, r) => sum + r.baseFee, 0);

  return {
    orderId,
    marketerId: order.marketerId,
    items: rows,
    totalFee,
    pendingFee,
  };
}

// ---------------------------------------------------------------------
// MARKETER FEE CONFIRMATION (owner-controlled — satu-satunya pembuat fact)
// ---------------------------------------------------------------------
// Owner mengonfirmasi fee untuk sebuah order. Secara default memakai hasil
// komputasi (computeMarketerFeeForOrder). Owner boleh menyesuaikan nominal
// per item (adjustment) — hasil edit owner yang menjadi confirmed fact,
// bukan suggestion/komputasi awal.
//
// Validation:
//   - Order harus ada dan punya marketer.
//   - Tidak boleh ada item dengan outcome "pending" yang dihitung sebagai
//     confirmed (fee pending ditahan; owner harus resolve cancellation dulu).
//   - Adjustment tidak boleh negatif.
//   - Satu order hanya boleh memiliki SATU MarketerFee confirmed (upsert).
//   - Fee TIDAK menghitung dari payment. Fee dihitung dari snapshot item.
export function confirmMarketerFee(
  orderId: string,
  adjustments?: { orderItemId: string; feeAmount: number }[]
): { ok: boolean; reason?: string; marketerFee?: MarketerFee } {
  const computed = computeMarketerFeeForOrder(orderId);
  if (!computed) return { ok: false, reason: "Order tidak ditemukan atau tidak memiliki marketer." };

  // Item pending tidak boleh dihitung sebagai confirmed.
  const pendingItems = computed.items.filter(i => i.outcome === "pending");
  if (pendingItems.length > 0) {
    return {
      ok: false,
      reason: "Terdapat item dengan outcome cancellation pending. Resolve cancellation terlebih dahulu sebelum konfirmasi fee.",
    };
  }

  // Terapkan adjustment owner (jika ada). Hasil edit owner yang menjadi fact.
  const adjustmentMap = new Map<string, number>();
  if (adjustments) {
    for (const adj of adjustments) {
      if (!(adj.feeAmount >= 0)) {
        return { ok: false, reason: "Adjustment fee tidak boleh negatif." };
      }
      adjustmentMap.set(adj.orderItemId, adj.feeAmount);
    }
  }

  const items = computed.items.map(i => ({
    orderItemId: i.orderItemId,
    productName: i.productName,
    qty: i.qty,
    feePerUnit: i.feePerUnit,
    baseFee: i.baseFee,
    outcome: i.outcome,
    feeAmount: adjustmentMap.has(i.orderItemId) ? adjustmentMap.get(i.orderItemId)! : i.feeAmount,
  }));
  const totalFee = items.reduce((sum, i) => sum + i.feeAmount, 0);

  const now = Date.now();
  const existing = getMarketerFeesForOrder(orderId)[0];
  const marketerFee: MarketerFee = {
    id: existing ? existing.id : "mfee-" + now + "-" + Math.random().toString(36).slice(2, 7),
    orderId,
    marketerId: computed.marketerId,
    items,
    totalFee,
    status: existing ? existing.status : "belum-diambil",
    paidDate: existing ? existing.paidDate : null,
    provenance: adjustments && adjustments.length > 0 ? "owner-manual" : "owner-confirmed",
    createdAt: existing ? existing.createdAt : now,
    updatedAt: now,
  };

  if (existing) {
    updateOne(KEYS.marketerFees, marketerFee);
  } else {
    addOne(KEYS.marketerFees, marketerFee);
  }
  return { ok: true, marketerFee };
}

// ---------------------------------------------------------------------
// MARKETER FEE STATUS (owner-controlled)
// ---------------------------------------------------------------------
// Tandai fee sudah diambil / belum diambil. Tidak menghapus histori.
export function updateMarketerFeeStatus(
  id: string,
  status: "belum-diambil" | "sudah-diambil",
  paidDate: string | null
): { ok: boolean; reason?: string; marketerFee?: MarketerFee } {
  const existing = getMarketerFee(id);
  if (!existing) return { ok: false, reason: "Marketer Fee tidak ditemukan." };
  const updated: MarketerFee = {
    ...existing,
    status,
    paidDate,
    updatedAt: Date.now(),
  };
  updateOne(KEYS.marketerFees, updated);
  return { ok: true, marketerFee: updated };
}

// ---------------------------------------------------------------------
// MARKETER FEE SUMMARY (derived, per marketer)
// ---------------------------------------------------------------------
// Menyediakan derived summary tanpa membuat UI baru dan tanpa mengubah
// legacy. Tidak ada entity baru — semua dihitung dari MarketerFee facts.
export type MarketerFeeSummary = {
  marketerId: string;
  totalFee: number; // total seluruh confirmed fee
  outstanding: number; // total fee belum diambil
  paid: number; // total fee sudah diambil
  count: number; // jumlah fee record
  fees: MarketerFee[];
};

export function getMarketerFeeSummary(marketerId: string): MarketerFeeSummary {
  const fees = getMarketerFeesForMarketer(marketerId);
  return {
    marketerId,
    totalFee: fees.reduce((sum, f) => sum + f.totalFee, 0),
    outstanding: fees.filter(f => f.status === "belum-diambil").reduce((sum, f) => sum + f.totalFee, 0),
    paid: fees.filter(f => f.status === "sudah-diambil").reduce((sum, f) => sum + f.totalFee, 0),
    count: fees.length,
    fees,
  };
}

// =====================================================================
// COLLECTION + COLLECTION ORDER (many-to-many)
// =====================================================================


export function getCollections(): Collection[] {
  return getAll<Collection>(KEYS.collections).filter(c => c.deletedAt === null);
}

export function getAllCollections(): Collection[] {
  return getAll<Collection>(KEYS.collections);
}

export function getCollection(id: string): Collection | undefined {
  return getById<Collection>(KEYS.collections, id);
}

export function addCollection(collection: Collection): Collection[] {
  return addOne(KEYS.collections, collection);
}

export function updateCollection(collection: Collection): Collection[] {
  return updateOne(KEYS.collections, collection);
}

export function softDeleteCollection(id: string): Collection[] {
  const list = getAll<Collection>(KEYS.collections);
  const updated = list.map(c => (c.id === id ? { ...c, deletedAt: Date.now() } : c));
  saveAll(KEYS.collections, updated);
  return updated;
}

export function getCollectionOrders(): CollectionOrder[] {
  return getAll<CollectionOrder>(KEYS.collectionOrders);
}

export function getOrdersForCollection(collectionId: string): Order[] {
  const rels = getCollectionOrders().filter(r => r.collectionId === collectionId);
  return rels
    .map(r => getOrder(r.orderId))
    .filter((o): o is Order => Boolean(o));
}

export function addOrderToCollection(collectionId: string, orderId: string): CollectionOrder[] {
  const rels = getCollectionOrders();
  if (rels.some(r => r.collectionId === collectionId && r.orderId === orderId)) {
    return rels;
  }
  const updated = [...rels, { id: "colord-" + Date.now(), collectionId, orderId, addedAt: Date.now() }];
  saveAll(KEYS.collectionOrders, updated);
  return updated;
}

export function removeOrderFromCollection(collectionId: string, orderId: string): CollectionOrder[] {
  const rels = getCollectionOrders();
  const updated = rels.filter(r => !(r.collectionId === collectionId && r.orderId === orderId));
  saveAll(KEYS.collectionOrders, updated);
  return updated;
}

// =====================================================================
// ACTIVITY (timeline customer)
// =====================================================================

export function getActivities(): Activity[] {
  return getAll<Activity>(KEYS.activities);
}

export function getActivitiesForCustomer(customerId: string): Activity[] {
  return getActivities()
    .filter(a => a.customerId === customerId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function addActivity(activity: Activity): Activity[] {
  return addOne(KEYS.activities, activity);
}

export function deleteActivity(id: string): Activity[] {
  return removeOne<Activity>(KEYS.activities, id);
}

// =====================================================================
// TASK / REMINDER (agenda manual)
// =====================================================================

export function getTasks(): Task[] {
  return getAll<Task>(KEYS.tasks);
}

export function getTask(id: string): Task | undefined {
  return getById<Task>(KEYS.tasks, id);
}

export function getTasksForCustomer(customerId: string): Task[] {
  return getTasks().filter(t => t.customerId === customerId);
}

export function addTask(task: Task): Task[] {
  return addOne(KEYS.tasks, task);
}

export function updateTask(task: Task): Task[] {
  return updateOne(KEYS.tasks, task);
}

export function deleteTask(id: string): Task[] {
  return removeOne<Task>(KEYS.tasks, id);
}

// Tandai task selesai
export function completeTask(id: string): Task[] {
  const task = getTask(id);
  if (!task) return getTasks();
  return updateTask({ ...task, status: "done", completedAt: new Date().toISOString() });
}

// Apakah task overdue (dihitung dinamis)
export function isTaskOverdue(task: Task): boolean {
  if (task.status === "done") return false;
  const today = new Date();
  const taskDate = new Date(task.date);
  return taskDate < today;
}

// =====================================================================
// DERIVED CALENDAR VIEW
// =====================================================================
// Kalender adalah VIEW yang menggabungkan tanggal dari entity bisnis
// (Batch, PaymentDue, Shipment, Resi) + Task manual. Tidak ada
// CalendarEvent terpisah — tanggal diambil dari sumber aslinya.

export type CalendarEvent = {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  desc?: string;
  type: "batch" | "payment" | "shipment" | "resi" | "task";
  sourceId: string;
  sourceType: string;
  customerId?: string;
  orderId?: string;
  status?: string;
};

function toDateKey(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toISOString().slice(0, 10);
}

// Bangun semua event kalender dari sumber aslinya
export function getCalendarEvents(): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  // Batch.estimatedReady → "Estimasi Ready"
  for (const batch of getBatches()) {
    if (batch.estimatedReady) {
      events.push({
        id: "batch-est-" + batch.id,
        date: toDateKey(batch.estimatedReady),
        title: `Estimasi Ready — ${batch.name}`,
        type: "batch",
        sourceId: batch.id,
        sourceType: "batch",
        status: batch.status,
      });
    }
    // Batch.actualReadyAt → "Ready"
    if (batch.actualReadyAt) {
      events.push({
        id: "batch-act-" + batch.id,
        date: toDateKey(batch.actualReadyAt),
        title: `Ready — ${batch.name}`,
        type: "batch",
        sourceId: batch.id,
        sourceType: "batch",
        status: "selesai",
      });
    }
  }

  // PaymentDue.dueDate → "Jatuh Tempo"
  for (const due of getPaymentDues()) {
    const order = getOrder(due.orderId);
    events.push({
      id: "due-" + due.id,
      date: toDateKey(due.dueDate),
      title: `Jatuh Tempo — ${order ? order.number : "Order"}`,
      desc: `Rp ${due.amount.toLocaleString("id-ID")}`,
      type: "payment",
      sourceId: due.id,
      sourceType: "payment-due",
      customerId: order?.customerId,
      orderId: due.orderId,
      status: due.status,
    });
  }

  // Shipment.shippedAt → "Pengiriman"
  for (const shipment of getShipments()) {
    if (shipment.shippedAt) {
      const orders = getOrdersForShipment(shipment.id);
      events.push({
        id: "ship-" + shipment.id,
        date: toDateKey(shipment.shippedAt),
        title: `Pengiriman — ${orders.map(o => o.number).join(", ") || "Shipment"}`,
        desc: shipment.courier,
        type: "shipment",
        sourceId: shipment.id,
        sourceType: "shipment",
        customerId: orders[0]?.customerId,
        status: shipment.status,
      });
    }
  }

  // Resi.date → "Resi"
  for (const resi of getResis()) {
    events.push({
      id: "resi-" + resi.id,
      date: toDateKey(resi.date),
      title: `Resi ${resi.number}`,
      desc: resi.courier,
      type: "resi",
      sourceId: resi.id,
      sourceType: "resi",
      status: resi.status,
    });
  }

  // Task.date → agenda manual
  for (const task of getTasks()) {
    events.push({
      id: "task-" + task.id,
      date: toDateKey(task.date),
      title: task.title,
      desc: task.note,
      type: "task",
      sourceId: task.id,
      sourceType: "task",
      customerId: task.customerId,
      orderId: task.orderId,
      status: task.status,
    });
  }

  return events;
}

// Event untuk tanggal tertentu
export function getCalendarEventsForDate(dateKey: string): CalendarEvent[] {
  return getCalendarEvents().filter(e => e.date === dateKey);
}

// =====================================================================
// DASHBOARD INTEGRATION (TODAY / UPCOMING / OVERDUE)
// =====================================================================
// Semua angka dihitung dari central store, bukan hardcode.

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export type DashboardToday = {
  paymentsDueToday: CalendarEvent[];
  paymentsOverdue: CalendarEvent[];
  batchesReadyToday: CalendarEvent[];
  tasksToday: CalendarEvent[];
  tasksOverdue: CalendarEvent[];
  shipmentsToProcess: CalendarEvent[];
};

export function getDashboardToday(): DashboardToday {
  const today = todayKey();
  const events = getCalendarEvents();

  return {
    paymentsDueToday: events.filter(e => e.type === "payment" && e.date === today && e.status !== "paid"),
    paymentsOverdue: events.filter(e => e.type === "payment" && e.date < today && e.status !== "paid"),
    batchesReadyToday: events.filter(e => e.type === "batch" && e.date === today && e.sourceType === "batch" && e.status !== "selesai"),
    tasksToday: events.filter(e => e.type === "task" && e.date === today && e.status !== "done"),
    tasksOverdue: events.filter(e => e.type === "task" && e.date < today && e.status !== "done"),
    shipmentsToProcess: events.filter(e => e.type === "shipment" && e.date === today),
  };
}

export type DashboardUpcoming = {
  batches: CalendarEvent[];
  payments: CalendarEvent[];
  tasks: CalendarEvent[];
  shipments: CalendarEvent[];
};

export function getDashboardUpcoming(days: number = 7): DashboardUpcoming {
  const today = todayKey();
  const limit = new Date();
  limit.setDate(limit.getDate() + days);
  const limitKey = limit.toISOString().slice(0, 10);
  const events = getCalendarEvents();

  const inRange = (e: CalendarEvent) => e.date >= today && e.date <= limitKey;

  return {
    batches: events.filter(e => e.type === "batch" && inRange(e) && e.status !== "selesai"),
    payments: events.filter(e => e.type === "payment" && inRange(e) && e.status !== "paid"),
    tasks: events.filter(e => e.type === "task" && inRange(e) && e.status !== "done"),
    shipments: events.filter(e => e.type === "shipment" && inRange(e)),
  };
}

// =====================================================================
// DERIVED: CUSTOMER WORKSPACE (dari sumber asli, tanpa tanggal baru)
// =====================================================================

export type CustomerWorkspaceData = {
  customer: Customer;
  orders: Order[];
  items: OrderItem[];
  payments: Payment[];
  paymentDues: PaymentDue[];
  shipments: Shipment[];
  resis: Resi[];
  tasks: Task[];
  activities: Activity[];
  addresses: Address[];
  outstanding: number;
  paymentStatus: PaymentStatus;
};

export function getCustomerWorkspace(customerId: string): CustomerWorkspaceData | null {
  const customer = getCustomer(customerId);
  if (!customer) return null;

  const orders = getOrdersForCustomer(customerId);
  const orderIds = new Set(orders.map(o => o.id));
  const items = getOrderItems().filter(i => orderIds.has(i.orderId));
  const payments = getPayments().filter(p => orderIds.has(p.orderId));
  const paymentDues = getPaymentDues().filter(d => orderIds.has(d.orderId));

  // Shipment yang terkait customer (via order items)
  const itemIds = new Set(items.map(i => i.id));
  const shipmentItems = getShipmentItems().filter(si => itemIds.has(si.orderItemId));
  const shipmentIds = new Set(shipmentItems.map(si => si.shipmentId));
  const shipments = getShipments().filter(s => shipmentIds.has(s.id));
  const resis = getResis().filter(r => shipmentIds.has(r.shipmentId));

  const tasks = getTasksForCustomer(customerId);
  const activities = getActivitiesForCustomer(customerId);
  const addresses = getCustomerAddresses(customerId);

  const outstanding = orders.reduce((sum, o) => sum + getOutstanding(o.id), 0);
  const paymentStatus = orders.length > 0 ? getPaymentStatus(orders[0].id) : "belum-bayar";

  return {
    customer,
    orders,
    items,
    payments,
    paymentDues,
    shipments,
    resis,
    tasks,
    activities,
    addresses,
    outstanding,
    paymentStatus,
  };
}

// =====================================================================
// OPERATIONAL STATE ENGINE (Tahap 2)
// =====================================================================
// Satu-satunya sumber kebenaran untuk kondisi operasional.
// Semua derived state berasal dari central.ts — TIDAK ada perhitungan
// kedua di UI. Business logic final DIKUNCI (tidak diinterpretasi ulang).
//
// Empat konsep tetap berbeda:
//   1. BOLEH PACKING
//   2. KANDIDAT SHIPMENT
//   3. BOLEH DIKIRIM
//   4. SHIPMENT SUDAH DIBUAT
//
// Payment gate (PHASE 9 — source of truth = Phase 2 getProductPaymentGate /
// Phase 8 getOrderItemFulfillmentState):
//   DP ≠ LUNAS. DP → NOT-LUNAS → BLOCKED_BY_PAYMENT → TIDAK boleh packing,
//   TIDAK boleh kandidat shipment.
//   Hanya LUNAS / SETTLED yang boleh eligible packing, packing, shipment.
//   getPaymentStatus (legacy) tetap ada untuk display/compatibility, tetapi
//   TIDAK lagi menjadi penentu packing/shipment/fulfillment.
//   overdue → keputusan kirim/tahan manual oleh owner
//
// Warehouse:
//   Bekasi      → HANYA Boardbook Anak PO
//   Purwakarta  → semua produk lainnya (Jilbab, Manset, dll)
//   Actual warehouse → FulfillmentAllocation.warehouseId
//   Product.defaultWarehouseId → hanya default allocation awal
//   Warehouse berbeda → shipment berbeda, ongkir berbeda
//
// Shipping Preference (customer-level + order override):
//   belum-ditentukan | tunggu-lengkap | kirim-sebagian
// =====================================================================

// =====================================================================
// 1. ITEM CONDITION ENGINE
// =====================================================================

export type ItemCondition = {
  orderItemId: string;
  orderId: string;
  productName: string;
  emoji: string;
  qty: number;
  productionCondition: ProductionStatus;
  fulfillmentCondition: FulfillmentStatus;
  paymentGate: PaymentStatus;
  shipmentCondition: string;
  blocker: string | null;
  nextAction: string;
  canPack: boolean;
  canBeShipmentCandidate: boolean;
  remainingAllocation: number;
  warehouseId: string | null;
  courier: string | null;
};

// Sisa allocation yang belum masuk shipment:
//   remaining = allocation.quantity - SUM(ShipmentItem.quantity utk allocation tsb)
export function getRemainingAllocation(orderItemId: string): number {
  const allocations = getAllocationsForItem(orderItemId).filter(a => !a.releasedAt);
  let remaining = 0;
  for (const alloc of allocations) {
    const shipped = getShipmentItems()
      .filter(si => si.fulfillmentAllocationId === alloc.id)
      .reduce((sum, si) => sum + si.quantity, 0);
    remaining += Math.max(0, alloc.quantity - shipped);
  }
  return remaining;
}

// Warehouse aktual dari allocation (sumber kebenaran actual)
export function getItemWarehouse(orderItemId: string): string | null {
  const allocations = getAllocationsForItem(orderItemId).filter(a => !a.releasedAt);
  if (allocations.length === 0) return null;
  return allocations[0].warehouseId;
}

// Courier aktual dari shipment yang sudah dibuat untuk item ini
export function getItemCourier(orderItemId: string): string | null {
  const shipmentItems = getShipmentItems().filter(si => si.orderItemId === orderItemId);
  if (shipmentItems.length === 0) return null;
  const shipment = getShipment(shipmentItems[0].shipmentId);
  return shipment ? shipment.courier : null;
}

// Kondisi operasional satu OrderItem
export function getItemCondition(orderItemId: string): ItemCondition | null {
  const item = getOrderItem(orderItemId);
  if (!item) return null;
  const order = getOrder(item.orderId);
  if (!order) return null;

  // PHASE 9: payment gate fulfillment memakai Phase 8 getOrderItemFulfillmentState
  // (source of truth = Phase 2 getProductPaymentGate). DP ≠ LUNAS → DP tidak
  // boleh packing / shipment. getPaymentStatus (legacy) tetap untuk display.
  const paymentGate = getPaymentStatus(order.id); // legacy, display only
  const productionReady = item.productionStatus === "ready-gudang";
  const fulfillmentState = getOrderItemFulfillmentState(orderItemId); // Phase 8 source of truth
  const fulfillmentEligible = fulfillmentState === "ELIGIBLE_FOR_PACKING";
  const alreadyPacked = item.fulfillmentStatus === "sudah-packing" || item.fulfillmentStatus === "menunggu-kurir";
  const remainingAllocation = getRemainingAllocation(orderItemId);
  const warehouseId = getItemWarehouse(orderItemId);
  const courier = getItemCourier(orderItemId);

  // BOLEH PACKING: Phase 8 ELIGIBLE_FOR_PACKING (READY + LUNAS, tidak hold) + belum selesai packing
  const canPack = fulfillmentEligible && !alreadyPacked;

  // KANDIDAT SHIPMENT: sudah packing + Phase 8 ELIGIBLE_FOR_PACKING + remaining allocation > 0
  const canBeShipmentCandidate = alreadyPacked && fulfillmentEligible && remainingAllocation > 0;

  // Blocker & next action
  let blocker: string | null = null;
  let nextAction = "Tidak ada";
  let shipmentCondition = "belum-dibuat";

  if (!productionReady) {
    if (item.productionStatus === "masih-diproduksi") {
      blocker = "Masih diproduksi";
      nextAction = "Tunggu produksi";
      shipmentCondition = "menunggu-produksi";
    } else if (item.productionStatus === "proses-qc") {
      blocker = "Menunggu QC";
      nextAction = "Tunggu QC";
      shipmentCondition = "menunggu-qc";
    } else {
      blocker = "Belum ready";
      nextAction = "Tunggu produksi";
      shipmentCondition = "belum-ready";
    }
  } else if (fulfillmentState === "BLOCKED_BY_PAYMENT") {
    blocker = "Belum bayar";
    nextAction = "Tagih pelunasan";
    shipmentCondition = "menunggu-pembayaran";
  } else if (fulfillmentState === "HOLD_FOR_COMBINATION") {
    blocker = "Menunggu digabung";
    nextAction = "Tunggu produk lengkap";
    shipmentCondition = "menunggu-penggabungan";
  } else if (!alreadyPacked) {
    nextAction = "Packing";
    shipmentCondition = "siap-packing";
  } else if (canBeShipmentCandidate) {
    nextAction = "Buat Shipment";
    shipmentCondition = "kandidat-shipment";
  } else if (remainingAllocation === 0) {
    nextAction = "Input Resi";
    shipmentCondition = "sudah-dibuat";
  }

  return {
    orderItemId,
    orderId: item.orderId,
    productName: item.productName,
    emoji: item.emoji,
    qty: item.qty,
    productionCondition: item.productionStatus,
    fulfillmentCondition: item.fulfillmentStatus,
    paymentGate,
    shipmentCondition,
    blocker,
    nextAction,
    canPack,
    canBeShipmentCandidate,
    remainingAllocation,
    warehouseId,
    courier,
  };
}

// =====================================================================
// 2. ORDER CONDITION ENGINE
// =====================================================================

export type OrderCondition = {
  orderId: string;
  orderNumber: string;
  customerId: string;
  items: ItemCondition[];
  allItemsReady: boolean;
  anyItemReady: boolean;
  anyItemPacked: boolean;
  anyItemCanPack: boolean;
  anyItemShipmentCandidate: boolean;
  anyItemBlocked: boolean;
  paymentGate: PaymentStatus;
  shippingPreference: ShippingPreferenceValue;
};

// Agregasi kondisi seluruh OrderItem dalam satu order.
// Item condition TIDAK boleh hilang — semua tetap tersedia di items[].
export function getOrderCondition(orderId: string): OrderCondition | null {
  const order = getOrder(orderId);
  if (!order) return null;
  const items = getItemsForOrder(orderId)
    .map(i => getItemCondition(i.id))
    .filter((c): c is ItemCondition => Boolean(c));

  const allItemsReady = items.length > 0 && items.every(i => i.productionCondition === "ready-gudang");
  const anyItemReady = items.some(i => i.productionCondition === "ready-gudang");
  const anyItemPacked = items.some(i => i.fulfillmentCondition === "sudah-packing" || i.fulfillmentCondition === "menunggu-kurir");
  const anyItemCanPack = items.some(i => i.canPack);
  const anyItemShipmentCandidate = items.some(i => i.canBeShipmentCandidate);
  const anyItemBlocked = items.some(i => i.blocker !== null);

  return {
    orderId,
    orderNumber: order.number,
    customerId: order.customerId,
    items,
    allItemsReady,
    anyItemReady,
    anyItemPacked,
    anyItemCanPack,
    anyItemShipmentCandidate,
    anyItemBlocked,
    paymentGate: getPaymentStatus(orderId),
    shippingPreference: getEffectiveShippingPreference(order.customerId, orderId),
  };
}

// =====================================================================
// 3. PRIMARY CONDITION ENGINE
// =====================================================================

export type PrimaryCondition =
  | "BERMASALAH"
  | "PERLU DITAGIH"
  | "KEPUTUSAN PENGIRIMAN DIPERLUKAN"
  | "MENUNGGU PRODUK LENGKAP"
  | "SIAP DIBUAT SHIPMENT"
  | "BISA DIKIRIM SEBAGIAN"
  | "SIAP PACKING"
  | "MENUNGGU QC / PRODUKSI / PEMBAYARAN"
  | "DALAM PENGIRIMAN / MENUNGGU RESI"
  | "SELESAI";

// SATU order hanya boleh memiliki SATU primary condition.
// Prioritas final (1 = tertinggi):
//   1. BERMASALAH
//   2. PERLU DITAGIH
//   3. KEPUTUSAN PENGIRIMAN DIPERLUKAN
//   4. MENUNGGU PRODUK LENGKAP
//   5. SIAP DIBUAT SHIPMENT
//   6. BISA DIKIRIM SEBAGIAN
//   7. SIAP PACKING
//   8. MENUNGGU QC / PRODUKSI / PEMBAYARAN
//   9. DALAM PENGIRIMAN / MENUNGGU RESI
//   10. SELESAI
export function getPrimaryCondition(orderId: string): PrimaryCondition {
  const cond = getOrderCondition(orderId);
  if (!cond) return "SELESAI";

  const { items, allItemsReady, anyItemReady, anyItemPacked, anyItemCanPack, anyItemShipmentCandidate, paymentGate, shippingPreference } = cond;

  // 1. BERMASALAH — ada item bermasalah (retur/bermasalah)
  const hasProblem = items.some(i => i.shipmentCondition === "bermasalah");
  if (hasProblem) return "BERMASALAH";

  // 2. PERLU DITAGIH — ada outstanding (belum bayar / dp / lunas sebagian)
  if (paymentGate === "belum-bayar" || paymentGate === "dp" || paymentGate === "lunas-sebagian") {
    return "PERLU DITAGIH";
  }

  // 3. KEPUTUSAN PENGIRIMAN DIPERLUKAN — sebagian ready + preference belum ditentukan
  if (!allItemsReady && anyItemReady && shippingPreference === "belum-ditentukan") {
    return "KEPUTUSAN PENGIRIMAN DIPERLUKAN";
  }

  // 4. MENUNGGU PRODUK LENGKAP — preference tunggu lengkap + sebagian belum ready
  if (!allItemsReady && shippingPreference === "tunggu-lengkap") {
    return "MENUNGGU PRODUK LENGKAP";
  }

  // 5. SIAP DIBUAT SHIPMENT — semua item siap shipment (full)
  if (allItemsReady && anyItemShipmentCandidate && items.every(i => i.canBeShipmentCandidate || i.remainingAllocation === 0)) {
    return "SIAP DIBUAT SHIPMENT";
  }

  // 6. BISA DIKIRIM SEBAGIAN — sebagian item siap shipment (kirim sebagian)
  if (anyItemShipmentCandidate && shippingPreference === "kirim-sebagian") {
    return "BISA DIKIRIM SEBAGIAN";
  }

  // 7. SIAP PACKING — ada item siap packing
  if (anyItemCanPack) {
    return "SIAP PACKING";
  }

  // 8. MENUNGGU QC / PRODUKSI / PEMBAYARAN — ada item menunggu
  if (items.some(i => i.blocker !== null)) {
    return "MENUNGGU QC / PRODUKSI / PEMBAYARAN";
  }

  // 9. DALAM PENGIRIMAN / MENUNGGU RESI — ada shipment dibuat
  if (anyItemPacked && items.some(i => i.shipmentCondition === "sudah-dibuat")) {
    return "DALAM PENGIRIMAN / MENUNGGU RESI";
  }

  // 10. SELESAI
  return "SELESAI";
}

// =====================================================================
// 4. SECONDARY SIGNAL / BLOCKER
// =====================================================================

export type SecondarySignal = {
  type: string;
  label: string;
  count: number;
};

// Kondisi yang tidak menjadi primary tetap tersedia sebagai konteks.
// Order TIDAK muncul dua kali di work queue karena secondary condition.
export function getSecondarySignals(orderId: string): SecondarySignal[] {
  const cond = getOrderCondition(orderId);
  if (!cond) return [];
  const signals: SecondarySignal[] = [];

  const readyCount = cond.items.filter(i => i.productionCondition === "ready-gudang").length;
  const packedCount = cond.items.filter(i => i.fulfillmentCondition === "sudah-packing" || i.fulfillmentCondition === "menunggu-kurir").length;
  const canPackCount = cond.items.filter(i => i.canPack).length;
  const shipmentCandidateCount = cond.items.filter(i => i.canBeShipmentCandidate).length;
  const waitingCount = cond.items.filter(i => i.blocker !== null).length;

  if (readyCount > 0) signals.push({ type: "ready", label: "item siap", count: readyCount });
  if (canPackCount > 0) signals.push({ type: "pack", label: "item siap packing", count: canPackCount });
  if (shipmentCandidateCount > 0) signals.push({ type: "shipment", label: "item siap shipment", count: shipmentCandidateCount });
  if (packedCount > 0) signals.push({ type: "packed", label: "item sudah packing", count: packedCount });
  if (waitingCount > 0) signals.push({ type: "waiting", label: "item menunggu", count: waitingCount });

  return signals;
}

// =====================================================================
// 5. NEXT ACTION
// =====================================================================

export type NextAction =
  | "Tagih pelunasan"
  | "Packing"
  | "Buat Shipment"
  | "Input Resi"
  | "Resolve"
  | "Tunggu produksi"
  | "Tunggu QC"
  | "Keputusan pengiriman"
  | "Tidak ada";

// Satu primary action yang paling relevan.
// Jangan memberikan action yang belum valid dilakukan.
export function getNextAction(orderId: string): NextAction {
  const primary = getPrimaryCondition(orderId);
  const cond = getOrderCondition(orderId);

  switch (primary) {
    case "BERMASALAH":
      return "Resolve";
    case "PERLU DITAGIH":
      return "Tagih pelunasan";
    case "KEPUTUSAN PENGIRIMAN DIPERLUKAN":
      return "Keputusan pengiriman";
    case "MENUNGGU PRODUK LENGKAP":
      return "Tunggu produksi";
    case "SIAP DIBUAT SHIPMENT":
    case "BISA DIKIRIM SEBAGIAN":
      return "Buat Shipment";
    case "SIAP PACKING":
      return "Packing";
    case "MENUNGGU QC / PRODUKSI / PEMBAYARAN":
      if (cond && cond.items.some(i => i.productionCondition === "proses-qc")) return "Tunggu QC";
      return "Tunggu produksi";
    case "DALAM PENGIRIMAN / MENUNGGU RESI":
      return "Input Resi";
    case "SELESAI":
      return "Tidak ada";
  }
}

// =====================================================================
// 6. PACKING CANDIDATE
// =====================================================================

export type PackingCandidate = {
  orderItemId: string;
  orderId: string;
  orderNumber: string;
  customerId: string;
  productName: string;
  emoji: string;
  qty: number;
  warehouseId: string | null;
};

// Gate (PHASE 9): Phase 8 ELIGIBLE_FOR_PACKING (READY + LUNAS, tidak hold)
// + fulfillment belum selesai. DP ≠ LUNAS → DP TIDAK boleh packing.
// Belum bayar / masih produksi / QC / hold → TIDAK boleh.
export function getPackingCandidates(): PackingCandidate[] {
  const candidates: PackingCandidate[] = [];
  for (const item of getOrderItems()) {
    const cond = getItemCondition(item.id);
    if (!cond || !cond.canPack) continue;
    const order = getOrder(item.orderId);
    if (!order) continue;
    candidates.push({
      orderItemId: item.id,
      orderId: item.orderId,
      orderNumber: order.number,
      customerId: order.customerId,
      productName: item.productName,
      emoji: item.emoji,
      qty: item.qty,
      warehouseId: cond.warehouseId,
    });
  }
  return candidates;
}

// =====================================================================
// 7. SHIPMENT CANDIDATE
// =====================================================================

export type ShipmentCandidate = {
  orderItemId: string;
  orderId: string;
  orderNumber: string;
  customerId: string;
  productName: string;
  emoji: string;
  qty: number;
  remainingAllocation: number;
  warehouseId: string | null;
  courier: string | null;
};

// Gate (PHASE 9): production ready + sudah packing + Phase 8 ELIGIBLE_FOR_PACKING
//       (LUNAS, tidak hold) + remaining allocation > 0 + shipping preference
//       memenuhi + courier + warehouse. DP ≠ LUNAS → DP TIDAK boleh shipment.
// Quantity yang sudah masuk shipment TIDAK muncul lagi (via remaining allocation).
export function getShipmentCandidates(): ShipmentCandidate[] {
  const candidates: ShipmentCandidate[] = [];
  for (const item of getOrderItems()) {
    const cond = getItemCondition(item.id);
    if (!cond || !cond.canBeShipmentCandidate) continue;
    const order = getOrder(item.orderId);
    if (!order) continue;
    candidates.push({
      orderItemId: item.id,
      orderId: item.orderId,
      orderNumber: order.number,
      customerId: order.customerId,
      productName: item.productName,
      emoji: item.emoji,
      qty: item.qty,
      remainingAllocation: cond.remainingAllocation,
      warehouseId: cond.warehouseId,
      courier: cond.courier,
    });
  }
  return candidates;
}

// =====================================================================
// 8. CANDIDATE GROUPING (per warehouse)
// =====================================================================

export type ShipmentCandidateGroup = {
  customerId: string;
  warehouseId: string;
  courier: string | null;
  items: ShipmentCandidate[];
  totalRemaining: number;
};

// Candidate hanya dikelompokkan jika: customer sama + warehouse sama + courier sama.
// Warehouse berbeda → WAJIB group berbeda.
export function getShipmentCandidatesByWarehouse(): ShipmentCandidateGroup[] {
  const candidates = getShipmentCandidates();
  const groups: ShipmentCandidateGroup[] = [];

  for (const cand of candidates) {
    const key = `${cand.customerId}|${cand.warehouseId}|${cand.courier ?? "none"}`;
    let group = groups.find(g => `${g.customerId}|${g.warehouseId}|${g.courier ?? "none"}` === key);
    if (!group) {
      group = {
        customerId: cand.customerId,
        warehouseId: cand.warehouseId ?? "",
        courier: cand.courier,
        items: [],
        totalRemaining: 0,
      };
      groups.push(group);
    }
    group.items.push(cand);
    group.totalRemaining += cand.remainingAllocation;
  }

  return groups;
}

// =====================================================================
// 9. SHIPPING PREFERENCE LOGIC
// =====================================================================
// Implementasi logic preference (dipakai oleh primary condition):
//   Semua item ready + Belum Ditentukan → full shipment candidate boleh.
//   Sebagian item ready + Belum Ditentukan → KEPUTUSAN PENGIRIMAN DIPERLUKAN.
//   Tunggu Lengkap + sebagian belum ready → MENUNGGU PRODUK LENGKAP.
//   Kirim Sebagian + item memenuhi seluruh gate → candidate shipment.
// (Logic ini sudah diimplementasikan di getPrimaryCondition.)

// =====================================================================
// 10. CALENDAR DERIVED ENGINE
// =====================================================================
// getCalendarEvents() sudah ada di atas (sumber: Batch.estimatedReady,
// Batch.actualReadyAt, PaymentDue.dueDate, Shipment.shippedAt, Resi.date,
// Task.date). Tidak ada CalendarEvent entity terpisah.

// =====================================================================
// 11. DASHBOARD DERIVED DATA
// =====================================================================

export type WorkQueueItem = {
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  primaryCondition: PrimaryCondition;
  nextAction: NextAction;
  secondarySignals: SecondarySignal[];
};

export type DashboardWorkQueue = {
  perluTindakan: WorkQueueItem[];
  bisaDikerjakan: WorkQueueItem[];
  segera: WorkQueueItem[];
  menunggu: WorkQueueItem[];
  ringkasan: WorkQueueItem[];
};

// Satu order hanya masuk SATU primary queue.
export function getDashboardWorkQueue(): DashboardWorkQueue {
  const queue: DashboardWorkQueue = {
    perluTindakan: [],
    bisaDikerjakan: [],
    segera: [],
    menunggu: [],
    ringkasan: [],
  };

  for (const order of getOrders()) {
    const primary = getPrimaryCondition(order.id);
    const customer = getCustomer(order.customerId);
    const item: WorkQueueItem = {
      orderId: order.id,
      orderNumber: order.number,
      customerId: order.customerId,
      customerName: customer ? customer.name : "—",
      primaryCondition: primary,
      nextAction: getNextAction(order.id),
      secondarySignals: getSecondarySignals(order.id),
    };

    switch (primary) {
      case "BERMASALAH":
      case "PERLU DITAGIH":
      case "KEPUTUSAN PENGIRIMAN DIPERLUKAN":
        queue.perluTindakan.push(item);
        break;
      case "SIAP DIBUAT SHIPMENT":
      case "BISA DIKIRIM SEBAGIAN":
      case "SIAP PACKING":
        queue.bisaDikerjakan.push(item);
        break;
      case "DALAM PENGIRIMAN / MENUNGGU RESI":
        queue.segera.push(item);
        break;
      case "MENUNGGU QC / PRODUKSI / PEMBAYARAN":
      case "MENUNGGU PRODUK LENGKAP":
        queue.menunggu.push(item);
        break;
      case "SELESAI":
        queue.ringkasan.push(item);
        break;
    }
  }

  return queue;
}

// =====================================================================
// 12. CUSTOMER WORKSPACE DERIVED DATA
// =====================================================================
// getCustomerWorkspace(customerId) sudah ada di atas dan mengambil data
// dari central entity + operational engine yang sama. Tidak ada
// perhitungan kedua khusus Customer Workspace.

// =====================================================================
// FORMAT HELPERS
// =====================================================================

export const formatRupiah = (value: number) => "Rp " + value.toLocaleString("id-ID");

// =====================================================================
// FULFILLMENT DECISION CRUD
// =====================================================================
// Keputusan operasional owner terhadap kandidat shipment.
// TERPISAH dari ShippingPreference (lihat definisi entity di atas).

export function getFulfillmentDecisions(): FulfillmentDecision[] {
  return getAll<FulfillmentDecision>(KEYS.fulfillmentDecisions);
}

// Decision customer-level (orderId = null)
export function getCustomerFulfillmentDecision(customerId: string): FulfillmentDecision | undefined {
  return getFulfillmentDecisions().find(d => d.customerId === customerId && d.orderId === null);
}

// Decision order-level override (jika ada)
export function getOrderFulfillmentDecision(orderId: string): FulfillmentDecision | undefined {
  return getFulfillmentDecisions().find(d => d.orderId === orderId);
}

// Decision efektif untuk sebuah order: override order > customer-level
export function getEffectiveFulfillmentDecision(customerId: string, orderId: string): FulfillmentDecisionValue | null {
  const orderDecision = getOrderFulfillmentDecision(orderId);
  if (orderDecision) return orderDecision.value;
  const customerDecision = getCustomerFulfillmentDecision(customerId);
  if (customerDecision) return customerDecision.value;
  return null;
}

export function addFulfillmentDecision(decision: FulfillmentDecision): FulfillmentDecision[] {
  return addOne(KEYS.fulfillmentDecisions, decision);
}

export function updateFulfillmentDecision(decision: FulfillmentDecision): FulfillmentDecision[] {
  return updateOne(KEYS.fulfillmentDecisions, decision);
}

export function deleteFulfillmentDecision(id: string): FulfillmentDecision[] {
  return removeOne<FulfillmentDecision>(KEYS.fulfillmentDecisions, id);
}

// Set customer-level decision (upsert)
export function setCustomerFulfillmentDecision(
  customerId: string,
  value: FulfillmentDecisionValue,
  note?: string
): FulfillmentDecision[] {
  const existing = getCustomerFulfillmentDecision(customerId);
  if (existing) {
    return updateFulfillmentDecision({ ...existing, value, note, updatedAt: Date.now() });
  }
  return addFulfillmentDecision({
    id: "fulldec-" + Date.now(),
    customerId,
    orderId: null,
    value,
    note,
    updatedAt: Date.now(),
  });
}

// Set order-level decision (upsert)
export function setOrderFulfillmentDecision(
  orderId: string,
  customerId: string,
  value: FulfillmentDecisionValue,
  note?: string
): FulfillmentDecision[] {
  const existing = getOrderFulfillmentDecision(orderId);
  if (existing) {
    return updateFulfillmentDecision({ ...existing, value, note, updatedAt: Date.now() });
  }
  return addFulfillmentDecision({
    id: "fulldec-" + Date.now(),
    customerId,
    orderId,
    value,
    note,
    updatedAt: Date.now(),
  });
}

// =====================================================================
// ENUM / MODEL MAPPING (legacy → central)
// =====================================================================
// Mapping ini HANYA untuk referensi migrasi. Tidak mengubah business rule.
// Jika sebuah nilai sudah dapat diturunkan dari central, jangan menyimpan
// field kedua yang menyimpan fakta yang sama.

export type LegacyEnumMapping = {
  progressStatus: Record<string, ProductionStatus>;
  fulfillmentStatus: Record<string, FulfillmentStatus>;
  paymentStatus: Record<string, PaymentStatus>;
  shippingPlan: Record<string, ShippingPreferenceValue>;
  shipmentStatus: Record<string, ShipmentStatus>;
  location: Record<string, string>;
  nextAction: Record<string, string>;
};

// Mapping legacy → central. Nilai yang tidak punya padanan aman
// ditandai dengan string kosong (harus dilaporkan, bukan ditebak).
export const legacyEnumMapping: LegacyEnumMapping = {
  // operations.ts progressStatus → central ProductionStatus
  progressStatus: {
    "belum-produksi": "belum-ready",
    "diproduksi": "masih-diproduksi",
    "proses-qc": "proses-qc",
    "ready": "ready-gudang",
    "selesai": "ready-gudang",
  },
  // operations.ts fulfillmentStatus → central FulfillmentStatus
  fulfillmentStatus: {
    "belum-packing": "belum-siap",
    "siap-packing": "siap-packing",
    "packing": "siap-packing",
    "packing-selesai": "sudah-packing",
    "menunggu-kurir": "menunggu-kurir",
    "dikirim": "menunggu-kurir",
  },
  // paymentStatus (legacy card) → central PaymentStatus (derived)
  paymentStatus: {
    "belum-bayar": "belum-bayar",
    "dp": "dp",
    "lunas": "lunas",
    "lunas-sebagian": "lunas-sebagian",
  },
  // shippingPlan → central ShippingPreferenceValue
  shippingPlan: {
    "belum-ditentukan": "belum-ditentukan",
    "tunggu-lengkap": "tunggu-lengkap",
    "kirim-sebagian": "kirim-sebagian",
  },
  // shipmentStatus → central ShipmentStatus
  shipmentStatus: {
    "belum-dibuat": "belum-dibuat",
    "dalam-pengiriman": "dalam-pengiriman",
    "terkirim": "terkirim",
    "bermasalah": "bermasalah",
    "retur": "retur",
    "selesai": "selesai",
  },
  // location (legacy warehouse label) → central warehouseId
  // Label legacy tidak aman dipetakan ke id tanpa lookup. Kosong = perlu lookup.
  location: {
    "Bekasi": "",
    "Purwakarta": "",
  },
  // nextAction (legacy label) → central NextAction
  nextAction: {
    "Tagih pelunasan": "Tagih pelunasan",
    "Packing": "Packing",
    "Buat Shipment": "Buat Shipment",
    "Input Resi": "Input Resi",
    "Tunggu produksi": "Tunggu produksi",
    "Tunggu QC": "Tunggu QC",
    "Keputusan pengiriman": "Keputusan pengiriman",
    "Tidak ada": "Tidak ada",
  },
};

// Helper: map legacy progressStatus → central ProductionStatus (aman)
export function mapLegacyProgressStatus(value: string): ProductionStatus {
  return legacyEnumMapping.progressStatus[value] ?? "belum-ready";
}

// Helper: map legacy fulfillmentStatus → central FulfillmentStatus (aman)
export function mapLegacyFulfillmentStatus(value: string): FulfillmentStatus {
  return legacyEnumMapping.fulfillmentStatus[value] ?? "belum-siap";
}

// Helper: map legacy shippingPlan → central ShippingPreferenceValue (aman)
export function mapLegacyShippingPlan(value: string): ShippingPreferenceValue {
  return legacyEnumMapping.shippingPlan[value] ?? "belum-ditentukan";
}

// =====================================================================
// OPERATIONAL ACTION LAYER (PHASE 1)
// =====================================================================
// Lapisan aksi/mutasi. Setiap action memodifikasi entity central yang
// relevan dan persist melalui central persistence layer. TIDAK ada
// placeholder. TIDAK mengubah status hanya di UI.
//
// Pemisahan tetap dijaga:
//   CONDITION  → getItemCondition / getOrderCondition / getPrimaryCondition
//   ACTION     → fungsi di bawah ini
//   NEXT ACTION→ getNextAction
//   CANDIDATE  → getPackingCandidates / getShipmentCandidates
// =====================================================================

// Helper: log aktivitas ke timeline customer (opsional, non-destruktif)
function logActivity(
  customerId: string,
  type: string,
  title: string,
  desc: string | undefined,
  orderId?: string
) {
  addActivity({
    id: "act-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
    customerId,
    orderId,
    type,
    title,
    desc,
    time: new Date().toISOString(),
    createdAt: Date.now(),
  });
}

// ---------------------------------------------------------------------
// PAYMENT ACTIONS
// ---------------------------------------------------------------------

// Catat pembayaran (DP / pelunasan / cicilan). Menambah Payment entity.
// Payment gate tetap: belum-bayar → tidak boleh packing.
export function recordPayment(
  orderId: string,
  amount: number,
  paidDate: string,
  note?: string
): { ok: boolean; reason?: string; payment?: Payment } {
  const order = getOrder(orderId);
  if (!order) return { ok: false, reason: "Order tidak ditemukan." };
  if (amount <= 0) return { ok: false, reason: "Jumlah pembayaran harus lebih dari 0." };

  const payment: Payment = {
    id: "pay-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
    orderId,
    amount,
    paidDate,
    note,
    createdAt: Date.now(),
  };
  addPayment(payment);

  // Tandai PaymentDue yang sesuai sebagai paid (jika ada yang pending & amount menutupinya)
  const dues = getPaymentDuesForOrder(orderId).filter(d => d.status === "pending");
  let remaining = amount;
  for (const due of dues) {
    if (remaining <= 0) break;
    const apply = Math.min(remaining, due.amount);
    remaining -= apply;
    if (apply >= due.amount) {
      updatePaymentDue({ ...due, status: "paid" });
    }
  }

  logActivity(order.customerId, "payment", "Pembayaran dicatat", `Rp ${amount.toLocaleString("id-ID")}`, orderId);
  return { ok: true, payment };
}

// Catat DP (convenience wrapper)
export function recordDp(orderId: string, amount: number, paidDate: string, note?: string) {
  return recordPayment(orderId, amount, paidDate, note ?? "DP");
}

// Catat pelunasan (convenience wrapper)
export function recordPelunasan(orderId: string, amount: number, paidDate: string, note?: string) {
  return recordPayment(orderId, amount, paidDate, note ?? "Pelunasan");
}

// ---------------------------------------------------------------------
// PRODUCTION ACTIONS
// ---------------------------------------------------------------------

// Mulai produksi: item → masih-diproduksi; batch → produksi (jika planned)
export function startProduction(orderItemId: string): { ok: boolean; reason?: string } {
  const item = getOrderItem(orderItemId);
  if (!item) return { ok: false, reason: "Order item tidak ditemukan." };
  if (item.batchId) {
    const batch = getBatch(item.batchId);
    if (batch && batch.status === "planned") {
      updateBatch({ ...batch, status: "produksi" });
    }
  }
  const updated: OrderItem = { ...item, productionStatus: "masih-diproduksi" };
  const err = validateOrderItemProduction(updated);
  if (err) return { ok: false, reason: err };
  updateOrderItem(updated);
  const order = getOrder(item.orderId);
  if (order) logActivity(order.customerId, "production", "Produksi dimulai", item.productName, item.orderId);
  return { ok: true };
}

// Selesai produksi: item → proses-qc; batch → qc
export function finishProduction(orderItemId: string): { ok: boolean; reason?: string } {
  const item = getOrderItem(orderItemId);
  if (!item) return { ok: false, reason: "Order item tidak ditemukan." };
  if (item.batchId) {
    const batch = getBatch(item.batchId);
    if (batch && batch.status === "produksi") {
      updateBatch({ ...batch, status: "qc" });
    }
  }
  const updated: OrderItem = { ...item, productionStatus: "proses-qc" };
  const err = validateOrderItemProduction(updated);
  if (err) return { ok: false, reason: err };
  updateOrderItem(updated);
  const order = getOrder(item.orderId);
  if (order) logActivity(order.customerId, "production", "Produksi selesai", item.productName, item.orderId);
  return { ok: true };
}

// QC selesai: item → ready-gudang; batch → selesai + actualReadyAt + progress 100
export function completeQc(orderItemId: string): { ok: boolean; reason?: string } {
  const item = getOrderItem(orderItemId);
  if (!item) return { ok: false, reason: "Order item tidak ditemukan." };
  if (item.batchId) {
    const batch = getBatch(item.batchId);
    if (batch && batch.status !== "selesai") {
      updateBatch({
        ...batch,
        status: "selesai",
        actualReadyAt: batch.actualReadyAt ?? new Date().toISOString().slice(0, 10),
        progress: 100,
      });
    }
  }
  const updated: OrderItem = { ...item, productionStatus: "ready-gudang" };
  const err = validateOrderItemProduction(updated);
  if (err) return { ok: false, reason: err };
  updateOrderItem(updated);
  const order = getOrder(item.orderId);
  if (order) logActivity(order.customerId, "production", "QC selesai", item.productName, item.orderId);
  return { ok: true };
}

// Masuk gudang / ready gudang: item → ready-gudang + buat FulfillmentAllocation
// (jika belum ada). Warehouse default dari product.defaultWarehouseId.
export function markReadyGudang(orderItemId: string): { ok: boolean; reason?: string } {
  const item = getOrderItem(orderItemId);
  if (!item) return { ok: false, reason: "Order item tidak ditemukan." };
  if (item.batchId) {
    const batch = getBatch(item.batchId);
    if (batch && batch.status !== "selesai") {
      updateBatch({
        ...batch,
        status: "selesai",
        actualReadyAt: batch.actualReadyAt ?? new Date().toISOString().slice(0, 10),
        progress: 100,
      });
    }
  }
  const updated: OrderItem = { ...item, productionStatus: "ready-gudang" };
  const err = validateOrderItemProduction(updated);
  if (err) return { ok: false, reason: err };
  updateOrderItem(updated);

  // Buat allocation awal jika belum ada
  const existing = getAllocationsForItem(orderItemId);
  if (existing.length === 0) {
    const product = getProduct(item.productId);
    const warehouseId = product?.defaultWarehouseId;
    if (warehouseId) {
      addAllocation({
        id: "alloc-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
        orderItemId,
        warehouseId,
        quantity: item.qty,
      });
    }
  }

  const order = getOrder(item.orderId);
  if (order) logActivity(order.customerId, "production", "Masuk gudang", item.productName, item.orderId);
  return { ok: true };
}

// ---------------------------------------------------------------------
// PACKING ACTIONS
// ---------------------------------------------------------------------

// Mulai packing: item → siap-packing (hanya jika canPack)
export function startPacking(orderItemId: string): { ok: boolean; reason?: string } {
  const item = getOrderItem(orderItemId);
  if (!item) return { ok: false, reason: "Order item tidak ditemukan." };
  const cond = getItemCondition(orderItemId);
  if (!cond) return { ok: false, reason: "Kondisi item tidak tersedia." };
  if (!cond.canPack) {
    return { ok: false, reason: cond.blocker ?? "Item belum boleh packing (payment gate / produksi)." };
  }
  updateOrderItem({ ...item, fulfillmentStatus: "siap-packing" });
  const order = getOrder(item.orderId);
  if (order) logActivity(order.customerId, "packing", "Packing dimulai", item.productName, item.orderId);
  return { ok: true };
}

// Packing selesai: item → sudah-packing
export function completePacking(orderItemId: string): { ok: boolean; reason?: string } {
  const item = getOrderItem(orderItemId);
  if (!item) return { ok: false, reason: "Order item tidak ditemukan." };
  if (item.fulfillmentStatus !== "siap-packing") {
    return { ok: false, reason: "Item belum dalam status siap-packing." };
  }
  updateOrderItem({ ...item, fulfillmentStatus: "sudah-packing" });
  const order = getOrder(item.orderId);
  if (order) logActivity(order.customerId, "packing", "Packing selesai", item.productName, item.orderId);
  return { ok: true };
}

// ---------------------------------------------------------------------
// SHIPMENT ACTIONS
// ---------------------------------------------------------------------

export type CreateShipmentInput = {
  courier: string;
  items: { orderItemId: string; fulfillmentAllocationId: string; quantity: number }[];
};

// Buat shipment dari kandidat. Setiap ShipmentItem divalidasi.
// Item yang masuk shipment → fulfillmentStatus menunggu-kurir.
//
// PHASE 9 (RISK-2 / OD-1 / OD-12): Shipment HANYA boleh dibuat SETELAH
// packing selesai (fulfillmentStatus === "sudah-packing"). Selain itu:
//   - Hanya LUNAS (Phase 8 ELIGIBLE_FOR_PACKING) yang boleh shipment (DP ≠ LUNAS).
//   - Allocation harus ada & sesuai order item.
//   - Remaining allocation > 0.
//   - ONE ORDER ITEM = ONE SHIPMENT (OWNER FINAL DECISION): quantity shipment
//     HARUS sama dengan remaining fulfillment quantity. Partial shipment
//     (quantity < remaining) DITOLAK. Tidak ada automatic split, tidak ada
//     owner-controlled partial split.
//   - Warehouse source konsisten (OD-4: warehouse berbeda → shipment berbeda).
//   - Courier wajib.
//   - NO AUTO SHIPMENT / NO AUTO PARTIAL SPLIT / NO AUTO MERGE WAREHOUSE.
// Seluruh item divalidasi SEBELUM shipment dibuat (atomic — tidak ada
// partial create).
export function createShipment(input: CreateShipmentInput): { ok: boolean; reason?: string; shipment?: Shipment } {
  if (!input.courier) return { ok: false, reason: "Kurir wajib diisi." };
  if (input.items.length === 0) return { ok: false, reason: "Tidak ada item untuk shipment." };

  // Validasi semua item SEBELUM membuat shipment (atomic).
  const warehouseIds = new Set<string>();
  for (const it of input.items) {
    const item = getOrderItem(it.orderItemId);
    if (!item) return { ok: false, reason: "Order item tidak ditemukan." };
    // Shipment hanya setelah packing selesai (OD-1 / OD-12).
    if (item.fulfillmentStatus !== "sudah-packing") {
      return { ok: false, reason: `Item ${item.productName} belum selesai packing. Shipment hanya setelah packing selesai.` };
    }
    // Hanya LUNAS yang boleh shipment (DP ≠ LUNAS).
    if (getOrderItemFulfillmentState(it.orderItemId) !== "ELIGIBLE_FOR_PACKING") {
      return { ok: false, reason: `Item ${item.productName} belum LUNAS / tidak eligible shipment.` };
    }
    // Allocation harus ada & sesuai order item.
    const allocation = getById<FulfillmentAllocation>(KEYS.allocations, it.fulfillmentAllocationId);
    if (!allocation) return { ok: false, reason: "Allocation tidak ditemukan." };
    if (allocation.orderItemId !== it.orderItemId) {
      return { ok: false, reason: "Allocation tidak sesuai dengan order item." };
    }
    // Remaining allocation > 0 (tidak boleh shipment tanpa sisa allocation).
    const shippedForAlloc = getShipmentItems()
      .filter(si => si.fulfillmentAllocationId === it.fulfillmentAllocationId)
      .reduce((sum, si) => sum + si.quantity, 0);
    const remainingForAlloc = Math.max(0, allocation.quantity - shippedForAlloc);
    if (remainingForAlloc <= 0) {
      return { ok: false, reason: `Item ${item.productName} tidak memiliki sisa allocation untuk shipment.` };
    }
    // ONE ORDER ITEM = ONE SHIPMENT (OWNER FINAL DECISION).
    // Quantity shipment harus UTUH = remaining fulfillment quantity.
    // Partial shipment (quantity < remaining) DITOLAK.
    if (it.quantity !== remainingForAlloc) {
      return {
        ok: false,
        reason: `Item ${item.productName} harus dikirim UTUH (${remainingForAlloc}). Partial shipment tidak diizinkan.`,
      };
    }
    // Warehouse source konsisten (OD-4: warehouse berbeda → shipment berbeda).
    warehouseIds.add(allocation.warehouseId);
  }
  if (warehouseIds.size > 1) {
    return { ok: false, reason: "Item berasal dari warehouse berbeda. Buat shipment terpisah per warehouse." };
  }

  const shipment: Shipment = {
    id: "ship-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
    status: "belum-dibuat",
    courier: input.courier,
    shippedAt: null,
    createdAt: Date.now(),
  };
  addShipment(shipment);

  for (const it of input.items) {
    const shipmentItem: ShipmentItem = {
      id: "shipitem-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
      shipmentId: shipment.id,
      orderItemId: it.orderItemId,
      fulfillmentAllocationId: it.fulfillmentAllocationId,
      quantity: it.quantity,
    };
    const err = validateShipmentItem(shipmentItem);
    if (err) {
      // Rollback shipment yang baru dibuat
      deleteShipment(shipment.id);
      return { ok: false, reason: err };
    }
    addShipmentItem(shipmentItem);
    const item = getOrderItem(it.orderItemId);
    if (item) {
      updateOrderItem({ ...item, fulfillmentStatus: "menunggu-kurir" });
      const order = getOrder(item.orderId);
      if (order) logActivity(order.customerId, "shipment", "Shipment dibuat", `${item.productName} (${it.quantity})`, item.orderId);
    }
  }

  return { ok: true, shipment };
}

// Input resi untuk shipment
export function inputResi(
  shipmentId: string,
  number: string,
  courier: string,
  date: string
): { ok: boolean; reason?: string; resi?: Resi } {
  const shipment = getShipment(shipmentId);
  if (!shipment) return { ok: false, reason: "Shipment tidak ditemukan." };
  if (!number) return { ok: false, reason: "Nomor resi wajib diisi." };
  const resi: Resi = {
    id: "resi-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
    shipmentId,
    number,
    courier: courier || shipment.courier,
    status: "dalam-pengiriman",
    date,
  };
  addResi(resi);
  return { ok: true, resi };
}

// Kurir/pickup: shipment → dalam-pengiriman + shippedAt
export function markPickedUp(shipmentId: string): { ok: boolean; reason?: string } {
  const shipment = getShipment(shipmentId);
  if (!shipment) return { ok: false, reason: "Shipment tidak ditemukan." };
  updateShipment({
    ...shipment,
    status: "dalam-pengiriman",
    shippedAt: shipment.shippedAt ?? new Date().toISOString().slice(0, 10),
  });
  return { ok: true };
}

// Delivered: shipment → terkirim
export function markDelivered(shipmentId: string): { ok: boolean; reason?: string } {
  const shipment = getShipment(shipmentId);
  if (!shipment) return { ok: false, reason: "Shipment tidak ditemukan." };
  updateShipment({ ...shipment, status: "terkirim" });
  return { ok: true };
}

// Retur: shipment → retur
export function markRetur(shipmentId: string, note?: string): { ok: boolean; reason?: string } {
  const shipment = getShipment(shipmentId);
  if (!shipment) return { ok: false, reason: "Shipment tidak ditemukan." };
  updateShipment({ ...shipment, status: "retur" });
  return { ok: true };
}

// ---------------------------------------------------------------------
// COURIER UPDATE (PHASE 9 / OD-9)
// ---------------------------------------------------------------------
// Courier boleh diubah SEBELUM SHIPPED (status "belum-dibuat").
// Setelah SHIPPED (dalam-pengiriman / terkirim / bermasalah / retur /
// selesai) TIDAK boleh silent overwrite — koreksi hanya boleh dilakukan
// owner secara eksplisit (force=true + note) dan dicatat ke timeline
// customer (traceable). Tidak menghapus histori.
export function updateShipmentCourier(
  shipmentId: string,
  courier: string,
  opts?: { force?: boolean; note?: string }
): { ok: boolean; reason?: string; shipment?: Shipment } {
  const shipment = getShipment(shipmentId);
  if (!shipment) return { ok: false, reason: "Shipment tidak ditemukan." };
  if (!courier) return { ok: false, reason: "Kurir wajib diisi." };

  const shipped = shipment.status !== "belum-dibuat";
  if (shipped && !opts?.force) {
    return {
      ok: false,
      reason: "Shipment sudah dikirim. Koreksi kurir harus owner-controlled (force + note) dan traceable.",
    };
  }

  const previous = shipment.courier;
  const updated: Shipment = { ...shipment, courier };
  updateShipment(updated);

  // Traceable: catat ke timeline customer (jika shipment terkait order).
  const items = getShipmentItemsForShipment(shipmentId);
  const firstItem = items[0];
  if (firstItem) {
    const oi = getOrderItem(firstItem.orderItemId);
    const order = oi ? getOrder(oi.orderId) : undefined;
    if (order) {
      logActivity(
        order.customerId,
        "shipment",
        "Kurir diubah",
        `${previous} → ${courier}${opts?.note ? " (" + opts.note + ")" : ""}`,
        order.id
      );
    }
  }
  return { ok: true, shipment: updated };
}

// ---------------------------------------------------------------------
// HOLD / RELEASE ACTIONS
// ---------------------------------------------------------------------
// Hold/release adalah action operasional terpisah. Disimpan sebagai
// FulfillmentDecision (value hold/release) dengan alasan di note.

// Hold customer: keputusan owner menahan karena alasan customer
export function holdCustomer(orderId: string, note?: string): { ok: boolean; reason?: string } {
  const order = getOrder(orderId);
  if (!order) return { ok: false, reason: "Order tidak ditemukan." };
  setOrderFulfillmentDecision(orderId, order.customerId, "hold", note ?? "hold-customer");
  return { ok: true };
}

// Hold admin: keputusan owner menahan karena alasan internal/admin
export function holdAdmin(orderId: string, note?: string): { ok: boolean; reason?: string } {
  const order = getOrder(orderId);
  if (!order) return { ok: false, reason: "Order tidak ditemukan." };
  setOrderFulfillmentDecision(orderId, order.customerId, "hold", note ?? "hold-admin");
  return { ok: true };
}

// Release hold: lepas status hold
export function releaseHold(orderId: string, note?: string): { ok: boolean; reason?: string } {
  const order = getOrder(orderId);
  if (!order) return { ok: false, reason: "Order tidak ditemukan." };
  setOrderFulfillmentDecision(orderId, order.customerId, "release", note);
  return { ok: true };
}

// ---------------------------------------------------------------------
// FULFILLMENT DECISION ACTIONS (owner)
// ---------------------------------------------------------------------

// Keputusan gabung pengiriman (owner)
export function decideGabungPengiriman(customerId: string, orderId: string | null, note?: string) {
  if (orderId) {
    return setOrderFulfillmentDecision(orderId, customerId, "gabungkan", note);
  }
  return setCustomerFulfillmentDecision(customerId, "gabungkan", note);
}

// Keputusan kirim terpisah (owner)
export function decideKirimTerpisah(customerId: string, orderId: string | null, note?: string) {
  if (orderId) {
    return setOrderFulfillmentDecision(orderId, customerId, "kirim-terpisah", note);
  }
  return setCustomerFulfillmentDecision(customerId, "kirim-terpisah", note);
}

// Keputusan tunda (owner)
export function decideTunda(customerId: string, orderId: string | null, note?: string) {
  if (orderId) {
    return setOrderFulfillmentDecision(orderId, customerId, "tunda", note);
  }
  return setCustomerFulfillmentDecision(customerId, "tunda", note);
}

// ---------------------------------------------------------------------
// SHIPPING PREFERENCE ACTIONS
// ---------------------------------------------------------------------

// Set shipping preference (customer-level atau order-level)
export function setShippingPreference(
  customerId: string,
  value: ShippingPreferenceValue,
  orderId: string | null = null
) {
  if (orderId) {
    return setOrderShippingPreference(orderId, customerId, value);
  }
  return setCustomerShippingPreference(customerId, value);
}

// ---------------------------------------------------------------------
// ORDER STATUS ACTIONS
// ---------------------------------------------------------------------

// Batal order (batal / cancel PO / cancel tanpa konfirmasi).
// Alasan disimpan di note. Status order → cancelled.
export function cancelOrder(orderId: string, reason?: string): { ok: boolean; reason?: string } {
  const order = getOrder(orderId);
  if (!order) return { ok: false, reason: "Order tidak ditemukan." };
  updateOrder({ ...order, status: "cancelled", note: reason ? `${order.note} [${reason}]`.trim() : order.note });
  logActivity(order.customerId, "order", "Order dibatalkan", reason, orderId);
  return { ok: true };
}

// Prioritas: tandai order sebagai prioritas owner (keputusan manual)
export function setOrderPriority(orderId: string, priority: boolean): { ok: boolean; reason?: string } {
  const order = getOrder(orderId);
  if (!order) return { ok: false, reason: "Order tidak ditemukan." };
  updateOrder({ ...order, priority });
  return { ok: true };
}

// =====================================================================
// PHASE 2 — ORDER INTEGRATION (store.ts → central)
// =====================================================================
// Order/OrderItem yang dibuat melalui sistem transaksi (store.ts) dapat
// dibaca oleh central sebagai sumber transaksi yang sama.
//
// PENTING:
//   - store.ts TIDAK dihapus; data legacy TIDAK dihapus.
//   - store.ts tetap pemilik key `umayasla_orders` (OrderRecord).
//   - central memakai key terpisah (`umayasla_central_orders`).
//   - syncOrdersFromStore() mematerialisasi OrderRecord → Order/OrderItem
//     secara idempotent (keyed by order id) → TIDAK ada duplicate order.
//   - Order tanpa customerId yang valid dilewati (provenance uncertain).
// =====================================================================

// Mapping status OrderRecord (store.ts) → central OrderStatus
//   draft → draft, confirmed → confirmed, paid → confirmed
//   ("paid" adalah state pembayaran, bukan lifecycle order; pembayaran
//    dilacak terpisah via Payment entity.)
export function mapStoreOrderStatus(status: string): OrderStatus {
  if (status === "draft") return "draft";
  if (status === "paid") return "confirmed";
  return "confirmed";
}

// Materialisasi satu OrderRecord → central Order + OrderItem.
// Idempotent: jika order id sudah ada di central, dilewati.
export function materializeStoreOrder(record: StoreOrderRecordLike): { order?: Order; items?: OrderItem[]; skipped?: boolean; reason?: string } {
  if (!record.customerId) {
    return { skipped: true, reason: "Order tanpa customerId (provenance uncertain)." };
  }
  if (getOrder(record.id)) {
    return { skipped: true, reason: "Order sudah ada di central." };
  }

  const order: Order = {
    id: record.id,
    number: record.number || record.id,
    customerId: record.customerId,
    date: record.date || "",
    phone: record.phone || "",
    address: record.address || "",
    discountType: record.discountType === "percent" ? "percent" : "nominal",
    discountValue: record.discountValue ?? 0,
    discountAmount: record.discountAmount ?? 0,
    ongkir: record.ongkir ?? 0,
    ongkirLabel: record.ongkirLabel || "",
    dp: record.dp ?? 0,
    note: record.note || "",
    marketerId: record.marketerId ?? null,
    status: mapStoreOrderStatus(record.status),
    subtotal: record.subtotal ?? 0,
    total: record.total ?? 0,
    totalFee: record.totalFee ?? 0,
    createdAt: record.createdAt ?? Date.now(),
  };
  addOrder(order);

  const items: OrderItem[] = (record.items || []).map((it) => {
    const price = it.price ?? 0;
    const qty = it.qty ?? 0;
    const discount = it.discount ?? 0;
    const finalPrice = it.finalPrice ?? price;
    const subtotal = finalPrice * qty;
    return {
      id: it.id || "oi-" + record.id + "-" + Math.random().toString(36).slice(2, 7),
      orderId: record.id,
      productId: it.productId || "",
      // OrderItemSnapshot (store.ts) memakai field `name`, bukan `productName`.
      productName: it.productName || it.name || "Produk",
      emoji: it.emoji || "📦",
      qty,
      price,
      discount,
      subtotal,
      hpp: it.hpp ?? 0,
      feeMarketer: it.feeMarketer ?? 0,
      // OrderItemSnapshot tidak punya batchId; batch ada di level OrderRecord.
      // Item tanpa batchId diperlakukan sebagai ready stock (default aman).
      batchId: it.batchId ?? null,
      productionStatus: "belum-ready",
      fulfillmentStatus: "belum-siap",
      size: it.size,
      pad: it.pad,
      fabric: it.fabric,
      color: it.color,
      poni: it.poni,
      rits: it.rits,
      modifications: it.modifications,
      customRequests: it.customRequests,
      additionalPrice: it.additionalPrice,
      finalPrice,
    };

  });
  for (const item of items) {
    addOrderItem(item);
  }

  return { order, items };
}

// =====================================================================
// LOSSLESS BACKFILL — SHIPPING OBLIGATION (PHASE 11B)
// =====================================================================
// Backfill ShippingObligation dari OrderRecord legacy (store.ts) secara
// LOSSLESS (tanpa inferensi):
//   - amount   = record.ongkir      (nominal ongkir yang diketahui)
//   - courier  = record.ongkirLabel (label kurir yang diketahui)
//   - warehouseId = undefined       (tidak diketahui → jangan menebak)
//
// Idempotent: jika ShippingObligation untuk order sudah ada, dilewati.
// TIDAK membuat Payment / Fulfillment / Shipment / Cancellation facts.
// Coarse legacy status (paid/shipped/ready/completed/cancelled) TIDAK
// pernah dikonversi menjadi central fact.
export function backfillStoreOrderShippingObligation(record: StoreOrderRecordLike): {
  created: boolean;
  skipped: boolean;
  reason?: string;
} {
  if (!record.customerId) {
    return { created: false, skipped: true, reason: "Order tanpa customerId (provenance uncertain)." };
  }
  if (!record.id) {
    return { created: false, skipped: true, reason: "Order tanpa id." };
  }
  // Idempotent: jangan duplikasi ShippingObligation untuk order yang sama.
  if (getShippingObligationsForOrder(record.id).length > 0) {
    return { created: false, skipped: true, reason: "ShippingObligation sudah ada untuk order ini." };
  }
  // Hanya backfill jika ongkir adalah nominal yang diketahui (bukan 0/unknown).
  const amount = record.ongkir;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return { created: false, skipped: true, reason: "Ongkir tidak diketahui (bukan nominal positif)." };
  }
  const result = addShippingObligation({
    orderId: record.id,
    customerId: record.customerId,
    amount,
    courier: record.ongkirLabel || undefined,
    description: "Backfill lossless dari OrderRecord legacy (ongkir).",
  });
  if (!result.ok) {
    return { created: false, skipped: true, reason: result.reason };
  }
  return { created: true, skipped: false };
}

// Sinkronisasi semua OrderRecord dari store.ts ke central (idempotent).
// Dipanggil otomatis di awal getOrders() agar central selalu mencerminkan
// sistem transaksi. Non-destruktif terhadap store.ts.
export function syncOrdersFromStore(): { synced: number; skipped: number } {
  if (typeof window === "undefined") return { synced: 0, skipped: 0 };
  let synced = 0;
  let skipped = 0;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const store = require("./store");
    const records: StoreOrderRecordLike[] = store.getOrders ? store.getOrders() : [];
    for (const record of records) {
      const result = materializeStoreOrder(record);
      if (result.skipped) skipped++;
      else synced++;
      // Backfill ShippingObligation lossless (idempotent) untuk setiap order.
      backfillStoreOrderShippingObligation(record);
    }
  } catch (err) {
    // store.ts tidak tersedia / error → jangan crash, biarkan central apa adanya.
    // Tetap dilog (non-throwing) supaya kegagalan diam-diam tidak hilang total.
    console.error("syncOrdersFromStore: gagal membaca store.ts", err);
  }
  return { synced, skipped };
}

// =====================================================================
// EDIT-ORDER CENTRAL REFRESH (PHASE 11C)
// =====================================================================
// Setelah legacy `updateOrder(orderRecord)` berhasil (authoritative commit
// point di store.ts), panggil refreshCentralOrderFromStore(orderId) untuk
// memproyeksikan ulang Order / OrderItem / ShippingObligation ke central.
//
// Aturan:
//   - Legacy tetap authoritative. Refresh adalah proyeksi non-authoritative.
//   - Jika central order belum ada → gunakan materializeStoreOrder (lossless)
//     + backfillStoreOrderShippingObligation (idempotent).
//   - Jika central order sudah ada → update (bukan duplikasi).
//   - OrderItem yang sudah ada: PRESERVE productionStatus / fulfillmentStatus /
//     batchId (field operasional central-only).
//   - OrderItem baru: default aman (belum-ready / belum-siap / batchId null).
//   - OrderItem yang dihapus dari legacy: hapus dari central HANYA jika tidak
//     punya downstream facts (PaymentAllocation / Cancellation / ShipmentItem /
//     FulfillmentAllocation). Jika diblokir → retain + laporkan blockedRemovals.
//   - ShippingObligation: TIDAK pernah dihapus. amount di-update sesuai ongkir
//     (positif → amount; nol → 0; unknown → null). courier di-update.
//   - Idempotent per orderId: pemanggilan ulang menghasilkan state yang sama.
//   - Error / partial refresh TIDAK pernah rollback legacy edit.
// =====================================================================
export function refreshCentralOrderFromStore(orderId: string): {
  ok: boolean;
  reason?: string;
  materialized?: boolean;
  updated?: boolean;
  blockedRemovals?: string[];
} {
  if (typeof window === "undefined") {
    return { ok: false, reason: "Bukan environment browser." };
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const store = require("./store");
    const record: StoreOrderRecordLike | undefined = store.getOrderById
      ? store.getOrderById(orderId)
      : undefined;
    if (!record) {
      return { ok: false, reason: "OrderRecord tidak ditemukan di store." };
    }
    if (!record.customerId) {
      return { ok: false, reason: "Order tanpa customerId (provenance uncertain)." };
    }

    // Jika central order belum ada → materialisasi lossless (idempotent).
    if (!getOrder(orderId)) {
      const mat = materializeStoreOrder(record);
      if (mat.skipped) {
        return { ok: false, reason: mat.reason || "Materialisasi dilewati." };
      }
      backfillStoreOrderShippingObligation(record);
      return { ok: true, materialized: true };
    }

    // ===== UPDATE PATH: central order sudah ada =====
    const blockedRemovals: string[] = [];

    // 1) Update Order (replace by id, tanpa duplikasi).
    const order: Order = {
      id: record.id,
      number: record.number || record.id,
      customerId: record.customerId,
      date: record.date || "",
      phone: record.phone || "",
      address: record.address || "",
      discountType: record.discountType === "percent" ? "percent" : "nominal",
      discountValue: record.discountValue ?? 0,
      discountAmount: record.discountAmount ?? 0,
      ongkir: record.ongkir ?? 0,
      ongkirLabel: record.ongkirLabel || "",
      dp: record.dp ?? 0,
      note: record.note || "",
      marketerId: record.marketerId ?? null,
      status: mapStoreOrderStatus(record.status),
      subtotal: record.subtotal ?? 0,
      total: record.total ?? 0,
      totalFee: record.totalFee ?? 0,
      createdAt: record.createdAt ?? Date.now(),
    };
    updateOrder(order);

    // 2) Reconcile OrderItems.
    const existingItems = getItemsForOrder(orderId);
    const existingById = new Map(existingItems.map((i) => [i.id, i]));
    const legacyIds = new Set<string>();

    for (const it of record.items || []) {
      const itemId = it.id || "oi-" + record.id + "-" + Math.random().toString(36).slice(2, 7);
      legacyIds.add(itemId);
      const price = it.price ?? 0;
      const qty = it.qty ?? 0;
      const discount = it.discount ?? 0;
      const finalPrice = it.finalPrice ?? price;
      const subtotal = finalPrice * qty;

      const existing = existingById.get(itemId);
      if (existing) {
        // PRESERVE central-only operational fields.
        updateOrderItem({
          ...existing,
          id: itemId,
          orderId,
          productId: it.productId || "",
          productName: it.productName || it.name || "Produk",
          emoji: it.emoji || "📦",
          qty,
          price,
          discount,
          subtotal,
          hpp: it.hpp ?? 0,
          feeMarketer: it.feeMarketer ?? 0,
          size: it.size,
          pad: it.pad,
          fabric: it.fabric,
          color: it.color,
          poni: it.poni,
          rits: it.rits,
          modifications: it.modifications,
          customRequests: it.customRequests,
          additionalPrice: it.additionalPrice,
          finalPrice,
        });
      } else {
        // New item → safe defaults.
        addOrderItem({
          id: itemId,
          orderId,
          productId: it.productId || "",
          productName: it.productName || it.name || "Produk",
          emoji: it.emoji || "📦",
          qty,
          price,
          discount,
          subtotal,
          hpp: it.hpp ?? 0,
          feeMarketer: it.feeMarketer ?? 0,
          batchId: it.batchId ?? null,
          productionStatus: "belum-ready",
          fulfillmentStatus: "belum-siap",
          size: it.size,
          pad: it.pad,
          fabric: it.fabric,
          color: it.color,
          poni: it.poni,
          rits: it.rits,
          modifications: it.modifications,
          customRequests: it.customRequests,
          additionalPrice: it.additionalPrice,
          finalPrice,
        });
      }
    }

    // 3) Remove central items absent from legacy — only if no downstream facts.
    for (const existing of existingItems) {
      if (legacyIds.has(existing.id)) continue;
      const hasDownstream =
        getPaymentAllocationsForTarget({ type: "product-obligation", referenceId: existing.id }).length > 0 ||
        getCancellationsForItem(existing.id).length > 0 ||
        getShipmentItems().some((si) => si.orderItemId === existing.id) ||
        getAllocationsForItem(existing.id).length > 0;
      if (hasDownstream) {
        blockedRemovals.push(existing.id);
      } else {
        deleteOrderItem(existing.id);
      }
    }

    // 4) ShippingObligation: never remove; update amount/courier.
    const obligations = getShippingObligationsForOrder(orderId);
    const ongkir = record.ongkir;
    const courier = record.ongkirLabel || undefined;
    if (obligations.length > 0) {
      // amount: known positive → amount; zero → 0; unknown → null.
      const amount =
        typeof ongkir === "number" && Number.isFinite(ongkir) && ongkir > 0
          ? ongkir
          : typeof ongkir === "number" && Number.isFinite(ongkir) && ongkir === 0
            ? 0
            : null;
      for (const ob of obligations) {
        updateShippingObligation(ob.id, { amount, courier });
      }
    } else {
      // No obligation yet → create only if ongkir is a known positive number.
      if (typeof ongkir === "number" && Number.isFinite(ongkir) && ongkir > 0) {
        addShippingObligation({
          orderId,
          customerId: record.customerId,
          amount: ongkir,
          courier,
          description: "Refresh lossless dari OrderRecord legacy (ongkir).",
        });
      }
    }

    return { ok: true, updated: true, blockedRemovals };
  } catch (err) {
    // Error / partial refresh → jangan crash, jangan rollback legacy edit.
    // Tetap dilog (non-throwing) supaya kegagalan diam-diam tidak hilang total.
    console.error("refreshCentralOrderFromStore: gagal refresh", err);
    return { ok: false, reason: "Refresh central gagal (non-authoritative)." };
  }
}

// =====================================================================
// LOSSLESS BACKFILL — CUSTOMER + CUSTOMER ADDRESS (PHASE 11B)
// =====================================================================

// Backfill Customer + CustomerAddress dari customers.ts (legacy) secara
// LOSSLESS (tanpa inferensi / normalisasi / default / merge):
//
// Customer (disalin persis):
//   id, name, waName, city, since, initials, phone, receiver,
//   receiverPhone, defaultAddressId.
//   TIDAK menyalin / menurunkan aggregate summary (orders, paid,
//   outstanding, shipment) — itu operational summary, bukan fakta lossless.
//   Field central-only yang tidak punya padanan legacy diisi aman:
//     notes      = [] (tidak disalin — bukan bagian mapping yang disetujui)
//     createdAt  = Date.now() (metadata backfill, bukan nilai source)
//     deletedAt  = null (tidak soft-delete)
//
// CustomerAddress (disalin persis):
//   id, customerId, label, recipientName, phone, address, landmark,
//   courier, note, isDefault.
//
// Idempotent: jika Customer dengan id yang sama sudah ada di central,
// dilewati (tidak duplikasi). Address idempotent per id.
//
// Skip rule (hanya saat identity/linking field absen):
//   - Customer tanpa `id` → dilewati (identity field absen).
//   - Address tanpa `id` ATAU tanpa `customerId` → dilewati (tidak bisa
//     ditautkan deterministik ke customer).
// =====================================================================

// Tipe minimal Customer dari customers.ts (untuk mapping tanpa import sirkular)
export type LegacyCustomerLike = {
  id: string;
  name: string;
  waName: string;
  city: string;
  since: string;
  initials: string;
  phone: string;
  receiver: string;
  receiverPhone: string;
  defaultAddressId: string | null;
  addresses?: LegacyCustomerAddressLike[];
};

export type LegacyCustomerAddressLike = {
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

// Backfill satu Customer + seluruh CustomerAddress-nya (lossless, idempotent).
export function backfillStoreCustomer(customer: LegacyCustomerLike): {
  created: boolean;
  skipped: boolean;
  reason?: string;
  addressesCreated: number;
  addressesSkipped: number;
} {
  // Skip rule: identity field absen.
  if (!customer.id) {
    return { created: false, skipped: true, reason: "Customer tanpa id (identity field absen).", addressesCreated: 0, addressesSkipped: 0 };
  }
  // Idempotent: jangan duplikasi Customer yang sudah ada di central.
  if (getCustomer(customer.id)) {
    return { created: false, skipped: true, reason: "Customer sudah ada di central.", addressesCreated: 0, addressesSkipped: 0 };
  }

  // Disalin persis sesuai mapping yang disetujui. TIDAK menyalin aggregate
  // summary (orders/paid/outstanding/shipment). Field central-only diisi aman.
  const centralCustomer: Customer = {
    id: customer.id,
    name: customer.name,
    waName: customer.waName,
    phone: customer.phone,
    receiver: customer.receiver,
    receiverPhone: customer.receiverPhone,
    city: customer.city,
    since: customer.since,
    notes: [],
    createdAt: Date.now(),
    deletedAt: null,
    initials: customer.initials,
    defaultAddressId: customer.defaultAddressId ?? null,
  };
  addCustomer(centralCustomer);

  // Backfill addresses (lossless, idempotent per id).
  let addressesCreated = 0;
  let addressesSkipped = 0;
  for (const addr of customer.addresses || []) {
    // Skip rule: linking/identity field absen → tidak bisa ditautkan.
    if (!addr.id || !addr.customerId) {
      addressesSkipped++;
      continue;
    }
    // Idempotent: jangan duplikasi Address yang sudah ada di central.
    if (getById<Address>(KEYS.addresses, addr.id)) {
      addressesSkipped++;
      continue;
    }
    const centralAddress: Address = {
      id: addr.id,
      customerId: addr.customerId,
      label: addr.label,
      recipientName: addr.recipientName,
      phone: addr.phone,
      address: addr.address,
      landmark: addr.landmark,
      courier: addr.courier,
      note: addr.note,
      isDefault: addr.isDefault,
    };
    addAddress(centralAddress);
    addressesCreated++;
  }

  return { created: true, skipped: false, addressesCreated, addressesSkipped };
}

// Sinkronisasi semua Customer dari customers.ts ke central (idempotent).
// Non-destruktif terhadap customers.ts. Tidak dipanggil otomatis oleh
// getCustomers() — backfill eksplisit (owner memanggil saat migrasi).
// Catatan: memakai dynamic import (bukan require) karena Node type-stripping
// tidak meresolusi require("./customers.ts") dari dalam modul .ts yang dimuat
// via require() — dynamic import menangani ekstensi .ts dengan benar.
export async function syncCustomersFromStore(): Promise<{ synced: number; skipped: number; addressesCreated: number; addressesSkipped: number }> {
  if (typeof window === "undefined") return { synced: 0, skipped: 0, addressesCreated: 0, addressesSkipped: 0 };
  let synced = 0;
  let skipped = 0;
  let addressesCreated = 0;
  let addressesSkipped = 0;
  try {
    // Path dikomputasi agar TypeScript tidak menandai ekstensi .ts (yang
    // dibutuhkan Node type-stripping untuk meresolusi dynamic import).
    const customers = await import("./customers" + ".ts");
    const records: LegacyCustomerLike[] = customers.customersData ? customers.customersData : [];
    for (const record of records) {
      const result = backfillStoreCustomer(record);
      if (result.skipped) skipped++;
      else synced++;
      addressesCreated += result.addressesCreated;
      addressesSkipped += result.addressesSkipped;
    }
  } catch {
    // customers.ts tidak tersedia / error → jangan crash, biarkan central apa adanya
  }
  return { synced, skipped, addressesCreated, addressesSkipped };
}


// Tipe minimal OrderRecord dari store.ts (untuk mapping tanpa import sirkular)
export type StoreOrderRecordLike = {

  id: string;
  number?: string;
  customerId: string | null;
  date?: string;
  phone?: string;
  address?: string;
  discountType?: "percent" | "nominal";
  discountValue?: number;
  discountAmount?: number;
  ongkir?: number;
  ongkirLabel?: string;
  dp?: number;
  note?: string;
  marketerId?: string | null;
  status: string;
  subtotal?: number;
  total?: number;
  totalFee?: number;
  createdAt?: number;
  items?: StoreOrderItemLike[];
};

export type StoreOrderItemLike = {
  id?: string;
  productId?: string;
  // OrderItemSnapshot (store.ts) memakai field `name`, bukan `productName`.
  name?: string;
  productName?: string;
  emoji?: string;
  qty?: number;
  price?: number;
  discount?: number;
  finalPrice?: number;
  hpp?: number;
  feeMarketer?: number;
  batchId?: string | null;
  size?: string;
  pad?: string;
  fabric?: string;
  color?: string;
  poni?: string;
  rits?: string;
  modifications?: string[];
  customRequests?: { name: string; price: number }[];
  additionalPrice?: number;
};

// =====================================================================
// CREATE ORDER (PHASE 11B) — CENTRAL NEW-ORDER WRITE PATH (UNWIRED)
// =====================================================================
// createOrder adalah PURE, side-effect-free function yang MEMPERSIAPKAN
// (bukan menulis) order baru + order-line facts + order-number allocation
// fact sebagai satu hasil atomik. TIDAK dipanggil oleh UI / route / action
// mana pun. Caller (owner) yang akan me-wire di fase berikutnya.
//
// Aturan final:
//   - PURE: tidak membaca/menulis localStorage, tidak memanggil addOrder /
//     addOrderItem, tidak menyentuh store.ts / operations.ts.
//   - ATOMIC: mengembalikan satu result object berisi order + items +
//     orderNumberAllocation. Jika input invalid → throw sebelum return.
//   - Order number dialokasikan DETERMINISTIK dari sequence value yang
//     diberikan caller. Function TIDAK meng-generate / meng-mutasi sequence.
//   - HANYA membuat: order record, order-line facts, order-number allocation
//     fact. TIDAK membuat payment / fulfillment / shipment / cancellation.
//   - Tidak ada dual-write, consumer migration, UI wiring, legacy action
//     rewiring.
// =====================================================================

// Input satu baris order (snapshot harga + konfigurasi customer).
export type CreateOrderLineInput = {
  productId: string;
  productName: string;
  emoji?: string;
  qty: number;
  price: number; // harga jual per unit (snapshot)
  discount?: number; // diskon per unit
  hpp?: number; // HPP per unit (snapshot)
  feeMarketer?: number; // fee per unit (snapshot)
  // snapshot konfigurasi customer (bukan SKU)
  size?: string;
  pad?: string;
  fabric?: string;
  color?: string;
  poni?: string;
  rits?: string;
  modifications?: string[];
  customRequests?: { name: string; price: number }[];
  additionalPrice?: number;
};

// Input untuk createOrder. Caller menyediakan sequence order number.
export type CreateOrderInput = {
  customerId: string;
  date: string;
  phone?: string;
  address?: string;
  discountType?: "percent" | "nominal";
  discountValue?: number;
  ongkir?: number;
  ongkirLabel?: string;
  dp?: number;
  note?: string;
  marketerId?: string | null;
  // Sequence value untuk alokasi order number (caller-owned).
  nextOrderNumber: number;
  items: CreateOrderLineInput[];
};

// Order-number allocation fact — bukti alokasi nomor order.
export type OrderNumberAllocationFact = {
  id: string;
  orderId: string;
  number: string;
  sequence: number;
  allocatedAt: number;
};

// Hasil atomik createOrder.
export type CreateOrderResult = {
  order: Order;
  items: OrderItem[];
  orderNumberAllocation: OrderNumberAllocationFact;
};

// PURE, side-effect-free. Tidak menulis ke localStorage / store.ts.
export function createOrder(input: CreateOrderInput): CreateOrderResult {
  // ---- Validasi input (throw sebelum return → atomicity) ----
  if (!input.customerId) throw new Error("createOrder: customerId wajib.");
  if (!input.date) throw new Error("createOrder: date wajib.");
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new Error("createOrder: minimal satu item.");
  }
  if (!Number.isInteger(input.nextOrderNumber) || input.nextOrderNumber < 1) {
    throw new Error("createOrder: nextOrderNumber harus integer positif.");
  }
  for (const it of input.items) {
    if (!it.productId) throw new Error("createOrder: productId wajib per item.");
    if (!it.productName) throw new Error("createOrder: productName wajib per item.");
    if (!Number.isFinite(it.qty) || it.qty <= 0) throw new Error("createOrder: qty harus > 0.");
    if (!Number.isFinite(it.price) || it.price < 0) throw new Error("createOrder: price tidak boleh negatif.");
  }

  const now = Date.now();
  const orderId = "ord-" + now + "-" + Math.random().toString(36).slice(2, 7);
  const number = "INV-" + String(input.nextOrderNumber).padStart(4, "0");

  // ---- Bangun order-line facts (snapshot harga + konfigurasi) ----
  const items: OrderItem[] = input.items.map((it, idx) => {
    const price = it.price;
    const qty = it.qty;
    const discount = it.discount ?? 0;
    const finalPrice = price - discount;
    const subtotal = finalPrice * qty;
    return {
      id: "oi-" + orderId + "-" + idx,
      orderId,
      productId: it.productId,
      productName: it.productName,
      emoji: it.emoji || "📦",
      qty,
      price,
      discount,
      subtotal,
      hpp: it.hpp ?? 0,
      feeMarketer: it.feeMarketer ?? 0,
      batchId: null, // ready stock default aman
      productionStatus: "belum-ready",
      fulfillmentStatus: "belum-siap",
      size: it.size,
      pad: it.pad,
      fabric: it.fabric,
      color: it.color,
      poni: it.poni,
      rits: it.rits,
      modifications: it.modifications,
      customRequests: it.customRequests,
      additionalPrice: it.additionalPrice,
      finalPrice,
    };
  });

  // ---- Hitung subtotal / diskon / total (derived, bukan fakta terpisah) ----
  const subtotal = items.reduce((sum, it) => sum + it.subtotal, 0);
  const discountType = input.discountType === "percent" ? "percent" : "nominal";
  const discountValue = input.discountValue ?? 0;
  const discountAmount = discountType === "percent"
    ? Math.round(subtotal * (discountValue / 100))
    : discountValue;
  const ongkir = input.ongkir ?? 0;
  const total = subtotal - discountAmount + ongkir;

  // ---- Bangun order record ----
  const order: Order = {
    id: orderId,
    number,
    customerId: input.customerId,
    date: input.date,
    phone: input.phone || "",
    address: input.address || "",
    discountType,
    discountValue,
    discountAmount,
    ongkir,
    ongkirLabel: input.ongkirLabel || "",
    dp: input.dp ?? 0,
    note: input.note || "",
    marketerId: input.marketerId ?? null,
    status: "draft",
    subtotal,
    total,
    totalFee: 0, // fee dihitung derived (Phase 7), bukan di sini
    createdAt: now,
  };

  // ---- Order-number allocation fact ----
  const orderNumberAllocation: OrderNumberAllocationFact = {
    id: "ona-" + orderId,
    orderId,
    number,
    sequence: input.nextOrderNumber,
    allocatedAt: now,
  };

  return { order, items, orderNumberAllocation };
}

// =====================================================================
// SHIPPING OBLIGATION (PHASE 4)
// =====================================================================
// Shipping Obligation adalah kewajiban FINANSIAL customer untuk membayar
// biaya pengiriman tertentu. TERPISAH dari:
//   - Product Obligation (kewajiban produk)
//   - PaymentFact / PaymentAllocation (actual payment)
//   - Shipment (konsekuensi operasional pengiriman)
//
// Aturan final:
//   - Ongkir boleh BELUM DIKETAHUI saat Order dibuat → amount = null (UNKNOWN).
//   - Ongkir boleh diketahui kemudian (owner memasukkan nominal manual).
//   - Satu Order dapat memiliki LEBIH DARI SATU Shipping Obligation
//     (mis. per warehouse / per pengiriman operasional).
//   - Shipping Obligation TIDAK membutuhkan Shipment untuk dibuat / menerima
//     payment. Bisa ada sebelum Shipment.
//   - amount = null (UNKNOWN) TIDAK dianggap Rp0, TIDAK dianggap paid,
//     TIDAK dianggap settled. Jangan menebak nominal.
//   - warehouseId = actual warehouse (dari FulfillmentAllocation), BUKAN
//     Product.defaultWarehouseId. Jika belum diketahui → undefined.
//   - courier boleh belum diketahui → undefined. Jangan menebak.
//   - Tidak ada automatic courier pricing / tarif eksternal. Owner memasukkan
//     nominal ongkir secara manual.
//
// Source of truth:
//   ACTUAL PAYMENT          → PaymentFact (Phase 1)
//   PAYMENT ALLOCATION      → PaymentAllocation (Phase 1)
//   SHIPPING OBLIGATION     → ShippingObligation (Phase 4)
//   SHIPPING OUTSTANDING    → derived = obligation − confirmed allocations
//   SHIPPING PAYMENT GATE   → derived dari outstanding
//
// Payment gate adalah DERIVED — bukan mutable source-of-truth field.
//   amount UNKNOWN (null) → UNKNOWN (bukan paid, bukan settled)
//   outstanding > 0       → PARTIALLY-PAID (jika ada allocation) / NOT-PAID
//   outstanding ≤ 0       → PAID
// =====================================================================

// Payment gate per shipping obligation (derived).
export type ShippingPaymentGate = "UNKNOWN" | "NOT-PAID" | "PARTIALLY-PAID" | "PAID";

// ---------------------------------------------------------------------
// SHIPPING OBLIGATION CRUD
// ---------------------------------------------------------------------

export function getShippingObligations(): ShippingObligation[] {
  return getAll<ShippingObligation>(KEYS.shippingObligations);
}

export function getShippingObligation(id: string): ShippingObligation | undefined {
  return getById<ShippingObligation>(KEYS.shippingObligations, id);
}

export function getShippingObligationsForOrder(orderId: string): ShippingObligation[] {
  return getShippingObligations().filter(s => s.orderId === orderId);
}

export function getShippingObligationsForCustomer(customerId: string): ShippingObligation[] {
  return getShippingObligations().filter(s => s.customerId === customerId);
}

// Buat Shipping Obligation. amount boleh null (UNKNOWN — belum diketahui).
// Owner memasukkan nominal ongkir secara manual; TIDAK ada automatic pricing.
export function addShippingObligation(input: {
  orderId: string;
  customerId: string;
  amount: number | null; // null = UNKNOWN (belum diketahui). Bukan Rp0.
  warehouseId?: string; // actual warehouse (dari FulfillmentAllocation)
  courier?: string; // boleh belum diketahui
  description?: string;
}): { ok: boolean; reason?: string; shippingObligation?: ShippingObligation } {
  if (!input.orderId) return { ok: false, reason: "orderId wajib diisi." };
  if (!input.customerId) return { ok: false, reason: "customerId wajib diisi." };
  if (input.amount !== null && !(input.amount >= 0)) {
    return { ok: false, reason: "Nominal ongkir tidak valid. Gunakan null untuk UNKNOWN." };
  }

  const now = Date.now();
  const shippingObligation: ShippingObligation = {
    id: "soblig-" + now + "-" + Math.random().toString(36).slice(2, 7),
    orderId: input.orderId,
    customerId: input.customerId,
    amount: input.amount,
    warehouseId: input.warehouseId,
    courier: input.courier,
    description: input.description,
    createdAt: now,
    updatedAt: now,
  };
  addOne(KEYS.shippingObligations, shippingObligation);
  return { ok: true, shippingObligation };
}

// Update Shipping Obligation (owner-controlled). amount boleh diubah dari
// UNKNOWN → known, atau known → known. Tidak boleh menghapus histori.
export function updateShippingObligation(
  id: string,
  patch: {
    amount?: number | null;
    warehouseId?: string;
    courier?: string;
    description?: string;
  }
): { ok: boolean; reason?: string; shippingObligation?: ShippingObligation } {
  const existing = getShippingObligation(id);
  if (!existing) return { ok: false, reason: "Shipping Obligation tidak ditemukan." };
  if (patch.amount !== undefined && patch.amount !== null && !(patch.amount >= 0)) {
    return { ok: false, reason: "Nominal ongkir tidak valid. Gunakan null untuk UNKNOWN." };
  }

  const updated: ShippingObligation = {
    ...existing,
    ...(patch.amount !== undefined ? { amount: patch.amount } : {}),
    ...(patch.warehouseId !== undefined ? { warehouseId: patch.warehouseId } : {}),
    ...(patch.courier !== undefined ? { courier: patch.courier } : {}),
    ...(patch.description !== undefined ? { description: patch.description } : {}),
    updatedAt: Date.now(),
  };
  updateOne(KEYS.shippingObligations, updated);
  return { ok: true, shippingObligation: updated };
}

// ---------------------------------------------------------------------
// SHIPPING OBLIGATION DERIVED (outstanding + payment gate)
// ---------------------------------------------------------------------

// Nominal ongkir yang diketahui. Jika UNKNOWN (null) → null.
// Jangan menganggap UNKNOWN sebagai Rp0.
export function getShippingObligationKnownAmount(id: string): number | null {
  const shipping = getShippingObligation(id);
  if (!shipping) return null;
  return shipping.amount;
}

// Total confirmed PaymentAllocation ke sebuah Shipping Obligation.
// Satu shipping obligation dapat menerima banyak allocation dari banyak payment.
export function getConfirmedShippingAllocationTotal(id: string): number {
  const target: PaymentAllocationTarget = {
    type: "shipping-obligation",
    referenceId: id,
  };
  return getPaymentAllocationsForTarget(target).reduce((sum, a) => sum + a.amount, 0);
}

// Outstanding ongkir = known amount − confirmed allocation. Clamp ≥ 0.
// Jika amount UNKNOWN (null) → null (tidak bisa dihitung; bukan Rp0).
export function getShippingOutstanding(id: string): number | null {
  const amount = getShippingObligationKnownAmount(id);
  if (amount === null) return null;
  return Math.max(0, amount - getConfirmedShippingAllocationTotal(id));
}

// Payment gate per shipping obligation (derived).
//   amount UNKNOWN (null) → UNKNOWN (bukan paid, bukan settled)
//   outstanding > 0       → PARTIALLY-PAID (jika ada allocation) / NOT-PAID
//   outstanding ≤ 0       → PAID
export function getShippingPaymentGate(id: string): ShippingPaymentGate {
  const amount = getShippingObligationKnownAmount(id);
  if (amount === null) return "UNKNOWN";
  const outstanding = getShippingOutstanding(id);
  if (outstanding === null) return "UNKNOWN";
  if (outstanding <= 0) return "PAID";
  const confirmed = getConfirmedShippingAllocationTotal(id);
  return confirmed > 0 ? "PARTIALLY-PAID" : "NOT-PAID";
}

// Apakah shipping obligation sudah lunas (derived). UNKNOWN → false.
export function isShippingObligationSettled(id: string): boolean {
  return getShippingPaymentGate(id) === "PAID";
}

// Sisa obligation yang masih dapat menerima allocation (untuk suggestion
// dan validasi over-allocation terhadap target shipping obligation).
// Jika amount UNKNOWN (null) → null (tidak bisa menentukan ceiling).
export function getShippingObligationRemaining(id: string): number | null {
  return getShippingOutstanding(id);
}

// =====================================================================
// SHIPPING OBLIGATION SUMMARY (derived, per order)
// =====================================================================
// Menyediakan derived summary tanpa membuat UI baru dan tanpa mengubah
// legacy order summary. Tidak ada entity baru — semua dihitung dari
// ShippingObligation + confirmed PaymentAllocation.
export type ShippingObligationSummary = {
  orderId: string;
  totalObligation: number; // jumlah nominal yang diketahui (UNKNOWN tidak dihitung)
  totalConfirmedAllocation: number;
  totalOutstanding: number;
  obligationCount: number;
  knownCount: number; // jumlah obligation dengan nominal diketahui
  unknownCount: number; // jumlah obligation dengan nominal UNKNOWN
  settledCount: number; // obligation lunas
  obligations: {
    id: string;
    amount: number | null;
    warehouseId?: string;
    courier?: string;
    confirmedAllocation: number;
    outstanding: number | null;
    paymentGate: ShippingPaymentGate;
  }[];
};

export function getShippingObligationSummary(orderId: string): ShippingObligationSummary {
  const obligations = getShippingObligationsForOrder(orderId);
  const rows = obligations.map(ob => {
    const confirmedAllocation = getConfirmedShippingAllocationTotal(ob.id);
    const outstanding = getShippingOutstanding(ob.id);
    return {
      id: ob.id,
      amount: ob.amount,
      warehouseId: ob.warehouseId,
      courier: ob.courier,
      confirmedAllocation,
      outstanding,
      paymentGate: getShippingPaymentGate(ob.id),
    };
  });
  return {
    orderId,
    totalObligation: rows.reduce((s, r) => s + (r.amount ?? 0), 0),
    totalConfirmedAllocation: rows.reduce((s, r) => s + r.confirmedAllocation, 0),
    totalOutstanding: rows.reduce((s, r) => s + (r.outstanding ?? 0), 0),
    obligationCount: rows.length,
    knownCount: rows.filter(r => r.amount !== null).length,
    unknownCount: rows.filter(r => r.amount === null).length,
    settledCount: rows.filter(r => r.paymentGate === "PAID").length,
    obligations: rows,
  };
}

// =====================================================================
// PROMISED PAYMENT (PHASE 5)
// =====================================================================
// Promised Payment adalah JANJI/komitmen customer untuk membayar di masa
// depan. TERPISAH dari PaymentFact (actual money received), PaymentAllocation
// (confirmed allocation), Product/Shipping Obligation, dan Deposit.
//
// Promise ≠ Payment. Promise ≠ Allocation. Promise TIDAK mengubah payment
// status menjadi paid. Hanya actual PaymentFact + confirmed allocation yang
// memengaruhi payment settlement.
//
// Source of truth:
//   PROMISED PAYMENT       → PromisedPayment (Phase 5)
//   ACTUAL PAYMENT         → PaymentFact (Phase 1)
//   CONFIRMED ALLOCATION   → PaymentAllocation (Phase 1)
//   FULFILLMENT (historical)→ derived = compare actual payment vs promisedDate
//
// Aturan final:
//   - Promise hanya menyimpan: customerId, promisedDate, amount (jika
//     diketahui), intendedObligation (jika diketahui), note/reference,
//     createdAt, updatedAt.
//   - Jika intended obligation belum diketahui → null/undefined. JANGAN
//     menebak allocation.
//   - Promise TIDAK membuat PaymentFact / PaymentAllocation / Deposit /
//     mengubah Product/Shipping Obligation / payment gate / packing.
//   - promisedDate eksplisit. TIDAK ada tolerance window / grace period /
//     overdue buffer.
//   - Customer dapat memiliki LEBIH DARI SATU promise. Promise lama TIDAK
//     dihapus hanya karena promise baru dibuat.
//   - Promise lateness hanya historical/operational signal — TIDAK otomatis
//     cancel/refund/forfeit/release stock/block/blacklist/mark paid.
// =====================================================================

// ---------------------------------------------------------------------
// PROMISED PAYMENT CRUD
// ---------------------------------------------------------------------

export function getPromisedPayments(): PromisedPayment[] {
  return getAll<PromisedPayment>(KEYS.promisedPayments);
}

export function getPromisedPayment(id: string): PromisedPayment | undefined {
  return getById<PromisedPayment>(KEYS.promisedPayments, id);
}

export function getPromisedPaymentsForCustomer(customerId: string): PromisedPayment[] {
  return getPromisedPayments()
    .filter(p => p.customerId === customerId)
    .sort((a, b) => a.promisedDate.localeCompare(b.promisedDate));
}

// Buat Promised Payment. Hanya menyimpan janji — TIDAK membuat PaymentFact,
// TIDAK membuat PaymentAllocation, TIDAK mengubah obligation/gate/deposit.
export function addPromisedPayment(input: {
  customerId: string;
  promisedDate: string; // eksplisit, YYYY-MM-DD. Tidak ada tolerance window.
  amount?: number | null; // null = belum diketahui. Jangan menebak.
  intendedObligation?: PaymentAllocationTarget; // INTENT saja, bukan allocation.
  note?: string;
  reference?: string;
}): { ok: boolean; reason?: string; promisedPayment?: PromisedPayment } {
  if (!input.customerId) return { ok: false, reason: "customerId wajib diisi." };
  if (!input.promisedDate) return { ok: false, reason: "promisedDate wajib diisi." };
  if (input.amount !== undefined && input.amount !== null && !(input.amount > 0)) {
    return { ok: false, reason: "Jumlah promise harus lebih dari 0, atau null jika belum diketahui." };
  }

  const now = Date.now();
  const promisedPayment: PromisedPayment = {
    id: "ppromise-" + now + "-" + Math.random().toString(36).slice(2, 7),
    customerId: input.customerId,
    promisedDate: input.promisedDate,
    amount: input.amount ?? null,
    intendedObligation: input.intendedObligation,
    note: input.note,
    reference: input.reference,
    createdAt: now,
    updatedAt: now,
  };
  addOne(KEYS.promisedPayments, promisedPayment);
  return { ok: true, promisedPayment };
}

// Update Promised Payment (owner-controlled). Tidak menghapus histori.
export function updatePromisedPayment(
  id: string,
  patch: {
    promisedDate?: string;
    amount?: number | null;
    intendedObligation?: PaymentAllocationTarget | null;
    note?: string;
    reference?: string;
  }
): { ok: boolean; reason?: string; promisedPayment?: PromisedPayment } {
  const existing = getPromisedPayment(id);
  if (!existing) return { ok: false, reason: "Promised Payment tidak ditemukan." };
  if (patch.promisedDate !== undefined && !patch.promisedDate) {
    return { ok: false, reason: "promisedDate tidak boleh kosong." };
  }
  if (patch.amount !== undefined && patch.amount !== null && !(patch.amount > 0)) {
    return { ok: false, reason: "Jumlah promise harus lebih dari 0, atau null jika belum diketahui." };
  }

  const updated: PromisedPayment = {
    ...existing,
    ...(patch.promisedDate !== undefined ? { promisedDate: patch.promisedDate } : {}),
    ...(patch.amount !== undefined ? { amount: patch.amount } : {}),
    ...(patch.intendedObligation !== undefined
      ? { intendedObligation: patch.intendedObligation ?? undefined }
      : {}),
    ...(patch.note !== undefined ? { note: patch.note } : {}),
    ...(patch.reference !== undefined ? { reference: patch.reference } : {}),
    updatedAt: Date.now(),
  };
  updateOne(KEYS.promisedPayments, updated);
  return { ok: true, promisedPayment: updated };
}

// Hapus Promised Payment (owner-controlled). Tidak menghapus histori payment.
export function deletePromisedPayment(id: string): PromisedPayment[] {
  return removeOne<PromisedPayment>(KEYS.promisedPayments, id);
}

// ---------------------------------------------------------------------
// PROMISED PAYMENT DERIVED (historical classification + fulfillment)
// ---------------------------------------------------------------------

// Historical classification promise vs actual payment (derived).
//   actual < promised  → "early"  (fulfilled early)
//   actual = promised  → "on-time" (fulfilled on time)
//   actual > promised  → "late"   (fulfilled late)
//   belum ada actual   → null     (pending/unfulfilled)
// TIDAK ada tolerance window / grace period / overdue buffer.
export type PromiseTiming = "early" | "on-time" | "late";

// Bandingkan actual payment date terhadap promised date.
// Return null jika belum ada actual payment (promise pending/unfulfilled).
export function getPromiseTiming(
  promisedDate: string,
  actualPaymentDate: string | null
): PromiseTiming | null {
  if (!actualPaymentDate) return null;
  const promised = new Date(promisedDate);
  const actual = new Date(actualPaymentDate);
  if (isNaN(promised.getTime()) || isNaN(actual.getTime())) return null;
  if (actual < promised) return "early";
  if (actual > promised) return "late";
  return "on-time";
}

// Fulfillment status promise (derived).
//   fulfilled  → ada actual payment yang memenuhi promise
//   partial    → ada actual payment tetapi belum memenuhi seluruh nominal
//   pending    → belum ada actual payment
// Promise TIDAK otomatis dianggap fulfilled hanya karena ada promise.
export type PromiseFulfillmentStatus = "fulfilled" | "partial" | "pending";

// Hitung fulfillment status berdasarkan actual payment yang tersedia.
// `actualPaidAmount` = jumlah actual payment yang relevan (disediakan caller
// dengan provenance). Jika promise.amount null (belum diketahui) dan ada
// actual payment → dianggap fulfilled (tidak bisa menentukan sisa).
export function getPromiseFulfillmentStatus(
  promise: PromisedPayment,
  actualPaidAmount: number
): PromiseFulfillmentStatus {
  if (actualPaidAmount <= 0) return "pending";
  if (promise.amount === null) return "fulfilled";
  if (actualPaidAmount >= promise.amount) return "fulfilled";
  return "partial";
}

// Sisa nominal promise yang belum terpenuhi (derived).
// Jika promise.amount null → null (tidak bisa dihitung).
// Jika actualPaidAmount >= amount → 0.
export function getPromiseRemainingAmount(
  promise: PromisedPayment,
  actualPaidAmount: number
): number | null {
  if (promise.amount === null) return null;
  return Math.max(0, promise.amount - actualPaidAmount);
}

// ---------------------------------------------------------------------
// PROMISED PAYMENT SUMMARY (derived, per customer)
// ---------------------------------------------------------------------
// Menyediakan derived summary tanpa membuat UI baru dan tanpa mengubah
// legacy. Tidak ada entity baru — semua dihitung dari PromisedPayment +
// actual PaymentFact (dengan provenance). Promise TIDAK mengubah
// PaymentFact / allocation / gate / deposit.
export type PromisedPaymentSummary = {
  customerId: string;
  totalPromised: number; // jumlah nominal promise yang diketahui
  unknownCount: number; // jumlah promise dengan nominal belum diketahui
  pendingCount: number;
  partialCount: number;
  fulfilledCount: number;
  promises: {
    id: string;
    promisedDate: string;
    amount: number | null;
    intendedObligation?: PaymentAllocationTarget;
    note?: string;
    reference?: string;
    timing: PromiseTiming | null; // null = belum ada actual payment
    fulfillmentStatus: PromiseFulfillmentStatus;
    remainingAmount: number | null;
    createdAt: number;
    updatedAt: number;
  }[];
};

// Bangun summary promise customer. `actualPaidAmount` dan `actualPaymentDate`
// disediakan caller dengan provenance (mis. total actual payment customer
// yang relevan). Promise TIDAK membuat allocation otomatis.
export function getPromisedPaymentSummary(
  customerId: string,
  actualPaidAmount: number,
  actualPaymentDate: string | null
): PromisedPaymentSummary {
  const promises = getPromisedPaymentsForCustomer(customerId);
  const rows = promises.map(p => {
    const timing = getPromiseTiming(p.promisedDate, actualPaymentDate);
    const fulfillmentStatus = getPromiseFulfillmentStatus(p, actualPaidAmount);
    const remainingAmount = getPromiseRemainingAmount(p, actualPaidAmount);
    return {
      id: p.id,
      promisedDate: p.promisedDate,
      amount: p.amount,
      intendedObligation: p.intendedObligation,
      note: p.note,
      reference: p.reference,
      timing,
      fulfillmentStatus,
      remainingAmount,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  });
  return {
    customerId,
    totalPromised: rows.reduce((s, r) => s + (r.amount ?? 0), 0),
    unknownCount: rows.filter(r => r.amount === null).length,
    pendingCount: rows.filter(r => r.fulfillmentStatus === "pending").length,
    partialCount: rows.filter(r => r.fulfillmentStatus === "partial").length,
    fulfilledCount: rows.filter(r => r.fulfillmentStatus === "fulfilled").length,
    promises: rows,
  };
}

// =====================================================================
// CANCELLATION + FINANCIAL RESOLUTION (PHASE 6)
// =====================================================================
// Cancellation adalah HISTORICAL FACT bahwa order/item dibatalkan. TERPISAH
// dari PaymentFact / PaymentAllocation / Deposit / Refund.
//
// Aturan final (TIDAK otomatis):
//   - Cancellation TIDAK menghapus PaymentFact / PaymentAllocation / histori.
//   - Cancellation TIDAK otomatis menentukan satu hasil universal. Owner
//     menentukan resolution manual (FORFEITED / REFUNDED / MOVED_TO_DEPOSIT /
//     REALLOCATED / OWNER_MANUAL).
//   - Cancellation dapat terjadi pada seluruh Order ATAU satu/beberapa
//     OrderItem. Satu item dibatalkan TIDAK membatalkan item lain.
//   - Reason adalah KONTEKS, bukan penentu otomatis refund.
//   - Jika resolution belum ditentukan → PENDING_OWNER_RESOLUTION.
//   - Cancellation TIDAK menghapus PromisedPayment / Shipping Obligation.
//   - Cancellation TIDAK melakukan inventory mutation / shipment / packing.
//   - Marketer fee TIDAK dihitung di Phase 6 — hanya outcome disediakan.
//
// Resolution adalah CONTROLLED/MANUAL abstraction yang AMAN:
//   - TIDAK menghapus / mengubah PaymentAllocation.
//   - TIDAK membuat PaymentAllocation baru (reallocate TIDAK otomatis).
//   - TIDAK membuat Deposit baru (deposit tetap derived dari unallocated).
//   - TIDAK membuat Refund otomatis (refund adalah event terpisah).
// =====================================================================

// ---------------------------------------------------------------------
// CANCELLATION CRUD
// ---------------------------------------------------------------------

export function getCancellations(): Cancellation[] {
  return getAll<Cancellation>(KEYS.cancellations);
}

export function getCancellation(id: string): Cancellation | undefined {
  return getById<Cancellation>(KEYS.cancellations, id);
}

export function getCancellationsForOrder(orderId: string): Cancellation[] {
  return getCancellations().filter(c => c.orderId === orderId);
}

export function getCancellationsForCustomer(customerId: string): Cancellation[] {
  return getCancellations().filter(c => c.customerId === customerId);
}

// Cancellation untuk satu OrderItem (item-level).
export function getCancellationsForItem(orderItemId: string): Cancellation[] {
  return getCancellations().filter(c => c.level === "item" && c.orderItemId === orderItemId);
}

// Buat Cancellation — historical fact. TIDAK menghapus histori, TIDAK
// membuat refund/deposit/reallocation otomatis. Owner menentukan resolution
// terpisah. Jika order/item tidak ditemukan → ditolak.
export function addCancellation(input: {
  orderId: string;
  customerId: string;
  level: CancellationLevel;
  orderItemId?: string;
  reason: CancellationReason;
  note?: string;
}): { ok: boolean; reason?: string; cancellation?: Cancellation } {
  if (!input.orderId) return { ok: false, reason: "orderId wajib diisi." };
  if (!input.customerId) return { ok: false, reason: "customerId wajib diisi." };
  if (input.level !== "order" && input.level !== "item") {
    return { ok: false, reason: "Level cancellation harus 'order' atau 'item'." };
  }
  if (input.level === "item" && !input.orderItemId) {
    return { ok: false, reason: "orderItemId wajib diisi untuk cancellation level item." };
  }

  const order = getOrder(input.orderId);
  if (!order) return { ok: false, reason: "Order tidak ditemukan." };
  if (input.level === "item") {
    const item = getOrderItem(input.orderItemId!);
    if (!item) return { ok: false, reason: "Order item tidak ditemukan." };
    if (item.orderId !== input.orderId) {
      return { ok: false, reason: "Order item tidak termasuk dalam order tersebut." };
    }
  }

  const now = Date.now();
  const cancellation: Cancellation = {
    id: "cancel-" + now + "-" + Math.random().toString(36).slice(2, 7),
    orderId: input.orderId,
    customerId: input.customerId,
    level: input.level,
    orderItemId: input.level === "item" ? input.orderItemId : undefined,
    reason: input.reason,
    note: input.note,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
  addOne(KEYS.cancellations, cancellation);
  return { ok: true, cancellation };
}

// Update Cancellation (owner-controlled). Tidak menghapus histori.
export function updateCancellation(
  id: string,
  patch: {
    reason?: CancellationReason;
    note?: string;
    status?: CancellationStatus;
  }
): { ok: boolean; reason?: string; cancellation?: Cancellation } {
  const existing = getCancellation(id);
  if (!existing) return { ok: false, reason: "Cancellation tidak ditemukan." };
  const updated: Cancellation = {
    ...existing,
    ...(patch.reason !== undefined ? { reason: patch.reason } : {}),
    ...(patch.note !== undefined ? { note: patch.note } : {}),
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    updatedAt: Date.now(),
  };
  updateOne(KEYS.cancellations, updated);
  return { ok: true, cancellation: updated };
}

// ---------------------------------------------------------------------
// CANCELLATION DERIVED (status + active obligation)
// ---------------------------------------------------------------------

// Apakah sebuah OrderItem dibatalkan (derived dari cancellation facts).
// Item yang dibatalkan TIDAK lagi menjadi active obligation untuk
// fulfillment. OrderItem itu sendiri TIDAK diubah — hanya status derived.
export function isOrderItemCancelled(orderItemId: string): boolean {
  return getCancellationsForItem(orderItemId).some(c => c.status !== "cancelled");
}

// Apakah sebuah Order dibatalkan (derived). Order-level cancellation.
export function isOrderCancelled(orderId: string): boolean {
  return getCancellationsForOrder(orderId).some(c => c.level === "order" && c.status !== "cancelled");
}

// ---------------------------------------------------------------------
// CANCELLATION RESOLUTION CRUD
// ---------------------------------------------------------------------

export function getCancellationResolutions(): CancellationResolution[] {
  return getAll<CancellationResolution>(KEYS.cancellationResolutions);
}

export function getCancellationResolution(id: string): CancellationResolution | undefined {
  return getById<CancellationResolution>(KEYS.cancellationResolutions, id);
}

export function getCancellationResolutionsForCancellation(cancellationId: string): CancellationResolution[] {
  return getCancellationResolutions().filter(r => r.cancellationId === cancellationId);
}

// Catat resolution owner terhadap allocation yang terdampak. Ini adalah
// CONTROLLED/MANUAL abstraction — TIDAK menghapus / mengubah allocation,
// TIDAK membuat allocation baru, TIDAK membuat deposit, TIDAK membuat refund
// otomatis. Hanya MENCATAT keputusan owner + provenance.
export function addCancellationResolution(input: {
  cancellationId: string;
  allocationId?: string;
  target?: PaymentAllocationTarget;
  resolution: CancellationResolutionType;
  amount: number;
  refundId?: string;
  reallocatedTo?: PaymentAllocationTarget;
  note?: string;
}): { ok: boolean; reason?: string; resolution?: CancellationResolution } {
  const cancellation = getCancellation(input.cancellationId);
  if (!cancellation) return { ok: false, reason: "Cancellation tidak ditemukan." };
  if (!(input.amount > 0)) return { ok: false, reason: "Jumlah resolution harus lebih dari 0." };
  const validResolutions: CancellationResolutionType[] = [
    "FORFEITED",
    "REFUNDED",
    "MOVED_TO_DEPOSIT",
    "REALLOCATED",
    "OWNER_MANUAL",
  ];
  if (!validResolutions.includes(input.resolution)) {
    return { ok: false, reason: "Resolution tidak valid." };
  }
  // REFUNDED wajib merujuk ke Refund event (dibuat terpisah oleh owner).
  if (input.resolution === "REFUNDED" && !input.refundId) {
    return { ok: false, reason: "Resolution REFUNDED memerlukan refundId (refund dibuat terpisah oleh owner)." };
  }
  // REALLOCATED wajib menyebut target tujuan (INTENT owner). Allocation baru
  // TIDAK dibuat otomatis — hanya dicatat sebagai keputusan.
  if (input.resolution === "REALLOCATED" && !input.reallocatedTo) {
    return { ok: false, reason: "Resolution REALLOCATED memerlukan reallocatedTo (target tujuan)." };
  }

  const now = Date.now();
  const resolution: CancellationResolution = {
    id: "cres-" + now + "-" + Math.random().toString(36).slice(2, 7),
    cancellationId: input.cancellationId,
    allocationId: input.allocationId,
    target: input.target,
    resolution: input.resolution,
    amount: input.amount,
    refundId: input.refundId,
    reallocatedTo: input.reallocatedTo,
    note: input.note,
    createdAt: now,
    updatedAt: now,
  };
  addOne(KEYS.cancellationResolutions, resolution);

  // Tandai cancellation sebagai resolved (owner sudah menentukan resolution).
  if (cancellation.status !== "resolved") {
    updateCancellation(cancellation.id, { status: "resolved" });
  }
  return { ok: true, resolution };
}

// ---------------------------------------------------------------------
// CANCELLATION RESOLUTION DERIVED
// ---------------------------------------------------------------------

// Status resolution sebuah cancellation (derived).
//   Jika belum ada resolution → PENDING_OWNER_RESOLUTION.
//   Jika ada → daftar resolution type yang dipilih owner.
export function getCancellationResolutionStatus(
  cancellationId: string
): { pending: boolean; resolutions: CancellationResolutionType[] } {
  const resolutions = getCancellationResolutionsForCancellation(cancellationId);
  if (resolutions.length === 0) {
    return { pending: true, resolutions: [] };
  }
  return {
    pending: false,
    resolutions: resolutions.map(r => r.resolution),
  };
}

// ---------------------------------------------------------------------
// REFUND CRUD
// ---------------------------------------------------------------------

export function getRefunds(): Refund[] {
  return getAll<Refund>(KEYS.refunds);
}

export function getRefund(id: string): Refund | undefined {
  return getById<Refund>(KEYS.refunds, id);
}

export function getRefundsForCustomer(customerId: string): Refund[] {
  return getRefunds().filter(r => r.customerId === customerId);
}

export function getRefundsForPayment(paymentId: string): Refund[] {
  return getRefunds().filter(r => r.paymentId === paymentId);
}

// Catat Refund — financial event/fact TERPISAH. Bukan negative payment.
// TIDAK menghapus / mengubah PaymentFact. Owner menentukan nominal refund.
// Refund TIDAK dibuat otomatis oleh cancellation — hanya oleh owner.
export function addRefund(input: {
  customerId: string;
  paymentId: string;
  allocationId?: string;
  target?: PaymentAllocationTarget;
  amount: number;
  reason: string;
}): { ok: boolean; reason?: string; refund?: Refund } {
  if (!input.customerId) return { ok: false, reason: "customerId wajib diisi." };
  if (!input.paymentId) return { ok: false, reason: "paymentId wajib diisi." };
  if (!(input.amount > 0)) return { ok: false, reason: "Jumlah refund harus lebih dari 0." };
  if (!input.reason) return { ok: false, reason: "Alasan refund wajib diisi." };

  const payment = getPaymentFact(input.paymentId);
  if (!payment) return { ok: false, reason: "PaymentFact tidak ditemukan." };
  if (payment.customerId !== input.customerId) {
    return { ok: false, reason: "PaymentFact tidak dimiliki customer tersebut." };
  }

  const refund: Refund = {
    id: "refund-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
    customerId: input.customerId,
    paymentId: input.paymentId,
    allocationId: input.allocationId,
    target: input.target,
    amount: input.amount,
    reason: input.reason,
    provenance: "owner-manual",
    createdAt: Date.now(),
  };
  addOne(KEYS.refunds, refund);
  return { ok: true, refund };
}

// Total refund untuk sebuah payment (derived). PaymentFact TIDAK diubah.
export function getTotalRefundedForPayment(paymentId: string): number {
  return getRefundsForPayment(paymentId).reduce((sum, r) => sum + r.amount, 0);
}

// ---------------------------------------------------------------------
// MARKETER FEE OUTCOME (derived — TIDAK menghitung nominal fee)
// ---------------------------------------------------------------------
// Phase 6 TIDAK menghitung marketer fee. Hanya menyediakan OUTCOME yang
// nantinya dapat digunakan Marketer Fee Engine (Phase berikutnya).
//
// Final marketer rules yang HARUS dijaga (dihitung di phase berikutnya):
//   1. Order/item sukses → fee normal.
//   2. Customer cancel → fee 50% dari fee normal item tersebut.
//   3. Customer mendapat refund karena udzur → fee 0%.
//   4. Cancellation karena kesalahan YasLa → fee 0%.
//   5. Jika satu invoice 6 item dan 1 item cancelled → hanya item cancelled
//      yang terkena outcome cancellation; 5 item lain tetap sesuai outcome.
// =====================================================================

// Outcome cancellation untuk future fee engine (derived, tanpa nominal fee).
export type CancellationFeeOutcome = {
  orderItemId: string;
  cancelled: boolean;
  reason: CancellationReason | null;
  resolution: CancellationResolutionType | null;
  refunded: boolean;
  forfeited: boolean;
  // Indikasi untuk future fee engine (bukan nominal fee):
  //   - customer cancel tanpa refund → fee 50% (dihitung phase berikutnya)
  //   - refund karena udzur / kesalahan YasLa → fee 0%
  feeOutcomeHint: "normal" | "half" | "zero" | "pending";
};

// Outcome cancellation untuk satu OrderItem (derived).
// Jika item tidak dibatalkan → cancelled=false, feeOutcomeHint="normal".
// Jika dibatalkan tetapi belum ada resolution → feeOutcomeHint="pending".
// TIDAK menghitung nominal fee.
export function getCancellationFeeOutcome(orderItemId: string): CancellationFeeOutcome {
  const cancellations = getCancellationsForItem(orderItemId);
  const active = cancellations.find(c => c.status !== "cancelled");
  if (!active) {
    return {
      orderItemId,
      cancelled: false,
      reason: null,
      resolution: null,
      refunded: false,
      forfeited: false,
      feeOutcomeHint: "normal",
    };
  }

  const resolutions = getCancellationResolutionsForCancellation(active.id);
  if (resolutions.length === 0) {
    return {
      orderItemId,
      cancelled: true,
      reason: active.reason,
      resolution: null,
      refunded: false,
      forfeited: false,
      feeOutcomeHint: "pending",
    };
  }

  const refunded = resolutions.some(r => r.resolution === "REFUNDED");
  const forfeited = resolutions.some(r => r.resolution === "FORFEITED");

  // Fee outcome hint (bukan nominal fee):
  //   - kesalahan YasLa → fee 0%
  //   - refund karena udzur → fee 0%
  //   - customer cancel tanpa refund (forfeit) → fee 50%
  //   - lainnya → pending (owner manual)
  let feeOutcomeHint: CancellationFeeOutcome["feeOutcomeHint"] = "pending";
  if (active.reason === "YASLA_ERROR") {
    feeOutcomeHint = "zero";
  } else if (refunded && active.reason === "CUSTOMER_UDZUR") {
    feeOutcomeHint = "zero";
  } else if (forfeited) {
    feeOutcomeHint = "half";
  }

  return {
    orderItemId,
    cancelled: true,
    reason: active.reason,
    resolution: resolutions[0].resolution,
    refunded,
    forfeited,
    feeOutcomeHint,
  };
}

// =====================================================================
// INVENTORY + FULFILLMENT (PHASE 8)
// =====================================================================
// Sistem harus mampu mengetahui hubungan antara:
//   ORDER ITEM → PRODUCT/SKU → WAREHOUSE → STOCK → READY/BELUM READY →
//   PAYMENT GATE → ALLOCATION/DIPISAHKAN → FULFILLMENT ELIGIBILITY.
//
// Prinsip final (DIKUNCI):
//   - DP ≠ LUNAS. Customer yang baru bayar DP TIDAK dianggap lunas, TIDAK
//     dianggap siap packing, TIDAK otomatis masuk fulfillment completed.
//   - READY adalah kondisi availability produk, BUKAN lunas / boleh packing /
//     sudah dikirim. READY ≠ NOT_READY.
//   - READY + BELUM LUNAS → stock boleh DIPISAHKAN tetapi TIDAK boleh packing.
//   - READY + LUNAS → ELIGIBLE UNTUK PACKING (eligibility ≠ actual action).
//   - READY STOCK ≠ otomatis dikirim (customer boleh menunggu item lain).
//   - CUSTOMER HOLD ≠ product not ready. Hold adalah keputusan menunggu
//     penggabungan, TIDAK mengubah payment / stock ownership.
//   - OWNER OVERRIDE: kondisi khusus yang tidak dapat disimpulkan sistem
//     ditentukan owner secara manual. Sistem TIDAK memaksa automatic behavior.
//   - NO AUTO STOCK SPLIT: satu OrderItem TIDAK otomatis dipecah antar
//     warehouse. Split hanya jika owner eksplisit.
//   - NO AUTO SHIPMENT: Phase 8 TIDAK membuat Shipment entity final.
//   - NO UI / NO MIGRATION / NO DUMMY.
//
// Payment gate (source of truth = Phase 2 Product Obligation):
//   getProductPaymentGate(orderItemId) → "LUNAS" | "NOT-LUNAS".
//   Inventory TIDAK membuat payment calculation kedua — hanya membaca gate.
//
// Stock state (tidak ambigu):
//   AVAILABLE   = stock fisik − allocated (belum dilepaskan)
//   DIPISAHKAN  = allocated (FulfillmentAllocation, belum released)
//   FULFILLED   = sudah masuk shipment (via ShipmentItem)
//   RELEASED    = allocation dilepaskan (cancellation resolution, owner)
// =====================================================================

// Fulfillment state sebuah OrderItem (derived). Menjawab "boleh masuk
// proses packing?" sesuai Business Rule #16:
//   READY + LUNAS                    → ELIGIBLE_FOR_PACKING
//   READY + BELUM LUNAS              → BLOCKED_BY_PAYMENT
//   BELUM READY                      → WAITING_READY
//   READY + LUNAS + CUSTOMER_HOLD    → HOLD_FOR_COMBINATION
// Eligibility ≠ actual action. Tidak otomatis mengubah menjadi PACKED.
export type OrderItemFulfillmentState =
  | "ELIGIBLE_FOR_PACKING"
  | "BLOCKED_BY_PAYMENT"
  | "WAITING_READY"
  | "HOLD_FOR_COMBINATION";

// Apakah customer/order sedang menahan penggabungan (customer hold).
// Hold = keputusan menunggu item lain dikirim bersamaan. TIDAK mengubah
// payment / stock ownership. Sumber: ShippingPreference "tunggu-lengkap"
// ATAU FulfillmentDecision "gabungkan"/"hold".
function isCustomerHold(customerId: string, orderId: string): boolean {
  const shipping = getEffectiveShippingPreference(customerId, orderId);
  if (shipping === "tunggu-lengkap") return true;
  const decision = getEffectiveFulfillmentDecision(customerId, orderId);
  if (decision === "gabungkan" || decision === "hold") return true;
  return false;
}

// Fulfillment state sebuah OrderItem (derived). Menggunakan Phase 2
// getProductPaymentGate sebagai source of truth payment settlement.
// Jika item/order tidak ditemukan → null.
export function getOrderItemFulfillmentState(orderItemId: string): OrderItemFulfillmentState | null {
  const item = getOrderItem(orderItemId);
  if (!item) return null;
  const order = getOrder(item.orderId);
  if (!order) return null;

  const ready = item.productionStatus === "ready-gudang";
  const lunas = getProductPaymentGate(orderItemId) === "LUNAS";
  const hold = isCustomerHold(order.customerId, order.id);

  if (!ready) return "WAITING_READY";
  if (!lunas) return "BLOCKED_BY_PAYMENT";
  if (hold) return "HOLD_FOR_COMBINATION";
  return "ELIGIBLE_FOR_PACKING";
}

// Apakah OrderItem boleh masuk proses packing (derived). Eligibility ≠ action.
export function isOrderItemEligibleForPacking(orderItemId: string): boolean {
  return getOrderItemFulfillmentState(orderItemId) === "ELIGIBLE_FOR_PACKING";
}

// Fulfillment eligibility agregat sebuah order (derived).
export type OrderFulfillmentEligibility = {
  orderId: string;
  items: { orderItemId: string; state: OrderItemFulfillmentState }[];
  allEligible: boolean;
  anyEligible: boolean;
  anyBlockedByPayment: boolean;
  anyWaitingReady: boolean;
  anyHold: boolean;
};

export function getOrderFulfillmentEligibility(orderId: string): OrderFulfillmentEligibility | null {
  const order = getOrder(orderId);
  if (!order) return null;
  const items = getItemsForOrder(orderId).map(i => ({
    orderItemId: i.id,
    state: getOrderItemFulfillmentState(i.id) ?? "WAITING_READY",
  }));
  return {
    orderId,
    items,
    allEligible: items.length > 0 && items.every(i => i.state === "ELIGIBLE_FOR_PACKING"),
    anyEligible: items.some(i => i.state === "ELIGIBLE_FOR_PACKING"),
    anyBlockedByPayment: items.some(i => i.state === "BLOCKED_BY_PAYMENT"),
    anyWaitingReady: items.some(i => i.state === "WAITING_READY"),
    anyHold: items.some(i => i.state === "HOLD_FOR_COMBINATION"),
  };
}

// Warehouse aktual sebuah OrderItem (derived). Sumber kebenaran actual =
// FulfillmentAllocation.warehouseId. Jika belum ada allocation → null.
export function getOrderItemWarehouse(orderItemId: string): string | null {
  return getItemWarehouse(orderItemId);
}

// Saldo stok sebuah produk di sebuah warehouse (derived). = stock fisik.
export function getInventoryBalance(productId: string, warehouseId: string): number {
  return getStockAtWarehouse(warehouseId, productId);
}

// Total quantity yang dialokasikan (DIPISAHKAN) untuk sebuah produk di
// sebuah warehouse. Hanya allocation yang BELUM dilepaskan (releasedAt
// kosong) yang dihitung. Allocation yang dilepaskan kembali ke AVAILABLE.
export function getAllocatedQuantityForProduct(productId: string, warehouseId: string): number {
  return getAllocations()
    .filter(a => a.warehouseId === warehouseId && !a.releasedAt)
    .reduce((sum, a) => {
      const item = getOrderItem(a.orderItemId);
      if (item && item.productId === productId) return sum + a.quantity;
      return sum;
    }, 0);
}

// Stok AVAILABLE sebuah produk di sebuah warehouse (derived).
//   available = stock fisik − allocated (belum dilepaskan).
// Tidak pernah negatif. Allocation yang dilepaskan kembali ke available.
export function getAvailableQuantity(productId: string, warehouseId: string): number {
  const stock = getInventoryBalance(productId, warehouseId);
  const allocated = getAllocatedQuantityForProduct(productId, warehouseId);
  return Math.max(0, stock - allocated);
}

// ---------------------------------------------------------------------
// OWNER-CONTROLLED CANCELLATION RELEASE (PHASE 8)
// ---------------------------------------------------------------------
// Business Rule #12: jika item cancelled dan allocation stock sebelumnya
// ada, allocation harus dapat dilepaskan/di-resolve agar stock kembali
// tersedia. TIDAK menghapus histori allocation (releasedAt disimpan).
// TIDAK membuat cancellation logic baru — memakai Cancellation Phase 6.
// Release adalah keputusan OWNER (tidak otomatis).
// ---------------------------------------------------------------------

// Lepaskan sebuah FulfillmentAllocation (owner-controlled). Allocation
// ditandai releasedAt sehingga stock kembali ke AVAILABLE. Histori
// allocation TIDAK dihapus. Jika sudah dilepaskan → ditolak (idempotent).
export function releaseAllocation(
  allocationId: string
): { ok: boolean; reason?: string; allocation?: FulfillmentAllocation } {
  const allocation = getAllocations().find(a => a.id === allocationId);
  if (!allocation) return { ok: false, reason: "Allocation tidak ditemukan." };
  if (allocation.releasedAt) {
    return { ok: false, reason: "Allocation sudah dilepaskan." };
  }
  const updated: FulfillmentAllocation = { ...allocation, releasedAt: Date.now() };
  updateAllocation(updated);
  return { ok: true, allocation: updated };
}

// Apakah sebuah allocation sudah dilepaskan (derived).
export function isAllocationReleased(allocationId: string): boolean {
  const allocation = getAllocations().find(a => a.id === allocationId);
  return Boolean(allocation?.releasedAt);
}

// ---------------------------------------------------------------------
// GENERIC FULFILLMENT DECISION SETTER (owner override)
// ---------------------------------------------------------------------
// Business Rule #18: owner dapat menentukan keputusan fulfillment secara
// manual untuk kondisi khusus. Upsert customer-level (orderId = null) atau
// order-level override. Tidak memaksa automatic behavior.
export function setFulfillmentDecision(
  customerId: string,
  orderId: string | null,
  value: FulfillmentDecisionValue,
  note?: string
): FulfillmentDecision[] {
  if (orderId) {
    return setOrderFulfillmentDecision(orderId, customerId, value, note);
  }
  return setCustomerFulfillmentDecision(customerId, value, note);
}

// =====================================================================
// PHASE 10 — OPERATIONAL STATE ENGINE (DERIVED)
// =====================================================================
// Lapisan DERIVED yang menjawab: "SEKARANG order/item ini kondisinya apa,
// dan owner perlu melakukan apa?".
//
// PRINSIP (DIKUNCI):
//   - TIDAK membuat source of truth kedua. Semua state diturunkan dari
//     Phase 1-9 (Payment, Product Obligation, Deposit, Shipping Obligation,
//     Promise, Cancellation, Marketer Fee, Inventory+Fulfillment, Shipment).
//   - TIDAK mengubah business rule Phase 1-9.
//   - TIDAK membuat enum baru jika existing state dapat digunakan.
//   - Menggunakan terminology existing + mapping derived.
//   - Promise hanya informasi kontekstual — TIDAK memblokir packing/shipment.
//   - DP ≠ LUNAS. Hanya LUNAS yang boleh packing/shipment.
//   - Jika kondisi tidak dapat disimpulkan aman → NEEDS_OWNER_DECISION.
//   - Priority: ready/urgent/older obligations, payment, readiness,
//     fulfillment, shipment issue. BUKAN nominal terkecil, BUKAN FIFO buta,
//     BUKAN promise-as-overdue.
// =====================================================================

// 16 core operational states + CANCELLED (Phase 6). Menggunakan terminology
// existing (FulfillmentStatus, ShipmentStatus, OrderItemFulfillmentState).
export type OperationalState =
  | "BELUM_BAYAR"
  | "DP_BELUM_LUNAS"
  | "MENUNGGU_READY"
  | "READY_BELUM_LUNAS"
  | "READY_LUNAS"
  | "SIAP_PACKING"
  | "SEDANG_PACKING"
  | "SUDAH_PACKING"
  | "HOLD_CUSTOMER"
  | "MENUNGGU_SHIPMENT"
  | "SHIPMENT_DIBUAT"
  | "DALAM_PENGIRIMAN"
  | "TERKIRIM"
  | "BERMASALAH"
  | "RETUR"
  | "SELESAI"
  | "CANCELLED";

// Next action actionable (bukan sekadar status).
export type OperationalNextAction =
  | "TAGIH_PELUNASAN"
  | "TUNGGU_READY"
  | "PACKING"
  | "BUAT_SHIPMENT"
  | "SIAP_DIKIRIM"
  | "PANTAU_PENGIRIMAN"
  | "TINDAK_LANJUTI_MASALAH"
  | "PROSES_RETUR"
  | "RESOLVE_CANCELLATION"
  | "NEEDS_OWNER_DECISION"
  | "TIDAK_ADA";

// Payment sub-state (derived dari Phase 2 Product Obligation).
// BELUM_BAYAR / DP_BELUM_LUNAS dapat dibedakan meskipun primary state
// fulfillment adalah READY_BELUM_LUNAS.
export type OperationalPaymentState = "BELUM_BAYAR" | "DP_BELUM_LUNAS" | "LUNAS";

// Status shipment sebuah OrderItem (derived dari ShipmentItem → Shipment).
function getItemShipmentStatus(orderItemId: string): ShipmentStatus | null {
  const shipmentItems = getShipmentItems().filter(si => si.orderItemId === orderItemId);
  if (shipmentItems.length === 0) return null;
  const shipment = getShipment(shipmentItems[0].shipmentId);
  return shipment ? shipment.status : null;
}

// Payment sub-state sebuah OrderItem (derived dari Phase 2).
export function getItemOperationalPaymentState(orderItemId: string): OperationalPaymentState {
  const gate = getProductPaymentGate(orderItemId);
  if (gate === "LUNAS") return "LUNAS";
  const confirmed = getConfirmedProductAllocationTotal(orderItemId);
  return confirmed > 0 ? "DP_BELUM_LUNAS" : "BELUM_BAYAR";
}

// Primary operational state sebuah OrderItem (derived). Precedence:
//   CANCELLED > shipment status > SHIPMENT_DIBUAT > SUDAH_PACKING >
//   SEDANG_PACKING > HOLD_CUSTOMER > MENUNGGU_READY > READY_BELUM_LUNAS >
//   SIAP_PACKING > READY_LUNAS.
export function getItemOperationalState(orderItemId: string): OperationalState | null {
  const item = getOrderItem(orderItemId);
  if (!item) return null;
  const order = getOrder(item.orderId);
  if (!order) return null;

  // 1. Cancellation (Phase 6) — highest priority.
  if (isOrderItemCancelled(orderItemId)) return "CANCELLED";

  // 2. Shipment status (Phase 9).
  const shipmentStatus = getItemShipmentStatus(orderItemId);
  if (shipmentStatus === "dalam-pengiriman") return "DALAM_PENGIRIMAN";
  if (shipmentStatus === "terkirim") return "TERKIRIM";
  if (shipmentStatus === "bermasalah") return "BERMASALAH";
  if (shipmentStatus === "retur") return "RETUR";
  if (shipmentStatus === "selesai") return "SELESAI";

  // 3. Fulfillment status (existing terminology).
  if (item.fulfillmentStatus === "menunggu-kurir") return "SHIPMENT_DIBUAT";
  if (item.fulfillmentStatus === "sudah-packing") return "SUDAH_PACKING";
  if (item.fulfillmentStatus === "siap-packing") return "SEDANG_PACKING";

  // 4. Phase 8 fulfillment state (source of truth payment + readiness + hold).
  const fState = getOrderItemFulfillmentState(orderItemId);
  if (fState === "HOLD_FOR_COMBINATION") return "HOLD_CUSTOMER";
  if (fState === "WAITING_READY") return "MENUNGGU_READY";
  if (fState === "BLOCKED_BY_PAYMENT") return "READY_BELUM_LUNAS";
  if (fState === "ELIGIBLE_FOR_PACKING") {
    const cond = getItemCondition(orderItemId);
    if (cond && cond.canPack) return "SIAP_PACKING";
    return "READY_LUNAS";
  }

  return "READY_LUNAS";
}

// Detail operasional sebuah OrderItem (derived). Menyediakan state primary,
// payment sub-state, next action, blocker, dan konteks promise (informasi
// saja — TIDAK memblokir). Semua diturunkan dari Phase 1-9.
export type ItemOperationalDetail = {
  orderItemId: string;
  orderId: string;
  productName: string;
  emoji: string;
  qty: number;
  state: OperationalState;
  paymentState: OperationalPaymentState;
  nextAction: OperationalNextAction;
  blocker: string | null;
  warehouseId: string | null;
  courier: string | null;
  remainingAllocation: number;
  // Promise hanya kontekstual — TIDAK memblokir packing/shipment.
  promiseContext: { late: boolean; pending: boolean } | null;
};

// Next action untuk sebuah OperationalState (derived).
function nextActionForState(state: OperationalState, orderItemId: string): OperationalNextAction {
  switch (state) {
    case "CANCELLED": {
      // Jika cancellation belum di-resolve → owner perlu memutuskan.
      const cancellations = getCancellationsForItem(orderItemId);
      const unresolved = cancellations.some(c => getCancellationResolutionStatus(c.id).pending);
      return unresolved ? "RESOLVE_CANCELLATION" : "TIDAK_ADA";
    }
    case "BERMASALAH":
      return "TINDAK_LANJUTI_MASALAH";
    case "RETUR":
      return "PROSES_RETUR";
    case "DALAM_PENGIRIMAN":
      return "PANTAU_PENGIRIMAN";
    case "TERKIRIM":
    case "SELESAI":
      return "TIDAK_ADA";
    case "SHIPMENT_DIBUAT":
      return "SIAP_DIKIRIM";
    case "SUDAH_PACKING":
    case "MENUNGGU_SHIPMENT":
      return "BUAT_SHIPMENT";
    case "SEDANG_PACKING":
      return "PACKING";
    case "HOLD_CUSTOMER":
      return "TUNGGU_READY";
    case "MENUNGGU_READY":
      return "TUNGGU_READY";
    case "READY_BELUM_LUNAS":
      return "TAGIH_PELUNASAN";
    case "SIAP_PACKING":
    case "READY_LUNAS":
      return "PACKING";
    case "BELUM_BAYAR":
    case "DP_BELUM_LUNAS":
      return "TAGIH_PELUNASAN";
  }
}

// Detail operasional sebuah OrderItem (derived).
export function getItemOperationalDetail(orderItemId: string): ItemOperationalDetail | null {
  const item = getOrderItem(orderItemId);
  if (!item) return null;
  const order = getOrder(item.orderId);
  if (!order) return null;

  const state = getItemOperationalState(orderItemId) ?? "READY_LUNAS";
  const paymentState = getItemOperationalPaymentState(orderItemId);
  const cond = getItemCondition(orderItemId);
  const nextAction = nextActionForState(state, orderItemId);

  // Promise kontekstual (informasi saja — TIDAK memblokir).
  let promiseContext: ItemOperationalDetail["promiseContext"] = null;
  const promises = getPromisedPaymentsForCustomer(order.customerId);
  if (promises.length > 0) {
    const latest = promises[promises.length - 1];
    const actualPaid = getPaidAmount(order.id);
    const fulfillment = getPromiseFulfillmentStatus(latest, actualPaid);
    const timing = getPromiseTiming(latest.promisedDate, new Date().toISOString().slice(0, 10));
    promiseContext = {
      late: timing === "late",
      pending: fulfillment === "pending" || fulfillment === "partial",
    };
  }

  return {
    orderItemId,
    orderId: item.orderId,
    productName: item.productName,
    emoji: item.emoji,
    qty: item.qty,
    state,
    paymentState,
    nextAction,
    blocker: cond ? cond.blocker : null,
    warehouseId: cond ? cond.warehouseId : null,
    courier: cond ? cond.courier : null,
    remainingAllocation: cond ? cond.remainingAllocation : 0,
    promiseContext,
  };
}

// =====================================================================
// ORDER-LEVEL OPERATIONAL STATE (derived)
// =====================================================================
// Primary operational state sebuah order = agregasi item states dengan
// precedence (urgent > actionable > waiting). Satu order hanya memiliki
// SATU primary operational state. Item states tetap tersedia di items[].
export type OrderOperationalState = {
  orderId: string;
  orderNumber: string;
  customerId: string;
  primary: OperationalState;
  primaryCondition: PrimaryCondition; // existing (Phase 2 engine)
  items: { orderItemId: string; state: OperationalState }[];
  nextAction: OperationalNextAction;
  needsOwnerDecision: boolean;
};

// Precedence order-level primary (1 = tertinggi).
const ORDER_STATE_PRECEDENCE: OperationalState[] = [
  "CANCELLED",
  "BERMASALAH",
  "RETUR",
  "DALAM_PENGIRIMAN",
  "TERKIRIM",
  "SHIPMENT_DIBUAT",
  "MENUNGGU_SHIPMENT",
  "SUDAH_PACKING",
  "SEDANG_PACKING",
  "SIAP_PACKING",
  "HOLD_CUSTOMER",
  "MENUNGGU_READY",
  "READY_BELUM_LUNAS",
  "DP_BELUM_LUNAS",
  "BELUM_BAYAR",
  "READY_LUNAS",
  "SELESAI",
];

// Primary operational state sebuah order (derived) — agregasi item states
// dengan precedence (urgent > actionable > waiting). Dipakai bersama oleh
// getOrderOperationalState dan getOperationalNextAction agar keduanya
// berbagi satu sumber perhitungan (tanpa saling memanggil).
function computeOrderPrimaryState(orderId: string): OperationalState {
  const items = getItemsForOrder(orderId)
    .map(i => getItemOperationalState(i.id) ?? "READY_LUNAS");
  let primary: OperationalState = "SELESAI";
  for (const candidate of ORDER_STATE_PRECEDENCE) {
    if (items.includes(candidate)) {
      primary = candidate;
      break;
    }
  }
  return primary;
}

// Next action order-level (derived) dari primary operational state + sinyal
// needsOwnerDecision. Murni (pure) — tidak memanggil fungsi order-level lain,
// sehingga memutus siklus getOrderOperationalState ↔ getOperationalNextAction.
function deriveNextAction(primary: OperationalState, needsOwnerDecision: boolean): OperationalNextAction {
  // NEEDS_OWNER_DECISION menang atas segalanya (ambiguity nyata).
  if (needsOwnerDecision) return "NEEDS_OWNER_DECISION";

  switch (primary) {
    case "CANCELLED":
      return "RESOLVE_CANCELLATION";
    case "BERMASALAH":
      return "TINDAK_LANJUTI_MASALAH";
    case "RETUR":
      return "PROSES_RETUR";
    case "DALAM_PENGIRIMAN":
      return "PANTAU_PENGIRIMAN";
    case "TERKIRIM":
    case "SELESAI":
      return "TIDAK_ADA";
    case "SHIPMENT_DIBUAT":
      return "SIAP_DIKIRIM";
    case "MENUNGGU_SHIPMENT":
    case "SUDAH_PACKING":
      return "BUAT_SHIPMENT";
    case "SEDANG_PACKING":
    case "SIAP_PACKING":
    case "READY_LUNAS":
      return "PACKING";
    case "HOLD_CUSTOMER":
    case "MENUNGGU_READY":
      return "TUNGGU_READY";
    case "READY_BELUM_LUNAS":
    case "DP_BELUM_LUNAS":
    case "BELUM_BAYAR":
      return "TAGIH_PELUNASAN";
  }
}

export function getOrderOperationalState(orderId: string): OrderOperationalState | null {
  const order = getOrder(orderId);
  if (!order) return null;

  const items = getItemsForOrder(orderId)
    .map(i => ({ orderItemId: i.id, state: getItemOperationalState(i.id) ?? "READY_LUNAS" }));

  const primary = computeOrderPrimaryState(orderId);
  const needsOwnerDecision = getNeedsOwnerDecision(orderId).needsDecision;

  return {
    orderId,
    orderNumber: order.number,
    customerId: order.customerId,
    primary,
    primaryCondition: getPrimaryCondition(orderId),
    items,
    nextAction: deriveNextAction(primary, needsOwnerDecision),
    needsOwnerDecision,
  };
}

// =====================================================================
// OPERATIONAL NEXT ACTION (order-level, derived)
// =====================================================================
// Satu primary action paling relevan untuk sebuah order. Menggunakan
// primary operational state + existing getNextAction sebagai fallback.
export function getOperationalNextAction(orderId: string): OperationalNextAction {
  const order = getOrder(orderId);
  if (!order) return "TIDAK_ADA";

  const primary = computeOrderPrimaryState(orderId);
  const needsOwnerDecision = getNeedsOwnerDecision(orderId).needsDecision;
  return deriveNextAction(primary, needsOwnerDecision);
}

// =====================================================================
// NEEDS OWNER DECISION (derived)
// =====================================================================
// Menandai kondisi yang TIDAK dapat disimpulkan aman oleh sistem sehingga
// memerlukan keputusan owner. Bukan error — hanya sinyal.
//   - Cancellation unresolved (Phase 6) → owner harus resolve.
//   - Order dibatalkan tetapi masih ada shipment aktif (Phase 9: cancellation
//     TIDAK otomatis membatalkan shipment) → owner harus memutuskan.
// Shipping Obligation UNKNOWN (Phase 4) TIDAK menjadi blocker / decision —
// hanya informasi (T16).
export type OwnerDecision = {
  orderId: string;
  needsDecision: boolean;
  reasons: string[];
};

export function getNeedsOwnerDecision(orderId: string): OwnerDecision {
  const reasons: string[] = [];

  // Cancellation unresolved (Phase 6).
  const cancellations = getCancellationsForOrder(orderId);
  for (const c of cancellations) {
    if (getCancellationResolutionStatus(c.id).pending) {
      reasons.push("cancellation-unresolved");
      break;
    }
  }

  // Order dibatalkan tetapi masih ada shipment aktif (Phase 9).
  if (isOrderCancelled(orderId)) {
    const hasActiveShipment = getShipmentItems().some(si => {
      const oi = getOrderItem(si.orderItemId);
      if (!oi || oi.orderId !== orderId) return false;
      const shipment = getShipment(si.shipmentId);
      return shipment && shipment.status !== "selesai" && shipment.status !== "terkirim";
    });
    if (hasActiveShipment) reasons.push("cancelled-with-active-shipment");
  }

  return { orderId, needsDecision: reasons.length > 0, reasons };
}

// =====================================================================
// OPERATIONAL PRIORITY (derived)
// =====================================================================
// Priority ranking untuk work queue. BUKAN nominal terkecil, BUKAN FIFO
// buta, BUKAN promise-as-overdue. Komponen (higher = lebih mendesak):
//   1. owner priority flag (keputusan manual)
//   2. urgent blocker (BERMASALAH / RETUR / cancellation unresolved)
//   3. siap dipenuhi (ready to ship / ready to pack)
//   4. payment outstanding (perlu ditagih)
//   5. dalam pengiriman (monitor)
//   6. menunggu (waiting)
//   7. age tiebreaker (order lebih tua sedikit lebih tinggi — bukan FIFO buta)
export type OperationalPriority = {
  orderId: string;
  orderNumber: string;
  score: number; // higher = lebih mendesak
  rank: number; // 1 = tertinggi
  reasons: string[];
};

export function getOperationalPriority(orderId: string): OperationalPriority | null {
  const order = getOrder(orderId);
  if (!order) return null;
  const op = getOrderOperationalState(orderId);
  if (!op) return null;

  let score = 0;
  const reasons: string[] = [];

  // 1. Owner priority flag (keputusan manual).
  if (order.priority) {
    score += 100;
    reasons.push("prioritas-owner");
  }

  // 2. Urgent blocker.
  if (op.primary === "BERMASALAH") { score += 80; reasons.push("bermasalah"); }
  if (op.primary === "RETUR") { score += 80; reasons.push("retur"); }
  if (op.needsOwnerDecision) { score += 80; reasons.push("needs-owner-decision"); }

  // 3. Siap dipenuhi (ready to ship / ready to pack).
  if (op.primary === "MENUNGGU_SHIPMENT" || op.primary === "SUDAH_PACKING") {
    score += 60;
    reasons.push("siap-shipment");
  }
  if (op.primary === "SIAP_PACKING" || op.primary === "READY_LUNAS") {
    score += 50;
    reasons.push("siap-packing");
  }

  // 4. Payment outstanding (perlu ditagih).
  if (op.primary === "READY_BELUM_LUNAS" || op.primary === "DP_BELUM_LUNAS" || op.primary === "BELUM_BAYAR") {
    score += 40;
    reasons.push("perlu-ditagih");
  }

  // 5. Dalam pengiriman (monitor).
  if (op.primary === "DALAM_PENGIRIMAN" || op.primary === "SHIPMENT_DIBUAT") {
    score += 30;
    reasons.push("dalam-pengiriman");
  }

  // 6. Menunggu.
  if (op.primary === "MENUNGGU_READY" || op.primary === "HOLD_CUSTOMER") {
    score += 10;
    reasons.push("menunggu");
  }

  // 7. Age tiebreaker (order lebih tua sedikit lebih tinggi — bukan FIFO buta).
  const ageDays = Math.max(0, (Date.now() - (order.createdAt ?? Date.now())) / 86400000);
  score += Math.min(20, ageDays);

  return { orderId, orderNumber: order.number, score, rank: 0, reasons };
}

// =====================================================================
// OPERATIONAL WORK QUEUE (derived, ranked)
// =====================================================================
// Semua order yang memerlukan tindakan, diurutkan berdasarkan priority
// (score descending). Order SELESAI / TERKIRIM tidak masuk queue aktif.
export type OperationalWorkQueueItem = {
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  primary: OperationalState;
  nextAction: OperationalNextAction;
  priority: OperationalPriority;
  needsOwnerDecision: boolean;
};

export function getOperationalWorkQueue(): OperationalWorkQueueItem[] {
  const items: OperationalWorkQueueItem[] = [];

  for (const order of getOrders()) {
    const op = getOrderOperationalState(order.id);
    if (!op) continue;
    // Order selesai / terkirim tidak perlu tindakan.
    if (op.primary === "SELESAI" || op.primary === "TERKIRIM") continue;

    const priority = getOperationalPriority(order.id);
    if (!priority) continue;

    const customer = getCustomer(order.customerId);
    items.push({
      orderId: order.id,
      orderNumber: order.number,
      customerId: order.customerId,
      customerName: customer ? customer.name : "—",
      primary: op.primary,
      nextAction: op.nextAction,
      priority,
      needsOwnerDecision: op.needsOwnerDecision,
    });
  }

  // Rank by score descending (higher = lebih mendesak).
  items.sort((a, b) => b.priority.score - a.priority.score);
  items.forEach((it, idx) => {
    it.priority.rank = idx + 1;
  });

  return items;
}







