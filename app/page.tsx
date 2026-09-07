"use client";


import { ArrowLeft, Bell, Box, Check, ChevronRight, ClipboardList, Clock, CreditCard, Heart, MapPin, MessageCircle, MoreHorizontal, Pencil, Plus, Search, ShoppingBag, Trash2, Truck } from "lucide-react";


import Link from "next/link";
import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { createNewCustomer, toDisplayCustomer, EMPTY_CUSTOMER, type Customer, type CustomerAddress } from "./data/customers";
import { getCustomers, getCustomer, addCustomer, updateCustomer as updateCentralCustomer, addAddress, updateAddress as updateCentralAddress, deleteAddress as deleteCentralAddress, getAddresses, getCustomerAddresses as getCentralCustomerAddresses, softDeleteCustomer, hardDeleteCustomer, backupLocalStorage, listBackups, restoreBackup, type BackupInfo } from "./data/central";
import { Overview, CustomerPanel } from "./components/panels";
import { NewCustomerForm, EditCustomerForm, type EditableCustomerFields } from "./components/NewCustomerForm";
import { BottomNav } from "./components/BottomNav";
import { goBack } from "./lib/goBack";
import { getCollections, getAllCollections, seedCollections, getCollectionStats, addCollection, saveCollections, collectionTypeInfo, collectionStatusInfo, collectionColors, collectionIcons, type Collection, type CollectionType, type CollectionStatus } from "./data/collections";
import { demoCustomers, demoAddresses, demoCustomerIds } from "./data/demoSeed";

import { formatRupiah, getOrdersForCustomer, computePaymentTotals, getProducts, saveProducts, getMarketers, saveMarketers, defaultMarketers, type OrderRecord } from "./data/store";
import { products as seedCatalogProducts, nonBookMasterCatalog } from "./data/products";
import { getOperations, type CustomerOperations } from "./data/operations";



// Label tab & catatan metrik dihitung per-customer di dalam komponen (lihat
// buildTabs/buildMetrics) — dulu hardcode ("Order (6)", "6 order sepanjang
// hubungan", dst) jadi kelihatan seperti data customer lain "nempel" padahal
// cuma teks tetap yang lupa disesuaikan.
function buildTabs(customer: Customer, orderCount: number): string[] {
  return [
    "Ringkasan",
    `Order (${orderCount})`,
    `Payment (${customer.payments.length})`,
    `Shipment (${customer.shipments.length})`,
    "Marketer", "Batch", "Resi", "Alamat Pengiriman",
    `Catatan (${customer.notes.length})`,
    "Aktivitas",
  ];
}

function buildMetrics(customer: Customer, orders: OrderRecord[]) {
  const { totalPaid, totalOutstanding } = computePaymentTotals(orders);
  // Lunas = status "paid" ATAU DP sudah menutupi total — status "paid" sendiri
  // belum pernah dipakai di alur manapun, jadi kalau cuma mengandalkan status
  // label ini akan selalu "0% invoice selesai" walau DP-nya sudah penuh.
  const paidOrders = orders.filter(o => o.status === "paid" || o.dp >= o.total);
  const paidPercent = orders.length > 0 ? Math.round((paidOrders.length / orders.length) * 100) : 0;
  const outstandingCount = orders.length - paidOrders.length;
  return [
    { label: "Total Order", value: String(orders.length), note: `${orders.length} order sepanjang hubungan`, icon: ClipboardList, tone: "olive", progress: 100 },
    { label: "Total Payment", value: formatRupiah(totalPaid), note: `${paidPercent}% invoice selesai`, icon: CreditCard, tone: "brown", progress: paidPercent },
    { label: "Outstanding", value: formatRupiah(totalOutstanding), note: `${outstandingCount} invoice menunggu`, icon: Box, tone: "sand", progress: outstandingCount > 0 ? 40 : 0 },
    { label: "Total Shipment", value: customer.shipment, note: `${customer.shipments.length} paket tercatat`, icon: Truck, tone: "olive", progress: 100 },
  ];
}

function loadFirstCustomer(): Customer {
  const first = getCustomers()[0];
  return first ? toDisplayCustomer(first, getCentralCustomerAddresses(first.id)) : EMPTY_CUSTOMER;
}

export default function HomePage() {
  return <Suspense fallback={null}><HomePageInner /></Suspense>;
}

// Datang dari luar (mis. tab Customer di Collection Workspace, "?customerId=...")
// — langsung buka profil customer itu, bukan customer pertama di daftar.
function HomePageInner() {
  const searchParams = useSearchParams();
  const initialCustomerId = searchParams.get("customerId");
  const [activeTab, setActiveTab] = useState("Ringkasan");
  const [saved, setSaved] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [finderOpen, setFinderOpen] = useState(false);
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  // Mulai dari EMPTY_CUSTOMER (bukan langsung baca localStorage) supaya render
  // pertama di server & di client SAMA — localStorage cuma ada di browser, jadi
  // kalau dibaca langsung di sini akan bikin hydration mismatch. Data asli dimuat
  // lewat useEffect di bawah, setelah mount (lihat pola sama di dashboard/fees).
  const [customer, setCustomer] = useState<Customer>(EMPTY_CUSTOMER);
  const [notice, setNotice] = useState("");
  const [addressFormOpen, setAddressFormOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<CustomerAddress | null>(null);
  const [addrForm, setAddrForm] = useState({ label: "", recipientName: "", phone: "", address: "", landmark: "", courier: "", note: "", isDefault: false });
  const [searchQuery, setSearchQuery] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editCustomerOpen, setEditCustomerOpen] = useState(false);
  const [deleteCustomerConfirmOpen, setDeleteCustomerConfirmOpen] = useState(false);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [restoreConfirmKey, setRestoreConfirmKey] = useState<string | null>(null);
  const [wipeDemoConfirmOpen, setWipeDemoConfirmOpen] = useState(false);
  const [ops, setOps] = useState<CustomerOperations>(() => getOperations("-"));
  const [customerOrders, setCustomerOrders] = useState<OrderRecord[]>([]);
  const notify = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2600); };

  // ===== HYDRATION FIX: muat customer asli dari localStorage setelah mount =====
  useEffect(() => {
    if (initialCustomerId) {
      const found = getCustomer(initialCustomerId);
      if (found) {
        setCustomer(toDisplayCustomer(found, getCentralCustomerAddresses(found.id)));
        return;
      }
    }
    setCustomer(loadFirstCustomer());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Order asli customer ini (dibuat lewat halaman /order) — dimuat ulang tiap
  // ganti customer, supaya Total Order/tab Order gak nyangkut punya customer lain.
  useEffect(() => {
    setCustomerOrders(customer.id ? getOrdersForCustomer(customer.id) : []);
  }, [customer.id]);

  // Setiap kali customer yang aktif berganti (pindah profil / bikin customer baru),
  // muat ulang operasinya sendiri — jangan biarkan ops customer sebelumnya "nempel".
  useEffect(() => {
    setOps(getOperations(customer.id || "-"));
  }, [customer.id]);

  // ===== CUSTOMER BARU — beneran tersimpan lewat central.ts, bukan cuma di state React =====
  const handleCreateCustomer = (name: string, city: string) => {
    const created = createNewCustomer(name, city);
    addCustomer(created);
    setCustomer(toDisplayCustomer(created, []));
  };

  // ===== DATA DEMO — muat / sembunyikan lewat central.ts, aman & bisa dipulihkan =====
  const loadDemoData = () => {
    backupLocalStorage();
    const existingIds = new Set(getCustomers().map(c => c.id));
    let added = 0;
    for (const c of demoCustomers) {
      if (!existingIds.has(c.id)) { addCustomer(c); added++; }
    }
    const existingAddrIds = new Set(getAddresses().map(a => a.id));
    for (const a of demoAddresses) {
      if (!existingAddrIds.has(a.id)) addAddress(a);
    }
    setCustomer(loadFirstCustomer());
    notify(added > 0 ? `Data demo dimuat (${added} customer)` : "Data demo sudah dimuat sebelumnya");
  };

  const clearDemoData = () => {
    backupLocalStorage();
    for (const id of demoCustomerIds) softDeleteCustomer(id);
    setCustomer(loadFirstCustomer());
    notify("Data demo disembunyikan");
  };

  // ===== HAPUS PERMANEN SEMUA DATA DEMO (customer, alamat, collection,
  // produk, marketer) — beda dari "Sembunyikan" di atas yang cuma soft-delete
  // 3 customer. Ini benar-benar menghapus, termasuk katalog produk contoh &
  // daftar marketer contoh. Tetap dicadangkan dulu otomatis sebelum dihapus.
  const wipeAllDemoData = () => {
    backupLocalStorage();
    for (const id of demoCustomerIds) {
      const result = hardDeleteCustomer(id);
      if (!result.ok) softDeleteCustomer(id);
    }
    for (const a of demoAddresses) deleteCentralAddress(a.id);
    // Hanya hapus Collection & Marketer BAWAAN (seed) — bukan semuanya, supaya
    // Collection "PO Batch" atau marketer asli yang sudah dibuat user tidak
    // ikut kehapus kalau tombol ini dipakai lagi di kemudian hari.
    const seedCollectionIds = new Set(seedCollections.map(c => c.id));
    saveCollections(getAllCollections().filter(c => !seedCollectionIds.has(c.id)));
    const seedMarketerIds = new Set(defaultMarketers.map(m => m.id));
    saveMarketers(getMarketers().filter(m => !seedMarketerIds.has(m.id)));
    // Hanya hapus produk seed DEMO LAMA (Parenting A/B/C, Boardbook, dst) —
    // BUKAN seluruh katalog. nonBookMasterCatalog (dimuat lewat "Muat Katalog
    // Master Data") sengaja pakai beberapa id yang sama dengan seed lama
    // (niqab-poni-basic, handsock-standar, dst, karena memang produk yang
    // sama) — id yang overlap itu DIKECUALIKAN dari penghapusan supaya
    // katalog asli yang sudah dimuat user tidak ikut lenyap kalau tombol ini
    // dipakai lagi nanti.
    const realCatalogIds = new Set(nonBookMasterCatalog.map(p => p.id));
    const seedOnlyProductIds = new Set(seedCatalogProducts.filter(p => !realCatalogIds.has(p.id)).map(p => p.id));
    saveProducts(getProducts().filter(p => !seedOnlyProductIds.has(p.id)));
    // saveFees([]) SENGAJA DIHAPUS — dulu di sini menghapus SELURUH riwayat
    // fee marketer (termasuk order asli), padahal tidak ada data fee demo yang
    // pernah dimuat ke localStorage sama sekali (seedFees di store.ts gak
    // pernah dipakai oleh fitur "Muat Data Demo" manapun) — jadi baris ini
    // gak ada gunanya selain merusak data asli. Sama persis kelasnya dengan
    // bug saveProducts([]) yang baru diperbaiki di atas.
    setCustomer(loadFirstCustomer());
    notify("Semua data demo (customer, collection, produk, marketer) dihapus permanen");
  };

  // ===== EDIT PROFIL CUSTOMER =====
  const handleUpdateCustomer = (data: EditableCustomerFields) => {
    const central = getCustomer(customer.id);
    if (!central) return;
    const updated = { ...central, ...data };
    updateCentralCustomer(updated);
    setCustomer(toDisplayCustomer(updated, customer.addresses));
    setEditCustomerOpen(false);
    notify("Profil customer diperbarui");
  };

  // ===== HAPUS CUSTOMER (soft delete — bisa dipulihkan dari backup) =====
  const handleDeleteCustomer = () => {
    backupLocalStorage();
    softDeleteCustomer(customer.id);
    setDeleteCustomerConfirmOpen(false);
    setCustomer(loadFirstCustomer());
    notify("Customer dihapus");
  };

  const openSettings = () => {
    setBackups(listBackups());
    setSettingsOpen(true);
  };

  // ===== PULIHKAN CADANGAN =====
  const handleRestoreBackup = (key: string) => {
    const ok = restoreBackup(key);
    setRestoreConfirmKey(null);
    setSettingsOpen(false);
    setCustomer(loadFirstCustomer());
    notify(ok ? "Cadangan berhasil dipulihkan" : "Gagal memulihkan cadangan");
  };

  // ===== ALAMAT PENGIRIMAN =====
  const openAddAddress = () => {
    setEditingAddress(null);
    setAddrForm({ label: "", recipientName: "", phone: "", address: "", landmark: "", courier: "", note: "", isDefault: customer.addresses.length === 0 });
    setAddressFormOpen(true);
  };

  const openEditAddress = (addr: CustomerAddress) => {
    setEditingAddress(addr);
    setAddrForm({ label: addr.label, recipientName: addr.recipientName, phone: addr.phone, address: addr.address, landmark: addr.landmark || "", courier: addr.courier || "", note: addr.note || "", isDefault: addr.isDefault });
    setAddressFormOpen(true);
  };

  // Simpan defaultAddressId ke central.ts juga, supaya tetap benar setelah refresh.
  const persistDefaultAddressId = (defaultAddressId: string | null) => {
    const centralCust = getCustomer(customer.id);
    if (centralCust) updateCentralCustomer({ ...centralCust, defaultAddressId });
  };

  const saveAddress = () => {
    if (!addrForm.label.trim() || !addrForm.recipientName.trim() || !addrForm.address.trim()) { notify("Label, nama penerima, dan alamat wajib diisi"); return; }
    const updatedCustomer = { ...customer };
    let addresses = [...updatedCustomer.addresses];
    let newAddrId: string | null = null;
    if (editingAddress) {
      addresses = addresses.map(a => a.id === editingAddress.id ? { ...a, ...addrForm, id: a.id, customerId: a.customerId } : a);
    } else {
      const newAddr: CustomerAddress = { id: "addr-" + Date.now(), customerId: customer.id, ...addrForm };
      addresses = [...addresses, newAddr];
      newAddrId = newAddr.id;
    }
    if (addrForm.isDefault) {
      const targetId = editingAddress ? editingAddress.id : newAddrId!;
      addresses = addresses.map(a => ({ ...a, isDefault: a.id === targetId }));
    }
    updatedCustomer.addresses = addresses;
    updatedCustomer.defaultAddressId = addresses.find(a => a.isDefault)?.id || null;
    setCustomer(updatedCustomer);

    // Simpan ke central.ts supaya alamat beneran tersimpan, bukan cuma di state React.
    for (const a of addresses) { if (a.id === newAddrId) addAddress(a); else updateCentralAddress(a); }
    persistDefaultAddressId(updatedCustomer.defaultAddressId);

    setAddressFormOpen(false);
    notify(editingAddress ? "Alamat diperbarui" : "Alamat ditambahkan");
  };

  const deleteAddress = (addrId: string) => {
    const updatedCustomer = { ...customer };
    const remaining = updatedCustomer.addresses.filter(a => a.id !== addrId).map(a => ({ ...a }));
    if (remaining.length > 0 && !remaining.some(a => a.isDefault)) {
      remaining[0].isDefault = true;
    }
    updatedCustomer.addresses = remaining;
    updatedCustomer.defaultAddressId = remaining.find(a => a.isDefault)?.id || null;
    setCustomer(updatedCustomer);

    deleteCentralAddress(addrId);
    for (const a of remaining) updateCentralAddress(a);
    persistDefaultAddressId(updatedCustomer.defaultAddressId);

    notify("Alamat dihapus");
  };

  const setDefaultAddress = (addrId: string) => {
    const updatedCustomer = { ...customer };
    updatedCustomer.addresses = updatedCustomer.addresses.map(a => ({ ...a, isDefault: a.id === addrId }));
    updatedCustomer.defaultAddressId = addrId;
    setCustomer(updatedCustomer);

    for (const a of updatedCustomer.addresses) updateCentralAddress(a);
    persistDefaultAddressId(addrId);

    notify("Alamat default diperbarui");
  };

  // Settings/Cadangan/Wipe-demo tidak butuh data customer sama sekali — dipakai
  // di DUA tempat (layar kosong & layar profil normal) supaya tetap bisa
  // diakses walau customer.id === "" (mis. mau pulihkan backup setelah semua
  // data ke-hapus). Sebelumnya cuma ada di layar profil normal, jadi kalau
  // customer sudah 0, tombol "..." di layar kosong keliatan ada tapi diam
  // total — gak ada jalan buka Pengaturan/pulihkan Cadangan sama sekali.
  const settingsAndBackupModals = <>
    {settingsOpen && <div className="overlay" onClick={() => setSettingsOpen(false)}>
      <section className="modal" onClick={event => event.stopPropagation()}>
        <button className="close" onClick={() => setSettingsOpen(false)}>×</button>
        <h2>Pengaturan</h2>
        <p className="muted" style={{ marginBottom: 14 }}>Data Demo</p>
        <p style={{ fontSize: 13, color: "#8a7c6c", marginBottom: 14 }}>Muat 3 contoh customer untuk melihat tampilan aplikasi, atau sembunyikan kalau sudah tidak diperlukan. Bisa dipulihkan dari backup lokal kapan saja.</p>
        <div className="form-actions" style={{ flexDirection: "column", gap: 8 }}>
          <button className="chat" onClick={() => { loadDemoData(); setSettingsOpen(false); }}>Muat Data Demo</button>
          <button className="quiet" onClick={() => { clearDemoData(); setSettingsOpen(false); }}>Sembunyikan Data Demo</button>
          <button
            onClick={() => setWipeDemoConfirmOpen(true)}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, border: "1px solid #c0392b", background: "#fff", color: "#c0392b", borderRadius: 10, padding: "10px 15px", fontWeight: 600, cursor: "pointer" }}
          ><Trash2 size={15} /> Hapus Semua Data Demo (Permanen)</button>
        </div>

        <p className="muted" style={{ marginTop: 22, marginBottom: 14 }}>Cadangan Data</p>
        <p style={{ fontSize: 13, color: "#8a7c6c", marginBottom: 14 }}>Setiap kali data demo dimuat/disembunyikan atau customer dihapus, aplikasi otomatis menyimpan cadangan kondisi sebelumnya di HP ini. Kalau data tiba-tiba kosong/hilang, coba pulihkan salah satu di bawah.</p>
        {backups.length === 0 && <p className="panel-hint">Belum ada cadangan tersimpan di HP ini.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 220, overflowY: "auto" }}>
          {backups.map(b => (
            <div key={b.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{new Date(b.timestamp).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{b.customerCount < 0 ? "Jumlah customer tidak terbaca" : `${b.customerCount} customer tersimpan`}</div>
              </div>
              <button className="secondary" onClick={() => setRestoreConfirmKey(b.key)}>Pulihkan</button>
            </div>
          ))}
        </div>
      </section>
    </div>}
    {restoreConfirmKey && (
      <div className="overlay" onClick={() => setRestoreConfirmKey(null)}>
        <section className="modal confirm-modal" onClick={event => event.stopPropagation()}>
          <h2>Pulihkan Cadangan Ini?</h2>
          <p>Data yang ada SEKARANG akan ditimpa dengan isi cadangan dari <b>{new Date(Number(restoreConfirmKey.replace("umayasla_backup_", ""))).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</b>.</p>
          <p className="muted">Kondisi sebelum ini juga otomatis dicadangkan dulu, jadi tetap bisa dibatalkan nanti.</p>
          <div className="confirm-actions">
            <button className="secondary" onClick={() => setRestoreConfirmKey(null)}>Batal</button>
            <button className="danger" onClick={() => handleRestoreBackup(restoreConfirmKey)}>Pulihkan</button>
          </div>
        </section>
      </div>
    )}
    {wipeDemoConfirmOpen && (
      <div className="overlay" onClick={() => setWipeDemoConfirmOpen(false)}>
        <section className="modal confirm-modal" onClick={event => event.stopPropagation()}>
          <h2>Hapus Semua Data Demo?</h2>
          <p>Ini akan menghapus PERMANEN: 3 customer contoh + alamatnya, Collection contoh, produk contoh di katalog, dan marketer contoh. Customer/Collection/produk/marketer ASLI yang sudah kamu buat sendiri (termasuk katalog dari Master Data & riwayat fee marketer) TIDAK ikut terhapus.</p>
          <p className="muted">Kondisi sekarang otomatis dicadangkan dulu (lihat "Cadangan Data" di atas), jadi masih bisa dipulihkan kalau berubah pikiran.</p>
          <div className="confirm-actions">
            <button className="secondary" onClick={() => setWipeDemoConfirmOpen(false)}>Batal</button>
            <button className="danger" onClick={() => { wipeAllDemoData(); setWipeDemoConfirmOpen(false); setSettingsOpen(false); }}><Trash2 size={15} /> Hapus Semua</button>
          </div>
        </section>
      </div>
    )}
  </>;

  // Belum ada customer sama sekali (localStorage kosong) — tampilkan layar
  // kosong yang jelas, bukan crash atau halaman utama yang isinya string kosong.
  if (customer.id === "") {
    return <main className="app-shell">
      <header className="topbar">
        <button className="icon-btn" aria-label="Kembali" onClick={goBack}><ArrowLeft size={21} /></button>
        <div className="brand">UmayasLa<span>·</span></div>
        <div className="header-actions"><button className="icon-btn" onClick={openSettings}><MoreHorizontal size={21} /></button></div>
      </header>
      <div className="empty-state" style={{ marginTop: 40 }}>
        <span>👋</span>
        <h3>Belum ada customer</h3>
        <p>Tambah customer pertama, atau muat data demo untuk melihat contoh tampilannya.</p>
        <button className="primary" style={{ marginTop: 16 }} onClick={() => setNewCustomerOpen(true)}><Plus size={16} /> Tambah Customer Baru</button>
        <button className="quiet" style={{ marginTop: 8 }} onClick={loadDemoData}>Muat Data Demo</button>
      </div>
      {newCustomerOpen && <NewCustomerForm onClose={() => setNewCustomerOpen(false)} onSave={(name, city) => { handleCreateCustomer(name, city); setNewCustomerOpen(false); notify(`Profil ${name} berhasil dibuat`); }}/>}
      {settingsAndBackupModals}
      {notice && <div className="toast"><Check size={17}/>{notice}</div>}
    </main>;
  }

  return <main className="app-shell">

    <header className="topbar">
      <button className="icon-btn" aria-label="Kembali" onClick={goBack}><ArrowLeft size={21} /></button>

      <div className="brand">UmayasLa<span>·</span></div>
      <div className="header-actions"><Link href="/products" className="icon-btn" aria-label="Katalog produk"><ShoppingBag size={19} /></Link><button className="icon-btn"><Bell size={19} /></button><button className="icon-btn" onClick={openSettings}><MoreHorizontal size={21} /></button></div>
    </header>
    <button className="customer-finder" onClick={() => setFinderOpen(true)}><Search size={17}/><span>Cari atau pindah customer...</span><kbd>⌘ K</kbd></button>

    <section className="profile">
      <div className="avatar"><div className="hijab">◖</div><span>✦</span></div>
      <div className="profile-copy"><h1>{customer.name}</h1><p className="badge"><Heart size={13} fill="currentColor" /> {customer.orders === "0" ? "Customer Baru" : "Repeat Customer"}</p><p><MapPin size={15} /> {customer.city}</p><p><ClipboardList size={14} /> Sejak {customer.since}</p></div>
      <div className="profile-actions"><button className="chat" onClick={() => setChatOpen(true)}><MessageCircle size={17} /> Chat</button><Link href="/order" className="add-order"><Plus size={17} /> Order</Link><button onClick={() => setEditCustomerOpen(true)} className="save" aria-label="Edit profil customer"><Pencil size={16} /></button><button onClick={() => setDeleteCustomerConfirmOpen(true)} className="save" aria-label="Hapus customer"><Trash2 size={16} /></button><button onClick={() => { setSaved(!saved); notify(!saved ? "Customer disimpan ke favorit" : "Customer dihapus dari favorit"); }} className={saved ? "saved" : "save"} aria-label="Simpan customer"><Heart size={18} fill={saved ? "currentColor" : "none"} /></button></div>

      {/* ===== SITUATION STRIP — kondisi customer saat ini ===== */}
      <div className="situation-strip">
        <div className="situation-item"><small>Lifetime Value</small><b>{formatRupiah(computePaymentTotals(customerOrders).totalPaid)}</b></div>
        <div className="situation-item"><small>Outstanding</small><b className="situation-warn">{formatRupiah(computePaymentTotals(customerOrders).totalOutstanding)}</b></div>
        {/* Dihitung dari order ASLI (customerOrders) — sebelumnya baca ops.productCards
            (operations.ts, state lama cuma pernah diisi utk 3 customer demo), jadi
            customer dgn order asli selalu tampil "0 produk" di sini walau "Total Order"
            di bawah (juga dari data asli) sudah benar menunjukkan order aktif. */}
        <div className="situation-item"><small>Order Aktif</small><b>{customerOrders.filter(o => o.total - o.dp > 0).reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.qty, 0), 0)} produk</b></div>
        {/* Dihitung dari tahap produksi/pengiriman ASLI per-item (OrderItemSnapshot.
            productionStage/shipmentStage, diisi lewat form Order) — sebelumnya
            selalu "0"/placeholder krn baca ops.productCards (data demo). */}
        {/* "packing" ikut dihitung di sini — harus sama persis dgn kriteria
            realProductionItems di dashboard/page.tsx, supaya item yang sama
            gak kehitung beda di 2 layar (ditemukan saat audit). */}
        <div className="situation-item"><small>Produksi</small><b>{customerOrders.reduce((sum, o) => sum + o.items.filter(i => i.productionStage === "produksi" || i.productionStage === "qc" || i.productionStage === "packing").length, 0)} berjalan</b></div>
        <div className="situation-item"><small>Pengiriman</small><b>{customerOrders.reduce((sum, o) => sum + o.items.filter(i => i.shipmentStage === "dalam-pengiriman").length, 0)} aktif</b></div>

        <div className="situation-item"><small>Prioritas</small><b className="situation-priority">{(ops.actionCenter.length + customerOrders.filter(o => o.total - o.dp > 0).length) > 0 ? `${ops.actionCenter.length + customerOrders.filter(o => o.total - o.dp > 0).length} aksi` : "Tenang"}</b></div>
      </div>
    </section>

    <section className="metrics" aria-label="Ringkasan customer">{buildMetrics(customer, customerOrders).map(({ label, value, note, icon: Icon, tone, progress }) => <article className="metric" key={label}><div className={`metric-icon ${tone}`}><Icon size={21} /></div><small>{label}</small><strong>{value}</strong><em>{note}</em><div className="metric-track"><div className={`metric-fill ${tone}`} style={{ width: `${progress}%` }} /></div></article>)}</section>


    <nav className="tabs" aria-label="Navigasi profil">{buildTabs(customer, customerOrders.length).map(tab => <button key={tab} className={activeTab === tab ? "active" : ""} onClick={() => setActiveTab(tab)}>{tab}</button>)}</nav>
    <Link href={`/order?customerId=${customer.id}`} className="mobile-add-order"><Plus size={17}/> Tambah Order untuk {customer.name}</Link>

    {activeTab === "Alamat Pengiriman" ? (
      <section className="address-section">
        <div className="address-head">
          <h2>Alamat Pengiriman</h2>
          <button className="add-address-btn" onClick={openAddAddress}><Plus size={15} /> Tambah Alamat</button>
        </div>
        <p className="address-sub">Satu customer dapat memiliki banyak alamat pengiriman. Alamat default otomatis terpilih saat membuat order.</p>
        {customer.addresses.length === 0 && <div className="empty-state"><span>📍</span><h3>Belum ada alamat</h3><p>Tambahkan alamat pengiriman untuk customer ini.</p></div>}
        {customer.addresses.map(addr => (
          <article className={`address-card ${addr.isDefault ? "default" : ""}`} key={addr.id}>
            <div className="address-card-head">
              <b>{addr.isDefault ? "⭐ " : ""}{addr.label}</b>
              {addr.isDefault && <span className="default-tag">Default</span>}
            </div>
            <div className="address-card-body">
              <p><b>{addr.recipientName}</b> · {addr.phone}</p>
              <p>{addr.address}</p>
              {addr.landmark && <p className="address-landmark">📍 {addr.landmark}</p>}
              {addr.courier && <p className="address-courier">🚚 Kurir: {addr.courier}</p>}
              {addr.note && <p className="address-note">📝 {addr.note}</p>}
            </div>
            <div className="address-card-actions">
              {!addr.isDefault && <button className="set-default" onClick={() => setDefaultAddress(addr.id)}>Set Default</button>}
              <button className="edit-address" onClick={() => openEditAddress(addr)}>Edit</button>
              <button className="delete-address" onClick={() => deleteAddress(addr.id)}>Hapus</button>
            </div>
          </article>
        ))}
      </section>
    ) : activeTab === "Ringkasan" ? <Overview customer={customer} onTab={setActiveTab} /> : <CustomerPanel customer={customer} tab={activeTab} />}

    {/* ===== COLLECTION WORKSPACE SECTION ===== */}
    <CollectionWorkspaceSection />

    <BottomNav onCustomerClick={() => setActiveTab("Ringkasan")} />




    {notice && <div className="toast"><Check size={17}/>{notice}</div>}
    {finderOpen && <div className="overlay" onClick={() => setFinderOpen(false)}><section className="modal finder" onClick={event => event.stopPropagation()}><button className="close" onClick={() => setFinderOpen(false)}>×</button><h2>Universal Search</h2><div className="find-input"><Search size={18}/><input autoFocus placeholder="Cari customer atau collection..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}/></div><button className="new-customer" onClick={() => { setFinderOpen(false); setNewCustomerOpen(true); }}>+ Tambah Customer Baru</button>
      {(() => {
        const q = searchQuery.toLowerCase().trim();
        const allCustomers = getCustomers().map(c => toDisplayCustomer(c, getCentralCustomerAddresses(c.id)));
        const filteredCustomers = q ? allCustomers.filter(c => c.name.toLowerCase().includes(q) || c.city.toLowerCase().includes(q) || c.waName.toLowerCase().includes(q)) : allCustomers;
        const filteredCollections = q ? getCollections().filter(c => c.name.toLowerCase().includes(q) || c.tags.some(t => t.toLowerCase().includes(q)) || (c.description || "").toLowerCase().includes(q)) : getCollections();
        return <>
          <p className="muted">Customer</p>
          {filteredCustomers.map(item => <button className="customer-result" key={item.id} onClick={() => { setCustomer(item); setFinderOpen(false); setActiveTab("Ringkasan"); notify(`Profil ${item.name} dibuka`); }}><span className="mini-avatar">{item.initials}</span><span>{item.name} · {item.city} · {item.orders} order</span><ChevronRight size={18}/></button>)}
          {filteredCollections.length > 0 && <p className="muted" style={{ marginTop: 12 }}>Collection</p>}
          {filteredCollections.map(c => <Link href={`/collections/${c.id}`} key={c.id} className="customer-result" onClick={() => setFinderOpen(false)}><span className="mini-avatar" style={{ background: c.color + "22", color: c.color }}>{c.icon}</span><span>{c.name} · {collectionTypeInfo[c.type].name}</span><ChevronRight size={18}/></Link>)}
        </>;
      })()}
    </section></div>}

    {newCustomerOpen && <NewCustomerForm onClose={() => setNewCustomerOpen(false)} onSave={(name, city) => { handleCreateCustomer(name, city); setNewCustomerOpen(false); setActiveTab("Ringkasan"); notify(`Profil ${name} berhasil dibuat`); }}/>}
    {settingsAndBackupModals}
    {editCustomerOpen && <EditCustomerForm customer={customer} onClose={() => setEditCustomerOpen(false)} onSave={handleUpdateCustomer} />}
    {deleteCustomerConfirmOpen && (
      <div className="overlay" onClick={() => setDeleteCustomerConfirmOpen(false)}>
        <section className="modal confirm-modal" onClick={event => event.stopPropagation()}>
          <h2>Hapus Customer?</h2>
          <p>Profil <b>{customer.name}</b> akan disembunyikan dari daftar customer.</p>
          <p className="muted">Ini bisa dipulihkan dari backup lokal kalau diperlukan lagi — riwayat order/pembayaran tidak ikut terhapus.</p>
          <div className="confirm-actions">
            <button className="secondary" onClick={() => setDeleteCustomerConfirmOpen(false)}>Batal</button>
            <button className="danger" onClick={handleDeleteCustomer}><Trash2 size={15} /> Hapus</button>
          </div>
        </section>
      </div>
    )}
    {chatOpen && <div className="overlay" onClick={() => setChatOpen(false)}><section className="modal" onClick={event => event.stopPropagation()}><button className="close" onClick={() => setChatOpen(false)}>×</button><div className="chat-title"><span className="mini-avatar">{customer.initials}</span><div><b>{customer.name}</b><small>WhatsApp customer</small></div></div><div className="message">Assalamu'alaikum {customer.name.split(" ")[0]}, ada yang bisa kami bantu?</div><div className="composer"><input placeholder="Tulis pesan..."/><button onClick={() => { setChatOpen(false); notify("Pesan siap dikirim ke WhatsApp"); }}>Kirim</button></div></section></div>}


    {/* ===== ADDRESS FORM MODAL ===== */}
    {addressFormOpen && <div className="overlay" onClick={() => setAddressFormOpen(false)}>
      <section className="modal address-form" onClick={event => event.stopPropagation()}>
        <button className="close" onClick={() => setAddressFormOpen(false)}>×</button>
        <p className="eyebrow">{editingAddress ? "EDIT ALAMAT" : "ALAMAT BARU"} · {customer.name}</p>
        <h2>{editingAddress ? "Edit Alamat Pengiriman" : "Tambah Alamat Pengiriman"}</h2>

        <label>Nama Label *
          <input value={addrForm.label} onChange={e => setAddrForm({ ...addrForm, label: e.target.value })} placeholder="Contoh: Rumah, Pesantren, Kantor, Orang Tua" />
        </label>
        <label>Nama Penerima *
          <input value={addrForm.recipientName} onChange={e => setAddrForm({ ...addrForm, recipientName: e.target.value })} placeholder="Nama penerima paket" />
        </label>
        <label>No HP
          <input value={addrForm.phone} onChange={e => setAddrForm({ ...addrForm, phone: e.target.value })} placeholder="No. HP penerima" />
        </label>
        <label>Alamat Lengkap *
          <textarea value={addrForm.address} onChange={e => setAddrForm({ ...addrForm, address: e.target.value })} placeholder="Alamat lengkap pengiriman" />
        </label>
        <label>Patokan Rumah (opsional)
          <input value={addrForm.landmark} onChange={e => setAddrForm({ ...addrForm, landmark: e.target.value })} placeholder="Contoh: Depan masjid besar" />
        </label>
        <label>Kurir Favorit (opsional)
          <input value={addrForm.courier} onChange={e => setAddrForm({ ...addrForm, courier: e.target.value })} placeholder="Contoh: J&T, ID Express" />
        </label>
        <label>Catatan (opsional)
          <input value={addrForm.note} onChange={e => setAddrForm({ ...addrForm, note: e.target.value })} placeholder="Catatan pengiriman" />
        </label>
        <label className="checkbox-label">
          <input type="checkbox" checked={addrForm.isDefault} onChange={e => setAddrForm({ ...addrForm, isDefault: e.target.checked })} />
          Jadikan alamat default
        </label>

        <div className="form-actions">
          <button className="primary" onClick={saveAddress}><Check size={16} /> {editingAddress ? "Simpan Perubahan" : "Tambah Alamat"}</button>
        </div>
      </section>
    </div>}
  </main>;
}




function CollectionWorkspaceSection() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [showForm, setShowForm] = useState(false);

  // ===== HYDRATION FIX: Muat data dari localStorage setelah hydration =====
  useEffect(() => {
    setCollections(getCollections());
  }, []);
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

  const activeCount = collections.filter(c => c.status === "aktif").length;
  const doneCount = collections.filter(c => c.status === "selesai").length;
  const draftCount = collections.filter(c => c.status === "draft").length;
  const followUpCount = collections.filter(c => {
    const stats = getCollectionStats(c.id);
    return stats.unlinkedCustomers > 0 || stats.draftOrders > 0;
  }).length;

  const handleSave = () => {
    if (!form.name.trim()) return;
    const now = Date.now();
    const collection: Collection = {
      id: "col-" + Date.now(),
      name: form.name.trim(),
      type: form.type,
      status: form.status,
      icon: form.icon,
      color: form.color,
      description: form.description.trim() || undefined,
      owner: form.owner.trim() || undefined,
      tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    const updated = addCollection(collection);
    setCollections(updated);
    setShowForm(false);
  };

  return <section className="collection-workspace-section">
    <div className="collection-workspace-head">
      <div>
        <h2>Collection Workspace</h2>
        <p>Ruang kerja untuk Batch, Produk, Campaign, dan lainnya</p>
      </div>
      <button className="collection-add-btn" onClick={() => setShowForm(true)}><Plus size={15} /> Collection Baru</button>
    </div>

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

    <div className="collection-grid" style={{ marginTop: 14 }}>
      {collections.map(c => {
        const stats = getCollectionStats(c.id);
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

    {showForm && (
      <div className="overlay" onClick={() => setShowForm(false)}>
        <section className="modal collection-form" onClick={e => e.stopPropagation()}>
          <button className="close" onClick={() => setShowForm(false)}>×</button>
          <p className="eyebrow">COLLECTION BARU</p>
          <h2>Buat Collection Baru</h2>
          <label>Nama Collection *
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Contoh: PO Batch 9, Linen Spray" />
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
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Deskripsi collection" />
          </label>
          <label>Owner (opsional)
            <input value={form.owner} onChange={e => setForm({ ...form, owner: e.target.value })} placeholder="Nama owner" />
          </label>
          <label>Tags (pisahkan dengan koma)
            <input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="Contoh: amna, jilbab, po" />
          </label>
          <div className="form-actions">
            <button className="primary" onClick={handleSave}><Check size={16} /> Buat Collection</button>
          </div>
        </section>
      </div>
    )}
  </section>;
}

