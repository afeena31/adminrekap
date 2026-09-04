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


export const customersData: Customer[] = [
  {
    id: "cust-1",
    name: "Ummu Hakkan",
    waName: "Ummu Hakkan",
    city: "Gresik, Jawa Timur",
    since: "Maret 2025",
    initials: "UH",
    orders: "6",
    paid: "Rp 1.245.000",
    outstanding: "Rp 212.000",
    shipment: "4",
    phone: "0812-3456-7890",
    receiver: "Bapak Hakim",
    receiverPhone: "0813-7788-9900",
    defaultAddressId: "addr-1-1",
    addresses: [
      { id: "addr-1-1", customerId: "cust-1", label: "Pesantren Garut", recipientName: "Muhammad Nabil", phone: "0822-1111-2222", address: "Pesantren Nurul Ilmi, Garut, Jawa Barat", landmark: "Depan masjid besar", courier: "J&T", note: "Kirim jam kerja", isDefault: true },
      { id: "addr-1-2", customerId: "cust-1", label: "Rumah Bandung", recipientName: "Rahma", phone: "0812-3333-4444", address: "Jl. Dago Asri No. 12, Bandung, Jawa Barat", landmark: "Sebelah minimarket", isDefault: false },
      { id: "addr-1-3", customerId: "cust-1", label: "Orang Tua", recipientName: "Bapak Hakim", phone: "0813-7788-9900", address: "Perum Bekasi Indah Blok C5, Bekasi, Jawa Barat", isDefault: false },
    ],
    notes: ["Mau dikirim semua barengan kalau sudah lengkap ya ✨", "Suka warna gelap untuk hijab", "Follow up invoice tanggal 10 Juni"],
    activities: ["Payment INV-10045 sudah dikonfirmasi", "Order Amna Jilbab L Rits berubah menjadi Siap Dikirim", "Customer menghubungkan WhatsApp"],
    orderRows: ["Amna Jilbab L Rits · Siap Dikirim · Rp 245.000", "Buku Parenting · Diproses (PO) · Kloter 8 · Rp 89.000", "Jilbab Amna · Menunggu Kloter 9 · Rp 135.000"],
    payments: [
      { invoice: "INV-10045", order: "Amna Jilbab L Rits · 31 Mei 2026", amount: "Rp 245.000", status: "Lunas" },
      { invoice: "INV-10067", order: "Buku Parenting · Jatuh tempo 10 Juni", amount: "Rp 142.000", status: "Bayar DP", progress: "DP masuk Rp 100.000 · Sisa Rp 42.000" },
      { invoice: "INV-10071", order: "Jilbab Amna · Jatuh tempo 14 Juni", amount: "Rp 70.000", status: "Belum Bayar" },
    ],
    shipments: [
      { order: "Amna Jilbab L Rits", status: "Siap Kirim", place: "Bekasi · Gudang Ready", ready: "Ready sekarang", ship: "Estimasi kirim 1–2 Juni" },
      { order: "Buku Parenting", status: "Perlu Packing", place: "Purwakarta · Gudang Ready", ready: "Barang sudah lengkap", ship: "Estimasi kirim setelah packing" },
      { order: "Jilbab Amna", status: "Hold Pengiriman", place: "Purwakarta · Batch 8 sudah ready", ready: "Customer minta tunggu Jilbab Amna", ship: "Belum ada estimasi kirim" },
      { order: "Niqab Aroby", status: "Sudah Packing", place: "Bekasi · Gudang Ready", ready: "Packing selesai 31 Mei", ship: "Menunggu jadwal pick up" },
      { order: "Linen Spray", status: "Menunggu Pick Up", place: "Bekasi · ID Express", ready: "Resi sudah dibuat", ship: "Pick up hari ini · 14.00–17.00" },
      { order: "Buku Anak", status: "Sudah Dikirim", place: "Purwakarta · J&T", ready: "Resi JNT123456789", ship: "Dikirim 28 Mei 2026" },
      { order: "Jilbab Amna", status: "Proses Retur", place: "Bekasi · Paket kembali", ready: "Menunggu paket diterima gudang", ship: "Retur diajukan 26 Mei" },
      { order: "Buku Parenting", status: "Refund", place: "Purwakarta · Pembayaran", ready: "Refund Rp 89.000 disetujui", ship: "Dijadwalkan 3 Juni 2026" },
    ],
    marketers: [
      { id: "mk-1", name: "Febia", role: "utama", since: "Maret 2025" },
      { id: "mk-3", name: "Salsabila", role: "aktif", since: "Mei 2026" },
    ],
    batches: [
      { id: "batch-8", name: "Batch 8", product: "Jilbab Amna", status: "ready", warehouse: "Purwakarta", estimateReady: "1 Mei 2026", orderRef: "Jilbab Amna" },
      { id: "kloter-8", name: "Kloter 8", product: "Buku Parenting", status: "produksi", warehouse: "Purwakarta", estimateReady: "10 Juni 2026", orderRef: "Buku Parenting" },
      { id: "kloter-9", name: "Kloter 9", product: "Jilbab Amna", status: "produksi", warehouse: "Purwakarta", estimateReady: "14 Juni 2026", orderRef: "Jilbab Amna" },
    ],
    resi: [
      { id: "resi-1", number: "JNT123456789", courier: "J&T", order: "Buku Anak", status: "dikirim", date: "28 Mei 2026" },
      { id: "resi-2", number: "IDX987654321", courier: "ID Express", order: "Linen Spray", status: "dalam-perjalanan", date: "1 Juni 2026" },
    ],
    overview: {
      attention: [
        { title: "2 invoice belum lunas", desc: "INV-10067 jatuh tempo 10 Jun · Rp 142.000", tab: "Payment (4)" },
        { title: "1 order menunggu barang PO", desc: "Buku Parenting dari Purwakarta", tab: "Shipment (4)" },
      ],
      fulfillment: [
        { title: "Linen Spray + Buku Parenting", desc: "Ready 19 Apr · Purwakarta", tone: "" },
        { title: "Jilbab Amna · Batch 8", desc: "Estimasi ready 1 Mei · Purwakarta", tone: "waiting" },
        { title: "Buku Anak PO", desc: "Bekasi · tidak dapat digabung dengan Purwakarta", tone: "other-warehouse" },
      ],
      decision: { title: "Customer minta kirim semua sekaligus", desc: "Barang ready akan ditahan sampai Jilbab Amna ready 1 Mei." },
      ledgerTotal: "Rp 750.000",
      ledgerRows: [
        { label: "2 Mei · Transfer masuk", value: "+ Rp 300.000" },
        { label: "14 Mei · Transfer masuk", value: "+ Rp 50.000" },
      ],
      ledgerReceived: "Rp 350.000",
      ledgerBalance: "Rp 400.000",
      insight: ["Pelanggan aktif dengan repeat order.", "Biasanya melunasi invoice sebagian terlebih dahulu.", "Tertarik pada produk Afeena premium & niqab."],
      status: [
        { label: "Order Aktif", value: "1", note: "Amna Jilbab L Rits", tab: "Order (6)", tone: "sand" },
        { label: "Outstanding", value: "Rp 212.000", note: "2 invoice belum lunas", tab: "Payment (4)", tone: "olive" },
      ],
      latestOrder: { id: "Amna Jilbab L Rits", status: "Siap Dikirim", items: "Amna Jilbab L Rits – Pitch Black\n+ Niqab Aroby Basic Pitch Black", date: "31 Mei 2026", total: "Rp 245.000" },
      journey: [
        { time: "31 Mei", title: "Amna Jilbab L Rits siap dikirim", desc: "2 item Afeena · dikirim dari Bekasi" },
        { time: "28 Mei", title: "DP diterima untuk PO buku", desc: "Batch 8 · produksi Purwakarta" },
        { time: "12 Mar", title: "Pembelian pertama", desc: "Afeena Jilbab · customer sejak Maret 2025" },
      ],
    },
  },
  {
    id: "cust-2",
    name: "Siti Aisyah",
    waName: "Siti Ummu Qonita",
    city: "Purwakarta, Jawa Barat",
    since: "Januari 2026",
    initials: "SA",
    orders: "3",
    paid: "Rp 517.000",
    outstanding: "Rp 0",
    shipment: "2",
    phone: "0857-1122-3344",
    receiver: "Siti Aisyah",
    receiverPhone: "0857-1122-3344",
    defaultAddressId: "addr-2-1",
    addresses: [
      { id: "addr-2-1", customerId: "cust-2", label: "Rumah", recipientName: "Siti Aisyah", phone: "0857-1122-3344", address: "Jl. Raya Purwakarta No. 45, Purwakarta, Jawa Barat", landmark: "Depan toko roti", courier: "J&T", isDefault: true },
      { id: "addr-2-2", customerId: "cust-2", label: "Kantor", recipientName: "Siti Aisyah", phone: "0857-1122-3344", address: "Gedung Graha Niaga Lt. 3, Jakarta Selatan", isDefault: false },
    ],
    notes: ["Prefer pengiriman via J&T", "Suka warna pastel", "Order rutin tiap bulan"],
    activities: ["Payment INV-10030 sudah dikonfirmasi", "Order Amna Jilbab L berubah menjadi Siap Dikirim", "Customer menambahkan catatan pengiriman"],
    orderRows: ["Amna Jilbab L · Siap Dikirim · Rp 245.000", "Niqab Aroby · Sudah Dikirim · Rp 142.000", "Jilbab Amna · Selesai · Rp 130.000"],
    payments: [
      { invoice: "INV-10030", order: "Amna Jilbab L · 20 Mei 2026", amount: "Rp 245.000", status: "Lunas" },
      { invoice: "INV-10022", order: "Niqab Aroby · 12 Mei 2026", amount: "Rp 142.000", status: "Lunas" },
      { invoice: "INV-10015", order: "Jilbab Amna · 3 Mei 2026", amount: "Rp 130.000", status: "Lunas" },
    ],
    shipments: [
      { order: "Amna Jilbab L", status: "Siap Kirim", place: "Purwakarta · Gudang Ready", ready: "Ready sekarang", ship: "Estimasi kirim 1–2 Juni" },
      { order: "Niqab Aroby", status: "Sudah Dikirim", place: "Purwakarta · J&T", ready: "Resi JNT987654321", ship: "Dikirim 25 Mei 2026" },
    ],
    marketers: [
      { id: "mk-2", name: "Naqiya", role: "utama", since: "Januari 2026" },
    ],
    batches: [
      { id: "batch-7", name: "Batch 7", product: "Jilbab Amna", status: "selesai", warehouse: "Purwakarta", estimateReady: "20 Mei 2026", orderRef: "Jilbab Amna" },
    ],
    resi: [
      { id: "resi-3", number: "JNT987654321", courier: "J&T", order: "Niqab Aroby", status: "sampai", date: "25 Mei 2026" },
    ],
    overview: {
      attention: [
        { title: "1 order siap dikirim", desc: "Amna Jilbab dari Purwakarta", tab: "Shipment (4)" },
      ],
      fulfillment: [
        { title: "Amna Jilbab L", desc: "Ready 20 Mei · Purwakarta", tone: "" },
        { title: "Niqab Aroby", desc: "Ready 20 Mei · Purwakarta", tone: "" },
      ],
      decision: { title: "Semua barang ready", desc: "Semua item sudah siap dikirim dari Purwakarta." },
      ledgerTotal: "Rp 517.000",
      ledgerRows: [
        { label: "20 Mei · Transfer masuk", value: "+ Rp 245.000" },
        { label: "12 Mei · Transfer masuk", value: "+ Rp 142.000" },
        { label: "3 Mei · Transfer masuk", value: "+ Rp 130.000" },
      ],
      ledgerReceived: "Rp 517.000",
      ledgerBalance: "Rp 0",
      insight: ["Pelanggan rutin dengan pembelian bulanan.", "Selalu melunasi invoice tepat waktu.", "Tertarik pada produk jilbab pastel."],
      status: [
        { label: "Order Aktif", value: "1", note: "Amna Jilbab L", tab: "Order (6)", tone: "sand" },
        { label: "Outstanding", value: "Rp 0", note: "Semua lunas", tab: "Payment (4)", tone: "olive" },
      ],
      latestOrder: { id: "Amna Jilbab L", status: "Siap Dikirim", items: "Amna Jilbab L – Dusty Pink\n+ Niqab Aroby Basic", date: "20 Mei 2026", total: "Rp 245.000" },
      journey: [
        { time: "20 Mei", title: "Amna Jilbab L siap dikirim", desc: "2 item Afeena · dikirim dari Purwakarta" },
        { time: "12 Mei", title: "Niqab Aroby dikirim", desc: "Jilbab Amna · J&T" },
        { time: "3 Mei", title: "Pembelian ketiga", desc: "Afeena Jilbab · customer sejak Januari 2026" },
      ],
    },
  },
  {
    id: "cust-3",
    name: "Anggun Gravika",
    waName: "Ummu Hilyah",
    city: "Bekasi, Jawa Barat",
    since: "Maret 2026",
    initials: "AG",
    orders: "3",
    paid: "Rp 245.000",
    outstanding: "Rp 208.000",
    shipment: "2",
    phone: "0813-5566-7788",
    receiver: "Anggun Gravika",
    receiverPhone: "0813-5566-7788",
    defaultAddressId: "addr-3-1",
    addresses: [
      { id: "addr-3-1", customerId: "cust-3", label: "Rumah", recipientName: "Anggun Gravika", phone: "0813-5566-7788", address: "Perum Bekasi Indah Blok A2 No. 7, Bekasi, Jawa Barat", landmark: "Dekat gerbang utama", courier: "ID Express", isDefault: true },
      { id: "addr-3-2", customerId: "cust-3", label: "Orang Tua", recipientName: "Ibu Hilyah", phone: "0812-9999-0000", address: "Jl. Melati No. 3, Sleman, Yogyakarta", isDefault: false },
    ],
    notes: ["Suka warna gelap untuk hijab", "Minta packing rapi", "Follow up invoice tanggal 14 Juni"],
    activities: ["Payment INV-10040 sudah dikonfirmasi", "Order Amna Jilbab L berubah menjadi Siap Dikirim", "Customer menanyakan status pengiriman"],
    orderRows: ["Amna Jilbab L · Siap Dikirim · Rp 245.000", "Jilbab Amna · Diproses · Rp 89.000", "Niqab Aroby · Selesai · Rp 119.000"],
    payments: [
      { invoice: "INV-10040", order: "Amna Jilbab L · 25 Mei 2026", amount: "Rp 245.000", status: "Bayar DP", progress: "DP masuk Rp 100.000 · Sisa Rp 145.000" },
      { invoice: "INV-10052", order: "Jilbab Amna · Jatuh tempo 14 Juni", amount: "Rp 89.000", status: "Belum Bayar" },
      { invoice: "INV-10044", order: "Niqab Aroby · 10 Mei 2026", amount: "Rp 119.000", status: "Lunas" },
    ],
    shipments: [
      { order: "Amna Jilbab L", status: "Siap Kirim", place: "Bekasi · Gudang Ready", ready: "Ready sekarang", ship: "Estimasi kirim 1–2 Juni" },
      { order: "Jilbab Amna", status: "Perlu Packing", place: "Purwakarta · Gudang Ready", ready: "Barang sudah lengkap", ship: "Estimasi kirim setelah packing" },
    ],
    marketers: [
      { id: "mk-4", name: "Nurul Aulia", role: "utama", since: "Maret 2026" },
    ],
    batches: [
      { id: "batch-8", name: "Batch 8", product: "Jilbab Amna", status: "produksi", warehouse: "Purwakarta", estimateReady: "1 Juni 2026", orderRef: "Jilbab Amna" },
    ],
    resi: [],
    overview: {
      attention: [
        { title: "1 invoice belum lunas", desc: "INV-10052 jatuh tempo 14 Jun · Rp 89.000", tab: "Payment (4)" },
        { title: "1 order menunggu packing", desc: "Jilbab Amna dari Purwakarta", tab: "Shipment (4)" },
      ],
      fulfillment: [
        { title: "Amna Jilbab L", desc: "Ready 25 Mei · Bekasi", tone: "" },
        { title: "Jilbab Amna · Batch 8", desc: "Estimasi ready 1 Juni · Purwakarta", tone: "waiting" },
      ],
      decision: { title: "Customer minta kirim semua sekaligus", desc: "Barang ready akan ditahan sampai Jilbab Amna ready 1 Juni." },
      ledgerTotal: "Rp 453.000",
      ledgerRows: [
        { label: "25 Mei · Transfer masuk", value: "+ Rp 100.000" },
        { label: "10 Mei · Transfer masuk", value: "+ Rp 119.000" },
        { label: "2 Mei · Transfer masuk", value: "+ Rp 26.000" },
      ],
      ledgerReceived: "Rp 245.000",
      ledgerBalance: "Rp 208.000",
      insight: ["Pelanggan baru dengan potensi repeat order.", "Membayar DP terlebih dahulu.", "Tertarik pada produk jilbab gelap."],
      status: [
        { label: "Order Aktif", value: "2", note: "Amna Jilbab L, Jilbab Amna", tab: "Order (6)", tone: "sand" },
        { label: "Outstanding", value: "Rp 208.000", note: "2 invoice belum lunas", tab: "Payment (4)", tone: "olive" },
      ],
      latestOrder: { id: "Amna Jilbab L", status: "Siap Dikirim", items: "Amna Jilbab L – Pitch Black\n+ Niqab Aroby Basic", date: "25 Mei 2026", total: "Rp 245.000" },
      journey: [
        { time: "25 Mei", title: "Amna Jilbab L siap dikirim", desc: "2 item Afeena · dikirim dari Bekasi" },
        { time: "10 Mei", title: "Niqab Aroby selesai", desc: "Jilbab Amna · dikirim dari Bekasi" },
        { time: "2 Mei", title: "Pembelian pertama", desc: "Afeena Jilbab · customer sejak Maret 2026" },
      ],
    },
  },
];

export function createNewCustomer(name: string, city: string): Customer {
  const id = "cust-" + Date.now();
  return {
    id,
    name,
    waName: name,
    city,
    since: "hari ini",
    initials: name.split(" ").map(part => part[0]).join("").slice(0, 2).toUpperCase(),
    orders: "0",
    paid: "Rp 0",
    outstanding: "Rp 0",
    shipment: "0",
    phone: "-",
    receiver: name,
    receiverPhone: "-",
    defaultAddressId: null,
    addresses: [],
    notes: [],
    activities: [],
    orderRows: [],
    payments: [],
    shipments: [],
    marketers: [],
    batches: [],
    resi: [],
    overview: {
      attention: [],
      fulfillment: [],
      decision: { title: "Belum ada keputusan", desc: "Belum ada order untuk customer ini." },
      ledgerTotal: "Rp 0",
      ledgerRows: [],
      ledgerReceived: "Rp 0",
      ledgerBalance: "Rp 0",
      insight: ["Customer baru, belum ada insight."],
      status: [],
      latestOrder: { id: "-", status: "-", items: "-", date: "-", total: "-" },
      journey: [],
    },
  };
}
