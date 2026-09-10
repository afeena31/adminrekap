"use client";

import { ArrowLeft, Bell, Check, Plus } from "lucide-react";

import Link from "next/link";
import { useEffect, useState } from "react";


import {
  getCollections, addCollection, updateCollection, softDeleteCollection, hardDeleteCollection,
  getCollectionStats, collectionTypeInfo, collectionStatusInfo,
  collectionColors, collectionIcons, afeenaYaslaMasterCollections,
  type Collection, type CollectionType, type CollectionStatus, type CollectionStats,
} from "../data/collections";
import { formatRupiah } from "../data/store";
import { BottomNav } from "../components/BottomNav";
import { goBack } from "../lib/goBack";


export default function CollectionsPage() {
  const [collectionList, setCollectionList] = useState<Collection[]>([]);
  const [statsMap, setStatsMap] = useState<Record<string, CollectionStats>>({});
  const [notice, setNotice] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    type: "custom" as CollectionType,
    status: "aktif" as CollectionStatus,
    icon: "✨",
    color: "#745034",
    description: "",
    owner: "",
    tags: "",
  });

  const notify = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2600); };

  // Preload stats semua collection sekaligus — getCollectionStats sekarang
  // async (Supabase), gak bisa dipanggil langsung di render/.map() lagi.
  const loadStats = async (list: Collection[]) => {
    const entries = await Promise.all(list.map(async c => [c.id, await getCollectionStats(c.id)] as const));
    setStatsMap(Object.fromEntries(entries));
  };

  const refreshCollections = async () => {
    const list = await getCollections();
    setCollectionList(list);
    await loadStats(list);
    return list;
  };

  // Idempotent (pola sama seperti "Muat Katalog Master Data" di halaman
  // Katalog) — aman diklik ulang, cuma nambah yang belum ada.
  const loadMasterCollections = async () => {
    const existingIds = new Set((await getCollections()).map(c => c.id));
    let added = 0;
    for (const c of afeenaYaslaMasterCollections) {
      if (!existingIds.has(c.id)) { await addCollection(c); added++; }
    }
    await refreshCollections();
    notify(added > 0 ? `${added} Collection dari Master Data dimuat` : "Kategori Master Data sudah lengkap");
  };

  // ===== HYDRATION FIX: Muat data dari localStorage setelah hydration =====
  useEffect(() => {
    refreshCollections();
  }, []);

  // ===== WIDGET COUNTS =====

  const activeCount = collectionList.filter(c => c.status === "aktif").length;
  const doneCount = collectionList.filter(c => c.status === "selesai").length;
  const draftCount = collectionList.filter(c => c.status === "draft").length;
  const followUpCount = collectionList.filter(c => {
    const stats = statsMap[c.id];
    return stats && (stats.unlinkedCustomers > 0 || stats.draftOrders > 0);
  }).length;

  // ===== FORM HANDLERS =====
  const openAddForm = () => {
    setEditingCollection(null);
    setForm({
      name: "",
      type: "custom",
      status: "aktif",
      icon: "✨",
      color: collectionColors[0],
      description: "",
      owner: "",
      tags: "",
    });
    setShowForm(true);
  };

  const openEditForm = (c: Collection) => {
    setEditingCollection(c);
    setForm({
      name: c.name,
      type: c.type,
      status: c.status,
      icon: c.icon,
      color: c.color,
      description: c.description || "",
      owner: c.owner || "",
      tags: c.tags.join(", "),
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { notify("Nama collection wajib diisi"); return; }
    const now = Date.now();
    const collection: Collection = {
      id: editingCollection ? editingCollection.id : "col-" + Date.now(),
      name: form.name.trim(),
      type: form.type,
      status: form.status,
      icon: form.icon,
      color: form.color,
      description: form.description.trim() || undefined,
      owner: form.owner.trim() || undefined,
      tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
      createdAt: editingCollection ? editingCollection.createdAt : now,
      updatedAt: now,
      deletedAt: null,
    };
    if (editingCollection) {
      await updateCollection(collection);
      await refreshCollections();
      notify("Collection diperbarui");
    } else {
      await addCollection(collection);
      await refreshCollections();
      notify("Collection baru dibuat");
    }
    setShowForm(false);
  };

  const handleDelete = async () => {
    if (!editingCollection) return;
    const stats = statsMap[editingCollection.id];
    if (stats && stats.totalOrders > 0) {
      // Soft delete - collection dengan transaksi
      await softDeleteCollection(editingCollection.id);
      await refreshCollections();
      notify("Collection diarsipkan (memiliki transaksi)");
    } else {
      // Hard delete - collection kosong
      await hardDeleteCollection(editingCollection.id);
      await refreshCollections();
      notify("Collection dihapus");
    }
    setShowDeleteConfirm(false);
    setShowForm(false);
  };

  const changeStatus = async (c: Collection, status: CollectionStatus) => {
    await updateCollection({ ...c, status });
    await refreshCollections();
    notify(`Status ${c.name} → ${collectionStatusInfo[status].name}`);
  };

  return <main className="app-shell collections-page">
    <header className="topbar">
      <button className="icon-btn" aria-label="Kembali" onClick={goBack}><ArrowLeft size={21} /></button>

      <div className="brand">UmayasLa<span>·</span> Collection</div>
      <div className="header-actions"><button className="icon-btn"><Bell size={19} /></button></div>
    </header>

    <div className="collections-hero">
      <h1>Collection Workspace</h1>
      <p>Ruang kerja untuk Batch, Produk, Campaign, dan lainnya</p>
    </div>

    {/* ===== WIDGETS ===== */}
    <div className="collection-widgets">
      <div className="collection-widget">
        <span className="collection-widget-icon aktif">🟢</span>
        <div><small>Collection Aktif</small><b>{activeCount}</b></div>
      </div>
      <div className="collection-widget">
        <span className="collection-widget-icon selesai">✅</span>
        <div><small>Collection Selesai</small><b>{doneCount}</b></div>
      </div>
      <div className="collection-widget">
        <span className="collection-widget-icon draft">📝</span>
        <div><small>Collection Draft</small><b>{draftCount}</b></div>
      </div>
      <div className="collection-widget">
        <span className="collection-widget-icon followup">🔔</span>
        <div><small>Perlu Follow Up</small><b>{followUpCount}</b></div>
      </div>
    </div>

    {/* ===== ADD BUTTON ===== */}
    <div className="collection-workspace-head" style={{ marginTop: 24 }}>
      <div>
        <h2>Semua Collection</h2>
        <p>Klik card untuk membuka workspace</p>
      </div>
      <button className="collection-add-btn" onClick={openAddForm}><Plus size={15} /> Collection Baru</button>
    </div>

    {/* ===== COLLECTION GRID ===== */}
    <div className="collection-grid">
      {collectionList.length === 0 && <div className="collection-empty">
        <span>🗂️</span>
        <h3>Belum ada collection</h3>
        <p>Buat collection pertama untuk mulai mengelola order per batch atau produk.</p>
        <button className="primary" style={{ marginTop: 14 }} onClick={loadMasterCollections}>Muat Kategori Master Data (Afeena & Etalase YasLa)</button>
      </div>}

      {collectionList.map(c => {
        const stats = statsMap[c.id] ?? { totalOrders: 0, totalCustomers: 0, totalItems: 0, totalOutstanding: 0, totalPayment: 0, totalShipment: 0, draftOrders: 0, unlinkedCustomers: 0, shipmentProgress: 0 };
        const typeInfo = collectionTypeInfo[c.type];
        const statusInfo = collectionStatusInfo[c.status];
        return (
          <Link href={`/collections/${c.id}`} key={c.id} className="collection-card" style={{ "--col-color": c.color, "--col-bg": c.color + "22" } as React.CSSProperties}>
            <div className="collection-card-head">
              <span className="collection-card-icon">{c.icon}</span>
              <div className="collection-card-title">
                <b>{c.name}</b>
                <small>{typeInfo.name}</small>
              </div>
              <span className={`collection-status-badge ${c.status}`}>{statusInfo.emoji} {statusInfo.name}</span>
            </div>
            <div className="collection-card-stats">
              <div className="collection-stat">
                <small>Order</small>
                <b>{stats.totalOrders}</b>
              </div>
              <div className="collection-stat">
                <small>Customer</small>
                <b>{stats.totalCustomers}</b>
              </div>
              <div className="collection-stat outstanding">
                <small>Outstanding</small>
                <b>{stats.totalOutstanding > 0 ? formatRupiah(stats.totalOutstanding) : "—"}</b>
              </div>
              <div className="collection-stat payment">
                <small>Payment</small>
                <b>{stats.totalPayment > 0 ? formatRupiah(stats.totalPayment) : "—"}</b>
              </div>
            </div>
            <div className="collection-card-footer">
              <div className="collection-shipment-progress">
                <small><span>Shipment</span><span>{stats.shipmentProgress}%</span></small>
                <div className="collection-progress-bar">
                  <div className="collection-progress-fill" style={{ width: `${stats.shipmentProgress}%` }} />
                </div>
              </div>
              <div className="collection-card-badges">
                {stats.draftOrders > 0 && <span className="collection-mini-badge draft">{stats.draftOrders} draft</span>}
                {stats.unlinkedCustomers > 0 && <span className="collection-mini-badge unlinked">{stats.unlinkedCustomers} unlinked</span>}
              </div>
            </div>
          </Link>
        );
      })}
    </div>

    {/* ===== COLLECTION FORM MODAL ===== */}
    {showForm && (
      <div className="overlay" onClick={() => setShowForm(false)}>
        <section className="modal collection-form" onClick={e => e.stopPropagation()}>
          <button className="close" onClick={() => setShowForm(false)}>×</button>
          <p className="eyebrow">{editingCollection ? "EDIT COLLECTION" : "COLLECTION BARU"}</p>
          <h2>{editingCollection ? "Edit Collection" : "Buat Collection Baru"}</h2>

          <label>Nama Collection *
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Contoh: PO Batch 9, Linen Spray, Buku" />
          </label>

          <label>Jenis Collection
            <div className="collection-type-grid">
              {(Object.keys(collectionTypeInfo) as CollectionType[]).map(t => (
                <button key={t} className={form.type === t ? "selected" : ""} onClick={() => setForm({ ...form, type: t })}>
                  <span>{collectionTypeInfo[t].emoji}</span>
                  {collectionTypeInfo[t].name}
                </button>
              ))}
            </div>
          </label>

          <label>Status
            <div className="collection-type-grid">
              {(Object.keys(collectionStatusInfo) as CollectionStatus[]).map(s => (
                <button key={s} className={form.status === s ? "selected" : ""} onClick={() => setForm({ ...form, status: s })}>
                  <span>{collectionStatusInfo[s].emoji}</span>
                  {collectionStatusInfo[s].name}
                </button>
              ))}
            </div>
          </label>

          <label>Icon
            <div className="collection-icon-grid">
              {collectionIcons.map(icon => (
                <button key={icon} className={form.icon === icon ? "selected" : ""} onClick={() => setForm({ ...form, icon })}>
                  {icon}
                </button>
              ))}
            </div>
          </label>

          <label>Warna
            <div className="collection-color-grid">
              {collectionColors.map(color => (
                <button key={color} className={form.color === color ? "selected" : ""} style={{ background: color }} onClick={() => setForm({ ...form, color })} />
              ))}
            </div>
          </label>

          <label>Deskripsi (opsional)
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Deskripsi collection ini" />
          </label>

          <label>Owner (opsional)
            <input value={form.owner} onChange={e => setForm({ ...form, owner: e.target.value })} placeholder="Nama owner" />
          </label>

          <label>Tags (pisahkan dengan koma)
            <input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="Contoh: amna, jilbab, po" />
          </label>

          <div className="form-actions">
            {editingCollection && <button className="danger" onClick={() => setShowDeleteConfirm(true)}>Hapus</button>}
            <button className="primary" onClick={handleSave}><Check size={16} /> {editingCollection ? "Simpan Perubahan" : "Buat Collection"}</button>
          </div>
        </section>
      </div>
    )}

    {/* ===== DELETE CONFIRM ===== */}
    {showDeleteConfirm && (
      <div className="overlay" onClick={() => setShowDeleteConfirm(false)}>
        <section className="modal confirm-modal" onClick={e => e.stopPropagation()}>
          <h2>Hapus Collection?</h2>
          <p>Collection <b>{editingCollection?.name}</b> akan dihapus.</p>
          <p className="muted">
            {editingCollection && (statsMap[editingCollection.id]?.totalOrders ?? 0) > 0
              ? "Collection ini memiliki transaksi, sehingga akan diarsipkan (soft delete). Data order tetap tersimpan."
              : "Collection ini kosong dan akan dihapus permanen."}
          </p>
          <div className="confirm-actions">
            <button className="secondary" onClick={() => setShowDeleteConfirm(false)}>Batal</button>
            <button className="danger" onClick={handleDelete}>Hapus</button>
          </div>
        </section>
      </div>
    )}

    <BottomNav />

    {notice && <div className="toast"><Check size={17} />{notice}</div>}
  </main>;
}
