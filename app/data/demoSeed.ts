// ===== DATA DEMO =====
// Contoh 3 customer untuk keperluan demo/testing. TIDAK dimuat otomatis —
// hanya dimuat lewat toggle "Data Demo" di Pengaturan (lihat app/page.tsx).
// Bentuknya mengikuti tipe Customer/Address milik central.ts (bukan bentuk
// lama customers.ts yang membawa field tampilan pra-hitung).

import type { Customer, Address } from "./central";

export const demoCustomers: Customer[] = [
  {
    id: "cust-1",
    name: "Ummu Hakkan",
    waName: "Ummu Hakkan",
    city: "Gresik, Jawa Timur",
    since: "Maret 2025",
    initials: "UH",
    phone: "0812-3456-7890",
    receiver: "Bapak Hakim",
    receiverPhone: "0813-7788-9900",
    defaultAddressId: "addr-1-1",
    notes: ["Mau dikirim semua barengan kalau sudah lengkap ya ✨", "Suka warna gelap untuk hijab", "Follow up invoice tanggal 10 Juni"],
    createdAt: 1740787200000,
    deletedAt: null,
  },
  {
    id: "cust-2",
    name: "Siti Aisyah",
    waName: "Siti Ummu Qonita",
    city: "Purwakarta, Jawa Barat",
    since: "Januari 2026",
    initials: "SA",
    phone: "0857-1122-3344",
    receiver: "Siti Aisyah",
    receiverPhone: "0857-1122-3344",
    defaultAddressId: "addr-2-1",
    notes: ["Prefer pengiriman via J&T", "Suka warna pastel", "Order rutin tiap bulan"],
    createdAt: 1735689600000,
    deletedAt: null,
  },
  {
    id: "cust-3",
    name: "Anggun Gravika",
    waName: "Ummu Hilyah",
    city: "Bekasi, Jawa Barat",
    since: "Maret 2026",
    initials: "AG",
    phone: "0813-5566-7788",
    receiver: "Anggun Gravika",
    receiverPhone: "0813-5566-7788",
    defaultAddressId: "addr-3-1",
    notes: ["Suka warna gelap untuk hijab", "Minta packing rapi", "Follow up invoice tanggal 14 Juni"],
    createdAt: 1741996800000,
    deletedAt: null,
  },
];

export const demoAddresses: Address[] = [
  { id: "addr-1-1", customerId: "cust-1", label: "Pesantren Garut", recipientName: "Muhammad Nabil", phone: "0822-1111-2222", address: "Pesantren Nurul Ilmi, Garut, Jawa Barat", landmark: "Depan masjid besar", courier: "J&T", note: "Kirim jam kerja", isDefault: true },
  { id: "addr-1-2", customerId: "cust-1", label: "Rumah Bandung", recipientName: "Rahma", phone: "0812-3333-4444", address: "Jl. Dago Asri No. 12, Bandung, Jawa Barat", landmark: "Sebelah minimarket", isDefault: false },
  { id: "addr-1-3", customerId: "cust-1", label: "Orang Tua", recipientName: "Bapak Hakim", phone: "0813-7788-9900", address: "Perum Bekasi Indah Blok C5, Bekasi, Jawa Barat", isDefault: false },

  { id: "addr-2-1", customerId: "cust-2", label: "Rumah", recipientName: "Siti Aisyah", phone: "0857-1122-3344", address: "Jl. Raya Purwakarta No. 45, Purwakarta, Jawa Barat", landmark: "Depan toko roti", courier: "J&T", isDefault: true },
  { id: "addr-2-2", customerId: "cust-2", label: "Kantor", recipientName: "Siti Aisyah", phone: "0857-1122-3344", address: "Gedung Graha Niaga Lt. 3, Jakarta Selatan", isDefault: false },

  { id: "addr-3-1", customerId: "cust-3", label: "Rumah", recipientName: "Anggun Gravika", phone: "0813-5566-7788", address: "Perum Bekasi Indah Blok A2 No. 7, Bekasi, Jawa Barat", landmark: "Dekat gerbang utama", courier: "ID Express", isDefault: true },
  { id: "addr-3-2", customerId: "cust-3", label: "Orang Tua", recipientName: "Ibu Hilyah", phone: "0812-9999-0000", address: "Jl. Melati No. 3, Sleman, Yogyakarta", isDefault: false },
];

export const demoCustomerIds = demoCustomers.map(c => c.id);
