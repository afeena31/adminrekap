"use client";

import type { CSSProperties } from "react";

// Input angka dengan pemisah ribuan otomatis (150000 -> "150.000") sambil
// diketik, dan kosong (bukan "0") saat nilainya 0 supaya gak ada angka 0
// yang nyangkut di depan waktu mulai ngetik.
export function MoneyInput({
  value,
  onChange,
  placeholder,
  id,
  style,
  min = 0,
}: {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  id?: string;
  style?: CSSProperties;
  min?: number;
}) {
  const display = value ? value.toLocaleString("id-ID") : "";
  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      value={display}
      placeholder={placeholder}
      style={style}
      onChange={event => {
        const digits = event.target.value.replace(/[^0-9]/g, "");
        onChange(digits ? Math.max(min, Number(digits)) : 0);
      }}
    />
  );
}
