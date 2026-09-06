// Tombol "Kembali" sebelumnya cuma window.history.back() — kalau halaman
// dibuka langsung dari bookmark/shortcut/link luar (riwayat browser kosong),
// itu gak ngapa-ngapain sama sekali, kesannya kayak tombolnya gak ada.
// Fallback ke halaman utama kalau memang gak ada riwayat buat di-back-in.
export function goBack() {
  if (typeof window === "undefined") return;
  if (window.history.length > 1) {
    window.history.back();
  } else {
    window.location.href = "/";
  }
}
