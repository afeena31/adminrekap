"use client";


import { ArrowLeft, Bell, Box, Check, ChevronRight, ClipboardList, Clock, CreditCard, Heart, Home, MapPin, MessageCircle, MoreHorizontal, Plus, Search, ShoppingBag, Truck, UserRound, Users, Wallet } from "lucide-react";


import Link from "next/link";
import { useState, useEffect } from "react";
import { createNewCustomer, toDisplayCustomer, EMPTY_CUSTOMER, type Customer, type CustomerAddress } from "./data/customers";
import { getCustomers, getCustomer, addCustomer, updateCustomer as updateCentralCustomer, addAddress, updateAddress as updateCentralAddress, deleteAddress as deleteCentralAddress, getCustomerAddresses as getCentralCustomerAddresses, softDeleteCustomer, backupLocalStorage } from "./data/central";
import { Overview, CustomerPanel } from "./components/panels";
import { getCollections, getCollectionStats, addCollection, collectionTypeInfo, collectionStatusInfo, collectionColors, collectionIcons, type Collection, type CollectionType, type CollectionStatus } from "./data/collections";
import { demoCustomers, demoAddresses, demoCustomerIds } from "./data/demoSeed";

import { formatRupiah } from "./data/store";
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
} from "./data/operations";



const tabs = ["Ringkasan", "Order (6)", "Payment (4)", "Shipment (4)", "Marketer", "Batch", "Resi", "Alamat Pengiriman", "Catatan (3)", "Aktivitas"];



const metrics = [
  { label: "Total Order", value: "6", note: "6 order sepanjang hubungan", icon: ClipboardList, tone: "olive", progress: 100 },
  { label: "Total Payment", value: "Rp 1.245.000", note: "75% invoice selesai", icon: CreditCard, tone: "brown", progress: 75 },
  { label: "Outstanding", value: "Rp 212.000", note: "2 invoice menunggu", icon: Box, tone: "sand", progress: 40 },
  { label: "Total Shipment", value: "4", note: "4 paket terkirim", icon: Truck, tone: "olive", progress: 100 },
];

function loadFirstCustomer(): Customer {
  const first = getCustomers()[0];
  return first ? toDisplayCustomer(first, getCentralCustomerAddresses(first.id)) : EMPTY_CUSTOMER;
}

export default function HomePage() {
  const [activeTab, setActiveTab] = useState("Ringkasan");
  const [saved, setSaved] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const [finderOpen, setFinderOpen] = useState(false);
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [newOrderOpen, setNewOrderOpen] = useState(false);
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
  const [ops, setOps] = useState<CustomerOperations>(() => getOperations("-"));
  const notify = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2600); };

  // ===== HYDRATION FIX: muat customer asli dari localStorage setelah mount =====
  useEffect(() => {
    setCustomer(loadFirstCustomer());
  }, []);

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
    for (const a of demoAddresses) {
      addAddress(a);
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

  // ===== OPERATIONS: AKSI → STATUS (state machine) =====
  // Filosofi: Admin tidak memilih status — admin memilih AKSI, sistem mengubah status.
  const handleOrderAction = (cardId: string, action: ActionType) => {
    const updated = performAction(customer.id, cardId, action);
    setOps(updated);
    notify(`${actionTypeInfo[action].name} diterapkan`);
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

  // Belum ada customer sama sekali (localStorage kosong) — tampilkan layar
  // kosong yang jelas, bukan crash atau halaman utama yang isinya string kosong.
  if (customer.id === "") {
    return <main className="app-shell">
      <header className="topbar">
        <div className="brand">UmayasLa<span>·</span></div>
        <div className="header-actions"><button className="icon-btn" onClick={() => setSettingsOpen(true)}><MoreHorizontal size={21} /></button></div>
      </header>
      <div className="empty-state" style={{ marginTop: 40 }}>
        <span>👋</span>
        <h3>Belum ada customer</h3>
        <p>Tambah customer pertama, atau muat data demo untuk melihat contoh tampilannya.</p>
        <button className="primary" style={{ marginTop: 16 }} onClick={() => setNewCustomerOpen(true)}><Plus size={16} /> Tambah Customer Baru</button>
        <button className="quiet" style={{ marginTop: 8 }} onClick={loadDemoData}>Muat Data Demo</button>
      </div>
      {newCustomerOpen && <NewCustomerForm onClose={() => setNewCustomerOpen(false)} onSave={(name, city) => { handleCreateCustomer(name, city); setNewCustomerOpen(false); notify(`Profil ${name} berhasil dibuat`); }}/>}
      {notice && <div className="toast"><Check size={17}/>{notice}</div>}
    </main>;
  }

  return <main className="app-shell">

    <header className="topbar">
      <button className="icon-btn" aria-label="Kembali" onClick={() => window.history.back()}><ArrowLeft size={21} /></button>

      <div className="brand">UmayasLa<span>·</span></div>
      <div className="header-actions"><Link href="/products" className="icon-btn" aria-label="Katalog produk"><ShoppingBag size={19} /></Link><button className="icon-btn"><Bell size={19} /></button><button className="icon-btn" onClick={() => setSettingsOpen(true)}><MoreHorizontal size={21} /></button></div>
    </header>
    <button className="customer-finder" onClick={() => setFinderOpen(true)}><Search size={17}/><span>Cari atau pindah customer...</span><kbd>⌘ K</kbd></button>

    <section className="profile">
      <div className="avatar"><div className="hijab">◖</div><span>✦</span></div>
      <div className="profile-copy"><h1>{customer.name}</h1><p className="badge"><Heart size={13} fill="currentColor" /> {customer.orders === "0" ? "Customer Baru" : "Repeat Customer"}</p><p><MapPin size={15} /> {customer.city}</p><p><ClipboardList size={14} /> Sejak {customer.since}</p></div>
      <div className="profile-actions"><button className="chat" onClick={() => setChatOpen(true)}><MessageCircle size={17} /> Chat</button><Link href="/order" className="add-order"><Plus size={17} /> Order</Link><button onClick={() => { setSaved(!saved); notify(!saved ? "Customer disimpan ke favorit" : "Customer dihapus dari favorit"); }} className={saved ? "saved" : "save"} aria-label="Simpan customer"><Heart size={18} fill={saved ? "currentColor" : "none"} /></button></div>

      {/* ===== SITUATION STRIP — kondisi customer saat ini ===== */}
      <div className="situation-strip">
        <div className="situation-item"><small>Lifetime Value</small><b>{customer.paid}</b></div>
        <div className="situation-item"><small>Outstanding</small><b className="situation-warn">{customer.outstanding}</b></div>
        <div className="situation-item"><small>Order Aktif</small><b>{ops.productCards.filter(c => c.nextAction !== "tidak-ada").length} produk</b></div>
        <div className="situation-item"><small>Produksi</small><b>{ops.productCards.filter(c => c.progressStatus === "produksi" || c.progressStatus === "qc").length} berjalan</b></div>
        <div className="situation-item"><small>Pengiriman</small><b>{ops.productCards.filter(c => c.shipmentStatus === "menunggu-pickup" || c.shipmentStatus === "dalam-perjalanan").length} aktif</b></div>

        <div className="situation-item"><small>Prioritas</small><b className="situation-priority">{ops.actionCenter.length > 0 ? `${ops.actionCenter.length} aksi` : "Tenang"}</b></div>
      </div>
    </section>

    <section className="metrics" aria-label="Ringkasan customer">{metrics.map(({ label, value, note, icon: Icon, tone, progress }) => { const currentValue = label === "Total Order" ? customer.orders : label === "Total Payment" ? customer.paid : label === "Outstanding" ? customer.outstanding : label === "Total Shipment" ? customer.shipment : value; return <article className="metric" key={label}><div className={`metric-icon ${tone}`}><Icon size={21} /></div><small>{label}</small><strong>{currentValue}</strong><em>{note}</em><div className="metric-track"><div className={`metric-fill ${tone}`} style={{ width: `${progress}%` }} /></div></article>})}</section>


    <nav className="tabs" aria-label="Navigasi profil">{tabs.map(tab => <button key={tab} className={activeTab === tab ? "active" : ""} onClick={() => setActiveTab(tab)}>{tab}</button>)}</nav>
    <button className="mobile-add-order" onClick={() => setNewOrderOpen(true)}><Plus size={17}/> Tambah Order untuk {customer.name}</button>

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
    ) : activeTab === "Ringkasan" ? <Overview customer={customer} onTab={setActiveTab} onOrder={() => setOrderOpen(true)} /> : <CustomerPanel customer={customer} tab={activeTab} onOrder={() => setOrderOpen(true)} />}

    {/* ===== COLLECTION WORKSPACE SECTION ===== */}
    <CollectionWorkspaceSection />

    <nav className="bottom-nav"><Link href="/dashboard" className="nav-link"><Home /><span>Dashboard</span></Link><Link href="/order" className="nav-link"><ShoppingBag /><span>Order</span></Link><button className="current" onClick={() => setActiveTab("Ringkasan")}><Users /><span>Customer</span></button><Link href="/fees" className="nav-link"><Wallet /><span>Fee</span></Link><Link href="/marketers" className="nav-link"><UserRound /><span>Marketer</span></Link></nav>




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
    {settingsOpen && <div className="overlay" onClick={() => setSettingsOpen(false)}>
      <section className="modal" onClick={event => event.stopPropagation()}>
        <button className="close" onClick={() => setSettingsOpen(false)}>×</button>
        <h2>Pengaturan</h2>
        <p className="muted" style={{ marginBottom: 14 }}>Data Demo</p>
        <p style={{ fontSize: 13, color: "#8a7c6c", marginBottom: 14 }}>Muat 3 contoh customer untuk melihat tampilan aplikasi, atau sembunyikan kalau sudah tidak diperlukan. Bisa dipulihkan dari backup lokal kapan saja.</p>
        <div className="form-actions" style={{ flexDirection: "column", gap: 8 }}>
          <button className="chat" onClick={() => { loadDemoData(); setSettingsOpen(false); }}>Muat Data Demo</button>
          <button className="quiet" onClick={() => { clearDemoData(); setSettingsOpen(false); }}>Sembunyikan Data Demo</button>
        </div>
      </section>
    </div>}
    {newOrderOpen && <NewOrderForm customerName={customer.name} onClose={() => setNewOrderOpen(false)} onSave={(total) => { setNewOrderOpen(false); setActiveTab("Order (6)"); notify(`Order baru dibuat · Total Rp ${total.toLocaleString("id-ID")}`); }}/>}
    {chatOpen && <div className="overlay" onClick={() => setChatOpen(false)}><section className="modal" onClick={event => event.stopPropagation()}><button className="close" onClick={() => setChatOpen(false)}>×</button><div className="chat-title"><span className="mini-avatar">{customer.initials}</span><div><b>{customer.name}</b><small>WhatsApp customer</small></div></div><div className="message">Assalamu'alaikum {customer.name.split(" ")[0]}, ada yang bisa kami bantu?</div><div className="composer"><input placeholder="Tulis pesan..."/><button onClick={() => { setChatOpen(false); notify("Pesan siap dikirim ke WhatsApp"); }}>Kirim</button></div></section></div>}
    {orderOpen && <OrderDetailModal customer={customer} ops={ops} onClose={() => setOrderOpen(false)} onAction={handleOrderAction} />}


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


function NewCustomerForm({ onClose, onSave }: { onClose: () => void; onSave: (name: string, city: string) => void }) { const [name, setName] = useState(""); const [city, setCity] = useState(""); return <div className="overlay" onClick={onClose}><section className="modal new-form" onClick={event => event.stopPropagation()}><button className="close" onClick={onClose}>×</button><h2>Customer Baru</h2><p>Mulai dari profilnya. Order pertama dapat ditambahkan setelah ini.</p><label>Nama customer<input value={name} onChange={event => setName(event.target.value)} placeholder="Contoh: Ummu Maryam"/></label><label>Kota / domisili<input value={city} onChange={event => setCity(event.target.value)} placeholder="Contoh: Jakarta Timur"/></label><button className="primary" disabled={!name.trim()} onClick={() => onSave(name.trim(), city.trim() || "Belum diisi")}>Buat Profil Customer</button></section></div> }

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
// Menentukan SATU kondisi utama per item, dari 5 dimensi status di ProductStatusCard.
// Prioritas: fulfillment bermasalah > pembayaran belum lunas > hold > progres produksi > pengiriman > selesai.
function derivePrimaryCondition(card: ProductStatusCard): { name: string; emoji: string; tone: string } {
  if (
    card.progressStatus === "retur" ||
    card.fulfillmentDecision === "retur" ||
    card.fulfillmentDecision === "batal" ||
    card.fulfillmentDecision === "cancel-po" ||
    card.fulfillmentDecision === "cancel-tanpa-konfirmasi"
  ) {
    return fulfillmentDecisionInfo[card.fulfillmentDecision] ?? progressStatusInfo["retur"];
  }
  if (card.paymentStatus !== "lunas" && card.paymentStatus !== "refund") {
    return paymentStatusInfo[card.paymentStatus];
  }
  if (card.fulfillmentDecision === "hold-customer" || card.fulfillmentDecision === "hold-admin") {
    return fulfillmentDecisionInfo[card.fulfillmentDecision];
  }
  if (card.progressStatus !== "selesai") {
    return progressStatusInfo[card.progressStatus];
  }
  if (card.shipmentStatus !== "delivered") {
    return shipmentStatusInfo[card.shipmentStatus];
  }
  return progressStatusInfo["selesai"];
}

// ===== ORDER DETAIL MODAL =====
// Menampilkan status order dari state machine (operations.ts).
// Admin tidak memilih status — admin memilih AKSI, sistem mengubah status otomatis.
function OrderDetailModal({ customer, ops, onClose, onAction }: { customer: Customer; ops: CustomerOperations; onClose: () => void; onAction: (cardId: string, action: ActionType) => void }) {
  const cards = ops.productCards;
  const latest = customer.overview.latestOrder;

  return <div className="overlay" onClick={onClose}>
    <section className="modal order-modal" onClick={event => event.stopPropagation()}>
      <button className="close" onClick={onClose}>×</button>

      <div className="order-modal-head">
        <h2>{latest.items.split("\n")[0]}</h2>
        <p className="muted">Dibuat {latest.date} · {latest.items.split("\n").length} item</p>
      </div>

      {latest.items.split("\n").map((item, index) => (
        <div className="line-item" key={index}><span>{item}</span><b>{latest.total}</b></div>
      ))}

      <div className="total"><span>Total</span><b>{latest.total}</b></div>

      {/* ===== STATUS ORDER — satu kondisi utama + satu aksi (anti-duplikasi) ===== */}
      {cards.length > 0 && (
        <div className="order-status-section">
          <p className="panel-hint">Satu kondisi utama per item — dikelola sistem dari aksi yang admin pilih.</p>
          {cards.map(card => {
            const primary = derivePrimaryCondition(card);
            const next = nextActionInfo[card.nextAction];
            const available = getAvailableActions(card);
            return (
              <div className="order-status-card" key={card.id}>
                <div className="order-status-title">
                  <span className="order-status-emoji">{card.emoji}</span>
                  <div>
                    <b>{card.productName}</b>
                    <small>{card.qty} pcs · {card.orderNumber}</small>
                  </div>
                </div>
                <div className="order-status-primary">
                  <span className={`psc-value ${primary.tone}`}>{primary.emoji} {primary.name}</span>
                  <span className="order-status-next"><small>⚡ Aksi</small><b className={`psc-value ${next.tone}`}>{next.emoji} {next.name}</b></span>
                </div>
                {card.blocker && <div className="order-status-blocker"><Clock size={14}/> {card.blocker}</div>}
                <div className="order-status-actions">
                  <p className="panel-hint">Pilih aksi — sistem akan mengubah status otomatis.</p>
                  <div className="action-buttons">
                    {available.map(a => (
                      <button key={a} className="action-btn" onClick={() => onAction(card.id, a)}>
                        {actionTypeInfo[a].emoji} {actionTypeInfo[a].name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button className="secondary" onClick={onClose}><Check size={16} /> Tutup</button>
    </section>
  </div>;
}


function CollectionWorkspaceSection() {
  const [collections, setCollections] = useState<Collection[]>(() => getCollections());
  const [showForm, setShowForm] = useState(false);
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

