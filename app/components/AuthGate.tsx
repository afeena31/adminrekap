"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../data/authContext";

// Ngunci SELURUH app di belakang login — kecuali halaman /login sendiri.
// "Kebocoran" render sekilas sebelum redirect BUKAN lubang keamanan: data
// asli (order/customer/dst) baru diambil setelah ini, dan mulai Tahap 4-6
// query ke Supabase pasti ditolak RLS tanpa session valid — gate ini murni
// soal pengalaman pakai (jangan sampai nampilin UI app kosong sebelum lempar
// ke /login), bukan satu-satunya lapisan proteksi data.
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/login";

  useEffect(() => {
    if (!loading && !session && !isLoginPage) router.replace("/login");
  }, [loading, session, isLoginPage, router]);

  if (isLoginPage) return <>{children}</>;
  if (loading || !session) return <div className="auth-gate-loading">Memuat…</div>;
  return <>{children}</>;
}
