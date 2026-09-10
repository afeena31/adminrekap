"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Download, Database, CheckCircle2, XCircle } from "lucide-react";
import { useAuth } from "../data/authContext";
import { goBack } from "../lib/goBack";
import { collectAllLocalData, migrateToSupabase, type MigrationStepResult } from "../data/migrateToSupabase";

export default function MigrasiPage() {
  const { role, loading } = useAuth();
  const [exported, setExported] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState("");
  const [results, setResults] = useState<MigrationStepResult[] | null>(null);

  // Halaman ini CUMA utk Owner -- data bisnis asli cuma ada di device Owner,
  // dan risikonya terlalu besar kalau sembarang orang bisa ngetrigger ini.
  useEffect(() => {
    if (!loading && role && role !== "owner") window.location.href = "/";
  }, [loading, role]);

  if (loading || role !== "owner") return null;

  const handleExport = () => {
    const data = collectAllLocalData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `umayasla-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setExported(true);
  };

  const handleMigrate = async () => {
    setConfirmOpen(false);
    setRunning(true);
    setResults(null);
    const res = await migrateToSupabase(step => setCurrentStep(step));
    setResults(res);
    setRunning(false);
    setCurrentStep("");
  };

  const totalRows = results?.reduce((sum, r) => sum + r.count, 0) || 0;
  const hasErrors = results?.some(r => r.error) || false;

  return <main className="app-shell migrasi-page">
    <header className="topbar">
      <button className="icon-btn" aria-label="Kembali" onClick={goBack}><ArrowLeft size={21} /></button>
      <div className="brand">UmayasLa<span>·</span> Migrasi Data</div>
    </header>

    <div className="card" style={{ marginTop: 16 }}>
      <h2 style={{ fontFamily: "var(--serif)", fontSize: 20, margin: "0 0 8px" }}>1. Cadangkan dulu (wajib)</h2>
      <p className="muted" style={{ marginBottom: 14 }}>Unduh SEMUA data yang ada di HP ini sekarang (customer, order, payment, dst) sebagai file JSON — simpan file ini di tempat aman. Ini jaring pengaman kalau ada yang salah di langkah 2.</p>
      <button className="primary" onClick={handleExport} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%" }}>
        <Download size={16} /> Unduh Cadangan (JSON)
      </button>
      {exported && <p style={{ color: "var(--green)", fontSize: 13, marginTop: 10 }}><CheckCircle2 size={14} style={{ verticalAlign: -2 }} /> Cadangan terunduh.</p>}
    </div>

    <div className="card" style={{ marginTop: 16, opacity: exported ? 1 : 0.5, pointerEvents: exported ? "auto" : "none" }}>
      <h2 style={{ fontFamily: "var(--serif)", fontSize: 20, margin: "0 0 8px" }}>2. Pindahkan ke database bersama</h2>
      <p className="muted" style={{ marginBottom: 14 }}>Kirim semua data di atas ke Supabase, supaya Admin (dari HP-nya sendiri) bisa lihat data yang sama. Aman diklik ulang kalau sempat gagal di tengah jalan — data yang sudah masuk tidak akan dobel.</p>
      {!exported && <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>Unduh cadangan dulu di langkah 1 sebelum tombol ini aktif.</p>}
      <button className="primary" disabled={!exported || running} onClick={() => setConfirmOpen(true)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%" }}>
        <Database size={16} /> {running ? `Memindahkan: ${currentStep}...` : "Mulai Pindahkan ke Database"}
      </button>
    </div>

    {results && (
      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ fontFamily: "var(--serif)", fontSize: 20, margin: "0 0 8px" }}>Hasil</h2>
        <p style={{ marginBottom: 14 }}>{hasErrors ? "Selesai, tapi ada beberapa bagian gagal (lihat di bawah)." : `Semua berhasil — total ${totalRows} baris data dipindahkan.`}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {results.map(r => (
            <div key={r.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", background: r.error ? "var(--red-bg)" : "var(--green-bg)", borderRadius: 8, fontSize: 13 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {r.error ? <XCircle size={14} color="var(--red)" /> : <CheckCircle2 size={14} color="var(--green)" />}
                {r.label}
              </span>
              <span>{r.error ? r.error : `${r.count} baris`}</span>
            </div>
          ))}
        </div>
      </div>
    )}

    {confirmOpen && (
      <div className="overlay" onClick={() => setConfirmOpen(false)}>
        <section className="modal confirm-modal" onClick={e => e.stopPropagation()}>
          <h2>Pindahkan Semua Data?</h2>
          <p>Semua customer, order, payment, fee, produk, dan data lain di HP ini akan dikirim ke database bersama. Pastikan kamu sudah unduh cadangan JSON di langkah 1.</p>
          <div className="confirm-actions">
            <button className="secondary" onClick={() => setConfirmOpen(false)}>Batal</button>
            <button className="primary" onClick={handleMigrate}>Ya, Pindahkan</button>
          </div>
        </section>
      </div>
    )}
  </main>;
}
