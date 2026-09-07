"use client";

import { AlertCircle, Check, ChevronRight, ClipboardList, MapPin, UserRound, Boxes, Truck, Package, Zap, Clock, MessageCircle, ArrowRight, PackageCheck } from "lucide-react";
import { useState, useEffect } from "react";
import Link from "next/link";
import type { Customer, PaymentData } from "../data/customers";
import { getOrdersForCustomer, formatRupiah, computePaymentTotals, type OrderRecord } from "../data/store";

import {
  getOperations,
  performAction,
  getAvailableActions,
  type CustomerOperations,
  type ProductStatusCard,
  type ActionType,
  paymentStatusInfo,
  progressStatusInfo,
  locationInfo,
  shippingPlanInfo,
  nextActionInfo,
  fulfillmentDecisionInfo,
  shipmentStatusInfo,
  actionTypeInfo,
  timelineTypeInfo,
} from "../data/operations";

// =====================================================================
// CUSTOMER WORKSPACE — Filosofi: Customer adalah pusat sistem.
// Semua modul hanyalah sudut pandang berbeda terhadap customer.
// =====================================================================

export function Overview({ customer, onTab }: { customer: Customer; onTab: (tab: string) => void }) {
  const [ops, setOps] = useState<CustomerOperations>(() => getOperations(customer.id));
  const [notice, setNotice] = useState("");
  const [realOrders, setRealOrders] = useState<OrderRecord[]>([]);

  // Komponen ini gak di-remount pas pindah customer (cuma re-render dengan
  // props baru), jadi ops-nya harus dimuat ulang sendiri tiap customer.id
  // berubah — kalau tidak, Action Center/Product Status Cards nyangkut nunjukin
  // punya customer sebelumnya.
  useEffect(() => {
    setOps(getOperations(customer.id));
    setRealOrders(getOrdersForCustomer(customer.id));
  }, [customer.id]);

  // Action Center di atas (ops.actionCenter) baca dari operations.ts — state
  // mesin lama yang cuma pernah diisi utk 3 customer demo, jadi BUTA total
  // terhadap order asli (dibuat lewat /order, disimpan di store.ts). Tanpa ini,
  // customer dengan order asli yang outstanding selalu tampil "Semua beres!"
  // walau ada tagihan yang belum lunas. Ini bridge ringan & read-only — bukan
  // migrasi penuh ke central.ts (itu tetap PR Tahap 4) — supaya minimal
  // "perlu ditagih" untuk order asli benar-benar muncul di sini.
  const unpaidRealOrders = realOrders.filter(o => o.total - o.dp > 0);

  const act = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2600); };

  const handleAction = (cardId: string, action: ActionType) => {
    const updated = performAction(customer.id, cardId, action);
    setOps(updated);
    act(`${actionTypeInfo[action].name} diterapkan`);
  };

  const utamaMarketer = customer.marketers.find(m => m.role === "utama");
  const aktifMarketer = customer.marketers.find(m => m.role === "aktif");
  const activeBatches = customer.batches.filter(b => b.status !== "selesai");
  const activeResi = customer.resi.filter(r => r.status !== "sampai");

  return <div className="content">
    {/* ===== ACTION CENTER ===== */}
    <ActionCenter ops={ops} onAction={handleAction} unpaidRealOrders={unpaidRealOrders} onRealOrderClick={() => onTab("Order")} />

    {/* ===== PERLU PERHATIAN ===== */}
    <section className="attention card">
      <div className="attention-head">
        <span className="round sand"><AlertCircle size={20}/></span>
        <div><h2>Perlu Perhatian</h2><p>{ops.attention.length} hal agar pesanan {customer.name.split(" ")[0]} tetap lancar.</p></div>
      </div>
      {ops.attention.length === 0 && <p className="panel-hint" style={{ marginTop: 10 }}>Semua berjalan lancar. Tidak ada yang perlu perhatian. ✨</p>}
      {ops.attention.map(item => <button key={item.title} onClick={() => onTab("Order")}><b>{item.title}</b><span>{item.desc}</span><ChevronRight size={17}/></button>)}
    </section>

    {/* ===== FULFILLMENT DECISION — premium recommendation ===== */}
    <section className="card fulfillment">
      <div className="section-head">
        <div><h2>Fulfillment Decision</h2><p>Rekomendasi operasional lintas semua order customer ini.</p></div>
        <span className="ready">{fulfillmentDecisionInfo[ops.fulfillmentDecision].emoji} {fulfillmentDecisionInfo[ops.fulfillmentDecision].name}</span>
      </div>
      <div className="decision">
        <b>{ops.fulfillmentDecisionNote}</b>
        <p>Keputusan ini memengaruhi bagaimana setiap produk dikirim.</p>
        <div className="decision-reason">
          <div><Check size={15}/><span>Rekomendasi sistem berdasarkan status produksi & permintaan customer.</span></div>
          <div><Clock size={15}/><span>Estimasi siap kirim: <span className="decision-expected">12 Juni</span></span></div>
        </div>
        <button onClick={() => onTab("Shipment")}>Kelola Pengiriman <ArrowRight size={14}/></button>
      </div>
    </section>


    {/* ===== PRODUCT STATUS CARDS ===== */}
    <section className="card product-cards">
      <div className="section-head">
        <div><h2>Product Status Cards</h2><p>Setiap produk menjelaskan kondisinya sendiri.</p></div>
        <button onClick={() => onTab("Order")}>Lihat semua</button>
      </div>
      {ops.productCards.map(card => (
        <ProductCard key={card.id} card={card} onAction={handleAction} />
      ))}
    </section>

    {/* ===== RELASI BISNIS ===== */}
    <section className="card relation-summary">
      <div className="section-head"><div><h2>Relasi Bisnis</h2><p>Marketer, batch produksi, dan resi yang terkait customer ini.</p></div></div>
      <div className="relation-grid">
        <button className="relation-item" onClick={() => onTab("Marketer")}>
          <span className="relation-icon"><UserRound size={18}/></span>
          <div><small>Marketer</small><b>{utamaMarketer?.name || "—"}</b>{aktifMarketer && aktifMarketer.id !== utamaMarketer?.id && <em>aktif: {aktifMarketer.name}</em>}</div>
          <ChevronRight size={16}/>
        </button>
        <button className="relation-item" onClick={() => onTab("Batch")}>
          <span className="relation-icon"><Boxes size={18}/></span>
          <div><small>Batch Produksi</small><b>{activeBatches.length} aktif</b>{activeBatches.length > 0 && <em>{activeBatches.map(b => b.name).join(", ")}</em>}</div>
          <ChevronRight size={16}/>
        </button>
        <button className="relation-item" onClick={() => onTab("Resi")}>
          <span className="relation-icon"><Truck size={18}/></span>
          <div><small>Resi Aktif</small><b>{activeResi.length} aktif</b>{activeResi.length > 0 && <em>{activeResi.map(r => r.number).join(", ")}</em>}</div>
          <ChevronRight size={16}/>
        </button>
      </div>
    </section>

    {/* ===== TIMELINE — vertical, alive ===== */}
    <section className="card timeline">
      <div className="section-head">
        <div><h2>Timeline</h2><p>Histori hubungan bisnis dengan customer.</p></div>
        <button onClick={() => onTab("Aktivitas")}>Semua aktivitas</button>
      </div>
      {ops.timeline.map(item => (
        <div key={item.id}>
          <time>{item.time}</time>
          <p><b>{timelineTypeInfo[item.type].emoji} {item.title}</b>{item.desc && <span>{item.desc}</span>}</p>
        </div>
      ))}
    </section>

    {/* ===== PROFIL & KONTAK — premium contact card ===== */}
    <section className="card contact">
      <div className="section-head"><div><h2>Profil & Kontak</h2><p>Informasi kontak dan penerima utama customer.</p></div></div>
      <a className="contact-row" href={`https://wa.me/${customer.phone.replace(/[^0-9]/g, "")}`} target="_blank">
        <span className="contact-icon"><MessageCircleIcon /></span>
        <span className="contact-main">{customer.name}<small>Nama & nomor WhatsApp · {customer.phone}</small></span>
        <span className="contact-action">WhatsApp <ArrowRight size={14}/></span>
      </a>
      <div className="contact-static">
        <span className="contact-icon"><UserRoundIcon /></span>
        <span className="contact-main">{customer.receiver}<small>Penerima paket · {customer.receiverPhone}</small></span>
        <span className="contact-action">Penerima</span>
      </div>
      <div className="contact-static">
        <span className="contact-icon"><MapPin size={20}/></span>
        <span className="contact-main">{customer.city}<small>Alamat utama pengiriman</small></span>
        <span className="contact-action">Alamat</span>
      </div>
    </section>


    {notice && <div className="toast"><Check size={17}/>{notice}</div>}
  </div>;
}

// Action Center item.action datang dari NextAction ("tagih-pelunasan", dst),
// bukan ActionType admin ("catat-dp", "catat-pelunasan", dst) — sebelumnya
// dicocokkan lewat tebak-tebakan potongan nama string, yang gagal total untuk
// "tagih-pelunasan"/"serahkan-kurir"/"hubungi-customer" (klik jadi diam saja,
// gak ngapa-ngapain — bikin orang kira tombolnya rusak/nyasar ke halaman lain).
// Pemetaan eksplisit ini menjamin aksi yang benar-benar dijalankan.
function resolveActionForNextAction(card: ProductStatusCard): ActionType | null {
  if (card.paymentStatus === "belum-bayar") return "catat-dp";
  if (card.paymentStatus === "dp" || card.paymentStatus === "lunas-sebagian") return "catat-pelunasan";
  switch (card.progressStatus) {
    case "po":
    case "menunggu-batch":
      return "mulai-produksi";
    case "ready-gudang":
    case "siap-packing":
      return "mulai-packing";
    case "perlu-input-resi":
      return "input-resi";
  }
  if (card.shipmentStatus === "menunggu-pickup") return "kurir-pickup";
  return null;
}

// ===== ACTION CENTER =====
function ActionCenter({ ops, onAction, unpaidRealOrders, onRealOrderClick }: { ops: CustomerOperations; onAction: (cardId: string, action: ActionType) => void; unpaidRealOrders: OrderRecord[]; onRealOrderClick: () => void }) {
  const priorityLabel: Record<string, string> = { red: "🔴", yellow: "🟡", green: "🟢", blue: "🔵" };
  const totalCount = ops.actionCenter.length + unpaidRealOrders.length;
  return <section className="card action-center">
    <div className="section-head">
      <div><h2>Action Center</h2><p>Pekerjaan admin untuk customer ini — sistem sudah menyusunnya.</p></div>
      <span className="ready">{totalCount} aksi</span>
    </div>
    {totalCount === 0 && <p className="panel-hint" style={{ marginTop: 10 }}>Tidak ada aksi yang perlu dilakukan. Semua beres! 🎉</p>}
    {unpaidRealOrders.map(order => (
      <button key={order.id} className="action-item" onClick={onRealOrderClick}>
        <span className="action-priority">🔴</span>
        <div className="action-copy"><b>Tagih pelunasan {order.number}</b><small>Sisa {formatRupiah(order.total - order.dp)}</small></div>
        <ChevronRight size={17}/>
      </button>
    ))}
    {ops.actionCenter.map(item => (
      <button key={item.id} className="action-item" onClick={() => {
        const card = ops.productCards.find(c => c.id === item.productId);
        if (!card) return;
        const action = resolveActionForNextAction(card);
        const available = getAvailableActions(card);
        if (action && available.includes(action)) onAction(card.id, action);
      }}>
        <span className="action-priority">{priorityLabel[item.priority]}</span>
        <div className="action-copy"><b>{item.title}</b>{item.desc && <small>{item.desc}</small>}</div>
        <ChevronRight size={17}/>
      </button>
    ))}
  </section>;
}

// ===== PRODUCT STATUS CARD =====
function ProductCard({ card, onAction }: { card: ProductStatusCard; onAction: (cardId: string, action: ActionType) => void }) {
  const [expanded, setExpanded] = useState(false);
  const available = getAvailableActions(card);
  const pay = paymentStatusInfo[card.paymentStatus];
  const prog = progressStatusInfo[card.progressStatus];
  const loc = locationInfo[card.location];
  const plan = shippingPlanInfo[card.shippingPlan];
  const next = nextActionInfo[card.nextAction];
  const ship = shipmentStatusInfo[card.shipmentStatus];

  return <article className={`product-card ${card.nextAction === "tidak-ada" ? "done" : ""}`}>
    <div className="product-card-head" onClick={() => setExpanded(!expanded)}>
      <span className="product-card-emoji">{card.emoji}</span>
      <div className="product-card-title">
        <b>{card.productName}</b>
        <small>{card.qty} pcs · {card.orderNumber}{card.invoiceNumber ? ` · ${card.invoiceNumber}` : ""}</small>
      </div>
      <span className={`status-chip ${prog.tone}`}>{prog.emoji} {prog.name}</span>
      <ChevronRight size={17} className={`chevron ${expanded ? "open" : ""}`}/>
    </div>

    <div className="product-card-grid">
      <div className="psc-field">
        <small>💰 Payment</small>
        <b className={`psc-value ${pay.tone}`}>{pay.emoji} {pay.name}</b>
      </div>
      <div className="psc-field">
        <small>📦 Progress</small>
        <b className={`psc-value ${prog.tone}`}>{prog.emoji} {prog.name}{card.batchName ? ` · ${card.batchName}` : ""}</b>
      </div>
      <div className="psc-field">
        <small>📍 Lokasi</small>
        <b>{loc.emoji} {loc.name}</b>
      </div>
      <div className="psc-field">
        <small>🚚 Shipping Plan</small>
        <b className={`psc-value ${plan.tone}`}>{plan.emoji} {plan.name}</b>
      </div>
      <div className="psc-field">
        <small>🧭 Fulfillment</small>
        <b className={`psc-value ${fulfillmentDecisionInfo[card.fulfillmentDecision].tone}`}>{fulfillmentDecisionInfo[card.fulfillmentDecision].emoji} {fulfillmentDecisionInfo[card.fulfillmentDecision].name}</b>
      </div>
      <div className="psc-field">
        <small>🚚 Shipment</small>
        <b className={`psc-value ${ship.tone}`}>{ship.emoji} {ship.name}{card.resiNumber ? ` · ${card.resiNumber}` : ""}</b>
      </div>
    </div>

    <div className="product-card-next">
      <span className="next-label">⚡ Next Action</span>
      <b className={`next-value ${next.tone}`}>{next.emoji} {next.name}</b>
    </div>

    {card.blocker && <div className="product-card-blocker"><Clock size={14}/> {card.blocker}</div>}

    {expanded && (
      <div className="product-card-actions">
        <p className="panel-hint">Pilih aksi — sistem akan mengubah status secara otomatis.</p>
        <div className="action-buttons">
          {available.map(a => (
            <button key={a} className="action-btn" onClick={() => onAction(card.id, a)}>
              {actionTypeInfo[a].emoji} {actionTypeInfo[a].name}
            </button>
          ))}
        </div>
        <div className="product-card-timeline">
          <p className="panel-hint" style={{ marginTop: 12 }}>Timeline produk ini:</p>
          {card.timeline.map(evt => (
            <div key={evt.id} className="mini-timeline">
              <time>{evt.time}</time>
              <span>{timelineTypeInfo[evt.type].emoji} {evt.title}</span>
            </div>
          ))}
        </div>
      </div>
    )}
  </article>;
}

// ===== CUSTOMER PANEL (untuk tab lain) =====
export function CustomerPanel({ customer, tab }: { customer: Customer; tab: string }) {
  if (tab.startsWith("Order")) return <OrderPanel customer={customer} />;
  if (tab.startsWith("Payment")) return <PaymentPanel customer={customer} />;
  if (tab.startsWith("Shipment")) return <ShipmentPanel customer={customer} />;
  if (tab.startsWith("Marketer")) return <MarketerPanel customer={customer} />;
  if (tab.startsWith("Batch")) return <BatchPanel customer={customer} />;
  if (tab.startsWith("Resi")) return <ResiPanel customer={customer} />;
  const rows = tab.startsWith("Catatan") ? customer.notes : customer.activities;
  return <div className="content"><section className="card panel"><div className="section-head"><h2>{tab}</h2><button>Terbaru dulu</button></div>{rows.length === 0 && <p className="panel-hint" style={{ marginTop: 10 }}>Belum ada data.</p>}{rows.map((row, index) => <div key={index} className="panel-row"><span className={`round ${index === 1 ? "sand" : "olive"}`}><Check size={17}/></span><span>{row}</span></div>)}</section></div>;
}

// ===== ORDER PANEL — order asli dari central data (store.ts), bukan lagi
// customer.orderRows yang cuma keisi buat 3 customer demo lama =====
const orderStatusLabel: Record<string, string> = { draft: "Draft", confirmed: "Confirmed", paid: "Lunas" };
const orderStatusTone: Record<string, string> = { draft: "sand", confirmed: "sand", paid: "olive" };

function OrderPanel({ customer }: { customer: Customer }) {
  const [orders, setOrders] = useState<OrderRecord[]>(() => getOrdersForCustomer(customer.id));

  useEffect(() => {
    setOrders(getOrdersForCustomer(customer.id));
  }, [customer.id]);

  const sorted = [...orders].sort((a, b) => b.createdAt - a.createdAt);

  return <div className="content">
    <section className="card panel">
      <div className="section-head"><h2>Order</h2><Link href={`/order?customerId=${customer.id}`}>+ Order Baru</Link></div>
      {sorted.length === 0 && <p className="panel-hint" style={{ marginTop: 10 }}>Belum ada order untuk customer ini.</p>}
      {sorted.map(order => (
        <Link key={order.id} href={`/order?orderId=${order.id}`} className="panel-row">
          <span className={`round ${orderStatusTone[order.status] || "sand"}`}><Check size={17}/></span>
          <span>
            <b>{order.items.map(i => i.name).join(", ") || order.number}</b><br/>
            <small>{order.number} · {formatRupiah(order.total)} · {orderStatusLabel[order.status] || order.status}{order.internalNote ? " · 📌" : ""}</small>
          </span>
          <ChevronRight size={18}/>
        </Link>
      ))}
    </section>
  </div>;
}

// ===== MARKETER PANEL =====
function MarketerPanel({ customer }: { customer: Customer }) {
  const utama = customer.marketers.find(m => m.role === "utama");
  const aktif = customer.marketers.find(m => m.role === "aktif");
  return <div className="content">
    <section className="card panel">
      <div className="section-head"><div><h2>Marketer Customer</h2><p>Marketer yang membawa dan menangani customer ini.</p></div></div>
      {customer.marketers.length === 0 && <div className="empty-state"><span>👤</span><h3>Belum ada marketer</h3><p>Marketer akan muncul saat order pertama dibuat.</p></div>}
      {customer.marketers.map(m => (
        <div className="marketer-row" key={m.id}>
          <span className="mini-avatar">{m.name.split(" ").map(p => p[0]).join("").slice(0, 2)}</span>
          <div className="marketer-info">
            <b>{m.name}</b>
            <small>{m.role === "utama" ? "Marketer utama · membawa customer" : "Marketer aktif · menangani order terakhir"}</small>
          </div>
          <span className={`marketer-role ${m.role}`}>{m.role === "utama" ? "Utama" : "Aktif"}</span>
        </div>
      ))}
      {utama && <p className="panel-hint" style={{ marginTop: 12 }}>Customer dibawa oleh <b>{utama.name}</b> sejak {utama.since}.{aktif && aktif.id !== utama.id ? ` Order terakhir ditangani ${aktif.name}.` : ""}</p>}
    </section>
  </div>;
}

// ===== BATCH PANEL =====
function BatchPanel({ customer }: { customer: Customer }) {
  return <div className="content">
    <section className="card panel">
      <div className="section-head"><div><h2>Batch Produksi</h2><p>Batch yang memengaruhi order customer ini.</p></div></div>
      {customer.batches.length === 0 && <div className="empty-state"><span>📦</span><h3>Belum ada batch</h3><p>Batch produksi akan muncul saat ada order PO.</p></div>}
      {customer.batches.map(b => (
        <div className="batch-row" key={b.id}>
          <span className="batch-icon"><Boxes size={18}/></span>
          <div className="batch-info">
            <b>{b.name} · {b.product}</b>
            <small>Order: {b.orderRef}</small>
            <small>Gudang: {b.warehouse}</small>
          </div>
          <div className="batch-right">
            <span className={`batch-status ${b.status}`}>{b.status === "produksi" ? "Produksi" : b.status === "ready" ? "Ready" : "Selesai"}</span>
            <em>Estimasi ready {b.estimateReady}</em>
          </div>
        </div>
      ))}
    </section>
  </div>;
}

// ===== RESI PANEL =====
function ResiPanel({ customer }: { customer: Customer }) {
  return <div className="content">
    <section className="card panel">
      <div className="section-head"><div><h2>Resi Pengiriman</h2><p>Bukti pengiriman customer.</p></div></div>
      {customer.resi.length === 0 && <div className="empty-state"><span>🚚</span><h3>Belum ada resi</h3><p>Resi akan muncul saat order dikirim.</p></div>}
      {customer.resi.map(r => (
        <div className="resi-row" key={r.id}>
          <span className="resi-icon"><Package size={18}/></span>
          <div className="resi-info">
            <b>{r.number}</b>
            <small>{r.courier} · {r.order}</small>
          </div>
          <div className="resi-right">
            <span className={`resi-status ${r.status}`}>{r.status === "dikirim" ? "Dikirim" : r.status === "dalam-perjalanan" ? "Dalam Perjalanan" : "Sampai"}</span>
            <em>{r.date}</em>
          </div>
        </div>
      ))}
    </section>
  </div>;
}

function ShipmentRow({ status, order, place, ready, ship }: { status: string; order: string; place: string; ready: string; ship: string }) {
  return <div className="shipment-row"><div><b>{order} <span className="ready">{status}</span></b><p><MapPin size={14}/>{place}</p></div><div className="estimate"><span>{ready}</span><b>{ship}</b></div></div>;
}

function ShipmentPanel({ customer }: { customer: Customer }) {
  const [status, setStatus] = useState("Siap Kirim");
  const rows = customer.shipments.map(item => item.order === customer.overview.latestOrder.id ? { ...item, status } : item);
  return <div className="content"><section className="card panel"><div className="section-head"><h2>Pengiriman Customer</h2><button>Terbaru dulu</button></div><p className="panel-hint">Status pengiriman terpisah dari status produksi/batch.</p>
    {rows.length === 0 ? <p className="panel-hint" style={{ marginTop: 10 }}>Belum ada data pengiriman untuk customer ini.</p> : <>
      <div className="shipment-filter"><label>Status utama<select value={status} onChange={event => setStatus(event.target.value)}><option>Siap Kirim</option><option>Sudah Packing</option><option>Perlu Packing</option><option>Hold Pengiriman</option><option>Menunggu Pick Up</option><option>Sudah Dikirim</option><option>Proses Retur</option><option>Refund</option></select></label></div>
      {rows.map(item => <ShipmentRow key={item.order} {...item} />)}
    </>}
  </section></div>;
}

function PaymentPanel({ customer }: { customer: Customer }) {
  const [followUp, setFollowUp] = useState("Tinggal pelunasan");
  const [secondFollowUp, setSecondFollowUp] = useState("Belum jawab");
  const [notice, setNotice] = useState("");
  const [editingPayment, setEditingPayment] = useState<PaymentData | null>(null);
  const [payments, setPayments] = useState<PaymentData[]>(customer.payments);
  // ===== HYDRATION FIX + data asli: customer.paid/outstanding statis "Rp 0" =====
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  useEffect(() => { setOrders(getOrdersForCustomer(customer.id)); }, [customer.id]);
  const { totalPaid, totalOutstanding } = computePaymentTotals(orders);
  const act = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2500); };

  const handleSavePayment = (updated: PaymentData) => {
    setPayments(prev => prev.map(p => p.invoice === updated.invoice ? updated : p));
    setEditingPayment(null);
    act(`Pembayaran ${updated.invoice} diperbarui → ${updated.status}`);
  };

  return <div className="content">
    <section className="card payment-panel">
      <div className="section-head"><div><h2>Payment Customer</h2><p>{formatRupiah(totalPaid)} sudah diterima · {formatRupiah(totalOutstanding)} tersisa</p></div><button>Terbaru dulu</button></div>
      <div className="payment-summary">
        <span>Total tagihan aktif <b>{formatRupiah(totalPaid + totalOutstanding)}</b></span>
        <span>Sudah masuk <b>{formatRupiah(totalPaid)}</b></span>
        <span>Sisa perlu ditangani <b>{formatRupiah(totalOutstanding)}</b></span>
      </div>
      {payments.length === 0 && <p className="panel-hint" style={{ marginTop: 10 }}>Belum ada rincian tagihan per-invoice untuk customer ini.</p>}
      {payments.map((item, index) => (
        <PaymentRow key={item.invoice} {...item}
          followUp={index === 1 ? followUp : index === 2 ? secondFollowUp : undefined}
          onChange={index === 1 ? setFollowUp : index === 2 ? setSecondFollowUp : undefined}
          onAction={act}
          onEdit={() => setEditingPayment(item)}
        />
      ))}
    </section>

    {editingPayment && (
      <PaymentEditModal
        payment={editingPayment}
        onClose={() => setEditingPayment(null)}
        onSave={handleSavePayment}
      />
    )}

    {notice && <div className="toast"><Check size={17}/>{notice}</div>}
  </div>;
}

function PaymentRow({ invoice, order, amount, status, progress, followUp, onChange, onAction, onEdit }: { invoice: string; order: string; amount: string; status: "Lunas" | "Bayar DP" | "Belum Bayar"; progress?: string; followUp?: string; onChange?: (value: string) => void; onAction: (message: string) => void; onEdit: () => void }) {
  const tone = status === "Lunas" ? "paid" : status === "Bayar DP" ? "dp" : "unpaid";
  return <article className="payment-row">
    <div className="payment-main">
      <div><b>{invoice} <span className={`payment-status ${tone}`}>{status}</span></b><p>{order}</p></div>
      <strong>{amount}</strong>
    </div>
    {progress && <p className="payment-progress">{progress}</p>}
    {followUp && <label className="follow-up">Keterangan follow-up<select value={followUp} onChange={event => onChange?.(event.target.value)}><option>Minta kelonggaran waktu</option><option>Belum jawab</option><option>Tidak ada konfirmasi</option><option>Tinggal pelunasan</option><option>Alamat belum jelas</option></select></label>}
    {status !== "Lunas" && <div className="payment-actions">
      <button onClick={onEdit}>Catat pembayaran</button>
      <button onClick={() => onAction(`Follow-up ${invoice} siap dikirim`)}>Kirim follow-up</button>
    </div>}
  </article>;
}

// ===== PAYMENT EDIT MODAL =====
// Admin mencatat pembayaran yang masuk hari ini:
// - Belum Bayar → Bayar DP / Lunas
// - Bayar DP → Lunas (pelunasan + ongkir)
function PaymentEditModal({ payment, onClose, onSave }: { payment: PaymentData; onClose: () => void; onSave: (updated: PaymentData) => void }) {
  const [newStatus, setNewStatus] = useState<"Lunas" | "Bayar DP" | "Belum Bayar">(payment.status);
  const [amountPaid, setAmountPaid] = useState(0);
  const [ongkir, setOngkir] = useState(0);
  const [note, setNote] = useState("");

  // Parse amount string "Rp 245.000" → 245000
  const parseAmount = (str: string): number => {
    const digits = str.replace(/[^0-9]/g, "");
    return digits ? parseInt(digits, 10) : 0;
  };
  const totalAmount = parseAmount(payment.amount);
  const dpPaid = payment.progress ? parseAmount(payment.progress.match(/DP masuk Rp ([\d.]+)/)?.[1] || "0") : 0;
  const remaining = Math.max(0, totalAmount - dpPaid);

  const handleSave = () => {
    const paidNow = amountPaid + ongkir;
    const newProgress = newStatus === "Bayar DP"
      ? `DP masuk Rp ${(dpPaid + amountPaid).toLocaleString("id-ID")} · Sisa Rp ${Math.max(0, totalAmount - dpPaid - amountPaid).toLocaleString("id-ID")}`
      : newStatus === "Lunas"
        ? `Lunas ${paidNow > 0 ? `· Bayar hari ini Rp ${paidNow.toLocaleString("id-ID")}` : ""}${ongkir > 0 ? ` · Ongkir Rp ${ongkir.toLocaleString("id-ID")}` : ""}`
        : undefined;

    onSave({
      ...payment,
      status: newStatus,
      progress: newProgress,
    });
  };

  return <div className="overlay" onClick={onClose}>
    <section className="modal payment-edit-modal" onClick={e => e.stopPropagation()}>
      <button className="close" onClick={onClose}>×</button>
      <p className="eyebrow">CATAT PEMBAYARAN · {payment.invoice}</p>
      <h2>Catat Pembayaran</h2>
      <p className="payment-edit-order">{payment.order}</p>

      <div className="payment-edit-summary">
        <div><span>Total tagihan</span><b>{payment.amount}</b></div>
        {dpPaid > 0 && <div><span>DP sudah masuk</span><b>Rp {dpPaid.toLocaleString("id-ID")}</b></div>}
        {remaining > 0 && <div><span>Sisa tagihan</span><b>Rp {remaining.toLocaleString("id-ID")}</b></div>}
      </div>

      <label>Status Pembayaran
        <div className="payment-status-options">
          <button className={newStatus === "Belum Bayar" ? "selected" : ""} onClick={() => setNewStatus("Belum Bayar")}>
            <span>🔴</span> Belum Bayar
          </button>
          <button className={newStatus === "Bayar DP" ? "selected" : ""} onClick={() => setNewStatus("Bayar DP")}>
            <span>🟡</span> Bayar DP
          </button>
          <button className={newStatus === "Lunas" ? "selected" : ""} onClick={() => setNewStatus("Lunas")}>
            <span>🟢</span> Lunas
          </button>
        </div>
      </label>

      <label>Nominal dibayar hari ini (Rp)
        <input type="number" min="0" step="1000" value={amountPaid || ""} placeholder={newStatus === "Lunas" ? String(remaining) : "Contoh: 100000"} onChange={e => setAmountPaid(Math.max(0, Number(e.target.value) || 0))} />
      </label>

      <label>Ongkir (Rp)
        <input type="number" min="0" step="1000" value={ongkir || ""} placeholder="Contoh: 15000" onChange={e => setOngkir(Math.max(0, Number(e.target.value) || 0))} />
      </label>

      <label>Catatan (opsional)
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="Contoh: Transfer BCA, sudah konfirmasi" />
      </label>

      <div className="payment-edit-preview">
        <span>Total dibayar hari ini</span>
        <b>Rp {(amountPaid + ongkir).toLocaleString("id-ID")}</b>
      </div>

      <div className="form-actions">
        <button className="primary" onClick={handleSave}><Check size={16} /> Simpan Pembayaran</button>
      </div>
    </section>
  </div>;
}


function MessageCircleIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>; }
function UserRoundIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>; }
