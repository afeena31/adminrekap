"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ShoppingBag, Users, Package, Wallet, UserRound, Layers } from "lucide-react";

// Satu daftar navigasi bawah yang dipakai SEMUA halaman — sebelumnya tiap
// halaman nulis daftarnya sendiri-sendiri secara manual, jadi gampang beda-beda
// dan ada yang linknya rusak (contoh: Katalog dulu punya tombol Dashboard/Akun
// yang cuma nunjukin notifikasi, gak benar-benar pindah halaman) dan Collection
// gak pernah muncul sama sekali di manapun.
const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/order", label: "Order", icon: ShoppingBag },
  { href: "/", label: "Customer", icon: Users },
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
        const isCurrent = href === "/" ? pathname === "/" : pathname.startsWith(href);
        const className = isCurrent ? "nav-link current" : "nav-link";
        // Di halaman Customer sendiri, tombol ini cuma reset tab internal ke
        // Ringkasan (bukan navigasi halaman) — dipakai page.tsx via onCustomerClick.
        if (href === "/" && onCustomerClick) {
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
