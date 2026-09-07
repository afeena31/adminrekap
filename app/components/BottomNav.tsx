"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ShoppingBag, Users, Package, Wallet, UserRound, Layers } from "lucide-react";

// Satu daftar navigasi bawah yang dipakai SEMUA halaman — sebelumnya tiap
// halaman nulis daftarnya sendiri-sendiri secara manual, jadi gampang beda-beda
// dan ada yang linknya rusak (contoh: Katalog dulu punya tombol Dashboard/Akun
// yang cuma nunjukin notifikasi, gak benar-benar pindah halaman) dan Collection
// gak pernah muncul sama sekali di manapun.
// Dashboard sekarang di "/" (tampilan pertama saat app dibuka — sebelumnya
// Customer Workspace, dipindah atas permintaan user), Customer Workspace
// pindah ke "/customer".
const navItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/order", label: "Order", icon: ShoppingBag },
  { href: "/customer", label: "Customer", icon: Users },
  { href: "/products", label: "Katalog", icon: Package },
  { href: "/fees", label: "Fee", icon: Wallet },
  { href: "/marketers", label: "Marketer", icon: UserRound },
  { href: "/collections", label: "Collection", icon: Layers },
];

export function BottomNav({ onCustomerClick }: { onCustomerClick?: () => void } = {}) {
  const pathname = usePathname();
  return (
    <nav className="bottom-nav">
      {navItems.map(({ href, label, icon: Icon }) => {
        // "/" butuh exact-match (bukan startsWith) — semua path lain juga
        // "mulai dengan /", jadi startsWith("/") akan selalu true & bikin
        // Dashboard keliatan "current" terus di halaman manapun kalau gak
        // di-exact-match-kan begini.
        const isCurrent = href === "/" ? pathname === "/" : pathname.startsWith(href);
        const className = isCurrent ? "nav-link current" : "nav-link";
        // Di halaman Customer sendiri, tombol ini cuma reset tab internal ke
        // Ringkasan (bukan navigasi halaman) — dipakai customer/page.tsx via onCustomerClick.
        if (href === "/customer" && onCustomerClick) {
          return <button key={href} className={className} onClick={onCustomerClick}><Icon /><span>{label}</span></button>;
        }
        return (
          <Link key={href} href={href} className={className}>
            <Icon />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
