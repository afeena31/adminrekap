export type PaymentData = {
  invoice: string;
  order: string;
  amount: string;
  status: "Lunas" | "Bayar DP" | "Belum Bayar";
  progress?: string;
};

export type ShipmentData = {
  order: string;
  status: string;
  place: string;
  ready: string;
  ship: string;
};

// ===== RELASI MARKETER =====
// Marketer adalah orang yang membawa customer.
// Satu customer dapat memiliki marketer utama (yang membawa pertama kali)
// dan marketer aktif (yang menangani order terakhir).

export type CustomerMarketer = {
  id: string;          // id marketer (relasi ke store.marketers)
  name: string;        // nama marketer
  role: "utama" | "aktif";  // utama = pembawa pertama, aktif = penangan terakhir
  since: string;       // sejak kapan
};

// ===== BATCH PRODUKSI =====
// Batch adalah informasi produksi yang memengaruhi order customer.
// Satu order dapat terkait dengan satu batch produksi.

export type ProductionBatch = {
  id: string;
  name: string;            // "Batch 8", "Kloter 9"
  product: string;         // produk yang diproduksi
  status: "produksi" | "ready" | "selesai";
  warehouse: string;       // gudang tujuan produksi (Purwakarta / Bekasi)
  estimateReady: string;   // estimasi siap
  orderRef: string;        // referensi order terkait
};

// ===== RESI AKTIF =====
// Resi adalah bukti pengiriman customer.

export type ActiveResi = {
  id: string;
  number: string;          // nomor resi
  courier: string;         // kurir (J&T, ID Express, dll)
  order: string;           // order terkait
  status: "dikirim" | "dalam-perjalanan" | "sampai";
  date: string;            // tanggal kirim
};

export type OverviewData = {
  attention: { title: string; desc: string; tab: string }[];
  fulfillment: { title: string; desc: string; tone: string }[];
  decision: { title: string; desc: string };
  ledgerTotal: string;
  ledgerRows: { label: string; value: string }[];
  ledgerReceived: string;
  ledgerBalance: string;
  insight: string[];
  status: { label: string; value: string; note: string; tab: string; tone: string }[];
  latestOrder: { id: string; status: string; items: string; date: string; total: string };
  journey: { time: string; title: string; desc: string }[];
};

// ===== ALAMAT PENGIRIMAN (struktur relasional) =====
// Customer dan Penerima Paket adalah dua entitas berbeda.
// Satu Customer dapat memiliki banyak alamat pengiriman.

export type CustomerAddress = {
  id: string;
  customerId: string;      // relasi ke Customer
  label: string;           // Rumah / Pesantren / Kantor / Orang Tua
  recipientName: string;   // Nama Penerima
  phone: string;           // No HP penerima
  address: string;         // Alamat lengkap
  landmark?: string;       // Patokan rumah (opsional)
  courier?: string;        // Kurir favorit (opsional)
  note?: string;           // Catatan (opsional)
  isDefault: boolean;      // alamat default
};

export type Customer = {
  id: string;
  name: string;
  waName: string;          // Nama WA (identitas pemesan)
  city: string;
  since: string;
  initials: string;
  orders: string;
  paid: string;
  outstanding: string;
  shipment: string;
  phone: string;
  receiver: string;
  receiverPhone: string;
  defaultAddressId: string | null;  // alamat default
  addresses: CustomerAddress[];     // daftar alamat pengiriman
  notes: string[];
  activities: string[];
  orderRows: string[];
  payments: PaymentData[];
  shipments: ShipmentData[];
  marketers: CustomerMarketer[];    // relasi marketer
  batches: ProductionBatch[];       // batch produksi terkait
  resi: ActiveResi[];               // resi aktif
  overview: OverviewData;
};


// ===== ADAPTER KE central.ts =====
// central.ts (app/data/central.ts) adalah sumber kebenaran untuk data customer
// (lihat getCustomers/addCustomer/dst). Tipe Customer di file ini adalah bentuk
// "tampilan" yang masih dipakai halaman profil hari ini — fungsi di bawah
// menjembatani keduanya selama migrasi bertahap berlangsung.
//
// Field ringkasan/agregat (orders/paid/outstanding/payments/batches/dst) diisi
// kosong di sini karena central.ts hanya menyimpan FAKTA, bukan angka olahan —
// perhitungan nyata dari data asli menyusul lewat central.ts's getCustomerWorkspace().
import type { Customer as CentralCustomer, Address as CentralAddress } from "./central";

function emptyOverview(): OverviewData {
  return {
    attention: [],
    fulfillment: [],
    decision: { title: "Belum ada keputusan", desc: "Belum ada order untuk customer ini." },
    ledgerTotal: "Rp 0",
    ledgerRows: [],
    ledgerReceived: "Rp 0",
    ledgerBalance: "Rp 0",
    insight: ["Belum ada insight."],
    status: [],
    latestOrder: { id: "-", status: "-", items: "-", date: "-", total: "-" },
    journey: [],
  };
}

export function toDisplayAddress(a: CentralAddress): CustomerAddress {
  return { ...a };
}

// Dipakai halaman yang butuh "ada customer terpilih" (page.tsx, order/page.tsx)
// saat localStorage benar-benar kosong — sentinel id kosong, BUKAN null, supaya
// pemakaian `customer.xxx` di halaman-halaman itu tetap aman tanpa pengecekan
// null di banyak tempat. Halaman yang memakainya wajib mengecek `id === ""`
// dan menampilkan layar kosong sendiri, bukan merender profil dengan data ini.
export const EMPTY_CUSTOMER: Customer = {
  id: "", name: "", waName: "", city: "", since: "", initials: "",
  orders: "0", paid: "Rp 0", outstanding: "Rp 0", shipment: "0",
  phone: "-", receiver: "", receiverPhone: "-", defaultAddressId: null,
  addresses: [], notes: [], activities: [], orderRows: [], payments: [],
  shipments: [], marketers: [], batches: [], resi: [],
  overview: { attention: [], fulfillment: [], decision: { title: "", desc: "" }, ledgerTotal: "Rp 0", ledgerRows: [], ledgerReceived: "Rp 0", ledgerBalance: "Rp 0", insight: [], status: [], latestOrder: { id: "-", status: "-", items: "-", date: "-", total: "-" }, journey: [] },
};

export function toDisplayCustomer(c: CentralCustomer, addresses: CentralAddress[]): Customer {
  return {
    id: c.id,
    name: c.name,
    waName: c.waName,
    city: c.city,
    since: c.since,
    initials: c.initials || c.name.split(" ").map(part => part[0]).join("").slice(0, 2).toUpperCase(),
    orders: "0",
    paid: "Rp 0",
    outstanding: "Rp 0",
    shipment: "0",
    phone: c.phone,
    receiver: c.receiver,
    receiverPhone: c.receiverPhone,
    defaultAddressId: c.defaultAddressId ?? null,
    addresses: addresses.map(toDisplayAddress),
    notes: c.notes,
    activities: [],
    orderRows: [],
    payments: [],
    shipments: [],
    marketers: [],
    batches: [],
    resi: [],
    overview: emptyOverview(),
  };
}

// Membuat objek Customer BENTUK central.ts (bukan bentuk tampilan di atas) —
// caller wajib menyimpannya lewat central.ts's addCustomer() supaya persist,
// lalu memakai toDisplayCustomer() di atas untuk menampilkannya.
export function createNewCustomer(name: string, city: string): CentralCustomer {
  return {
    id: "cust-" + Date.now(),
    name,
    waName: name,
    city,
    since: "hari ini",
    initials: name.split(" ").map(part => part[0]).join("").slice(0, 2).toUpperCase(),
    phone: "-",
    receiver: name,
    receiverPhone: "-",
    defaultAddressId: null,
    notes: [],
    createdAt: Date.now(),
    deletedAt: null,
  };
}
