"use client";

import { ArrowLeft, Bell, Check, ChevronRight, Search, Wallet, CheckCircle2, Clock, Filter, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { getFees, updateFeeStatus, updateFeeAmount, deleteFee, getMarketers, formatRupiah, type FeeRecord, type Marketer } from "../data/store";
import { BottomNav } from "../components/BottomNav";
import { goBack } from "../lib/goBack";
import { MoneyInput } from "../components/MoneyInput";

export default function FeesPage() {
  const [feeList, setFeeList] = useState<FeeRecord[]>([]);
  const [notice, setNotice] = useState("");
  const [filterStatus, setFilterStatus] = useState<"semua" | "belum-diambil" | "sudah-diambil">("semua");
  const [filterMarketer, setFilterMarketer] = useState("semua");
  const [search, setSearch] = useState("");
  const [detailFee, setDetailFee] = useState<FeeRecord | null>(null);
  const [editingAmount, setEditingAmount] = useState(false);
  const [amountDraft, setAmountDraft] = useState(0);
  const [deleteConfirmFee, setDeleteConfirmFee] = useState<FeeRecord | null>(null);

  const [marketers, setMarketers] = useState<Marketer[]>([]);

  const notify = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2600); };

  // ===== HYDRATION FIX: Muat data dari Supabase setelah hydration =====
  useEffect(() => {
    getFees().then(setFeeList);
    getMarketers().then(setMarketers);
  }, []);


  const filtered = feeList.filter(f => {
    const matchStatus = filterStatus === "semua" || f.status === filterStatus;
    const matchMarketer = filterMarketer === "semua" || f.marketerId === filterMarketer;
    const matchSearch = f.marketerName.toLowerCase().includes(search.toLowerCase()) || f.items.some(i => i.productName.toLowerCase().includes(search.toLowerCase()));
    return matchStatus && matchMarketer && matchSearch;
  });

  const totalOutstanding = feeList.filter(f => f.status === "belum-diambil").reduce((sum, f) => sum + f.totalFee, 0);
  const totalPaid = feeList.filter(f => f.status === "sudah-diambil").reduce((sum, f) => sum + f.totalFee, 0);
  const totalAll = feeList.reduce((sum, f) => sum + f.totalFee, 0);

  // Per-marketer summary
  const marketerSummary = marketers.map(m => {
    const fees = feeList.filter(f => f.marketerId === m.id);
    const outstanding = fees.filter(f => f.status === "belum-diambil").reduce((s, f) => s + f.totalFee, 0);
    const paid = fees.filter(f => f.status === "sudah-diambil").reduce((s, f) => s + f.totalFee, 0);
    return { ...m, count: fees.length, outstanding, paid };
  }).filter(m => m.count > 0);

  const markFeeAsPaid = async (fee: FeeRecord) => {
    const today = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    const updated = await updateFeeStatus(fee.id, "sudah-diambil", today);
    setFeeList(updated);
    setDetailFee(null);
    notify(`Fee ${fee.marketerName} ditandai sudah diambil`);
  };

  const markFeeAsUnpaid = async (fee: FeeRecord) => {
    const updated = await updateFeeStatus(fee.id, "belum-diambil", null);
    setFeeList(updated);
    setDetailFee(null);
    notify(`Fee ${fee.marketerName} dikembalikan ke belum diambil`);
  };

  const startEditAmount = (fee: FeeRecord) => {
    setAmountDraft(fee.totalFee);
    setEditingAmount(true);
  };

  const saveEditedAmount = async () => {
    if (!detailFee) return;
    const updated = await updateFeeAmount(detailFee.id, amountDraft);
    setFeeList(updated);
    setDetailFee(updated.find(f => f.id === detailFee.id) || null);
    setEditingAmount(false);
    notify(`Nominal fee ${detailFee.marketerName} diperbarui`);
  };

  const handleDeleteFee = async (fee: FeeRecord) => {
    const updated = await deleteFee(fee.id);
    setFeeList(updated);
    setDetailFee(null);
    setDeleteConfirmFee(null);
    notify(`Fee ${fee.marketerName} dihapus`);
  };

  return <main className="app-shell fees-page">
    <header className="topbar">
      <button className="icon-btn" aria-label="Kembali" onClick={goBack}><ArrowLeft size={21} /></button>

      <div className="brand">UmayasLa<span>·</span> Fee Marketer</div>
      <div className="header-actions"><button className="icon-btn"><Bell size={19} /></button></div>
    </header>

    <div className="fees-hero">
      <h1>Rekap Fee Marketer</h1>
      <p>Pantau fee yang masih menjadi tanggungan & riwayat pembayaran</p>
    </div>

    {/* ===== SUMMARY CARDS ===== */}
    <div className="fees-summary">
      <div className="fee-summary-card outstanding">
        <span className="fee-summary-icon"><Clock size={20} /></span>
        <div>
          <small>Belum Diambil</small>
          <b>{formatRupiah(totalOutstanding)}</b>
        </div>
      </div>
      <div className="fee-summary-card paid">
        <span className="fee-summary-icon"><CheckCircle2 size={20} /></span>
        <div>
          <small>Sudah Diambil</small>
          <b>{formatRupiah(totalPaid)}</b>
        </div>
      </div>
      <div className="fee-summary-card total">
        <span className="fee-summary-icon"><Wallet size={20} /></span>
        <div>
          <small>Total Fee</small>
          <b>{formatRupiah(totalAll)}</b>
        </div>
      </div>
    </div>

    {/* ===== PER MARKETER SUMMARY ===== */}
    {marketerSummary.length > 0 && (
      <div className="marketer-summary">
        <h2>Rekap per Marketer</h2>
        {marketerSummary.map(m => (
          <div className="marketer-summary-card" key={m.id}>
            <div className="marketer-avatar">{m.name.charAt(0)}</div>
            <div className="marketer-summary-info">
              <b>{m.name}</b>
              <small>{m.count} transaksi</small>
            </div>
            <div className="marketer-summary-amounts">
              <div className="amount-outstanding"><small>Belum</small><b>{formatRupiah(m.outstanding)}</b></div>
              <div className="amount-paid"><small>Diambil</small><b>{formatRupiah(m.paid)}</b></div>
            </div>
          </div>
        ))}
      </div>
    )}

    {/* ===== FILTERS ===== */}
    <div className="fees-filters">
      <div className="fees-search">
        <Search size={16} />
        <input placeholder="Cari marketer / nama produk..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="fees-filter-row">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as typeof filterStatus)}>
          <option value="semua">Semua Status</option>
          <option value="belum-diambil">Belum Diambil</option>
          <option value="sudah-diambil">Sudah Diambil</option>
        </select>
        <select value={filterMarketer} onChange={e => setFilterMarketer(e.target.value)}>
          <option value="semua">Semua Marketer</option>
          {marketers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>
    </div>

    {/* ===== FEE LIST ===== */}
    <div className="fees-list">
      {filtered.length === 0 && <div className="empty-state">
        <span>💸</span>
        <h3>Belum ada data fee</h3>
        <p>Fee akan otomatis tercatat saat order dibuat dengan marketer</p>
      </div>}

      {filtered.map(fee => (
        <div className={`fee-card ${fee.status}`} key={fee.id} onClick={() => setDetailFee(fee)}>
          <div className="fee-card-head">
            <div className="fee-marketer">
              <span className="fee-avatar">{fee.marketerName.charAt(0)}</span>
              <div>
                <b>{fee.marketerName}</b>
                <small>{fee.date}</small>
              </div>
            </div>
            <span className={`fee-status ${fee.status}`}>
              {fee.status === "belum-diambil" ? "⏳ Belum Diambil" : "✅ Sudah Diambil"}
            </span>
          </div>
          <div className="fee-card-body">
          <div className="fee-order-info">
            <small>Produk: <b>{fee.items.map(i => i.productName).join(", ")}</b></small>
          </div>
            <div className="fee-items-preview">
              {fee.items.slice(0, 3).map((item, i) => (
                <small key={i}>{item.productName} ×{item.qty} = {formatRupiah(item.feeTotal)}</small>
              ))}
              {fee.items.length > 3 && <small>+{fee.items.length - 3} item lainnya</small>}
            </div>
            <div className="fee-total">
              <span>Total Fee</span>
              <b>{formatRupiah(fee.totalFee)}</b>
            </div>
            {fee.paidDate && <small className="fee-paid-date">Dibayarkan: {fee.paidDate}</small>}
          </div>
          <ChevronRight className="fee-chevron" size={18} />
        </div>
      ))}
    </div>

    {/* ===== FEE DETAIL MODAL ===== */}
    {detailFee && (
      <div className="overlay" onClick={() => setDetailFee(null)}>
        <section className="modal fee-detail" onClick={e => e.stopPropagation()}>
          <button className="close" onClick={() => setDetailFee(null)}>×</button>
          <p className="eyebrow">DETAIL FEE</p>
          <h2>{detailFee.marketerName}</h2>
          <div className="fee-detail-meta">
            <span>Produk: <b>{detailFee.items.map(i => i.productName).join(", ")}</b></span>
            <span>Tanggal: <b>{detailFee.date}</b></span>
          </div>

          <div className="fee-detail-items">
            <div className="fee-detail-head">
              <span>Produk</span>
              <span>Qty</span>
              <span>Fee/pcs</span>
              <span>Total</span>
            </div>
            {detailFee.items.map((item, i) => (
              <div className="fee-detail-row" key={i}>
                <span>{item.productName}</span>
                <span>{item.qty}</span>
                <span>{formatRupiah(item.feePerUnit)}</span>
                <span><b>{formatRupiah(item.feeTotal)}</b></span>
              </div>
            ))}
          </div>

          {editingAmount ? (
            <div className="fee-detail-total fee-edit-amount">
              <span>Nominal Fee</span>
              <div className="fee-edit-amount-controls">
                <MoneyInput value={amountDraft} onChange={setAmountDraft} placeholder="0" />
                <button className="primary" onClick={saveEditedAmount}><Check size={15} /> Simpan</button>
                <button className="secondary" onClick={() => setEditingAmount(false)}>Batal</button>
              </div>
            </div>
          ) : (
            <div className="fee-detail-total">
              <span>Total Fee</span>
              <div className="fee-edit-amount-controls">
                <b>{formatRupiah(detailFee.totalFee)}</b>
                <button className="icon-btn" aria-label="Edit nominal fee" onClick={() => startEditAmount(detailFee)}><Pencil size={15} /></button>
              </div>
            </div>
          )}

          <div className="fee-detail-status">
            <span>Status</span>
            <b className={detailFee.status}>
              {detailFee.status === "belum-diambil" ? "⏳ Belum Diambil" : "✅ Sudah Diambil"}
            </b>
          </div>

          {detailFee.paidDate && <div className="fee-detail-paid">
            <span>Tanggal dibayarkan</span>
            <b>{detailFee.paidDate}</b>
          </div>}

          <div className="fee-detail-actions">
            {detailFee.status === "belum-diambil" ? (
              <button className="primary" onClick={() => markFeeAsPaid(detailFee)}>
                <CheckCircle2 size={16} /> Tandai Sudah Diambil
              </button>
            ) : (
              <button className="secondary" onClick={() => markFeeAsUnpaid(detailFee)}>
                <Clock size={16} /> Kembalikan ke Belum Diambil
              </button>
            )}
            <button className="fee-delete-btn" onClick={() => setDeleteConfirmFee(detailFee)}>
              <Trash2 size={16} /> Hapus Fee Ini
            </button>
          </div>
        </section>
      </div>
    )}

    {/* ===== KONFIRMASI HAPUS FEE ===== */}
    {deleteConfirmFee && (
      <div className="overlay" onClick={() => setDeleteConfirmFee(null)}>
        <section className="modal confirm-modal" onClick={e => e.stopPropagation()}>
          <h2>Hapus Fee Ini?</h2>
          <p>Fee <b>{formatRupiah(deleteConfirmFee.totalFee)}</b> untuk <b>{deleteConfirmFee.marketerName}</b> akan dihapus permanen. Order aslinya tidak ikut terhapus — cuma catatan fee-nya.</p>
          <div className="confirm-actions">
            <button className="secondary" onClick={() => setDeleteConfirmFee(null)}>Batal</button>
            <button className="danger" onClick={() => handleDeleteFee(deleteConfirmFee)}><Trash2 size={15} /> Hapus</button>
          </div>
        </section>
      </div>
    )}

    <BottomNav />


    {notice && <div className="toast"><Check size={17} />{notice}</div>}
  </main>;
}
