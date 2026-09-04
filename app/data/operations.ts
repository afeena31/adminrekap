"use client";

// =====================================================================
// OPERATIONS DOMAIN MODEL
// =====================================================================
// Filosofi: Customer adalah pusat sistem.
// Order hanyalah aktivitas customer.
// Invoice hanyalah transaksi customer.
// Payment hanyalah pembayaran customer.
// Shipment hanyalah konsekuensi dari keputusan fulfillment.
// Gudang hanyalah lokasi barang customer.
// Batch hanyalah informasi produksi customer.
// Resi hanyalah bukti pengiriman customer.
//
// Setiap produk (Order Item) memiliki Product Status Card sendiri.
// Admin tidak memilih status — admin memilih AKSI, sistem mengubah status.
// =====================================================================

// ===== ENUM: STATUS PEMBAYARAN =====
export type PaymentStatus =
  | "belum-bayar"
  | "dp"
  | "lunas-sebagian"
  | "lunas"
  | "refund"
  | "bermasalah";

export const paymentStatusInfo: Record<PaymentStatus, { name: string; emoji: string; tone: string }> = {
  "belum-bayar": { name: "Belum Bayar", emoji: "🔴", tone: "unpaid" },
  "dp": { name: "DP", emoji: "🟡", tone: "dp" },
  "lunas-sebagian": { name: "Lunas Sebagian", emoji: "🟠", tone: "partial" },
  "lunas": { name: "Lunas", emoji: "🟢", tone: "paid" },
  "refund": { name: "Refund", emoji: "🔵", tone: "refund" },
  "bermasalah": { name: "Bermasalah", emoji: "⛔", tone: "problem" },
};

// ===== ENUM: STATUS PROGRESS =====
export type ProgressStatus =
  | "po"
  | "menunggu-batch"
  | "produksi"
  | "qc"
  | "ready-gudang"
  | "siap-packing"
  | "sedang-packing"
  | "perlu-input-resi"
  | "sudah-dikirim"
  | "selesai"
  | "retur";

export const progressStatusInfo: Record<ProgressStatus, { name: string; emoji: string; tone: string }> = {
  "po": { name: "PO", emoji: "📝", tone: "po" },
  "menunggu-batch": { name: "Menunggu Batch", emoji: "⏳", tone: "waiting" },
  "produksi": { name: "Produksi", emoji: "🏭", tone: "production" },
  "qc": { name: "QC", emoji: "🔍", tone: "qc" },
  "ready-gudang": { name: "Ready Gudang", emoji: "✅", tone: "ready" },
  "siap-packing": { name: "Siap Packing", emoji: "📦", tone: "packing" },
  "sedang-packing": { name: "Sedang Packing", emoji: "📦", tone: "packing" },
  "perlu-input-resi": { name: "Perlu Input Resi", emoji: "🧾", tone: "resi" },
  "sudah-dikirim": { name: "Sudah Dikirim", emoji: "🚚", tone: "shipped" },
  "selesai": { name: "Selesai", emoji: "🎉", tone: "done" },
  "retur": { name: "Retur", emoji: "↩️", tone: "retur" },
};

// ===== ENUM: LOKASI =====
export type LocationType =
  | "gudang-purwakarta"
  | "gudang-bekasi"
  | "produksi"
  | "vendor";

export const locationInfo: Record<LocationType, { name: string; emoji: string }> = {
  "gudang-purwakarta": { name: "Gudang Purwakarta", emoji: "🏬" },
  "gudang-bekasi": { name: "Gudang Bekasi", emoji: "🏬" },
  "produksi": { name: "Produksi", emoji: "🏭" },
  "vendor": { name: "Vendor", emoji: "🤝" },
};

// ===== ENUM: RENCANA PENGIRIMAN =====
export type ShippingPlan =
  | "belum-ditentukan"
  | "gabung-produk-lain"
  | "kirim-terpisah"
  | "hold-customer"
  | "hold-admin"
  | "sudah-dikirim";

export const shippingPlanInfo: Record<ShippingPlan, { name: string; emoji: string; tone: string }> = {
  "belum-ditentukan": { name: "Belum Ditentukan", emoji: "❓", tone: "undecided" },
  "gabung-produk-lain": { name: "Gabung dengan Produk Lain", emoji: "📦", tone: "combine" },
  "kirim-terpisah": { name: "Kirim Terpisah", emoji: "📤", tone: "separate" },
  "hold-customer": { name: "Hold Customer", emoji: "⏸️", tone: "hold" },
  "hold-admin": { name: "Hold Admin", emoji: "⏸️", tone: "hold" },
  "sudah-dikirim": { name: "Sudah Dikirim", emoji: "🚚", tone: "shipped" },
};

// ===== ENUM: AKSI BERIKUTNYA =====
export type NextAction =
  | "tagih-pelunasan"
  | "mulai-produksi"
  | "mulai-packing"
  | "input-resi"
  | "cetak-label"
  | "serahkan-kurir"
  | "hubungi-customer"
  | "tidak-ada";

export const nextActionInfo: Record<NextAction, { name: string; emoji: string; tone: string }> = {
  "tagih-pelunasan": { name: "Tagih Pelunasan", emoji: "💰", tone: "red" },
  "mulai-produksi": { name: "Mulai Produksi", emoji: "🏭", tone: "yellow" },
  "mulai-packing": { name: "Mulai Packing", emoji: "📦", tone: "yellow" },
  "input-resi": { name: "Input Resi", emoji: "🧾", tone: "green" },
  "cetak-label": { name: "Cetak Label", emoji: "🏷️", tone: "green" },
  "serahkan-kurir": { name: "Serahkan ke Kurir", emoji: "🚚", tone: "green" },
  "hubungi-customer": { name: "Hubungi Customer", emoji: "📞", tone: "blue" },
  "tidak-ada": { name: "Tidak Ada", emoji: "✅", tone: "none" },
};

// ===== ENUM: FULFILLMENT DECISION =====
export type FulfillmentDecision =
  | "gabung-pengiriman"
  | "kirim-terpisah"
  | "hold-customer"
  | "hold-admin"
  | "prioritas"
  | "retur"
  | "batal"
  | "cancel-po"
  | "cancel-tanpa-konfirmasi";


export const fulfillmentDecisionInfo: Record<FulfillmentDecision, { name: string; emoji: string; tone: string }> = {
  "gabung-pengiriman": { name: "Gabung Pengiriman", emoji: "📦", tone: "combine" },
  "kirim-terpisah": { name: "Kirim Terpisah", emoji: "📤", tone: "separate" },
  "hold-customer": { name: "Hold Customer", emoji: "⏸️", tone: "hold" },
  "hold-admin": { name: "Hold Admin", emoji: "⏸️", tone: "hold" },
  "prioritas": { name: "Prioritas", emoji: "⭐", tone: "priority" },
  "retur": { name: "Retur", emoji: "↩️", tone: "retur" },
  "batal": { name: "Batal", emoji: "❌", tone: "cancel" },
  "cancel-po": { name: "Cancel PO", emoji: "🚫", tone: "cancel" },
  "cancel-tanpa-konfirmasi": { name: "Cancel Tanpa Konfirmasi", emoji: "⛔", tone: "cancel" },
};


// ===== ENUM: SHIPMENT STATUS =====
export type ShipmentStatus =
  | "belum-dibuat"
  | "menunggu-pickup"
  | "dalam-perjalanan"
  | "delivered"
  | "retur";

export const shipmentStatusInfo: Record<ShipmentStatus, { name: string; emoji: string; tone: string }> = {
  "belum-dibuat": { name: "Belum Dibuat", emoji: "📭", tone: "none" },
  "menunggu-pickup": { name: "Menunggu Pick Up", emoji: "⏳", tone: "waiting" },
  "dalam-perjalanan": { name: "Dalam Perjalanan", emoji: "🚚", tone: "shipped" },
  "delivered": { name: "Delivered", emoji: "✅", tone: "done" },
  "retur": { name: "Retur", emoji: "↩️", tone: "retur" },
};

// ===== PRODUCT STATUS CARD =====
// Setiap item produk dalam order memiliki kartu status sendiri.
export type ProductStatusCard = {
  id: string;
  orderId: string;
  orderNumber: string;
  productName: string;
  emoji: string;
  qty: number;
  price: number;
  invoiceNumber?: string;

  // 5 dimensi status (bukan satu field shipment_status)
  paymentStatus: PaymentStatus;
  progressStatus: ProgressStatus;
  location: LocationType;
  shippingPlan: ShippingPlan;
  nextAction: NextAction;

  // Keputusan operasional (bukan status)
  fulfillmentDecision: FulfillmentDecision;

  // Shipment (konsekuensi dari fulfillment)
  shipmentStatus: ShipmentStatus;
  resiNumber?: string;
  courier?: string;
  batchName?: string;
  batchEstimateReady?: string;

  // Blocker / hambatan
  blocker?: string;

  // Timeline per produk
  timeline: TimelineEvent[];
};

// ===== TIMELINE EVENT =====
export type TimelineEvent = {
  id: string;
  time: string;
  title: string;
  desc?: string;
  type: "order" | "invoice" | "payment" | "batch" | "qc" | "ready" | "packing" | "resi" | "delivered" | "note" | "decision";
};

export const timelineTypeInfo: Record<TimelineEvent["type"], { name: string; emoji: string }> = {
  "order": { name: "Order", emoji: "🛒" },
  "invoice": { name: "Invoice", emoji: "🧾" },
  "payment": { name: "Payment", emoji: "💰" },
  "batch": { name: "Batch", emoji: "📦" },
  "qc": { name: "QC", emoji: "🔍" },
  "ready": { name: "Ready", emoji: "✅" },
  "packing": { name: "Packing", emoji: "📦" },
  "resi": { name: "Resi", emoji: "🧾" },
  "delivered": { name: "Delivered", emoji: "🎉" },
  "note": { name: "Catatan", emoji: "📝" },
  "decision": { name: "Keputusan", emoji: "🧭" },
};

// ===== ACTION CENTER ITEM =====
export type ActionItem = {
  id: string;
  priority: "red" | "yellow" | "green" | "blue";
  title: string;
  desc?: string;
  productId?: string;
  action: NextAction;
};

// ===== CUSTOMER OPERATIONS =====
// Data operasional customer — semua sudut pandang terhadap customer.
export type CustomerOperations = {
  customerId: string;
  productCards: ProductStatusCard[];
  timeline: TimelineEvent[];
  actionCenter: ActionItem[];
  attention: { title: string; desc: string }[];
  fulfillmentDecision: FulfillmentDecision;
  fulfillmentDecisionNote: string;
};

// ===== AKSI → STATUS TRANSITIONS =====
// Admin memilih AKSI, sistem mengubah status otomatis.
// Ini adalah "state machine" yang menghubungkan aksi ke perubahan status.

export type ActionType =
  | "catat-dp"
  | "catat-pelunasan"
  | "mulai-produksi"
  | "selesai-produksi"
  | "qc-selesai"
  | "masuk-gudang"
  | "mulai-packing"
  | "packing-selesai"
  | "input-resi"
  | "kurir-pickup"
  | "delivered"
  | "hold-customer"
  | "hold-admin"
  | "release-hold"
  | "gabung-pengiriman"
  | "kirim-terpisah"
  | "prioritas"
  | "retur"
  | "batal"
  | "cancel-po"
  | "cancel-tanpa-konfirmasi";

export const actionTypeInfo: Record<ActionType, { name: string; emoji: string }> = {

  "catat-dp": { name: "Catat DP", emoji: "💰" },
  "catat-pelunasan": { name: "Catat Pelunasan", emoji: "✅" },
  "mulai-produksi": { name: "Mulai Produksi", emoji: "🏭" },
  "selesai-produksi": { name: "Selesai Produksi", emoji: "🏭" },
  "qc-selesai": { name: "QC Selesai", emoji: "🔍" },
  "masuk-gudang": { name: "Masuk Gudang", emoji: "🏬" },
  "mulai-packing": { name: "Mulai Packing", emoji: "📦" },
  "packing-selesai": { name: "Packing Selesai", emoji: "📦" },
  "input-resi": { name: "Input Resi", emoji: "🧾" },
  "kurir-pickup": { name: "Kurir Pick Up", emoji: "🚚" },
  "delivered": { name: "Delivered", emoji: "🎉" },
  "hold-customer": { name: "Hold Customer", emoji: "⏸️" },
  "hold-admin": { name: "Hold Admin", emoji: "⏸️" },
  "release-hold": { name: "Release Hold", emoji: "▶️" },
  "gabung-pengiriman": { name: "Gabung Pengiriman", emoji: "📦" },
  "kirim-terpisah": { name: "Kirim Terpisah", emoji: "📤" },
  "prioritas": { name: "Prioritas", emoji: "⭐" },
  "retur": { name: "Retur", emoji: "↩️" },
  "batal": { name: "Batal", emoji: "❌" },
  "cancel-po": { name: "Cancel PO", emoji: "🚫" },
  "cancel-tanpa-konfirmasi": { name: "Cancel Tanpa Konfirmasi", emoji: "⛔" },
};


// ===== STATE MACHINE: AKSI → PERUBAHAN STATUS =====
// Setiap aksi menghasilkan perubahan pada Product Status Card.
export type ActionEffect = {
  paymentStatus?: PaymentStatus;
  progressStatus?: ProgressStatus;
  location?: LocationType;
  shippingPlan?: ShippingPlan;
  nextAction?: NextAction;
  fulfillmentDecision?: FulfillmentDecision;
  shipmentStatus?: ShipmentStatus;
  blocker?: string;
  timelineEvent?: { title: string; desc?: string; type: TimelineEvent["type"] };
};

export const actionEffects: Record<ActionType, ActionEffect> = {
  "catat-dp": {
    paymentStatus: "dp",
    nextAction: "tagih-pelunasan",
    timelineEvent: { title: "DP diterima", type: "payment" },
  },
  "catat-pelunasan": {
    paymentStatus: "lunas",
    nextAction: "tidak-ada",
    timelineEvent: { title: "Pelunasan diterima", type: "payment" },
  },
  "mulai-produksi": {
    progressStatus: "produksi",
    location: "produksi",
    nextAction: "tidak-ada",
    timelineEvent: { title: "Produksi dimulai", type: "batch" },
  },
  "selesai-produksi": {
    progressStatus: "qc",
    nextAction: "tidak-ada",
    timelineEvent: { title: "Produksi selesai, masuk QC", type: "qc" },
  },
  "qc-selesai": {
    progressStatus: "ready-gudang",
    location: "gudang-purwakarta",
    nextAction: "mulai-packing",
    timelineEvent: { title: "QC selesai, ready gudang", type: "ready" },
  },
  "masuk-gudang": {
    progressStatus: "ready-gudang",
    location: "gudang-purwakarta",
    nextAction: "mulai-packing",
    timelineEvent: { title: "Barang masuk gudang", type: "ready" },
  },
  "mulai-packing": {
    progressStatus: "sedang-packing",
    nextAction: "tidak-ada",
    timelineEvent: { title: "Packing dimulai", type: "packing" },
  },
  "packing-selesai": {
    progressStatus: "perlu-input-resi",
    nextAction: "input-resi",
    timelineEvent: { title: "Packing selesai", type: "packing" },
  },
  "input-resi": {
    progressStatus: "sudah-dikirim",
    shipmentStatus: "menunggu-pickup",
    shippingPlan: "sudah-dikirim",
    nextAction: "serahkan-kurir",
    timelineEvent: { title: "Resi dibuat", type: "resi" },
  },
  "kurir-pickup": {
    shipmentStatus: "dalam-perjalanan",
    nextAction: "tidak-ada",
    timelineEvent: { title: "Kurir pick up", type: "resi" },
  },
  "delivered": {
    progressStatus: "selesai",
    shipmentStatus: "delivered",
    nextAction: "tidak-ada",
    timelineEvent: { title: "Delivered", type: "delivered" },
  },
  "hold-customer": {
    fulfillmentDecision: "hold-customer",
    shippingPlan: "hold-customer",
    nextAction: "hubungi-customer",
    blocker: "Menunggu keputusan customer",
    timelineEvent: { title: "Hold atas permintaan customer", type: "decision" },
  },
  "hold-admin": {
    fulfillmentDecision: "hold-admin",
    shippingPlan: "hold-admin",
    nextAction: "tidak-ada",
    blocker: "Ditahan admin",
    timelineEvent: { title: "Hold oleh admin", type: "decision" },
  },
  "release-hold": {
    fulfillmentDecision: "gabung-pengiriman",
    shippingPlan: "gabung-produk-lain",
    nextAction: "mulai-packing",
    blocker: undefined,
    timelineEvent: { title: "Hold dilepas", type: "decision" },
  },
  "gabung-pengiriman": {
    fulfillmentDecision: "gabung-pengiriman",
    shippingPlan: "gabung-produk-lain",
    nextAction: "mulai-packing",
    timelineEvent: { title: "Keputusan: gabung pengiriman", type: "decision" },
  },
  "kirim-terpisah": {
    fulfillmentDecision: "kirim-terpisah",
    shippingPlan: "kirim-terpisah",
    nextAction: "mulai-packing",
    timelineEvent: { title: "Keputusan: kirim terpisah", type: "decision" },
  },
  "prioritas": {
    fulfillmentDecision: "prioritas",
    nextAction: "mulai-packing",
    timelineEvent: { title: "Ditandai prioritas", type: "decision" },
  },
  "retur": {
    progressStatus: "retur",
    shipmentStatus: "retur",
    fulfillmentDecision: "retur",
    nextAction: "tidak-ada",
    timelineEvent: { title: "Retur diproses", type: "note" },
  },
  "batal": {
    fulfillmentDecision: "batal",
    nextAction: "tidak-ada",
    blocker: "Order dibatalkan",
    timelineEvent: { title: "Order dibatalkan", type: "note" },
  },
  "cancel-po": {
    fulfillmentDecision: "cancel-po",
    nextAction: "tidak-ada",
    blocker: "PO dibatalkan",
    timelineEvent: { title: "PO dibatalkan", type: "note" },
  },
  "cancel-tanpa-konfirmasi": {
    fulfillmentDecision: "cancel-tanpa-konfirmasi",
    nextAction: "tidak-ada",
    blocker: "Dibatalkan tanpa konfirmasi",
    timelineEvent: { title: "Dibatalkan tanpa konfirmasi", type: "note" },
  },
};


// ===== HELPER: Terapkan aksi ke Product Status Card =====
export function applyAction(card: ProductStatusCard, action: ActionType): ProductStatusCard {
  const effect = actionEffects[action];
  const updated: ProductStatusCard = {
    ...card,
    paymentStatus: effect.paymentStatus ?? card.paymentStatus,
    progressStatus: effect.progressStatus ?? card.progressStatus,
    location: effect.location ?? card.location,
    shippingPlan: effect.shippingPlan ?? card.shippingPlan,
    nextAction: effect.nextAction ?? card.nextAction,
    fulfillmentDecision: effect.fulfillmentDecision ?? card.fulfillmentDecision,
    shipmentStatus: effect.shipmentStatus ?? card.shipmentStatus,
    blocker: effect.blocker !== undefined ? effect.blocker : card.blocker,
  };
  if (effect.timelineEvent) {
    updated.timeline = [
      ...card.timeline,
      {
        id: "evt-" + Date.now(),
        time: new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
        title: effect.timelineEvent.title,
        desc: effect.timelineEvent.desc,
        type: effect.timelineEvent.type,
      },
    ];
  }
  return updated;
}

// ===== HELPER: Aksi yang tersedia untuk sebuah card =====
// Berdasarkan status saat ini, sistem menyarankan aksi yang valid.
export function getAvailableActions(card: ProductStatusCard): ActionType[] {
  const actions: ActionType[] = [];

  // Payment actions
  if (card.paymentStatus === "belum-bayar") actions.push("catat-dp");
  if (card.paymentStatus === "dp" || card.paymentStatus === "lunas-sebagian") actions.push("catat-pelunasan");

  // Progress actions
  if (card.progressStatus === "po" || card.progressStatus === "menunggu-batch") actions.push("mulai-produksi");
  if (card.progressStatus === "produksi") actions.push("selesai-produksi");
  if (card.progressStatus === "qc") actions.push("qc-selesai");
  if (card.progressStatus === "ready-gudang" || card.progressStatus === "siap-packing") actions.push("mulai-packing");
  if (card.progressStatus === "sedang-packing") actions.push("packing-selesai");
  if (card.progressStatus === "perlu-input-resi") actions.push("input-resi");

  // Shipment actions
  if (card.shipmentStatus === "menunggu-pickup") actions.push("kurir-pickup");
  if (card.shipmentStatus === "dalam-perjalanan") actions.push("delivered");

  // Fulfillment decisions
  if (card.fulfillmentDecision === "hold-customer" || card.fulfillmentDecision === "hold-admin") {
    actions.push("release-hold");
  } else if (card.progressStatus !== "selesai" && card.progressStatus !== "retur") {
    actions.push("gabung-pengiriman");
    actions.push("kirim-terpisah");
    actions.push("hold-customer");
    actions.push("hold-admin");
    actions.push("prioritas");
  }

  // Terminal states — termasuk cancel PO & cancel tanpa konfirmasi
  if (card.progressStatus !== "selesai" && card.progressStatus !== "retur") {
    actions.push("retur");
    actions.push("batal");
    actions.push("cancel-po");
    actions.push("cancel-tanpa-konfirmasi");
  }


  return actions;
}

// ===== HELPER: Hitung Next Action otomatis =====
// Sistem menyimpulkan aksi berikutnya dari status card.
export function inferNextAction(card: ProductStatusCard): NextAction {
  // Payment dulu
  if (card.paymentStatus === "belum-bayar" || card.paymentStatus === "dp" || card.paymentStatus === "lunas-sebagian") {
    return "tagih-pelunasan";
  }

  // Progress
  switch (card.progressStatus) {
    case "po":
    case "menunggu-batch":
      return "mulai-produksi";
    case "produksi":
    case "qc":
      return "tidak-ada";
    case "ready-gudang":
    case "siap-packing":
      return "mulai-packing";
    case "sedang-packing":
      return "tidak-ada";
    case "perlu-input-resi":
      return "input-resi";
    case "sudah-dikirim":
      return "serahkan-kurir";
    case "selesai":
    case "retur":
      return "tidak-ada";
  }

  // Shipping plan
  if (card.shippingPlan === "hold-customer") return "hubungi-customer";
  if (card.shippingPlan === "hold-admin") return "tidak-ada";

  return "tidak-ada";
}

// ===== HELPER: Bangun Action Center dari product cards =====
export function buildActionCenter(cards: ProductStatusCard[]): ActionItem[] {
  const items: ActionItem[] = [];

  for (const card of cards) {
    const action = inferNextAction(card);
    if (action === "tidak-ada") continue;

    let priority: ActionItem["priority"] = "yellow";
    let title = "";
    let desc = "";

    switch (action) {
      case "tagih-pelunasan":
        priority = "red";
        title = `Tagih pelunasan ${card.productName}`;
        desc = card.invoiceNumber ? `${card.invoiceNumber} · ${card.qty} pcs` : `${card.qty} pcs`;
        break;
      case "mulai-produksi":
        priority = "yellow";
        title = `Mulai produksi ${card.productName}`;
        desc = card.batchName ? `Batch ${card.batchName}` : "Belum ada batch";
        break;
      case "mulai-packing":
        priority = "yellow";
        title = `Packing ${card.productName}`;
        desc = `${card.qty} pcs · ${locationInfo[card.location].name}`;
        break;
      case "input-resi":
        priority = "green";
        title = `Input resi ${card.productName}`;
        desc = "Packing selesai, siap dibuatkan resi";
        break;
      case "serahkan-kurir":
        priority = "green";
        title = `Serahkan ${card.productName} ke kurir`;
        desc = card.resiNumber ? `Resi ${card.resiNumber}` : "Menunggu pick up";
        break;
      case "hubungi-customer":
        priority = "blue";
        title = `Hubungi customer mengenai ${card.productName}`;
        desc = card.blocker || "Menunggu keputusan customer";
        break;
      default:
        continue;
    }

    items.push({ id: card.id, priority, title, desc, productId: card.id, action });
  }

  // Sort: red → yellow → green → blue
  const order: Record<ActionItem["priority"], number> = { red: 0, yellow: 1, green: 2, blue: 3 };
  return items.sort((a, b) => order[a.priority] - order[b.priority]);
}

// ===== HELPER: Bangun "Perlu Perhatian" =====
export function buildAttention(cards: ProductStatusCard[]): { title: string; desc: string }[] {
  const attention: { title: string; desc: string }[] = [];

  // Invoice belum lunas
  const unpaid = cards.filter(c => c.paymentStatus === "belum-bayar" || c.paymentStatus === "dp" || c.paymentStatus === "lunas-sebagian");
  if (unpaid.length > 0) {
    attention.push({
      title: `${unpaid.length} produk belum lunas`,
      desc: unpaid.map(c => c.productName).join(", "),
    });
  }

  // Batch belum selesai
  const inBatch = cards.filter(c => c.progressStatus === "po" || c.progressStatus === "menunggu-batch" || c.progressStatus === "produksi");
  if (inBatch.length > 0) {
    attention.push({
      title: `${inBatch.length} produk masih dalam produksi`,
      desc: inBatch.map(c => `${c.productName}${c.batchName ? ` (${c.batchName})` : ""}`).join(", "),
    });
  }

  // Ready tapi belum dikirim
  const ready = cards.filter(c => c.progressStatus === "ready-gudang" || c.progressStatus === "siap-packing" || c.progressStatus === "sedang-packing" || c.progressStatus === "perlu-input-resi");
  if (ready.length > 0) {
    attention.push({
      title: `${ready.length} produk siap diproses`,
      desc: ready.map(c => c.productName).join(", "),
    });
  }

  // Hold
  const held = cards.filter(c => c.shippingPlan === "hold-customer" || c.shippingPlan === "hold-admin");
  if (held.length > 0) {
    attention.push({
      title: `${held.length} produk ditahan`,
      desc: held.map(c => c.productName).join(", "),
    });
  }

  return attention;
}

// ===== SEED DATA: Customer Operations =====
// Data contoh untuk customer Ummu Hakkan (cust-1)
export const seedOperations: Record<string, CustomerOperations> = {
  "cust-1": {
    customerId: "cust-1",
    productCards: [

      {
        id: "card-amna-xl",
        orderId: "ord-1",
        orderNumber: "ORD/2026/05/31-1001",
        productName: "Amna Jilbab XL · Rits",
        emoji: "🧕",
        qty: 1,
        price: 280000,
        invoiceNumber: "INV-10045",
        paymentStatus: "dp",
        progressStatus: "produksi",
        location: "produksi",
        shippingPlan: "gabung-produk-lain",
        nextAction: "tagih-pelunasan",
        fulfillmentDecision: "gabung-pengiriman",
        shipmentStatus: "belum-dibuat",
        batchName: "Batch 8",
        batchEstimateReady: "1 Juni 2026",
        blocker: "Menunggu produksi Batch 8 selesai",
        timeline: [
          { id: "t1", time: "31 Mei", title: "Order dibuat", type: "order" },
          { id: "t2", time: "31 Mei", title: "Invoice INV-10045 dibuat", type: "invoice" },
          { id: "t3", time: "31 Mei", title: "DP diterima Rp 100.000", type: "payment" },
          { id: "t4", time: "31 Mei", title: "Masuk Batch 8", type: "batch" },
          { id: "t5", time: "1 Jun", title: "Produksi dimulai", type: "batch" },
        ],
      },
      {
        id: "card-boardbook",
        orderId: "ord-2",
        orderNumber: "ORD/2026/05/28-1002",
        productName: "Boardbook ABC",
        emoji: "🔤",
        qty: 2,
        price: 60000,
        invoiceNumber: "INV-10067",
        paymentStatus: "lunas",
        progressStatus: "ready-gudang",
        location: "gudang-bekasi",
        shippingPlan: "gabung-produk-lain",
        nextAction: "mulai-packing",
        fulfillmentDecision: "gabung-pengiriman",
        shipmentStatus: "belum-dibuat",
        blocker: "Menunggu Amna XL selesai produksi",
        timeline: [
          { id: "t1", time: "28 Mei", title: "Order dibuat", type: "order" },
          { id: "t2", time: "28 Mei", title: "Invoice INV-10067 dibuat", type: "invoice" },
          { id: "t3", time: "28 Mei", title: "Lunas diterima", type: "payment" },
          { id: "t4", time: "29 Mei", title: "Barang masuk Gudang Bekasi", type: "ready" },
        ],
      },
      {
        id: "card-parenting",
        orderId: "ord-3",
        orderNumber: "ORD/2026/05/25-1003",
        productName: "Parenting B",
        emoji: "📚",
        qty: 1,
        price: 89000,
        invoiceNumber: "INV-10071",
        paymentStatus: "belum-bayar",
        progressStatus: "ready-gudang",
        location: "gudang-bekasi",
        shippingPlan: "hold-customer",
        nextAction: "tagih-pelunasan",
        fulfillmentDecision: "hold-customer",
        shipmentStatus: "belum-dibuat",
        blocker: "Customer minta digabung dengan Amna XL",
        timeline: [
          { id: "t1", time: "25 Mei", title: "Order dibuat", type: "order" },
          { id: "t2", time: "25 Mei", title: "Invoice INV-10071 dibuat", type: "invoice" },
          { id: "t3", time: "25 Mei", title: "Customer minta digabung dengan Amna XL", type: "decision" },
          { id: "t4", time: "26 Mei", title: "Barang masuk Gudang Bekasi", type: "ready" },
        ],
      },
    ],
    timeline: [
      { id: "tl1", time: "31 Mei", title: "Order Amna Jilbab XL dibuat", type: "order" },
      { id: "tl2", time: "31 Mei", title: "Invoice INV-10045 dibuat", type: "invoice" },
      { id: "tl3", time: "31 Mei", title: "DP diterima Rp 100.000", type: "payment" },
      { id: "tl4", time: "31 Mei", title: "Masuk Batch 8", type: "batch" },
      { id: "tl5", time: "28 Mei", title: "Order Boardbook ABC dibuat", type: "order" },
      { id: "tl6", time: "28 Mei", title: "Invoice INV-10067 dibuat", type: "invoice" },
      { id: "tl7", time: "28 Mei", title: "Lunas diterima", type: "payment" },
      { id: "tl8", time: "29 Mei", title: "Boardbook masuk Gudang Bekasi", type: "ready" },
      { id: "tl9", time: "25 Mei", title: "Order Parenting B dibuat", type: "order" },
      { id: "tl10", time: "25 Mei", title: "Invoice INV-10071 dibuat", type: "invoice" },
      { id: "tl11", time: "25 Mei", title: "Customer minta seluruh barang digabung", type: "decision" },
      { id: "tl12", time: "26 Mei", title: "Parenting B masuk Gudang Bekasi", type: "ready" },
    ],
    actionCenter: [],
    attention: [],
    fulfillmentDecision: "gabung-pengiriman",
    fulfillmentDecisionNote: "Customer meminta seluruh barang dikirim sekaligus setelah lengkap.",
  },
  "cust-2": {
    customerId: "cust-2",
    productCards: [

      {
        id: "card-amna-l",
        orderId: "ord-4",
        orderNumber: "ORD/2026/05/20-1004",
        productName: "Amna Jilbab L · Polos",
        emoji: "🧕",
        qty: 1,
        price: 260000,
        invoiceNumber: "INV-10030",
        paymentStatus: "lunas",
        progressStatus: "ready-gudang",
        location: "gudang-purwakarta",
        shippingPlan: "kirim-terpisah",
        nextAction: "mulai-packing",
        fulfillmentDecision: "kirim-terpisah",
        shipmentStatus: "belum-dibuat",
        blocker: undefined,
        timeline: [
          { id: "t1", time: "20 Mei", title: "Order dibuat", type: "order" },
          { id: "t2", time: "20 Mei", title: "Invoice INV-10030 dibuat", type: "invoice" },
          { id: "t3", time: "20 Mei", title: "Lunas diterima", type: "payment" },
          { id: "t4", time: "20 Mei", title: "Barang masuk Gudang Purwakarta", type: "ready" },
        ],
      },
      {
        id: "card-niqab",
        orderId: "ord-5",
        orderNumber: "ORD/2026/05/12-1005",
        productName: "Niqab Aroby",
        emoji: "🖤",
        qty: 1,
        price: 142000,
        invoiceNumber: "INV-10022",
        paymentStatus: "lunas",
        progressStatus: "sudah-dikirim",
        location: "gudang-purwakarta",
        shippingPlan: "sudah-dikirim",
        nextAction: "tidak-ada",
        fulfillmentDecision: "kirim-terpisah",
        shipmentStatus: "dalam-perjalanan",
        resiNumber: "JNT987654321",
        courier: "J&T",
        blocker: undefined,
        timeline: [
          { id: "t1", time: "12 Mei", title: "Order dibuat", type: "order" },
          { id: "t2", time: "12 Mei", title: "Invoice INV-10022 dibuat", type: "invoice" },
          { id: "t3", time: "12 Mei", title: "Lunas diterima", type: "payment" },
          { id: "t4", time: "20 Mei", title: "Packing selesai", type: "packing" },
          { id: "t5", time: "25 Mei", title: "Resi JNT987654321 dibuat", type: "resi" },
          { id: "t6", time: "25 Mei", title: "Kurir pick up", type: "resi" },
        ],
      },
    ],
    timeline: [
      { id: "tl1", time: "20 Mei", title: "Order Amna Jilbab L dibuat", type: "order" },
      { id: "tl2", time: "20 Mei", title: "Invoice INV-10030 dibuat", type: "invoice" },
      { id: "tl3", time: "20 Mei", title: "Lunas diterima", type: "payment" },
      { id: "tl4", time: "12 Mei", title: "Order Niqab Aroby dibuat", type: "order" },
      { id: "tl5", time: "12 Mei", title: "Invoice INV-10022 dibuat", type: "invoice" },
      { id: "tl6", time: "12 Mei", title: "Lunas diterima", type: "payment" },
      { id: "tl7", time: "25 Mei", title: "Niqab Aroby dikirim", type: "resi" },
    ],
    actionCenter: [],
    attention: [],
    fulfillmentDecision: "kirim-terpisah",
    fulfillmentDecisionNote: "Semua barang ready, dikirim terpisah sesuai ketersediaan.",
  },
  "cust-3": {
    customerId: "cust-3",
    productCards: [

      {
        id: "card-amna-l-3",
        orderId: "ord-6",
        orderNumber: "ORD/2026/05/25-1006",
        productName: "Amna Jilbab L · Rits",
        emoji: "🧕",
        qty: 1,
        price: 280000,
        invoiceNumber: "INV-10040",
        paymentStatus: "dp",
        progressStatus: "ready-gudang",
        location: "gudang-bekasi",
        shippingPlan: "gabung-produk-lain",
        nextAction: "tagih-pelunasan",
        fulfillmentDecision: "gabung-pengiriman",
        shipmentStatus: "belum-dibuat",
        blocker: "Menunggu Jilbab Amna selesai produksi",
        timeline: [
          { id: "t1", time: "25 Mei", title: "Order dibuat", type: "order" },
          { id: "t2", time: "25 Mei", title: "Invoice INV-10040 dibuat", type: "invoice" },
          { id: "t3", time: "25 Mei", title: "DP diterima Rp 100.000", type: "payment" },
          { id: "t4", time: "25 Mei", title: "Barang masuk Gudang Bekasi", type: "ready" },
        ],
      },
      {
        id: "card-jilbab-amna",
        orderId: "ord-7",
        orderNumber: "ORD/2026/05/20-1007",
        productName: "Jilbab Amna",
        emoji: "🧕",
        qty: 1,
        price: 89000,
        invoiceNumber: "INV-10052",
        paymentStatus: "belum-bayar",
        progressStatus: "menunggu-batch",
        location: "produksi",
        shippingPlan: "gabung-produk-lain",
        nextAction: "tagih-pelunasan",
        fulfillmentDecision: "gabung-pengiriman",
        shipmentStatus: "belum-dibuat",
        batchName: "Batch 8",
        batchEstimateReady: "1 Juni 2026",
        blocker: "Menunggu Batch 8 selesai",
        timeline: [
          { id: "t1", time: "20 Mei", title: "Order dibuat", type: "order" },
          { id: "t2", time: "20 Mei", title: "Invoice INV-10052 dibuat", type: "invoice" },
          { id: "t3", time: "20 Mei", title: "Masuk Batch 8", type: "batch" },
        ],
      },
      {
        id: "card-niqab-3",
        orderId: "ord-8",
        orderNumber: "ORD/2026/05/10-1008",
        productName: "Niqab Aroby",
        emoji: "🖤",
        qty: 1,
        price: 119000,
        invoiceNumber: "INV-10044",
        paymentStatus: "lunas",
        progressStatus: "selesai",
        location: "gudang-bekasi",
        shippingPlan: "sudah-dikirim",
        nextAction: "tidak-ada",
        fulfillmentDecision: "kirim-terpisah",
        shipmentStatus: "delivered",
        resiNumber: "IDX123456789",
        courier: "ID Express",
        blocker: undefined,
        timeline: [
          { id: "t1", time: "10 Mei", title: "Order dibuat", type: "order" },
          { id: "t2", time: "10 Mei", title: "Invoice INV-10044 dibuat", type: "invoice" },
          { id: "t3", time: "10 Mei", title: "Lunas diterima", type: "payment" },
          { id: "t4", time: "12 Mei", title: "Packing selesai", type: "packing" },
          { id: "t5", time: "12 Mei", title: "Resi IDX123456789 dibuat", type: "resi" },
          { id: "t6", time: "14 Mei", title: "Delivered", type: "delivered" },
        ],
      },
    ],
    timeline: [
      { id: "tl1", time: "25 Mei", title: "Order Amna Jilbab L dibuat", type: "order" },
      { id: "tl2", time: "25 Mei", title: "Invoice INV-10040 dibuat", type: "invoice" },
      { id: "tl3", time: "25 Mei", title: "DP diterima Rp 100.000", type: "payment" },
      { id: "tl4", time: "20 Mei", title: "Order Jilbab Amna dibuat", type: "order" },
      { id: "tl5", time: "20 Mei", title: "Invoice INV-10052 dibuat", type: "invoice" },
      { id: "tl6", time: "20 Mei", title: "Masuk Batch 8", type: "batch" },
      { id: "tl7", time: "10 Mei", title: "Order Niqab Aroby dibuat", type: "order" },
      { id: "tl8", time: "10 Mei", title: "Invoice INV-10044 dibuat", type: "invoice" },
      { id: "tl9", time: "10 Mei", title: "Lunas diterima", type: "payment" },
      { id: "tl10", time: "14 Mei", title: "Niqab Aroby delivered", type: "delivered" },
    ],
    actionCenter: [],
    attention: [],
    fulfillmentDecision: "gabung-pengiriman",
    fulfillmentDecisionNote: "Customer minta kirim semua sekaligus setelah lengkap.",
  },
};

// ===== STORE: Customer Operations =====
// Simpan operasi customer di localStorage agar perubahan aksi persist.

const KEYS = {
  operations: "umayasla_operations",
};

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

export function getOperations(customerId: string): CustomerOperations {
  const stored = load<Record<string, CustomerOperations>>(KEYS.operations, {});
  const seed = seedOperations[customerId];
  if (!seed) {
    // Customer baru: buat operasi kosong
    return {
      customerId,
      productCards: [],
      timeline: [],
      actionCenter: [],
      attention: [],
      fulfillmentDecision: "gabung-pengiriman",
      fulfillmentDecisionNote: "Belum ada keputusan fulfillment.",
    };
  }
  const merged = stored[customerId] || seed;
  // Selalu hitung ulang actionCenter & attention dari product cards
  return {
    ...merged,
    actionCenter: buildActionCenter(merged.productCards),
    attention: buildAttention(merged.productCards),
  };
}

export function saveOperations(customerId: string, ops: CustomerOperations) {
  const stored = load<Record<string, CustomerOperations>>(KEYS.operations, {});
  stored[customerId] = ops;
  save(KEYS.operations, stored);
}

// ===== HELPER: Terapkan aksi dan simpan =====
export function performAction(customerId: string, cardId: string, action: ActionType): CustomerOperations {
  const ops = getOperations(customerId);
  const updatedCards = ops.productCards.map(card => {
    if (card.id === cardId) {
      return applyAction(card, action);
    }
    return card;
  });
  const updatedOps: CustomerOperations = {
    ...ops,
    productCards: updatedCards,
    timeline: [
      ...ops.timeline,
      ...updatedCards
        .filter(c => c.id === cardId)
        .flatMap(c => c.timeline.slice(-1)),
    ],
  };
  saveOperations(customerId, updatedOps);
  return getOperations(customerId);
}


