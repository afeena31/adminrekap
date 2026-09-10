import { createClient } from "@supabase/supabase-js";

// Client Supabase dipakai browser (pakai anon key, aman ke-expose) — ini
// TIDAK menggantikan store.ts/central.ts dkk sama sekali di Tahap 1 ini,
// cuma fondasi koneksi yang akan dipakai mulai Tahap 2 (login) dst.
// Kalau env var belum diisi (mis. lagi kerja di bagian app yang belum
// disambungkan ke Supabase), `supabase` tetap dibuat tapi query apapun ke
// dia akan gagal jelas (bukan diam-diam null) -- sengaja begitu supaya
// kelupaan isi .env.local ketauan cepat, bukan error samar belakangan.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
  // Cuma warning di console, bukan throw -- build/prerender Next.js gak
  // boleh gagal gara-gara env var belum diisi (mis. Tahap 1 ini, sebelum
  // ada halaman yang beneran butuh koneksi).
  if (typeof window !== "undefined") {
    console.warn("[supabaseClient] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY belum diisi di .env.local");
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
