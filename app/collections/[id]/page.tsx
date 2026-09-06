"use client";

import { ArrowLeft, Bell, Check, Pencil, Plus, Trash2 } from "lucide-react";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BottomNav } from "../../components/BottomNav";
import { goBack } from "../../lib/goBack";


import {
  getCollection, getCollectionStats, getOrdersForCollection,
  removeOrderFromCollection,
  updateCollection, softDeleteCollection, hardDeleteCollection,
  createOrderInCollection, matchCustomerId,
  collectionTypeInfo, collectionStatusInfo,
  collectionColors, collectionIcons,
  type Collection, type CollectionType, type CollectionStatus,
} from "../../data/collections";
import { formatRupiah, type OrderRecord } from "../../data/store";

import { getCustomers } from "../../data/central";

type TabKey = "ringkasan" | "order" | "customer" | "payment" | "shipment" | "catatan" | "aktivitas";

const tabs: { key: TabKey; label: string }[] = [
  { key: "ringkasan", label: "Ringkasan" },
  { key: "order", label: "Order" },
  { key: "customer", label: "Customer" },
  { key: "payment", label: "Payment" },
  { key: "shipment", label: "Shipment" },
  { key: "catatan", label: "Catatan" },
  { key: "aktivitas", label: "Aktivitas" },
];

export default function CollectionDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [collection, setCollection] = useState<Collection | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("ringkasan");
  const [notice, setNotice] = useState("");
  const [showAddOrder, setShowAddOrder] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [editForm, setEditForm] = useState({
    name: "",
    type: "custom" as CollectionType,
    status: "aktif" as CollectionStatus,
    icon: "✨",
    color: "#745034",
    description: "",
    owner: "",
    tags: "",
  });

  // ===== ADD ORDER FORM STATE =====
  const [orderForm, setOrderForm] = useState({
    customerName: "",
    phone: "",
    productName: "",
    productEmoji: "📦",
    qty: 1,
    price: 0,
    note: "",
  });

  const notify = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2600); };

  // ===== HYDRATION FIX: Muat data dari localStorage setelah hydration =====
  useEffect(() => {
    setCollection(getCollection(id));
    setOrders(getOrdersForCollection(id));
  }, [id]);

  if (!collection) {

    return <main className="app-shell">
      <header className="topbar">
        <button className="icon-btn" aria-label="Kembali" onClick={goBack}><ArrowLeft size={21} /></button>
        <div className="brand">UmayasLa<span>·</span> Collection</div>
      </header>
      <div className="collection-empty">
        <span>🔍</span>
        <h3>Collection tidak ditemukan</h3>
        <p>Collection mungkin telah dihapus atau diarsipkan.</p>
        <Link href="/collections" className="primary" style={{ display: "inline-block", marginTop: 12 }}>Kembali ke Collection</Link>
      </div>
    </main>;
  }

  const stats = getCollectionStats(collection.id);
  const typeInfo = collectionTypeInfo[collection.type];
  const statusInfo = collectionStatusInfo[collection.status];

  // ===== CUSTOMER AGGREGATION =====
  const customerMap = new Map<string, { name: string; orders: number; total: number }>();
  orders.forEach(o => {
    const key = o.customerId || o.customer;
    const existing = customerMap.get(key);
    if (existing) {
      existing.orders += 1;
      existing.total += o.total;
    } else {
      customerMap.set(key, { name: o.customer, orders: 1, total: o.total });
    }
  });
  const customerList = Array.from(customerMap.entries()).map(([key, val]) => ({ key, ...val }));

  // ===== PAYMENT AGGREGATION =====
  const paymentList = orders.map(o => ({
    orderId: o.id,
    orderNumber: o.number,
    customer: o.customer,
    dp: o.dp,
    total: o.total,
    status: o.status === "paid" ? "paid" : o.dp > 0 ? "dp" : "unpaid",
  }));

  // ===== SHIPMENT AGGREGATION =====
  const shipmentList = orders.map(o => ({
    orderId: o.id,
    orderNumber: o.number,
    customer: o.customer,
    status: o.status,
    items: o.items.reduce((s, i) => s + i.qty, 0),
  }));

  // ===== ACTIVITY (derived from orders) =====
  const activityList = [...orders]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 10)
    .map(o => ({
      id: o.id,
      icon: "📦",
      title: `Order ${o.number} dibuat`,
      detail: `${o.customer} · ${formatRupiah(o.total)}`,
      time: new Date(o.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
    }));

  // ===== HANDLERS =====
  const openEditForm = () => {
    setEditForm({
      name: collection.name,
      type: collection.type,
      status: collection.status,
      icon: collection.icon,
      color: collection.color,
      description: collection.description || "",
      owner: collection.owner || "",
      tags: collection.tags.join(", "),
    });
    setShowEditForm(true);
  };

  const handleSaveEdit = () => {
    if (!editForm.name.trim()) { notify("Nama collection wajib diisi"); return; }
    const updated = updateCollection({
      ...collection,
      name: editForm.name.trim(),
      type: editForm.type,
      status: editForm.status,
      icon: editForm.icon,
      color: editForm.color,
      description: editForm.description.trim() || undefined,
      owner: editForm.owner.trim() || undefined,
      tags: editForm.tags.split(",").map(t => t.trim()).filter(Boolean),
    });
    setCollection(getCollection(collection.id));
    setShowEditForm(false);
    notify("Collection diperbarui");
  };

  const handleDelete = () => {
    if (stats.totalOrders > 0) {
      softDeleteCollection(collection.id);
      notify("Collection diarsipkan (memiliki transaksi)");
    } else {
      hardDeleteCollection(collection.id);
      notify("Collection dihapus");
    }
    setShowDeleteConfirm(false);
    window.location.href = "/collections";
  };

  const handleAddOrder = () => {
    if (!orderForm.customerName.trim()) { notify("Nama customer wajib diisi"); return; }
    if (!orderForm.productName.trim()) { notify("Nama produk wajib diisi"); return; }
    if (orderForm.qty <= 0) { notify("Qty harus lebih dari 0"); return; }
    if (orderForm.price <= 0) { notify("Harga wajib diisi"); return; }

    const newOrder = createOrderInCollection(collection.id, {
      customerName: orderForm.customerName.trim(),
      phone: orderForm.phone.trim(),
      productName: orderForm.productName.trim(),
      productEmoji: orderForm.productEmoji,
      qty: orderForm.qty,
      price: orderForm.price,
      note: orderForm.note.trim(),
    });

    if (newOrder) {
      setOrders(getOrdersForCollection(collection.id));
      setShowAddOrder(false);
      setOrderForm({ customerName: "", phone: "", productName: "", productEmoji: "📦", qty: 1, price: 0, note: "" });
      notify(newOrder.customerId ? "Order ditambahkan & customer terhubung" : "Order ditambahkan (customer belum terhubung)");
    }
  };

  const handleRemoveOrder = (orderId: string) => {
    removeOrderFromCollection(collection.id, orderId);
    setOrders(getOrdersForCollection(collection.id));
    notify("Order dihapus dari collection");
  };

  // ===== CHECK CUSTOMER MATCH LIVE =====
  const matchedCustomer = orderForm.customerName.trim() || orderForm.phone.trim()
    ? matchCustomerId(orderForm.customerName.trim(), orderForm.phone.trim())
    : null;

  const orderTotal = orderForm.price * orderForm.qty;

  return <main className="app-shell collection-detail-page">
    <header className="topbar">
      <Link href="/collections" className="icon-btn" aria-label="Kembali"><ArrowLeft size={21} /></Link>
      <div className="brand">UmayasLa<span>·</span> Collection</div>
      <div className="header-actions"><button className="icon-btn"><Bell size={19} /></button></div>
    </header>

    {/* ===== HERO ===== */}
    <div className="collection-detail-hero" style={{ "--col-color": collection.color, "--col-bg": collection.color + "22" } as React.CSSProperties}>
      <div className="collection-detail-head">
        <span className="collection-detail-icon">{collection.icon}</span>
        <div className="collection-detail-title">
          <h1>{collection.name}</h1>
          <div className="collection-meta-row">
            <span className={`collection-status-badge ${collection.status}`}>{statusInfo.emoji} {statusInfo.name}</span>
            <small>{typeInfo.name}</small>
            <small>· Dibuat {new Date(collection.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</small>
          </div>
        </div>
        <div className="collection-detail-actions">
          <button className="primary" onClick={() => setShowAddOrder(true)}><Plus size={14} /> Tambah Order</button>
          <button onClick={openEditForm}><Pencil size={14} /> Edit</button>
        </div>
      </div>

      <div className="collection-detail-info">
        <div className="collection-info-item">
          <small>Jenis</small>
          <b>{typeInfo.emoji} {typeInfo.name}</b>
        </div>
        <div className="collection-info-item">
          <small>Status</small>
          <b>{statusInfo.emoji} {statusInfo.name}</b>
        </div>
        <div className="collection-info-item">
          <small>Owner</small>
          <b>{collection.owner || "—"}</b>
        </div>
        {collection.description && <div className="collection-info-item">
          <small>Deskripsi</small>
          <b>{collection.description}</b>
        </div>}
        {collection.tags.length > 0 && <div className="collection-info-item">
          <small>Tags</small>
          <div className="tag-chips">
            {collection.tags.map((t, i) => <span key={i}>#{t}</span>)}
          </div>
        </div>}
      </div>
    </div>

    {/* ===== SUMMARY ===== */}
    <div className="collection-summary-grid">
      <div className="collection-summary-card">
        <small>Total Customer</small>
        <b>{stats.totalCustomers}</b>
      </div>
      <div className="collection-summary-card">
        <small>Total Order</small>
        <b>{stats.totalOrders}</b>
      </div>
      <div className="collection-summary-card">
        <small>Total Item</small>
        <b>{stats.totalItems}</b>
      </div>
      <div className="collection-summary-card outstanding">
        <small>Total Outstanding</small>
        <b>{stats.totalOutstanding > 0 ? formatRupiah(stats.totalOutstanding) : "—"}</b>
      </div>
      <div className="collection-summary-card payment">
        <small>Total Payment</small>
        <b>{stats.totalPayment > 0 ? formatRupiah(stats.totalPayment) : "—"}</b>
      </div>
      <div className="collection-summary-card">
        <small>Total Shipment</small>
        <b>{stats.totalShipment}</b>
      </div>
      <div className="collection-summary-card draft">
        <small>Draft Order</small>
        <b>{stats.draftOrders}</b>
      </div>
      <div className="collection-summary-card unlinked">
        <small>Belum Terhubung</small>
        <b>{stats.unlinkedCustomers}</b>
      </div>
    </div>

    {/* ===== TABS ===== */}
    <nav className="collection-tabs">
      {tabs.map(t => (
        <button key={t.key} className={activeTab === t.key ? "active" : ""} onClick={() => setActiveTab(t.key)}>
          {t.label}
        </button>
      ))}
    </nav>

    {/* ===== TAB CONTENT ===== */}
    {activeTab === "ringkasan" && (
      <div className="content">
        <div className="card">
          <h2>Ringkasan Collection</h2>
          <p className="muted" style={{ marginBottom: 14 }}>
            Collection <b>{collection.name}</b> adalah workspace untuk mengelola order {typeInfo.name.toLowerCase()}.
            Semua data terhubung langsung ke database utama — tidak ada duplikasi.
          </p>
          <div className="collection-shipment-progress-inline">
            <div className="collection-shipment-progress">
              <small><span>Shipment Progress</span><span>{stats.shipmentProgress}%</span></small>
              <div className="collection-progress-bar">
                <div className="collection-progress-fill" style={{ width: `${stats.shipmentProgress}%` }} />
              </div>
            </div>
          </div>
          {stats.unlinkedCustomers > 0 && (
            <div className="collection-order-form .customer-unlinked-hint" style={{ marginTop: 14, fontSize: 12, color: "#6d5d8a", background: "#e8e4f0", borderRadius: 6, padding: "8px 12px" }}>
              ⚠️ {stats.unlinkedCustomers} order belum terhubung ke customer. Buka tab Customer untuk melihat detail.
            </div>
          )}
          {stats.draftOrders > 0 && (
            <div className="collection-order-form .customer-unlinked-hint" style={{ marginTop: 8, fontSize: 12, color: "#966339", background: "#f7eadb", borderRadius: 6, padding: "8px 12px" }}>
              📝 {stats.draftOrders} order masih berstatus draft.
            </div>
          )}
        </div>
      </div>
    )}

    {activeTab === "order" && (
      <div className="collection-order-list">
        {orders.length === 0 && <div className="collection-empty">
          <span>📦</span>
          <h3>Belum ada order</h3>
          <p>Tambahkan order pertama untuk collection ini.</p>
          <button className="primary" style={{ marginTop: 12, width: "auto", display: "inline-flex" }} onClick={() => setShowAddOrder(true)}>
            <Plus size={15} /> Tambah Order
          </button>
        </div>}
        {orders.map(o => (
          <div className="collection-order-row" key={o.id}>
            <span className="collection-order-emoji">{o.items[0]?.emoji || "📦"}</span>
            <div className="collection-order-info">
              <b>{o.customer}</b>
              <small>{o.number} · {new Date(o.date).toLocaleDateString("id-ID")}</small>
              <span className={`order-status-tag ${o.status}`}>
                {o.status === "paid" ? "✅ Lunas" : o.status === "confirmed" ? "📋 Confirmed" : "📝 Draft"}
              </span>
              {!o.customerId && <span className="order-status-tag" style={{ background: "#e8e4f0", color: "#6d5d8a", marginLeft: 4 }}>Belum Terhubung</span>}
            </div>
            <div className="collection-order-total">
              {formatRupiah(o.total)}
              {o.status !== "paid" && o.total - o.dp > 0 && (
                <small style={{ display: "block", fontSize: 10, color: "#9b583d" }}>
                  Outstanding: {formatRupiah(o.total - o.dp)}
                </small>
              )}
            </div>
            <button className="icon-btn" style={{ color: "#9b583d" }} onClick={() => handleRemoveOrder(o.id)} aria-label="Hapus dari collection">
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
    )}

    {activeTab === "customer" && (
      <div className="collection-customer-list">
        {customerList.length === 0 && <div className="collection-empty">
          <span>👥</span>
          <h3>Belum ada customer</h3>
          <p>Customer akan muncul setelah ada order di collection ini.</p>
        </div>}
        {customerList.map(c => (
          <div className="collection-customer-row" key={c.key}>
            <span className="collection-customer-avatar">{c.name.charAt(0)}</span>
            <div className="collection-customer-info">
              <b>{c.name}</b>
              <small>{c.key.startsWith("cust-") ? "Terhubung ke Customer Workspace" : "Belum terhubung ke Customer"}</small>
            </div>
            <div className="collection-customer-orders">
              {c.orders} order · {formatRupiah(c.total)}
            </div>
          </div>
        ))}
      </div>
    )}

    {activeTab === "payment" && (
      <div className="collection-payment-list">
        {paymentList.length === 0 && <div className="collection-empty">
          <span>💰</span>
          <h3>Belum ada payment</h3>
          <p>Payment akan muncul setelah ada order di collection ini.</p>
        </div>}
        {paymentList.map(p => (
          <div className="collection-payment-row" key={p.orderId}>
            <div className="collection-payment-head">
              <b>{p.orderNumber}</b>
              <span className={`payment-status ${p.status}`}>
                {p.status === "paid" ? "✅ Lunas" : p.status === "dp" ? "💰 DP" : "⏳ Belum Bayar"}
              </span>
            </div>
            <small>{p.customer}</small>
            <div className="collection-payment-amount">
              {p.status === "paid" ? formatRupiah(p.total) : p.dp > 0 ? `DP ${formatRupiah(p.dp)} · Sisa ${formatRupiah(p.total - p.dp)}` : formatRupiah(p.total)}
            </div>
          </div>
        ))}
      </div>
    )}

    {activeTab === "shipment" && (
      <div className="collection-shipment-list">
        {shipmentList.length === 0 && <div className="collection-empty">
          <span>🚚</span>
          <h3>Belum ada shipment</h3>
          <p>Shipment akan muncul setelah ada order di collection ini.</p>
        </div>}
        {shipmentList.map(s => (
          <div className="collection-shipment-row" key={s.orderId}>
            <b>{s.orderNumber}</b>
            <small>{s.customer} · {s.items} item</small>
            <div className="collection-shipment-progress-inline">
              <div className="collection-shipment-progress">
                <small><span>Status</span><span>{s.status === "paid" ? "✅ Terkirim" : s.status === "confirmed" ? "📋 Diproses" : "📝 Draft"}</span></small>
                <div className="collection-progress-bar">
                  <div className="collection-progress-fill" style={{ width: s.status === "paid" ? "100%" : s.status === "confirmed" ? "50%" : "10%" }} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    )}

    {activeTab === "catatan" && (
      <div className="collection-notes-list">
        <div className="collection-empty">
          <span>📝</span>
          <h3>Belum ada catatan</h3>
          <p>Catatan collection akan muncul di sini.</p>
        </div>
      </div>
    )}

    {activeTab === "aktivitas" && (
      <div className="collection-activity-list">
        {activityList.length === 0 && <div className="collection-empty">
          <span>📊</span>
          <h3>Belum ada aktivitas</h3>
          <p>Aktivitas collection akan muncul di sini.</p>
        </div>}
        {activityList.map(a => (
          <div className="collection-activity-item" key={a.id}>
            <span className="collection-activity-icon">{a.icon}</span>
            <div className="collection-activity-content">
              <b>{a.title}</b>
              <small>{a.detail}</small>
            </div>
            <small style={{ color: "var(--muted)", fontSize: 11, whiteSpace: "nowrap" }}>{a.time}</small>
          </div>
        ))}
      </div>
    )}

    {/* ===== ADD ORDER MODAL ===== */}
    {showAddOrder && (
      <div className="overlay" onClick={() => setShowAddOrder(false)}>
        <section className="modal collection-order-form" onClick={e => e.stopPropagation()}>
          <button className="close" onClick={() => setShowAddOrder(false)}>×</button>
          <p className="eyebrow">ORDER BARU · {collection.name}</p>
          <h2>Tambah Order</h2>
          <p className="form-hint">Order langsung masuk ke collection ini dan database utama.</p>

          <label>Nama Customer *
            <input
              value={orderForm.customerName}
              onChange={e => setOrderForm({ ...orderForm, customerName: e.target.value })}
              placeholder="Contoh: Aulia"
            />
          </label>

          <label>WhatsApp (opsional)
            <input
              value={orderForm.phone}
              onChange={e => setOrderForm({ ...orderForm, phone: e.target.value })}
              placeholder="Contoh: 0812xxxx"
            />
          </label>

          {matchedCustomer && (
            <div className="customer-match-hint">
              ✅ Customer <b>{getCustomers().find(c => c.id === matchedCustomer)?.name}</b> ditemukan — order akan terhubung otomatis.
            </div>
          )}
          {!matchedCustomer && (orderForm.customerName.trim() || orderForm.phone.trim()) && (
            <div className="customer-unlinked-hint">
              ⚠️ Customer belum ditemukan. Order akan disimpan dengan status <b>Belum Terhubung</b> dan otomatis terhubung saat customer dibuat nanti.
            </div>
          )}

          <label>Produk *
            <input
              value={orderForm.productName}
              onChange={e => setOrderForm({ ...orderForm, productName: e.target.value })}
              placeholder="Contoh: Linen Spray"
            />
          </label>

          <div className="form-grid">
            <label>Qty
              <input
                type="number"
                min="1"
                value={orderForm.qty}
                onChange={e => setOrderForm({ ...orderForm, qty: Math.max(1, Number(e.target.value) || 1) })}
              />
            </label>
            <label>Harga (Rp)
              <input
                type="number"
                min="0"
                value={orderForm.price || ""}
                onChange={e => setOrderForm({ ...orderForm, price: Math.max(0, Number(e.target.value) || 0) })}
                placeholder="Contoh: 25000"
              />
            </label>
          </div>

          <label>Catatan (opsional)
            <textarea
              value={orderForm.note}
              onChange={e => setOrderForm({ ...orderForm, note: e.target.value })}
              placeholder="Catatan order"
            />
          </label>

          <div className="price-preview">
            <span>Subtotal <b>{formatRupiah(orderTotal)}</b></span>
            <strong>Total <b>{formatRupiah(orderTotal)}</b></strong>
          </div>

          <button className="primary" onClick={handleAddOrder}><Check size={16} /> Simpan Order</button>
        </section>
      </div>
    )}

    {/* ===== EDIT FORM MODAL ===== */}
    {showEditForm && (
      <div className="overlay" onClick={() => setShowEditForm(false)}>
        <section className="modal collection-form" onClick={e => e.stopPropagation()}>
          <button className="close" onClick={() => setShowEditForm(false)}>×</button>
          <p className="eyebrow">EDIT COLLECTION</p>
          <h2>Edit Collection</h2>

          <label>Nama Collection *
            <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
          </label>

          <label>Jenis Collection
            <div className="collection-type-grid">
              {(Object.keys(collectionTypeInfo) as CollectionType[]).map(t => (
                <button key={t} className={editForm.type === t ? "selected" : ""} onClick={() => setEditForm({ ...editForm, type: t })}>
                  <span>{collectionTypeInfo[t].emoji}</span>
                  {collectionTypeInfo[t].name}
                </button>
              ))}
            </div>
          </label>

          <label>Status
            <div className="collection-type-grid">
              {(Object.keys(collectionStatusInfo) as CollectionStatus[]).map(s => (
                <button key={s} className={editForm.status === s ? "selected" : ""} onClick={() => setEditForm({ ...editForm, status: s })}>
                  <span>{collectionStatusInfo[s].emoji}</span>
                  {collectionStatusInfo[s].name}
                </button>
              ))}
            </div>
          </label>

          <label>Icon
            <div className="collection-icon-grid">
              {collectionIcons.map(icon => (
                <button key={icon} className={editForm.icon === icon ? "selected" : ""} onClick={() => setEditForm({ ...editForm, icon })}>
                  {icon}
                </button>
              ))}
            </div>
          </label>

          <label>Warna
            <div className="collection-color-grid">
              {collectionColors.map(color => (
                <button key={color} className={editForm.color === color ? "selected" : ""} style={{ background: color }} onClick={() => setEditForm({ ...editForm, color })} />
              ))}
            </div>
          </label>

          <label>Deskripsi (opsional)
            <textarea value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} />
          </label>

          <label>Owner (opsional)
            <input value={editForm.owner} onChange={e => setEditForm({ ...editForm, owner: e.target.value })} />
          </label>

          <label>Tags (pisahkan dengan koma)
            <input value={editForm.tags} onChange={e => setEditForm({ ...editForm, tags: e.target.value })} />
          </label>

          <div className="form-actions">
            <button className="danger" onClick={() => setShowDeleteConfirm(true)}><Trash2 size={15} /> Hapus</button>
            <button className="primary" onClick={handleSaveEdit}><Check size={16} /> Simpan Perubahan</button>
          </div>
        </section>
      </div>
    )}

    {/* ===== DELETE CONFIRM ===== */}
    {showDeleteConfirm && (
      <div className="overlay" onClick={() => setShowDeleteConfirm(false)}>
        <section className="modal confirm-modal" onClick={e => e.stopPropagation()}>
          <h2>Hapus Collection?</h2>
          <p>Collection <b>{collection.name}</b> akan dihapus.</p>
          <p className="muted">
            {stats.totalOrders > 0
              ? "Collection ini memiliki transaksi, sehingga akan diarsipkan (soft delete). Data order tetap tersimpan."
              : "Collection ini kosong dan akan dihapus permanen."}
          </p>
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
// ===== NEW ORDER FORM DINAMIS (Afeena & Etalase YasLa) =====
function NewOrderForm({ customerName, onClose, onSave }: { customerName: string; onClose: () => void; onSave: (total: number) => void }) { 
  const [brand, setBrand] = useState("Afeena");
  const [product, setProduct] = useState("Amna Jilbab");
  const [qty, setQty] = useState(1);
  const [ongkir, setOngkir] = useState(0);
  const [catatan, setCatatan] = useState("");

  // Atribut Afeena
  const [size, setSize] = useState("L"); 
  const [handZip, setHandZip] = useState(false); 
  const [middleZip, setMiddleZip] = useState(false); 
  const [ties, setTies] = useState(false); 

  // Atribut YasLa
  const [bookType, setBookType] = useState("PO");

  const afeenaProducts = ["Amna Jilbab", "Niqab Khadijah", "Manset Basic"];
  const yaslaProducts = ["Buku Si Pensil Kecil", "Buku Persis Sepertimu", "Box Set 25 Buku", "Buku ASAQU!"];

  let unitPrice = 0;
  if (brand === "Afeena") {
    const basePrices: Record<string, number> = { M: 250000, L: 260000, XL: 260000, XXL: 270000 }; 
    unitPrice = (basePrices[size] || 250000) + (handZip ? 20000 : 0) + (middleZip ? 20000 : 0) + (ties ? 8000 : 0); 
  } else {
    const bookPrices: Record<string, number> = { "PO": 149000, "Ready Stock": 155000, "Early Bird": 147000 };
    unitPrice = bookPrices[bookType] || 149000;
  }
  
  const totalProduk = unitPrice * qty;
  const grandTotal = totalProduk + Number(ongkir);

  return (
    <div className="overlay" onClick={onClose}>
      <section 
        className="modal order-form" 
        onClick={event => event.stopPropagation()}
        style={{ maxHeight: '85vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px' }}
      >
        <button className="close" onClick={onClose} style={{ position: 'absolute', right: '15px', top: '15px', background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>×</button>
        
        <div>
          <p className="eyebrow" style={{ fontSize: '12px', color: '#888', fontWeight: 'bold' }}>ORDER BARU · {customerName}</p>
          <h2 style={{ margin: '4px 0', fontSize: '20px' }}>Pilih Produk & Detail</h2>
        </div>

        {/* Pemilihan Brand */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '14px', fontWeight: 'bold' }}>Pilih Brand</label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              type="button"
              className={brand === "Afeena" ? "primary" : "secondary"} 
              style={{ flex: 1, padding: '10px', borderRadius: '8px', cursor: 'pointer', border: '1px solid #745034', background: brand === "Afeena" ? '#745034' : '#fff', color: brand === "Afeena" ? '#fff' : '#745034' }}
              onClick={() => { setBrand("Afeena"); setProduct(afeenaProducts[0]); }}
            >Afeena</button>
            <button 
              type="button"
              className={brand === "YasLa" ? "primary" : "secondary"} 
              style={{ flex: 1, padding: '10px', borderRadius: '8px', cursor: 'pointer', border: '1px solid #745034', background: brand === "YasLa" ? '#745034' : '#fff', color: brand === "YasLa" ? '#fff' : '#745034' }}
              onClick={() => { setBrand("YasLa"); setProduct(yaslaProducts[0]); }}
            >Etalase YasLa</button>
          </div>
        </div>

        {/* Pemilihan Produk Dinamis */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '14px', fontWeight: 'bold' }}>Produk</label>
          <select value={product} onChange={e => setProduct(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}>
            {brand === "Afeena" 
              ? afeenaProducts.map(p => <option key={p} value={p}>{p}</option>)
              : yaslaProducts.map(p => <option key={p} value={p}>{p}</option>)
            }
          </select>
        </div>

        {/* Atribut Dinamis */}
        {brand === "Afeena" ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '14px', fontWeight: 'bold' }}>Size</label>
              <select value={size} onChange={e => setSize(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}>
                {["M", "L", "XL", "XXL"].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <fieldset style={{ padding: '12px', border: '1px solid #ddd', borderRadius: '8px', margin: 0 }}>
              <legend style={{ padding: '0 4px', fontSize: '14px', fontWeight: 'bold' }}>Modifikasi Jilbab</legend>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px', marginTop: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
                  <input type="checkbox" checked={handZip} onChange={e => setHandZip(e.target.checked)}/> 
                  <span>Lubang tangan rits <b>+ Rp 20.000</b></span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
                  <input type="checkbox" checked={middleZip} onChange={e => setMiddleZip(e.target.checked)}/> 
                  <span>Rits tengah busui <b>+ Rp 20.000</b></span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
                  <input type="checkbox" checked={ties} onChange={e => setTies(e.target.checked)}/> 
                  <span>Tali kecil dalam <b>+ Rp 8.000</b></span>
                </label>
              </div>
            </fieldset>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '14px', fontWeight: 'bold' }}>Jenis Harga Buku</label>
            <select value={bookType} onChange={e => setBookType(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}>
              {["PO", "Early Bird", "Ready Stock"].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '14px', fontWeight: 'bold' }}>Jumlah (Qty)</label>
            <input type="number" min="1" value={qty} onChange={e => setQty(Math.max(1, Number(e.target.value) || 1))} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}/>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '14px', fontWeight: 'bold' }}>Ongkos Kirim</label>
            <input type="number" min="0" value={ongkir} onChange={e => setOngkir(Number(e.target.value))} placeholder="Contoh: 15000" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}/>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '14px', fontWeight: 'bold' }}>Catatan order</label>
          <textarea value={catatan} onChange={e => setCatatan(e.target.value)} placeholder="Contoh: Kirim bareng Batch 8" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', minHeight: '60px' }}/>
        </div>

        <div style={{ background: '#f9f6f0', padding: '12px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
            <span>Harga Satuan:</span> <b>Rp {unitPrice.toLocaleString("id-ID")}</b>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
            <span>Total Produk ({qty} pcs):</span> <b>Rp {totalProduk.toLocaleString("id-ID")}</b>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
            <span>Ongkos Kirim:</span> <b>Rp {Number(ongkir).toLocaleString("id-ID")}</b>
          </div>
          <hr style={{ borderTop: '1px dashed #ccc', margin: '4px 0' }}/>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', color: '#745034' }}>
            <strong>GRAND TOTAL:</strong> <strong>Rp {grandTotal.toLocaleString("id-ID")}</strong>
          </div>
        </div>

        <button 
          type="button" 
          className="primary" 
          onClick={() => onSave(grandTotal)} 
          style={{ padding: '12px', width: '100%', background: '#745034', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          Tambahkan ke Order {customerName}
        </button>
      </section>
    </div>
  );
}
