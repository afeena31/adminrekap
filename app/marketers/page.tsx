"use client";

import { ArrowLeft, Bell, Check, ChevronRight, Pencil, Phone, Plus, Search, Trash2, Users, CalendarDays, StickyNote, TrendingUp, Package, Coins, Clock } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";


import { getMarketers, addMarketer, updateMarketer, deleteMarketer, getMarketerStats, getOrders, formatRupiah, type Marketer, type MarketerStatus, type MarketerStats } from "../data/store";
import { BottomNav } from "../components/BottomNav";
import { goBack } from "../lib/goBack";
import { useAuth } from "../data/authContext";


type StatusFilter = "semua" | MarketerStatus;

const statusLabels: Record<MarketerStatus, string> = {
  "aktif": "Aktif",
  "tidak-aktif": "Tidak Aktif",
  "arsip": "Arsip",
};

const statusEmoji: Record<MarketerStatus, string> = {
  "aktif": "🟢",
  "tidak-aktif": "🟡",
  "arsip": "⚪",
};

export default function MarketersPage() {
  // Tahap 7 — order.totalFee (dipakai MarketerStats.fee) di-strip get_orders()
  // RPC utk Admin sejak Tahap 7 (sama nilainya dgn fees.total_fee yg sudah
  // disembunyikan sejak Tahap 6), jadi selalu 0 utk Admin — tampilkan
  // "Tersembunyi", bukan "Rp0" (kelihatan seperti fee-nya emang kosong).
  const { role: authRole } = useAuth();
  const isOwner = authRole === "owner";
  const feeDisplay = (amount: number) => isOwner ? formatRupiah(amount) : "Tersembunyi";
  const [marketerList, setMarketerList] = useState<Marketer[]>([]);
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("semua");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [detailMarketer, setDetailMarketer] = useState<Marketer | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingMarketer, setEditingMarketer] = useState<Marketer | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    defaultFee: "",
    status: "aktif" as MarketerStatus,
    joinedAt: "",
    notes: "",
  });

  const [statsMap, setStatsMap] = useState<Record<string, MarketerStats | null>>({});
  // Order sekarang Supabase (Tahap 6) — gak bisa dipanggil langsung di
  // render/.map() lagi, dipreload di sini.
  const [allOrders, setAllOrders] = useState<Awaited<ReturnType<typeof getOrders>>>([]);

  const notify = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2600); };

  // ===== HYDRATION FIX: Muat data setelah hydration =====
  // Marketer sudah pindah ke Supabase (Tahap 4 migrasi backend) — async.
  useEffect(() => {
    getMarketers().then(setMarketerList);
    getOrders().then(setAllOrders);
  }, []);

  // getMarketerStats juga async sekarang — gak bisa dipanggil langsung di
  // dalam .map()/render (dulu bisa krn sync). Dihitung sekali di sini tiap
  // marketerList berubah, disimpan ke state, render tinggal lookup.
  useEffect(() => {
    Promise.all(marketerList.map(async m => [m.id, await getMarketerStats(m.id)] as const))
      .then(pairs => setStatsMap(Object.fromEntries(pairs)));
  }, [marketerList]);

  const filtered = marketerList.filter(m => {

    const matchStatus = filterStatus === "semua" || m.status === filterStatus;
    const matchSearch = m.name.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const activeCount = marketerList.filter(m => m.status === "aktif").length;
  const inactiveCount = marketerList.filter(m => m.status === "tidak-aktif").length;
  const archiveCount = marketerList.filter(m => m.status === "arsip").length;

  const openAddForm = () => {
    setEditingMarketer(null);
    setForm({ name: "", phone: "", defaultFee: "", status: "aktif", joinedAt: new Date().toISOString().slice(0, 10), notes: "" });
    setShowForm(true);
  };

  const openEditForm = (m: Marketer) => {
    setEditingMarketer(m);
    setForm({
      name: m.name,
      phone: m.phone || "",
      defaultFee: m.defaultFee ? String(m.defaultFee) : "",
      status: m.status,
      joinedAt: m.joinedAt,
      notes: m.notes || "",
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { notify("Nama marketer wajib diisi"); return; }
    const marketer: Marketer = {
      id: editingMarketer ? editingMarketer.id : "mk-" + Date.now(),
      name: form.name.trim(),
      phone: form.phone.trim() || undefined,
      defaultFee: Number(form.defaultFee) || 0,
      status: form.status,
      joinedAt: form.joinedAt || new Date().toISOString().slice(0, 10),
      notes: form.notes.trim() || undefined,
    };
    if (editingMarketer) {
      const updated = await updateMarketer(marketer);
      setMarketerList(updated);
      setDetailMarketer(marketer);
      notify("Profil marketer diperbarui");
    } else {
      const updated = await addMarketer(marketer, true);
      setMarketerList(updated);
      notify("Marketer baru ditambahkan ke master");
    }

    setShowForm(false);
  };

  const handleDelete = async () => {
    if (!editingMarketer) return;
    // Cek fresh (bukan state allOrders yg mungkin sudah basi) — ini guard
    // keamanan data, jangan sampai lolos gara-gara order baru belum ke-refresh.
    const hasOrders = (await getOrders()).some(o => o.marketerId === editingMarketer.id);
    if (hasOrders) {
      notify("Tidak bisa dihapus: marketer memiliki riwayat order. Ubah status menjadi Arsip.");
      setShowDeleteConfirm(false);
      setShowForm(false);
      return;
    }
    const updated = await deleteMarketer(editingMarketer.id);
    setMarketerList(updated);
    setShowDeleteConfirm(false);
    setShowForm(false);
    setDetailMarketer(null);
    notify("Marketer dihapus dari master");
  };

  const changeStatus = async (m: Marketer, status: MarketerStatus) => {
    const updated = await updateMarketer({ ...m, status });
    setMarketerList(updated);
    setDetailMarketer({ ...m, status });
    notify(`Status ${m.name} diubah menjadi ${statusLabels[status]}`);
  };

  return <main className="app-shell marketers-page">
    <header className="topbar">
      <button className="icon-btn" aria-label="Kembali" onClick={goBack}><ArrowLeft size={21} /></button>

      <div className="brand">UmayasLa<span>·</span> Marketer</div>
      <div className="header-actions"><button className="icon-btn"><Bell size={19} /></button></div>
    </header>

    <div className="marketers-hero">
      <h1>Master Marketer</h1>
      <p>Kelola profil, status, dan performa marketer</p>
    </div>

    {/* ===== SUMMARY ===== */}
    <div className="marketers-summary">
      <div className="mk-summary-card active">
        <span className="mk-summary-icon"><Users size={20} /></span>
        <div><small>Aktif</small><b>{activeCount}</b></div>
      </div>
      <div className="mk-summary-card inactive">
        <span className="mk-summary-icon"><Clock size={20} /></span>
        <div><small>Tidak Aktif</small><b>{inactiveCount}</b></div>
      </div>
      <div className="mk-summary-card archive">
        <span className="mk-summary-icon"><Package size={20} /></span>
        <div><small>Arsip</small><b>{archiveCount}</b></div>
      </div>
    </div>

    {/* ===== FILTERS ===== */}
    <div className="marketers-filters">
      <div className="marketers-search">
        <Search size={16} />
        <input placeholder="Cari marketer..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="mk-filter-chips">
        <button className={filterStatus === "semua" ? "active" : ""} onClick={() => setFilterStatus("semua")}>Semua</button>
        <button className={filterStatus === "aktif" ? "active" : ""} onClick={() => setFilterStatus("aktif")}>🟢 Aktif</button>
        <button className={filterStatus === "tidak-aktif" ? "active" : ""} onClick={() => setFilterStatus("tidak-aktif")}>🟡 Tidak Aktif</button>
        <button className={filterStatus === "arsip" ? "active" : ""} onClick={() => setFilterStatus("arsip")}>⚪ Arsip</button>
      </div>
    </div>

    {/* ===== ADD BUTTON ===== */}
    <button className="add-marketer-main" onClick={openAddForm}><Plus size={16} /> Tambah Marketer</button>

    {/* ===== MARKETER LIST ===== */}
    <div className="marketers-list">
      {filtered.length === 0 && <div className="empty-state">
        <span>👥</span>
        <h3>Belum ada marketer</h3>
        <p>Tambahkan marketer baru untuk mulai mencatat closing</p>
      </div>}

      {filtered.map(m => {
        const stats = statsMap[m.id];
        return (
          <div className={`marketer-card ${m.status}`} key={m.id} onClick={() => setDetailMarketer(m)}>
            <div className="marketer-card-head">
              <span className="marketer-avatar">{m.name.charAt(0)}</span>
              <div className="marketer-card-info">
                <b>{m.name}</b>
                <small>{statusEmoji[m.status]} {statusLabels[m.status]}</small>
              </div>
              <ChevronRight size={18} className="mk-chevron" />
            </div>
            <div className="marketer-card-stats">
              <div><small>Closing</small><b>{stats?.closingCount || 0}</b></div>
              <div><small>Omzet</small><b>{formatRupiah(stats?.omzet || 0)}</b></div>
              <div><small>Fee</small><b>{feeDisplay(stats?.fee || 0)}</b></div>
            </div>
          </div>
        );
      })}
    </div>

    {/* ===== DETAIL / PROFILE MODAL ===== */}
    {detailMarketer && (() => {
      const stats = statsMap[detailMarketer.id];
      const orders = allOrders.filter(o => o.marketerId === detailMarketer.id);
      return (
        <div className="overlay" onClick={() => setDetailMarketer(null)}>
          <section className="modal marketer-detail" onClick={e => e.stopPropagation()}>
            <button className="close" onClick={() => setDetailMarketer(null)}>×</button>
            <div className="mk-detail-head">
              <span className="marketer-avatar large">{detailMarketer.name.charAt(0)}</span>
              <div>
                <h2>{detailMarketer.name}</h2>
                <span className={`mk-status-badge ${detailMarketer.status}`}>{statusEmoji[detailMarketer.status]} {statusLabels[detailMarketer.status]}</span>
              </div>
            </div>

            {/* ===== PROFIL ===== */}
            <div className="mk-detail-section">
              <h3>Profil</h3>
              <div className="mk-detail-row"><span><Phone size={14} /> No. HP</span><b>{detailMarketer.phone || "—"}</b></div>
              <div className="mk-detail-row"><span><Coins size={14} /> Fee Default</span><b>{detailMarketer.defaultFee > 0 ? formatRupiah(detailMarketer.defaultFee) : "—"}</b></div>
              <div className="mk-detail-row"><span><CalendarDays size={14} /> Bergabung</span><b>{detailMarketer.joinedAt}</b></div>
              {detailMarketer.notes && <div className="mk-detail-row"><span><StickyNote size={14} /> Catatan</span><b>{detailMarketer.notes}</b></div>}
            </div>

            {/* ===== STATISTIK ===== */}
            <div className="mk-detail-section">
              <h3>Statistik</h3>
              <div className="mk-stats-grid">
                <div className="mk-stat"><small>Closing</small><b>{stats?.closingCount || 0}</b></div>
                <div className="mk-stat"><small>Order</small><b>{stats?.orderCount || 0}</b></div>
                <div className="mk-stat"><small>Omzet</small><b>{formatRupiah(stats?.omzet || 0)}</b></div>
                <div className="mk-stat"><small>Fee</small><b>{feeDisplay(stats?.fee || 0)}</b></div>
                <div className="mk-stat"><small>Outstanding</small><b>{formatRupiah(stats?.outstanding || 0)}</b></div>
                <div className="mk-stat"><small>Customer</small><b>{stats?.customers.length || 0}</b></div>
              </div>
              {stats && stats.customers.length > 0 && (
                <div className="mk-customers">
                  <small>Customer yang pernah closing:</small>
                  <div className="mk-customer-chips">
                    {stats.customers.map((c, i) => <span key={i}>{c}</span>)}
                  </div>
                </div>
              )}
            </div>

            {/* ===== RIWAYAT ORDER ===== */}
            {orders.length > 0 && (
              <div className="mk-detail-section">
                <h3>Riwayat Order ({orders.length})</h3>
                <div className="mk-order-list">
                  {orders.slice(0, 5).map(o => (
                    <div className="mk-order-row" key={o.id}>
                      <span className="mk-order-emoji">📦</span>
                      <div>
                        <b>{o.number}</b>
                        <small>{o.customer} · {new Date(o.date).toLocaleDateString("id-ID")}</small>
                      </div>
                      <b className="mk-order-total">{formatRupiah(o.total)}</b>
                    </div>
                  ))}
                  {orders.length > 5 && <small className="mk-more">+{orders.length - 5} order lainnya</small>}
                </div>
              </div>
            )}

            {/* ===== STATUS MANAGEMENT ===== */}
            <div className="mk-detail-section">
              <h3>Ubah Status</h3>
              <div className="mk-status-actions">
                <button className={detailMarketer.status === "aktif" ? "selected" : ""} onClick={() => changeStatus(detailMarketer, "aktif")}>🟢 Aktif</button>
                <button className={detailMarketer.status === "tidak-aktif" ? "selected" : ""} onClick={() => changeStatus(detailMarketer, "tidak-aktif")}>🟡 Tidak Aktif</button>
                <button className={detailMarketer.status === "arsip" ? "selected" : ""} onClick={() => changeStatus(detailMarketer, "arsip")}>⚪ Arsip</button>
              </div>
              <p className="mk-status-hint">
                {detailMarketer.status === "arsip"
                  ? "Marketer arsip tidak muncul di dropdown order baru, tetapi tetap tampil di histori order lama."
                  : detailMarketer.status === "tidak-aktif"
                    ? "Marketer tidak aktif tidak muncul di dropdown order baru."
                    : "Marketer aktif muncul di dropdown order baru."}
              </p>
            </div>

            <div className="mk-detail-actions">
              <button className="primary" onClick={() => { openEditForm(detailMarketer); setDetailMarketer(null); }}><Pencil size={15} /> Edit Profil</button>
            </div>
          </section>
        </div>
      );
    })()}

    {/* ===== ADD/EDIT FORM MODAL ===== */}
    {showForm && (
      <div className="overlay" onClick={() => setShowForm(false)}>
        <section className="modal marketer-form" onClick={e => e.stopPropagation()}>
          <button className="close" onClick={() => setShowForm(false)}>×</button>
          <p className="eyebrow">{editingMarketer ? "EDIT MARKETER" : "MARKETER BARU"}</p>
          <h2>{editingMarketer ? "Edit Profil Marketer" : "Tambah Marketer"}</h2>

          <label>Nama Marketer *
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nama marketer" />
          </label>

          <label>Nomor HP (opsional)
            <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="Contoh: 0812xxxx" />
          </label>

          <label>Fee Default (Rp/pcs, opsional)
            <input type="number" min="0" value={form.defaultFee} onChange={e => setForm({ ...form, defaultFee: e.target.value })} placeholder="Contoh: 15000" />
          </label>

          <label>Status
            <div className="mk-form-status">
              <button className={form.status === "aktif" ? "selected" : ""} onClick={() => setForm({ ...form, status: "aktif" })}>🟢 Aktif</button>
              <button className={form.status === "tidak-aktif" ? "selected" : ""} onClick={() => setForm({ ...form, status: "tidak-aktif" })}>🟡 Tidak Aktif</button>
              <button className={form.status === "arsip" ? "selected" : ""} onClick={() => setForm({ ...form, status: "arsip" })}>⚪ Arsip</button>
            </div>
          </label>

          <label>Tanggal Bergabung
            <input type="date" value={form.joinedAt} onChange={e => setForm({ ...form, joinedAt: e.target.value })} />
          </label>

          <label>Catatan (opsional)
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Catatan tentang marketer ini" />
          </label>

          <div className="form-actions">
            {editingMarketer && <button className="danger" onClick={() => setShowDeleteConfirm(true)}><Trash2 size={15} /> Hapus</button>}
            <button className="primary" onClick={handleSave}><Check size={16} /> {editingMarketer ? "Simpan Perubahan" : "Tambah Marketer"}</button>
          </div>
        </section>
      </div>
    )}

    {/* ===== DELETE CONFIRM ===== */}
    {showDeleteConfirm && (
      <div className="overlay" onClick={() => setShowDeleteConfirm(false)}>
        <section className="modal confirm-modal" onClick={e => e.stopPropagation()}>
          <h2>Hapus Marketer?</h2>
          <p>Marketer <b>{editingMarketer?.name}</b> akan dihapus permanen dari master.</p>
          <p className="muted">Jika marketer memiliki riwayat order, sebaiknya ubah status menjadi Arsip agar histori tetap tersimpan.</p>
          <div className="confirm-actions">
            <button className="secondary" onClick={() => setShowDeleteConfirm(false)}>Batal</button>
            <button className="danger" onClick={handleDelete}><Trash2 size={15} /> Hapus</button>
          </div>
        </section>
      </div>
    )}

    <BottomNav />

    {notice && <div className="toast"><Check size={17} />{notice}</div>}
  </main>;
}
