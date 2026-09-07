"use client";

import {
  ArrowLeft, Bell, Boxes, Check, ChevronRight, ClipboardList, CreditCard,
  Package, PackageCheck, Plus, ShoppingBag, Truck, UserPlus, Users,
  UserRound, AlertCircle, Factory, PackageOpen,
  FileText, HandCoins, Send, Clock, CircleDot, TrendingUp, StickyNote,
  Settings, Sparkles, ArrowUpRight, MessageCircle, CalendarDays
} from "lucide-react";

import Link from "next/link";
import { useEffect, useState } from "react";

import { toDisplayCustomer } from "../data/customers";
import { getOrders, getFees, getMarketers, getProducts, formatRupiah, getOrderById, getPelunasanWhatsAppUrl } from "../data/store";
import { BottomNav } from "../components/BottomNav";
import { goBack } from "../lib/goBack";
import { getOperations } from "../data/operations";
import { getCustomers, getCustomerAddresses as getCentralCustomerAddresses, getDashboardWorkQueue, type WorkQueueItem, type PrimaryCondition } from "../data/central";

function loadAllDisplayCustomers() {
  return getCustomers().map(c => toDisplayCustomer(c, getCentralCustomerAddresses(c.id)));
}

export default function DashboardPage() {
  const [notice, setNotice] = useState("");
  const notify = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2600); };

  // Item "PERLU DITAGIH" langsung buka WhatsApp dgn pesan pelunasan siap
  // kirim (bukan cuma pindah ke halaman Edit Order) — item lain di Work
  // Queue tetap link biasa ke halaman order.
  const handleTagihPelunasan = (orderId: string) => {
    const order = getOrderById(orderId);
    if (!order) return;
    const url = getPelunasanWhatsAppUrl(order);
    if (!url) { notify("Nomor WA customer belum ada — lengkapi dulu di halaman Customer"); return; }
    window.open(url, "_blank");
  };

  // Semua state di bawah ini dimulai kosong (bukan langsung baca localStorage)
  // supaya render pertama di server & di client sama, lalu diisi data asli
  // lewat HYDRATION FIX useEffect setelah mount.
  const [orders, setOrders] = useState<ReturnType<typeof getOrders>>([]);
  const [fees, setFees] = useState<ReturnType<typeof getFees>>([]);
  const [marketers, setMarketers] = useState<ReturnType<typeof getMarketers>>([]);
  const [products, setProducts] = useState<ReturnType<typeof getProducts>>([]);
  const [allOps, setAllOps] = useState<{ customer: ReturnType<typeof toDisplayCustomer>; ops: ReturnType<typeof getOperations> }[]>([]);
  const [workQueue, setWorkQueue] = useState<ReturnType<typeof getDashboardWorkQueue>>({ perluTindakan: [], bisaDikerjakan: [], segera: [], menunggu: [], ringkasan: [] });
  const [totalCustomers, setTotalCustomers] = useState(0);
  // Halaman ini di-prerender statis (waktu build) — kalau jam/tanggal dihitung
  // langsung di badan render, HTML hasil build (jam build) akan beda dari hasil
  // hitung ulang di client (jam dibuka), dan React akan selalu melaporkan
  // hydration mismatch. Default netral dulu, isi jam/tanggal asli di useEffect.
  const [greeting, setGreeting] = useState("Selamat Datang");
  const [todayLabel, setTodayLabel] = useState("");

  // ===== HYDRATION FIX: Muat data dari localStorage setelah hydration =====
  useEffect(() => {
    setOrders(getOrders());
    setFees(getFees());
    setMarketers(getMarketers());
    setProducts(getProducts());
    setAllOps(loadAllDisplayCustomers().map(c => ({ customer: c, ops: getOperations(c.id) })));
    setWorkQueue(getDashboardWorkQueue());
    setTotalCustomers(getCustomers().length);
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
  // Setiap order muncul SATU KALI dengan PRIMARY CONDITION + NEXT ACTION.
  // Kondisi non-primary menjadi secondary signal (konteks), bukan duplikasi.
  const queueSections: { key: string; label: string; tone: string; icon: any; items: WorkQueueItem[]; empty: string }[] = [
    { key: "perluTindakan", label: "Perlu Tindakan", tone: "red", icon: AlertCircle, items: workQueue.perluTindakan, empty: "Tidak ada yang perlu tindakan" },
    { key: "bisaDikerjakan", label: "Bisa Dikerjakan", tone: "amber", icon: PackageOpen, items: workQueue.bisaDikerjakan, empty: "Tidak ada yang bisa dikerjakan" },
    { key: "segera", label: "Segera", tone: "blue", icon: Clock, items: workQueue.segera, empty: "Tidak ada yang segera" },
    { key: "menunggu", label: "Menunggu", tone: "sand", icon: CircleDot, items: workQueue.menunggu, empty: "Tidak ada yang menunggu" },
  ];

  const primaryTone: Record<PrimaryCondition, string> = {
    "BERMASALAH": "red",
    "PERLU DITAGIH": "red",
    "KEPUTUSAN PENGIRIMAN DIPERLUKAN": "amber",
    "MENUNGGU PRODUK LENGKAP": "sand",
    "SIAP DIBUAT SHIPMENT": "green",
    "BISA DIKIRIM SEBAGIAN": "green",
    "SIAP PACKING": "amber",
    "MENUNGGU QC / PRODUKSI / PEMBAYARAN": "sand",
    "DALAM PENGIRIMAN / MENUNGGU RESI": "blue",
    "SELESAI": "olive",
  };

  return <main className="app-shell dashboard-page">
    <header className="topbar">
      <button className="icon-btn" aria-label="Kembali" onClick={goBack}><ArrowLeft size={21} /></button>
      <div className="brand">UmayasLa<span>·</span> <em className="brand-sub">Headquarters</em></div>
      <div className="header-actions">
        <button className="icon-btn" aria-label="Notifikasi" onClick={() => notify("Belum ada notifikasi baru")}><Bell size={19} /></button>
        <button className="icon-btn" aria-label="Pengaturan" onClick={() => notify("Pengaturan ada di halaman Customer (tombol ⋯)")}><Settings size={19} /></button>
        <button className="profile-chip" aria-label="Profil" onClick={() => notify("Profil pemilik akun belum tersedia")}><span className="profile-chip-avatar">U</span></button>
      </div>
    </header>

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
              const isTagihan = item.primaryCondition === "PERLU DITAGIH";
              const body = <>
                <span className="mini-avatar">{item.customerName.slice(0, 2).toUpperCase()}</span>
                <div className="dash-queue-body">
                  <div className="dash-queue-top">
                    <b>{item.customerName}</b>
                    <span className="dash-queue-order">{item.orderNumber}</span>
                  </div>
                  <div className="dash-queue-conditions">
                    <span className={`dash-queue-primary ${primaryTone[item.primaryCondition]}`}>{item.primaryCondition}</span>
                    {item.secondarySignals.map((s, i) => (
                      <span key={i} className="dash-queue-secondary">{s.count} {s.label}</span>
                    ))}
                  </div>
                  <span className="dash-queue-action">→ {item.nextAction}</span>
                </div>
                {isTagihan ? <MessageCircle size={16} className="dash-queue-chevron" /> : <ChevronRight size={16} className="dash-queue-chevron" />}
              </>;
              return isTagihan ? (
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
        <Link href="/" className="dash-quick-action"><span className="dash-quick-icon"><UserPlus size={20} /></span><span className="dash-quick-copy"><b>New Customer</b><small>Tambahkan profil</small></span></Link>
        <Link href="/order" className="dash-quick-action"><span className="dash-quick-icon"><HandCoins size={20} /></span><span className="dash-quick-copy"><b>Record Payment</b><small>Edit order untuk catat DP/pelunasan</small></span></Link>
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
      </div>
      <div className="dash-production">
        {productionBatches.length === 0 && (
          <div className="dash-empty">
            <span className="dash-empty-art">🏭</span>
            <h3>Tidak ada batch produksi aktif</h3>
            <p>Semua produksi telah selesai. Siap untuk batch berikutnya.</p>
          </div>
        )}
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

    {notice && <div className="toast"><Check size={17} />{notice}</div>}
  </main>;
}
