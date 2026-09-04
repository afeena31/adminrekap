"use client";

import { ArrowLeft, Bell, Check, ChevronRight, Home, Search, ShoppingBag, Users, UserRound, Wallet, CheckCircle2, Clock, Filter } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { getFees, updateFeeStatus, getMarketers, formatRupiah, type FeeRecord } from "../data/store";

export default function FeesPage() {
  const [feeList, setFeeList] = useState<FeeRecord[]>(() => getFees());
  const [notice, setNotice] = useState("");
  const [filterStatus, setFilterStatus] = useState<"semua" | "belum-diambil" | "sudah-diambil">("semua");
  const [filterMarketer, setFilterMarketer] = useState("semua");
  const [search, setSearch] = useState("");
  const [detailFee, setDetailFee] = useState<FeeRecord | null>(null);

  const [marketers, setMarketers] = useState(() => getMarketers());

  const notify = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2600); };

  // ===== HYDRATION FIX: Muat data dari localStorage setelah hydration =====
  useEffect(() => {
    setFeeList(getFees());
    setMarketers(getMarketers());
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

  const markFeeAsPaid = (fee: FeeRecord) => {
    const today = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    const updated = updateFeeStatus(fee.id, "sudah-diambil", today);
    setFeeList(updated);
    setDetailFee(null);
    notify(`Fee ${fee.marketerName} ditandai sudah diambil`);
  };

  const markFeeAsUnpaid = (fee: FeeRecord) => {
    const updated = updateFeeStatus(fee.id, "belum-diambil", null);
    setFeeList(updated);
    setDetailFee(null);
    notify(`Fee ${fee.marketerName} dikembalikan ke belum diambil`);
  };

  return <main className="app-shell fees-page">
    <header className="topbar">
      <button className="icon-btn" aria-label="Kembali" onClick={() => window.history.back()}><ArrowLeft size={21} /></button>

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

          <div className="fee-detail-total">
            <span>Total Fee</span>
            <b>{formatRupiah(detailFee.totalFee)}</b>
          </div>

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
          </div>
        </section>
      </div>
    )}

    <nav className="bottom-nav">
      <Link href="/dashboard" className="nav-link"><Home /><span>Dashboard</span></Link>
      <Link href="/order" className="nav-link"><ShoppingBag /><span>Order</span></Link>
      <button className="current"><Wallet /><span>Fee</span></button>
      <Link href="/" className="nav-link"><Users /><span>Customer</span></Link>
      <Link href="/marketers" className="nav-link"><UserRound /><span>Marketer</span></Link>
    </nav>


    {notice && <div className="toast"><Check size={17} />{notice}</div>}
  </main>;
}
