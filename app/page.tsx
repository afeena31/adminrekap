"use client";

import {
  ArrowLeft, Bell, Boxes, Check, ChevronRight, ClipboardList, CreditCard,
  Package, PackageCheck, Plus, ShoppingBag, Truck, UserPlus, Users,
  UserRound, AlertCircle, Factory, PackageOpen,
  FileText, HandCoins, Send, Clock, CircleDot, TrendingUp, StickyNote,
  Settings, Sparkles, ArrowUpRight, MessageCircle, CalendarDays, LogOut
} from "lucide-react";

import Link from "next/link";
import { useEffect, useState } from "react";

import { toDisplayCustomer } from "./data/customers";
import { getOrders, getMarketers, getProducts, formatRupiah, getOrderById, getPelunasanWhatsAppUrl, productionStageInfo, shipmentStageInfo, type OrderRecord, type ProductionStage, type ShipmentStage, type Marketer } from "./data/store";
import type { Product } from "./data/products";
import { BottomNav } from "./components/BottomNav";
import { QuickPaymentModal } from "./components/QuickPaymentModal";
import { goBack } from "./lib/goBack";
import { getOperations } from "./data/operations";
import { getCustomers, getCustomerAddresses as getCentralCustomerAddresses } from "./data/central";
import { useAuth } from "./data/authContext";

// ===== WORK QUEUE — dihitung LANGSUNG dari order asli (Tahap 6 migrasi
// backend), bukan lagi dari "Operational State Engine" central.ts. Riset
// sebelum Tahap 6 menemukan sistem itu ternyata jalan di atas data
// default/kosong utk order asli (productionStatus selalu hardcode
// "belum-ready", Payment central gak pernah diisi UI manapun) — jadi
// klasifikasi 10-state-nya kelihatan detail tapi gak akurat. 4 section yang
// sama (Perlu Tindakan/Bisa Dikerjakan/Segera/Menunggu) dipertahankan,
// isinya sekarang dihitung jujur dari status bayar + productionStage/
// shipmentStage asli tiap item (store.ts).
type QueueSection = "perluTindakan" | "bisaDikerjakan" | "segera" | "menunggu";
type QueueItem = {
  orderId: string;
  orderNumber: string;
  customerName: string;
  label: string;
  tone: string;
  nextAction: string;
  hasOutstanding: boolean;
  activeProdStage?: ProductionStage;
  activeShipStage?: ShipmentStage;
};

function classifyOrderForQueue(order: OrderRecord): { section: QueueSection; item: QueueItem } | null {
  const outstanding = order.status === "paid" ? 0 : Math.max(0, order.total - order.dp);
  const items = order.items;
  const activeProdItem = items.find(i => i.productionStage && i.productionStage !== "po" && i.productionStage !== "siap-kirim");
  const activeShipItem = items.find(i => i.shipmentStage && i.shipmentStage !== "selesai");
  const allShipped = items.length > 0 && items.every(i => i.shipmentStage === "selesai");
  if (allShipped && outstanding <= 0) return null; // beres total, gak perlu muncul di Work Queue.

  const base = {
    orderId: order.id, orderNumber: order.number, customerName: order.customer,
    hasOutstanding: outstanding > 0,
    activeProdStage: activeProdItem?.productionStage, activeShipStage: activeShipItem?.shipmentStage,
  };

  if (outstanding > 0) {
    return { section: "perluTindakan", item: { ...base, label: "Perlu Ditagih", tone: "red", nextAction: "Tagih pelunasan" } };
  }
  const anyHold = items.some(i => i.shipmentStage === "ditunda" || i.shipmentStage === "retur" || i.shipmentStage === "refund");
  if (anyHold) {
    return { section: "perluTindakan", item: { ...base, label: "Bermasalah", tone: "red", nextAction: "Cek status pengiriman" } };
  }
  const anyShipActive = items.some(i => i.shipmentStage === "sudah-dipacking" || i.shipmentStage === "proses-resi" || i.shipmentStage === "dalam-pengiriman");
  if (anyShipActive) {
    return { section: "segera", item: { ...base, label: "Segera Dikirim", tone: "blue", nextAction: "Input resi / kirim" } };
  }
  const anyProdActive = items.some(i => i.productionStage && i.productionStage !== "po");
  if (anyProdActive) {
    return { section: "bisaDikerjakan", item: { ...base, label: "Dalam Proses", tone: "amber", nextAction: "Lanjutkan produksi/packing" } };
  }
  return { section: "menunggu", item: { ...base, label: "Menunggu Diproses", tone: "sand", nextAction: "Mulai produksi" } };
}

// Customer sekarang Supabase (Tahap 5 migrasi backend) — async.
async function loadAllDisplayCustomers() {
  const customers = await getCustomers();
  return Promise.all(customers.map(async c => ({ customer: c, addresses: await getCentralCustomerAddresses(c.id) })))
    .then(rows => rows.map(({ customer, addresses }) => toDisplayCustomer(customer, addresses)));
}

export default function DashboardPage() {
  const [notice, setNotice] = useState("");
  const { role: authRole, name: authName, session, signOut } = useAuth();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [quickPaymentOpen, setQuickPaymentOpen] = useState(false);
  const notify = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2600); };

  // Item "PERLU DITAGIH" langsung buka WhatsApp dgn pesan pelunasan siap
  // kirim (bukan cuma pindah ke halaman Edit Order) — item lain di Work
  // Queue tetap link biasa ke halaman order.
  const handleTagihPelunasan = async (orderId: string) => {
    const order = await getOrderById(orderId);
    if (!order) return;
    const url = getPelunasanWhatsAppUrl(order);
    if (!url) { notify("Nomor WA customer belum ada — lengkapi dulu di halaman Customer"); return; }
    window.open(url, "_blank");
  };

  // Semua state di bawah ini dimulai kosong (bukan langsung baca localStorage)
  // supaya render pertama di server & di client sama, lalu diisi data asli
  // lewat HYDRATION FIX useEffect setelah mount.
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [marketers, setMarketers] = useState<Marketer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [allOps, setAllOps] = useState<{ customer: ReturnType<typeof toDisplayCustomer>; ops: ReturnType<typeof getOperations> }[]>([]);
  const [totalCustomers, setTotalCustomers] = useState(0);
  // Halaman ini di-prerender statis (waktu build) — kalau jam/tanggal dihitung
  // langsung di badan render, HTML hasil build (jam build) akan beda dari hasil
  // hitung ulang di client (jam dibuka), dan React akan selalu melaporkan
  // hydration mismatch. Default netral dulu, isi jam/tanggal asli di useEffect.
  const [greeting, setGreeting] = useState("Selamat Datang");
  const [todayLabel, setTodayLabel] = useState("");

  // ===== HYDRATION FIX: Muat data dari Supabase setelah hydration =====
  useEffect(() => {
    getOrders().then(setOrders);
    getMarketers().then(setMarketers);
    getProducts().then(setProducts);
    loadAllDisplayCustomers().then(list => setAllOps(list.map(c => ({ customer: c, ops: getOperations(c.id) }))));
    getCustomers().then(list => setTotalCustomers(list.length));
    const hour = new Date().getHours();
    setGreeting(hour < 11 ? "Selamat Pagi" : hour < 15 ? "Selamat Siang" : hour < 18 ? "Selamat Sore" : "Selamat Malam");
    setTodayLabel(new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" }));
  }, []);

  const activityIcon: Record<string, any> = {
    order: ShoppingBag,
    invoice: FileText,
    payment: HandCoins,
    batch: Boxes,
    qc: ClipboardList,
    ready: PackageCheck,
    packing: Package,
    resi: Send,
    delivered: Check,
    note: StickyNote,
    decision: CircleDot,
  };

  // ===== SECTION 3: TODAY'S ACTIVITY (HISTORI — hanya kejadian yang terjadi) =====
  // ops.timeline (operations.ts) cuma pernah diisi utk 3 customer demo lama —
  // workspace dgn order ASLI tapi nol customer demo dulu selalu tampil "Belum
  // ada aktivitas... Mulai dengan membuat order baru", padahal order-nya
  // sudah ada (bahkan mungkin banyak) — instruksi yang salah & membingungkan.
  // Order asli (createdAt asli, dari store.ts) sekarang ikut ditambahkan
  // sebagai "Order baru: {customer}" supaya histori ini jujur.
  const realOrderActivity = orders
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 8)
    .map(o => ({
      key: "real-" + o.id,
      icon: ShoppingBag,
      iconClass: "order",
      title: `Order baru: ${o.customer}`,
      desc: `${o.number} · ${formatRupiah(o.total)}`,
      time: new Date(o.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
    }));
  const demoActivity = allOps.flatMap(({ customer, ops }) =>
    ops.timeline.map(evt => ({ customer, evt }))
  ).sort((a, b) => {
    const dateA = a.evt.time;
    const dateB = b.evt.time;
    return dateB.localeCompare(dateA);
  });
  const activityFeed = [
    ...realOrderActivity,
    ...demoActivity.map(({ customer, evt }, i) => ({
      key: "demo-" + i,
      icon: activityIcon[evt.type] || CircleDot,
      iconClass: evt.type,
      title: evt.title,
      desc: customer.name + (evt.desc ? ` · ${evt.desc}` : ""),
      time: evt.time,
    })),
  ].slice(0, 8);

  // ===== SECTION 6: PRODUCTION (domain batch — terpisah dari work queue) =====
  // Diturunkan dari allOps (sudah dimuat hydration-safe lewat useEffect di
  // atas) alih-alih memanggil loadAllDisplayCustomers() lagi di sini — yang
  // sebelumnya baca localStorage langsung di badan render (beda dari SSR yang
  // baca [], bikin mismatch hydration persis kayak yang sudah dibenerin di
  // state lain di file ini).
  const productionBatches = allOps.flatMap(({ customer }) =>
    customer.batches.map(b => ({ customer, batch: b }))
  ).filter(({ batch }) => batch.status !== "selesai");

  // Item order ASLI yang tahap produksinya lagi berjalan (semua tahap SELAIN
  // "po" — belum mulai — dan "siap-kirim" — legacy, sudah kelar) — sebelumnya
  // section ini cuma baca customer.batches (operations.ts, demo), jadi order
  // asli gak pernah kelihatan di sini walau lagi diproses. Dulu list-nya
  // hardcode 3 tahap ("produksi"/"qc"/"packing"), jadi item yang lagi di
  // "Antre QC"/"Antre Packing" (tahap baru) ikut kelewat gak kehitung.
  const realProductionItems = orders.flatMap(o => o.items
    .filter(i => i.productionStage && i.productionStage !== "po" && i.productionStage !== "siap-kirim")
    .map(i => ({ order: o, item: i }))
  );

  const batchProgress = (status: string) => {
    switch (status) {
      case "produksi": return 55;
      case "ready": return 90;
      default: return 20;
    }
  };

  // ===== SECTION 7: BUSINESS SNAPSHOT (statistik — bukan kondisi operasional) =====
  const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
  const totalOutstanding = orders
    .filter(o => o.status !== "paid")
    .reduce((sum, o) => sum + (o.total - o.dp), 0);
  const totalOrders = orders.length;
  const totalProducts = products.length;
  const totalMarketers = marketers.filter(m => m.status === "aktif").length;

  const snapshot = [
    { label: "Pendapatan", value: formatRupiah(totalRevenue), icon: TrendingUp, tone: "green" },
    { label: "Outstanding", value: formatRupiah(totalOutstanding), icon: CreditCard, tone: "red" },
    { label: "Orders", value: String(totalOrders), icon: ShoppingBag, tone: "amber" },
    { label: "Customers", value: String(totalCustomers), icon: Users, tone: "blue" },
    { label: "Products", value: String(totalProducts), icon: Package, tone: "sand" },
    { label: "Marketers", value: String(totalMarketers), icon: UserRound, tone: "olive" },
  ];

  // ===== WORK QUEUE (satu tempat utama untuk kondisi operasional) =====
  // Setiap order muncul SATU KALI, dikelompokkan lewat classifyOrderForQueue
  // (dihitung langsung dari order asli — lihat catatan di atas fungsi itu).
  const workQueueGroups: Record<QueueSection, QueueItem[]> = { perluTindakan: [], bisaDikerjakan: [], segera: [], menunggu: [] };
  for (const order of orders) {
    const result = classifyOrderForQueue(order);
    if (result) workQueueGroups[result.section].push(result.item);
  }

  const queueSections: { key: QueueSection; label: string; tone: string; icon: any; items: QueueItem[]; empty: string }[] = [
    { key: "perluTindakan", label: "Perlu Tindakan", tone: "red", icon: AlertCircle, items: workQueueGroups.perluTindakan, empty: "Tidak ada yang perlu tindakan" },
    { key: "bisaDikerjakan", label: "Bisa Dikerjakan", tone: "amber", icon: PackageOpen, items: workQueueGroups.bisaDikerjakan, empty: "Tidak ada yang bisa dikerjakan" },
    { key: "segera", label: "Segera", tone: "blue", icon: Clock, items: workQueueGroups.segera, empty: "Tidak ada yang segera" },
    { key: "menunggu", label: "Menunggu", tone: "sand", icon: CircleDot, items: workQueueGroups.menunggu, empty: "Tidak ada yang menunggu" },
  ];

  return <main className="app-shell dashboard-page">
    <header className="topbar">
      <button className="icon-btn" aria-label="Kembali" onClick={goBack}><ArrowLeft size={21} /></button>
      <div className="brand">UmayasLa<span>·</span> <em className="brand-sub">Headquarters</em></div>
      <div className="header-actions">
        <button className="icon-btn" aria-label="Notifikasi" onClick={() => notify("Belum ada notifikasi baru")}><Bell size={19} /></button>
        <button className="icon-btn" aria-label="Pengaturan" onClick={() => notify("Pengaturan ada di halaman Customer (tombol ⋯)")}><Settings size={19} /></button>
        <button className="profile-chip" aria-label="Akun" onClick={() => setAccountMenuOpen(true)}><span className="profile-chip-avatar">{(authName || session?.user.email || "U").charAt(0).toUpperCase()}</span></button>
      </div>
    </header>

    {accountMenuOpen && (
      <div className="overlay" onClick={() => setAccountMenuOpen(false)}>
        <section className="modal confirm-modal" onClick={event => event.stopPropagation()}>
          <button className="close" onClick={() => setAccountMenuOpen(false)}>×</button>
          <h2>Akun</h2>
          <p style={{ fontWeight: 600, marginBottom: 2 }}>{authName || session?.user.email}</p>
          <p className="muted" style={{ marginBottom: 20 }}>{authRole === "owner" ? "Owner — lihat semua data" : authRole === "admin" ? "Admin" : "—"}</p>
          {authRole === "owner" && (
            <Link href="/migrasi" className="secondary" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", border: "1px solid var(--line)", background: "#fff", color: "var(--ink)", borderRadius: 10, padding: "11px 15px", fontWeight: 600, textDecoration: "none", marginBottom: 8 }}>
              Migrasi Data ke Database
            </Link>
          )}
          <button
            onClick={() => { signOut(); setAccountMenuOpen(false); }}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", border: "1px solid var(--line)", background: "#fff", color: "var(--ink)", borderRadius: 10, padding: "11px 15px", fontWeight: 600, cursor: "pointer" }}
          ><LogOut size={16} /> Keluar</button>
        </section>
      </div>
    )}

    {/* ===== HERO / GREETING ===== */}
    <div className="dash-hero">
      <div className="dash-hero-ornament" aria-hidden="true">❦</div>
      <p className="dash-hero-eyebrow"><Sparkles size={13} /> {todayLabel}</p>
      <h1>{greeting}, Ummyas <span className="dash-hero-leaf">🌿</span></h1>
      <p className="dash-hero-message">Semoga hari ini penuh keberkahan dan order berjalan lancar.</p>
    </div>

    {/* ===== SECTION 1: WORK QUEUE — satu tempat utama untuk kondisi operasional ===== */}
    <section className="dash-section">
      <div className="dash-section-head">
        <div>
          <h2>Work Queue</h2>
          <span className="dash-section-sub">Satu tempat untuk semua kondisi operasional — setiap order muncul sekali</span>
        </div>
        <span className="dash-section-date"><CalendarDays size={13} /> {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</span>
      </div>

      {queueSections.map(group => {
        const Icon = group.icon;
        return (
          <div key={group.key} className="dash-queue-group">
            <div className="dash-queue-group-head">
              <span className={`dash-queue-group-icon ${group.tone}`}><Icon size={16} /></span>
              <b>{group.label}</b>
              <span className="dash-queue-count">{group.items.length}</span>
            </div>
            {group.items.length === 0 && <p className="dash-queue-empty">{group.empty}</p>}
            {group.items.map(item => {
              const body = <>
                <span className="mini-avatar">{item.customerName.slice(0, 2).toUpperCase()}</span>
                <div className="dash-queue-body">
                  <div className="dash-queue-top">
                    <b>{item.customerName}</b>
                    <span className="dash-queue-order">{item.orderNumber}</span>
                  </div>
                  <div className="dash-queue-conditions">
                    <span className={`dash-queue-primary ${item.tone}`}>{item.label}</span>
                    {item.activeProdStage && <span className="dash-queue-secondary">🏭 {productionStageInfo[item.activeProdStage].name}</span>}
                    {item.activeShipStage && <span className="dash-queue-secondary">🚚 {shipmentStageInfo[item.activeShipStage].name}</span>}
                  </div>
                  <span className="dash-queue-action">→ {item.nextAction}</span>
                </div>
                {item.hasOutstanding ? <MessageCircle size={16} className="dash-queue-chevron" /> : <ChevronRight size={16} className="dash-queue-chevron" />}
              </>;
              return item.hasOutstanding ? (
                <button key={item.orderId} type="button" className="dash-queue-item" onClick={() => handleTagihPelunasan(item.orderId)}>{body}</button>
              ) : (
                <Link key={item.orderId} href={`/order?orderId=${item.orderId}`} className="dash-queue-item">{body}</Link>
              );
            })}
          </div>
        );
      })}
    </section>

    {/* ===== SECTION 2: QUICK ACTIONS ===== */}
    <section className="dash-section">
      <div className="dash-section-head">
        <div>
          <h2>Aksi Cepat</h2>
          <span className="dash-section-sub">Mulai pekerjaan dalam satu ketukan</span>
        </div>
      </div>
      <div className="dash-quick-actions">
        <Link href="/order" className="dash-quick-action primary"><span className="dash-quick-icon"><Plus size={20} /></span><span className="dash-quick-copy"><b>New Order</b><small>Buat pesanan baru</small></span></Link>
        <Link href="/customer?newCustomer=1" className="dash-quick-action"><span className="dash-quick-icon"><UserPlus size={20} /></span><span className="dash-quick-copy"><b>New Customer</b><small>Tambahkan profil</small></span></Link>
        <button type="button" className="dash-quick-action" onClick={() => setQuickPaymentOpen(true)}><span className="dash-quick-icon"><HandCoins size={20} /></span><span className="dash-quick-copy"><b>Record Payment</b><small>Catat transferan yang baru masuk</small></span></button>
        <button type="button" className="dash-quick-action" onClick={() => notify("Fitur pengiriman/resi belum tersedia")}><span className="dash-quick-icon"><Truck size={20} /></span><span className="dash-quick-copy"><b>Create Shipment</b><small>Belum tersedia</small></span></button>
        <button type="button" className="dash-quick-action" onClick={() => notify("Catatan dikelola per-customer, buka profil customer dulu")}><span className="dash-quick-icon"><StickyNote size={20} /></span><span className="dash-quick-copy"><b>Add Note</b><small>Lewat profil customer</small></span></button>
      </div>
    </section>

    {/* ===== SECTION 3: TODAY'S ACTIVITY (HISTORI) ===== */}
    <section className="dash-section">
      <div className="dash-section-head">
        <div>
          <h2>Aktivitas Terbaru</h2>
          <span className="dash-section-sub">Perubahan terakhir di seluruh workspace</span>
        </div>
      </div>
      <div className="dash-activity">
        {activityFeed.length === 0 && (
          <div className="dash-empty">
            <span className="dash-empty-art">🌿</span>
            <h3>Belum ada aktivitas</h3>
            <p>Semua tenang hari ini. Mulai dengan membuat order baru.</p>
            <Link href="/order" className="dash-empty-cta"><Plus size={15} /> Buat Order</Link>
          </div>
        )}
        {activityFeed.map(item => {
          const Icon = item.icon;
          return (
            <div key={item.key} className="dash-activity-item">
              <span className={`dash-activity-dot ${item.iconClass}`}><Icon size={14} /></span>
              <div className="dash-activity-body">
                <b>{item.title}</b>
                <span>{item.desc}</span>
              </div>
              <span className="dash-activity-time">{item.time}</span>
            </div>
          );
        })}
      </div>
    </section>

    {/* ===== SECTION 4: PRODUCTION (domain batch) ===== */}
    <section className="dash-section">
      <div className="dash-section-head">
        <div>
          <h2>Produksi</h2>
          <span className="dash-section-sub">Batch yang sedang berjalan</span>
        </div>
        <Link href="/produksi" className="dash-section-date"><Factory size={13} /> Papan Produksi</Link>
      </div>
      <div className="dash-production">
        {productionBatches.length === 0 && realProductionItems.length === 0 && (
          <div className="dash-empty">
            <span className="dash-empty-art">🏭</span>
            <h3>Tidak ada batch produksi aktif</h3>
            <p>Semua produksi telah selesai. Siap untuk batch berikutnya.</p>
          </div>
        )}
        {realProductionItems.map(({ order, item }, i) => (
          <Link key={"real-" + i} href={`/order?orderId=${order.id}`} className="dash-batch-card">
            <div className="dash-batch-head">
              <span className="dash-batch-icon"><Factory size={18} /></span>
              <div>
                <b>{item.name} · {order.customer}</b>
                <span>{order.number}</span>
              </div>
              <span className="dash-batch-status produksi">{productionStageInfo[item.productionStage || "po"].name}</span>
            </div>
          </Link>
        ))}
        {productionBatches.map(({ customer, batch }, i) => (
          <div key={i} className="dash-batch-card">
            <div className="dash-batch-head">
              <span className="dash-batch-icon"><Factory size={18} /></span>
              <div>
                <b>{batch.name} · {batch.product}</b>
                <span>{batch.warehouse} · {customer.name}</span>
              </div>
              <span className={`dash-batch-status ${batch.status}`}>{batch.status === "produksi" ? "Produksi" : batch.status === "ready" ? "Ready" : "Selesai"}</span>
            </div>
            <div className="dash-batch-progress">
              <div className="dash-batch-progress-bar" style={{ width: `${batchProgress(batch.status)}%` }} />
            </div>
            <div className="dash-batch-meta">
              <span><Clock size={13} /> Estimasi siap: {batch.estimateReady}</span>
              <span className="dash-batch-percent">{batchProgress(batch.status)}%</span>
            </div>
          </div>
        ))}
      </div>
    </section>

    {/* ===== SECTION 5: BUSINESS SNAPSHOT (statistik) ===== */}
    <section className="dash-section">
      <div className="dash-section-head">
        <div>
          <h2>Ringkasan Bisnis</h2>
          <span className="dash-section-sub">Statistik keseluruhan</span>
        </div>
      </div>
      <div className="dash-snapshot">
        {snapshot.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className={`dash-snapshot-card ${s.tone}`}>
              <span className="dash-snapshot-icon"><Icon size={16} /></span>
              <div>
                <small>{s.label}</small>
                <b>{s.value}</b>
              </div>
            </div>
          );
        })}
      </div>
    </section>

    {/* ===== BOTTOM NAV ===== */}
    <BottomNav />

    {quickPaymentOpen && <QuickPaymentModal onClose={() => setQuickPaymentOpen(false)} onRecorded={() => getOrders().then(setOrders)} />}
    {notice && <div className="toast"><Check size={17} />{notice}</div>}
  </main>;
}
