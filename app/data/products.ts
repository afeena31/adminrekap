export type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  originalPrice?: number;
  description?: string;
  emoji: string;
  badge?: string;
  variants?: string[];
  modalKotor?: number;    // Modal kotor bahan/produk (sebelum biaya operasional)
  biayaOperasional?: number; // Biaya operasional per pcs (packing, transaksi, dll)
  hpp?: number;          // Total HPP = modalKotor + biayaOperasional (Harga Pokok Penjualan)
  feeMarketer?: number;  // Fee marketer per pcs — kosongkan/0 kalau produk ini tidak pakai fee marketer
  discountDefault?: number;  // Diskon default (persen atau nominal)
  discountType?: "percent" | "nominal";  // Jenis diskon default
  active?: boolean;      // Status aktif / nonaktif
};


export type ProductCategory = {
  id: string;
  name: string;
  emoji: string;
  description?: string;
};

export const productCategories: ProductCategory[] = [
  { id: "buku-parenting", name: "Buku Parenting", emoji: "📚", description: "Buku parenting pilihan" },
  { id: "boardbook", name: "Boardbook", emoji: "📖", description: "Boardbook anak" },
  { id: "lebah-asaqu", name: "Lebah AsaQu", emoji: "🐝", description: "Buku Lebah AsaQu" },
  { id: "amna-jilbab", name: "Amna Jilbab", emoji: "🧕", description: "Jilbab Pitch Black Anti UV" },
  { id: "niqab", name: "Niqab", emoji: "🖤", description: "Niqab pilihan" },
  { id: "aksesoris", name: "Aksesoris", emoji: "🧤", description: "Handsock, kaos kaki, dll" },
  { id: "lainnya", name: "Lainnya", emoji: "✨", description: "Ongkir, DP, dll" },
];

export const products: Product[] = [
  // BUKU PARENTING (fee 5.000/pcs)
  { id: "parenting-a", name: "Parenting A", category: "buku-parenting", price: 89000, originalPrice: 128000, emoji: "📚", badge: "Diskon", hpp: 60000, feeMarketer: 5000, active: true },
  { id: "parenting-b", name: "Parenting B", category: "buku-parenting", price: 89000, originalPrice: 148000, emoji: "📚", badge: "Diskon", hpp: 60000, feeMarketer: 5000, active: true },
  { id: "parenting-c", name: "Parenting C", category: "buku-parenting", price: 78000, originalPrice: 88000, emoji: "📚", badge: "Diskon", hpp: 55000, feeMarketer: 5000, active: true },
  { id: "parenting-cover-baru", name: "Parenting 1 (Cover Baru)", category: "buku-parenting", price: 99000, emoji: "📚", description: "Untuk customer tertentu", hpp: 70000, feeMarketer: 5000, active: true },

  // BOARDBOOK (fee 5.000/pcs)
  { id: "boardbook-abc", name: "Boardbook ABC", category: "boardbook", price: 60000, emoji: "🔤", hpp: 40000, feeMarketer: 5000, active: true },
  { id: "boardbook-123", name: "Boardbook 123", category: "boardbook", price: 74000, emoji: "🔢", hpp: 50000, feeMarketer: 5000, active: true },
  { id: "boardbook-islami", name: "Boardbook Islami Anak", category: "boardbook", price: 78000, emoji: "🕌", hpp: 55000, feeMarketer: 5000, active: true },
  { id: "boardbook-sampah", name: "Selamatkan Bumi dari Sampah", category: "boardbook", price: 65000, emoji: "🌍", hpp: 45000, feeMarketer: 5000, active: true },

  // LEBAH ASAQU (fee 5.000/pcs)
  { id: "bundling-lebah-semut", name: "Bundling Lebah + Semut", category: "lebah-asaqu", price: 120000, emoji: "🐝", badge: "Bundling", hpp: 90000, feeMarketer: 5000, active: true },
  { id: "lebah-asaqu", name: "Lebah AsaQu", category: "lebah-asaqu", price: 70000, emoji: "🐝", hpp: 50000, feeMarketer: 5000, active: true },
  { id: "balon-ungu", name: "Balon Ungu Terus Melaju", category: "lebah-asaqu", price: 49000, emoji: "🎈", hpp: 35000, feeMarketer: 5000, active: true },

  // AMNA JILBAB (fee 15.000 closingan cust, 10.000 pribadi)
  { id: "amna-m-polos", name: "Amna Jilbab M · Polos", category: "amna-jilbab", price: 250000, emoji: "🧕", hpp: 180000, feeMarketer: 15000, active: true },
  { id: "amna-m-rits", name: "Amna Jilbab M · Rits", category: "amna-jilbab", price: 270000, emoji: "🧕", hpp: 200000, feeMarketer: 15000, active: true },
  { id: "amna-l-polos", name: "Amna Jilbab L · Polos", category: "amna-jilbab", price: 260000, emoji: "🧕", hpp: 185000, feeMarketer: 15000, active: true },
  { id: "amna-l-rits", name: "Amna Jilbab L · Rits", category: "amna-jilbab", price: 280000, emoji: "🧕", hpp: 205000, feeMarketer: 15000, active: true },
  { id: "amna-xl-polos", name: "Amna Jilbab XL · Polos", category: "amna-jilbab", price: 260000, emoji: "🧕", hpp: 185000, feeMarketer: 15000, active: true },
  { id: "amna-xl-rits", name: "Amna Jilbab XL · Rits", category: "amna-jilbab", price: 280000, emoji: "🧕", hpp: 205000, feeMarketer: 15000, active: true },
  { id: "amna-xxl-polos", name: "Amna Jilbab XXL · Polos", category: "amna-jilbab", price: 270000, emoji: "🧕", hpp: 190000, feeMarketer: 15000, active: true },
  { id: "amna-xxl-rits", name: "Amna Jilbab XXL · Rits", category: "amna-jilbab", price: 290000, emoji: "🧕", hpp: 210000, feeMarketer: 15000, active: true },

  // NIQAB (fee 10.000/pcs) — harga sesuai Master Data Bisnis (2026-09).
  // "Niqab Poni Banat" tidak tercantum di Master Data — dibiarkan apa adanya,
  // perlu konfirmasi owner apakah produk ini masih berlaku.
  { id: "niqab-poni-banat", name: "Niqab Poni Banat", category: "niqab", price: 45000, emoji: "🖤", hpp: 30000, feeMarketer: 10000, active: true },
  { id: "niqab-poni-basic", name: "Niqab Poni Basic", category: "niqab", price: 95000, emoji: "🖤", hpp: 70000, feeMarketer: 10000, active: true },
  { id: "niqab-poni-aroby", name: "Niqab Poni Aroby", category: "niqab", price: 100000, emoji: "🖤", hpp: 75000, feeMarketer: 10000, active: true },
  { id: "niqab-poni-muqowwa", name: "Niqab Poni Muqowwa", category: "niqab", price: 110000, emoji: "🖤", hpp: 80000, feeMarketer: 10000, active: true },
  { id: "niqab-bandana-basic", name: "Niqab Bandana Basic", category: "niqab", price: 90000, emoji: "🖤", hpp: 65000, feeMarketer: 10000, active: true },
  { id: "niqab-bandana-aroby", name: "Niqab Bandana Aroby", category: "niqab", price: 95000, emoji: "🖤", hpp: 70000, feeMarketer: 10000, active: true },
  { id: "niqab-bandana-muqowwa", name: "Niqab Bandana Muqowwa", category: "niqab", price: 105000, emoji: "🖤", hpp: 75000, feeMarketer: 10000, active: true },

  // AKSESORIS — harga & varian sesuai Master Data Bisnis (2026-09).
  { id: "handsock-standar", name: "Manset / Handsock Standar", category: "aksesoris", price: 25000, emoji: "🧤", variants: ["Hitam", "Navy", "Brown", "Latte", "Cream"], hpp: 15000, feeMarketer: 5000, active: true },
  { id: "handsock-long", name: "Manset / Handsock Long", category: "aksesoris", price: 32000, emoji: "🧤", variants: ["Hitam"], hpp: 20000, feeMarketer: 5000, active: true },
  { id: "kaos-kaki", name: "Kaos Kaki", category: "aksesoris", price: 25000, emoji: "🧦", variants: ["Hitam"], hpp: 15000, feeMarketer: 2000, active: true },
  { id: "linen-spray", name: "Afeena Linen Spray", category: "aksesoris", price: 35000, emoji: "🌸", hpp: 25000, feeMarketer: 5000, active: true },

  // LAINNYA
  { id: "ongkir-id-express", name: "Ongkir ID Express Jawa", category: "lainnya", price: 8500, emoji: "🚚", description: "ID Express Pulau Jawa", active: true },
  { id: "ongkir-id-express-2kg", name: "Ongkir ID Express 2kg", category: "lainnya", price: 17000, emoji: "🚚", description: "ID Express 2 kg", active: true },
  { id: "dp-amna", name: "DP Amna Jilbab", category: "lainnya", price: 100000, emoji: "💰", description: "DP standar per pcs", active: true },
];


export const formatRupiah = (value: number) => "Rp " + value.toLocaleString("id-ID");

// ===== INFO TAMBAHAN =====
export const modifikasiInfo = [
  { name: "Lubang Tangan Rits", price: 20000, emoji: "✂️" },
  { name: "Rits Tengah Busui / Sleting Tengah Jilbab", price: 20000, emoji: "🧵" },
  { name: "Lubang Tangan Rits + Rits Tengah Busui", price: 40000, emoji: "✂️🧵", note: "Total tambahan jika keduanya" },
  { name: "Tali kecil kanan-kiri bagian dalam jilbab", price: 8000, emoji: "🎀" },
  { name: "Request ukuran custom", price: 0, emoji: "📏", note: "Mengikuti harga sesuai kesepakatan (contoh: mengikuti harga Size L)" },
];

export const ongkirInfo = [
  { name: "ID Express Pulau Jawa", price: 9000, emoji: "🚚" },
  { name: "ID Express Sumatera (per kg)", price: 11000, emoji: "🚚" },
  { name: "ID Express 2 kg", price: 17000, emoji: "🚚" },
  { name: "Luar Jawa-Sumatera", price: null, note: "Menyesuaikan tarif", emoji: "🌏" },
  { name: "J&T 40%", price: null, note: "Menyesuaikan tarif", emoji: "📦" },
];

// ===== SHOPEE SPLIT BILL (sumber: Master Data Bisnis, 2026-09) =====
// Split Bill BUKAN full payment via Shopee — hanya Rp1.500 (nominal produk
// Split Bill) yang mengurangi Total Invoice, BUKAN total checkout Shopee
// (yang termasuk biaya admin). Rumus transfer manual SELALU:
// Total Invoice - Rp1.500.
export const SPLIT_BILL_PRODUK = 1500;

export const splitShopeeInfo = [
  {
    name: "Split Bill Afeena — 1 kg",
    emoji: "🧕",
    link: "https://s.shopee.co.id/4qEZTr7ffz",
    shopee: 3500,
    detail: "Rp1.500 harga produk + Rp2.000 biaya admin",
    transfer: "Total Invoice - Rp1.500",
    note: "Jilbab, Niqab, Manset/Handsock, Kaos Kaki, Linen Spray",
  },
  {
    name: "Split Bill Afeena — 2 kg",
    emoji: "🧕",
    link: "https://s.shopee.co.id/1qb9L5wKnp",
    shopee: 3500,
    detail: "Rp1.500 harga produk + Rp2.000 biaya admin",
    transfer: "Total Invoice - Rp1.500",
    note: "Order Afeena maksimal 2 kg — cukup checkout 1x meski beberapa produk sekaligus",
  },
  {
    name: "Split Bill Buku Etalase YasLa — dari Bekasi",
    emoji: "📚",
    link: "https://s.shopee.co.id/1gHowlnUIB",
    shopee: null,
    detail: "Nominal Split Bill Rp1.500 (biaya admin belum diatur di Master Data)",
    transfer: "Total Invoice - Rp1.500",
    note: "Buku dari Etalase YasLa, dikirim dari Bekasi",
  },
  {
    name: "Split Bill Buku Parenting — 1 kg",
    emoji: "📚",
    link: "https://s.shopee.co.id/5fmj9BG5VQ",
    shopee: 3385,
    detail: "Rp1.500 harga produk + Rp1.885 biaya admin",
    transfer: "Total Invoice - Rp1.500",
    note: "Buku Parenting, dikirim dari Purwakarta",
  },
];

// ===== REKENING PEMBAYARAN (sumber: Master Data Bisnis, 2026-09) =====
export const rekeningBoardbook = { name: "Buku Anak / Boardbook PO", bank: "Jago Syariah (542)", number: "508828328822", owner: "Gina Rizqi A", emoji: "📖" };
export const rekeningAfeena = { name: "Produk Afeena (Jilbab, Niqab, Manset, Kaos Kaki, Linen Spray)", bank: "Jago Syariah (542)", number: "503496110351", owner: "Rizki Muhammad R", emoji: "🧕" };
export const rekeningGabungan = { name: "Buku Parenting & Order Gabungan", bank: "Jago Syariah (542)", number: "506608360610", owner: "Rizki Muhammad R", emoji: "📚" };

export const rekeningInfo = [rekeningBoardbook, rekeningAfeena, rekeningGabungan];

// Kategori produk yang termasuk "Produk Afeena" per Master Data.
const AFEENA_CATEGORIES = ["amna-jilbab", "niqab", "aksesoris"];
// Kategori "buku" — kalau digabung dengan Afeena dalam satu order, jadi
// Order Gabungan (Rule 4). CATATAN: "lebah-asaqu" tidak eksplisit disebut di
// Master Data — sementara diperlakukan sebagai kategori buku untuk deteksi
// gabungan (paling mendekati boardbook/parenting), perlu konfirmasi owner.
const BUKU_CATEGORIES = ["buku-parenting", "boardbook", "lebah-asaqu"];

// Routing rekening pembayaran berdasarkan isi order — sesuai 4 aturan di
// Master Data Bisnis. Order gabungan (buku + Afeena) SELALU ke satu rekening
// (Rekening Gabungan), TIDAK dipecah ke dua rekening.
export function determineRekening(categories: string[]): typeof rekeningBoardbook | null {
  const uniqueCats = Array.from(new Set(categories.filter(c => c && c !== "lainnya")));
  if (uniqueCats.length === 0) return null; // BELUM DIATUR — gak ada kategori produk yang jelas

  const onlyBoardbook = uniqueCats.every(c => c === "boardbook");
  const onlyAfeena = uniqueCats.every(c => AFEENA_CATEGORIES.includes(c));
  const hasBuku = uniqueCats.some(c => BUKU_CATEGORIES.includes(c));

  if (onlyBoardbook) return rekeningBoardbook;   // Rule 1
  if (onlyAfeena) return rekeningAfeena;          // Rule 2
  if (hasBuku) return rekeningGabungan;           // Rule 3 (buku parenting saja) + Rule 4 (buku + Afeena)
  return null; // kombinasi di luar cakupan Master Data — BELUM DIATUR, jangan menebak
}

// ===== DATA JILBAB (untuk form order) =====

// Default atribut Amna (tidak perlu dipilih user, langsung tersimpan)
export const AMNA_DEFAULT_FABRIC = "Amna Pitch Black Anti UV";
export const AMNA_DEFAULT_COLOR = "Pitch Black";

export const jilbabSizes = [
  { id: "M", name: "M", price: 250000 },
  { id: "L", name: "L", price: 260000 },
  { id: "XL", name: "XL", price: 260000 },
  { id: "XXL", name: "XXL", price: 270000 },
];

export const jilbabPads = [
  { id: "nonpad", name: "NonPad", price: 0 },
  { id: "niqabis", name: "Niqabis", price: 0 },
];

// Sesuai Master Data Bisnis (2026-09) — sebelumnya "Tali Ikat Dalam/Luar"
// cuma ada di modifikasiInfo (info-only), belum pernah bisa dipilih beneran
// saat bikin order Amna Jilbab.
export const jilbabModifikasi = [
  { id: "lubang-tangan", name: "Fitur Lubang Tangan + Rits", price: 20000 },
  { id: "rits-tengah", name: "Rits Tengah Busui 40 cm", price: 20000 },
  { id: "tali-ikat", name: "Tali Ikat Dalam/Luar Jilbab", price: 8000 },
  { id: "request-khusus", name: "Request Khusus", price: 0 },
];


// ===== DATA INVOICE (sesuai Operating Manual) =====
export type InvoiceType = "buku" | "ready" | "po-amna" | "pelunasan-amna" | "gabungan";

export const ongkirOptions = [
  { id: "id-jawa", name: "ID Express Pulau Jawa (flat 9.000/kg)", price: 9000 },
  { id: "id-jawa-2kg", name: "ID Express Pulau Jawa 2 kg", price: 17000 },
  { id: "id-sumatera", name: "ID Express Sumatera (11.000/kg)", price: 11000 },
  { id: "cod", name: "COD", price: 0 },
  { id: "shopee", name: "Shopee", price: 0 },
  { id: "custom", name: "Lainnya (isi manual)", price: null },
];

export const invoiceTypeInfo: Record<InvoiceType, { name: string; desc: string }> = {
  "buku": { name: "Invoice Buku", desc: "Buku Parenting, Boardbook, Lebah AsaQu" },
  "ready": { name: "Invoice Produk Afeena Ready", desc: "Niqab, Handsock, Kaos Kaki, Linen Spray" },
  "po-amna": { name: "Invoice PO Amna", desc: "Customer baru melakukan DP" },
  "pelunasan-amna": { name: "Invoice Pelunasan Amna", desc: "Jilbab siap, customer melunasi" },
  "gabungan": { name: "Invoice Gabungan", desc: "Beberapa kategori sekaligus" },
};

