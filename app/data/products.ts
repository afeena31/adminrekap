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

  // NIQAB (fee 10.000/pcs)
  { id: "niqab-poni-banat", name: "Niqab Poni Banat", category: "niqab", price: 45000, emoji: "🖤", hpp: 30000, feeMarketer: 10000, active: true },
  { id: "niqab-poni-basic", name: "Niqab Poni Basic", category: "niqab", price: 95000, emoji: "🖤", hpp: 70000, feeMarketer: 10000, active: true },
  { id: "niqab-bandana-basic", name: "Niqab Bandana Basic", category: "niqab", price: 95000, emoji: "🖤", hpp: 70000, feeMarketer: 10000, active: true },
  { id: "niqab-bandana-aroby", name: "Niqab Bandana Aroby", category: "niqab", price: 100000, emoji: "🖤", hpp: 75000, feeMarketer: 10000, active: true },
  { id: "niqab-poni-muqowwa", name: "Niqab Poni Muqowwa", category: "niqab", price: 110000, emoji: "🖤", hpp: 80000, feeMarketer: 10000, active: true },
  { id: "niqab-bandana-muqowwa", name: "Niqab Bandana Muqowwa", category: "niqab", price: 110000, emoji: "🖤", hpp: 80000, feeMarketer: 10000, active: true },

  // AKSESORIS (handsock 5.000, kaos kaki 2.000, linen spray 5.000)
  { id: "handsock-standar", name: "Handsock Standar", category: "aksesoris", price: 25000, emoji: "🧤", variants: ["Hitam", "Navy", "Latte (Mocca)", "Cream", "Brown"], hpp: 15000, feeMarketer: 5000, active: true },
  { id: "handsock-long", name: "Handsock Long", category: "aksesoris", price: 32000, emoji: "🧤", variants: ["Hitam", "Navy", "Latte (Mocca)", "Cream", "Brown"], hpp: 20000, feeMarketer: 5000, active: true },
  { id: "kaos-kaki", name: "Kaos Kaki", category: "aksesoris", price: 24000, emoji: "🧦", hpp: 15000, feeMarketer: 2000, active: true },
  { id: "linen-spray", name: "Linen Spray", category: "aksesoris", price: 35000, emoji: "🌸", hpp: 25000, feeMarketer: 5000, active: true },

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

export const splitShopeeInfo = [
  { name: "Buku", emoji: "📚", shopee: 3385, detail: "Rp1.500 harga produk + Rp1.885 biaya admin", transfer: "Total Invoice - Rp1.500" },
  { name: "Produk Afeena (Jilbab, Niqab, Handsock, Kaos Kaki, Linen Spray)", emoji: "🧕", shopee: 3500, detail: "Rp1.500 harga produk + Rp2.000 biaya admin", transfer: "Total Invoice - Rp1.500" },
];

export const rekeningInfo = [
  { name: "Buku Parenting", bank: "Jago Syariah / Jago UUS (542)", number: "505321407794", owner: "Rizki Muhammad", emoji: "�" },
  { name: "Boardbook PO", bank: "Jago Syariah / Jago UUS (542)", number: "508828328822", owner: "Gina Rizqi", emoji: "📖" },
  { name: "Amna Jilbab Batch 7", bank: "Jago Syariah / Jago UUS (542)", number: "506687861938", owner: "Rizki Muhammad", emoji: "🧕" },
  { name: "Amna Jilbab Batch 8", bank: "Jago Syariah / Jago UUS (542)", number: "508249874973", owner: "Rizki Muhammad", emoji: "🧕" },
  { name: "Pembelian Kain", bank: "Jago Syariah / Jago UUS (542)", number: "508419126333", owner: "Rizki Muhammad", emoji: "🧵" },
];

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

export const jilbabModifikasi = [
  { id: "lubang-tangan", name: "Lubang Tangan Rits", price: 20000 },
  { id: "rits-tengah", name: "Rits Tengah Busui / Sleting Tengah Jilbab", price: 20000 },
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

// Rekening per kategori (sesuai manual)
export const rekeningByCategory: Record<string, { name: string; bank: string; number: string; owner: string }> = {
  "buku-parenting": { name: "Buku Parenting", bank: "Jago Syariah / Jago UUS (542)", number: "505321407794", owner: "Rizki Muhammad" },
  "boardbook": { name: "Boardbook PO", bank: "Jago Syariah / Jago UUS (542)", number: "508828328822", owner: "Gina Rizqi" },
  "amna-jilbab": { name: "Amna Jilbab Batch 7", bank: "Jago Syariah / Jago UUS (542)", number: "506687861938", owner: "Rizki Muhammad" },

  "niqab": { name: "Produk Afeena", bank: "Jago Syariah / Jago UUS (542)", number: "508249874973", owner: "Rizki Muhammad" },
  "aksesoris": { name: "Produk Afeena", bank: "Jago Syariah / Jago UUS (542)", number: "508249874973", owner: "Rizki Muhammad" },
  "lainnya": { name: "Produk Afeena", bank: "Jago Syariah / Jago UUS (542)", number: "508249874973", owner: "Rizki Muhammad" },
};
