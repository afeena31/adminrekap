"use client";

import { ArrowLeft, Bell, Check, ChevronRight, Copy, ExternalLink, Heart, MoreHorizontal, Package, Pencil, Plus, Search, ShoppingCart, SlidersHorizontal, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";


import { productCategories, formatRupiah, modifikasiInfo, ongkirInfo, splitShopeeInfo, rekeningInfo, nonBookMasterCatalog, type Product } from "../data/products";
import { getProducts, addProduct, updateProduct, deleteProduct, calculateProductMetrics, getWarehouses, getInventoryForProduct, getTotalAvailable, inventoryAvailable, setStock, type Warehouse } from "../data/store";
import { getCollections, type Collection } from "../data/collections";
import { MoneyInput } from "../components/MoneyInput";
import { BottomNav } from "../components/BottomNav";
import { goBack } from "../lib/goBack";

type ProductFormState = {
  id: string;
  name: string;
  category: string;
  price: string;
  originalPrice: string;
  modalKotor: string;
  biayaOperasional: string;
  feeMarketer: string;
  discountDefault: string;
  discountType: "percent" | "nominal";
  emoji: string;
  description: string;
  active: boolean;
  defaultCollectionIds: string[];
};

const emptyForm: ProductFormState = {
  id: "",
  name: "",
  category: "buku-parenting",
  price: "",
  originalPrice: "",
  modalKotor: "",
  biayaOperasional: "",
  feeMarketer: "",
  discountDefault: "",
  discountType: "percent",
  emoji: "📦",
  description: "",
  active: true,
  defaultCollectionIds: [],
};

const emojiOptions = ["📚", "📖", "🐝", "🧕", "🖤", "🧤", "🧦", "🌸", "🚚", "💰", "✨", "📦", "🎈", "🔤", "🔢", "🕌", "🌍", "✂️", "🧵", "🎀"];

export default function ProductsPage() {
  const [productList, setProductList] = useState<Product[]>([]);
  const [activeCategory, setActiveCategory] = useState("semua");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("terlaris");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [notice, setNotice] = useState("");
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [infoTab, setInfoTab] = useState("produk");
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductFormState>(emptyForm);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [collectionList, setCollectionList] = useState<Collection[]>([]);
  const [warehouseList, setWarehouseList] = useState<Warehouse[]>([]);
  const [stockModalProduct, setStockModalProduct] = useState<Product | null>(null);
  const [stockForm, setStockForm] = useState<Record<string, string>>({});

  const notify = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2600); };

  // ===== HYDRATION FIX: Muat data dari localStorage setelah hydration =====
  useEffect(() => {
    setProductList(getProducts());
    setCollectionList(getCollections());
    setWarehouseList(getWarehouses());
  }, []);

  // ===== KELOLA STOK — per gudang, per produk =====
  const openStockModal = (product: Product) => {
    const inv = getInventoryForProduct(product.id);
    const initial: Record<string, string> = {};
    getWarehouses().forEach(w => { initial[w.id] = String(inv.find(i => i.warehouseId === w.id)?.stockOnHand || 0); });
    setStockForm(initial);
    setStockModalProduct(product);
  };

  const handleSaveStock = () => {
    if (!stockModalProduct) return;
    warehouseList.forEach(w => {
      setStock(stockModalProduct.id, w.id, Number(stockForm[w.id]) || 0);
    });
    notify(`Stok ${stockModalProduct.name} diperbarui`);
    setStockModalProduct(null);
  };

  const toggleFormCollection = (collectionId: string) => {
    setForm(f => ({
      ...f,
      defaultCollectionIds: f.defaultCollectionIds.includes(collectionId)
        ? f.defaultCollectionIds.filter(id => id !== collectionId)
        : [...f.defaultCollectionIds, collectionId],
    }));
  };

  // Isi katalog ASLI (bukan demo) dari Master Data Bisnis — sengaja tidak
  // termasuk buku sama sekali. Dicek dulu per-ID biar aman diklik berkali-kali
  // tanpa bikin dobel.
  const loadMasterCatalog = () => {
    const existingIds = new Set(getProducts().map(p => p.id));
    let added = 0;
    for (const p of nonBookMasterCatalog) {
      if (!existingIds.has(p.id)) { addProduct(p); added++; }
    }
    setProductList(getProducts());
    notify(added > 0 ? `${added} produk dari Master Data dimuat` : "Katalog Master Data sudah lengkap");
  };

  const filtered = productList.filter(p => {

    const matchCategory = activeCategory === "semua" || p.category === activeCategory;
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    return matchCategory && matchSearch;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "termurah") return a.price - b.price;
    if (sortBy === "termahal") return b.price - a.price;
    return 0;
  });

  const cartCount = Object.values(cart).reduce((sum, n) => sum + n, 0);
  const cartTotal = Object.entries(cart).reduce((sum, [id, qty]) => {
    const p = productList.find(x => x.id === id);
    return sum + (p ? p.price * qty : 0);
  }, 0);

  const addToCart = (product: Product) => {
    setCart(prev => ({ ...prev, [product.id]: (prev[product.id] || 0) + 1 }));
    notify(`${product.name} ditambahkan ke keranjang`);
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard?.writeText(text);
    notify(`${label} disalin`);
  };

  const openAddForm = () => {
    setEditingProduct(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEditForm = (product: Product) => {
    setEditingProduct(product);
    setForm({
      id: product.id,
      name: product.name,
      category: product.category,
      price: String(product.price || ""),
      originalPrice: product.originalPrice ? String(product.originalPrice) : "",
      // Produk lama cuma punya `hpp` tanpa rincian — taruh semua di modal kotor
      // supaya Total HPP tetap sama persis, biaya operasional mulai dari 0.
      modalKotor: product.modalKotor ? String(product.modalKotor) : (product.hpp ? String(product.hpp) : ""),
      biayaOperasional: product.biayaOperasional ? String(product.biayaOperasional) : "",
      feeMarketer: product.feeMarketer ? String(product.feeMarketer) : "",
      discountDefault: product.discountDefault ? String(product.discountDefault) : "",
      discountType: product.discountType || "percent",
      emoji: product.emoji || "📦",
      description: product.description || "",
      active: product.active !== false,
      defaultCollectionIds: product.defaultCollectionIds || [],
    });
    setShowForm(true);
  };

  const handleSaveProduct = () => {
    if (!form.name.trim()) { notify("Nama produk wajib diisi"); return; }
    const price = Number(form.price) || 0;
    if (price <= 0) { notify("Harga jual wajib diisi"); return; }

    const modalKotor = Number(form.modalKotor) || 0;
    const biayaOperasional = Number(form.biayaOperasional) || 0;
    const product: Product = {
      // Field yang gak punya kontrol form (variants — warna/ukuran preset
      // dari Master Data) HARUS dibawa dari produk lama saat diedit, jangan
      // sampai objek baru ini nimpa jadi undefined & warnanya hilang diam-diam.
      variants: editingProduct?.variants,
      id: editingProduct ? editingProduct.id : "prod-" + Date.now(),
      name: form.name.trim(),
      category: form.category,
      price,
      originalPrice: form.originalPrice ? Number(form.originalPrice) : undefined,
      modalKotor: modalKotor || undefined,
      biayaOperasional: biayaOperasional || undefined,
      hpp: (modalKotor + biayaOperasional) || undefined,
      feeMarketer: form.feeMarketer ? Number(form.feeMarketer) : undefined,
      discountDefault: form.discountDefault ? Number(form.discountDefault) : undefined,
      discountType: form.discountType,
      emoji: form.emoji,
      description: form.description || undefined,
      active: form.active,
      defaultCollectionIds: form.defaultCollectionIds.length > 0 ? form.defaultCollectionIds : undefined,
    };

    if (editingProduct) {
      const updated = updateProduct(product);
      setProductList(updated);
      notify("Produk berhasil diperbarui");
    } else {
      const updated = addProduct(product);
      setProductList(updated);
      notify("Produk baru berhasil ditambahkan");
    }
    setShowForm(false);
  };

  const handleDeleteProduct = () => {
    if (!editingProduct) return;
    const updated = deleteProduct(editingProduct.id);
    setProductList(updated);
    setShowDeleteConfirm(false);
    setShowForm(false);
    notify("Produk dihapus");
  };

  const toggleActive = (product: Product) => {
    const updated = updateProduct({ ...product, active: product.active !== false ? false : true });
    setProductList(updated);
    notify(product.active !== false ? `${product.name} dinonaktifkan` : `${product.name} diaktifkan`);
  };

  return <main className="app-shell products-page">
    <header className="topbar">
      <button className="icon-btn" aria-label="Kembali" onClick={goBack}><ArrowLeft size={21} /></button>

      <div className="brand">UmayasLa<span>·</span> Katalog</div>
      <div className="header-actions">
        <button className="icon-btn" onClick={() => notify("Keranjang berisi " + cartCount + " item")}><ShoppingCart size={19} /><span className="cart-badge">{cartCount}</span></button>
        <button className="icon-btn"><MoreHorizontal size={21} /></button>
      </div>
    </header>

    <div className="products-hero">
      <h1>Master Price List</h1>
      <p>Afeena & Yasla · {productList.length} produk</p>
    </div>

    <div className="info-tabs">
      <button className={infoTab === "produk" ? "active" : ""} onClick={() => setInfoTab("produk")}>🛍️ Produk</button>
      <button className={infoTab === "modifikasi" ? "active" : ""} onClick={() => setInfoTab("modifikasi")}>✂️ Modifikasi</button>
      <button className={infoTab === "ongkir" ? "active" : ""} onClick={() => setInfoTab("ongkir")}>🚚 Ongkir</button>
      <button className={infoTab === "shopee" ? "active" : ""} onClick={() => setInfoTab("shopee")}>🛒 Split Shopee</button>
      <button className={infoTab === "rekening" ? "active" : ""} onClick={() => setInfoTab("rekening")}>🏦 Rekening</button>
    </div>

    {infoTab === "produk" && <>
      <div className="products-search">
        <Search size={18} />
        <input placeholder="Cari produk..." value={search} onChange={e => setSearch(e.target.value)} />
        <button className="filter-btn" onClick={() => notify("Filter produk")}><SlidersHorizontal size={18} /></button>
      </div>

      <div className="category-chips">
        <button className={activeCategory === "semua" ? "active" : ""} onClick={() => setActiveCategory("semua")}>✨ Semua</button>
        {productCategories.map(cat => (
          <button key={cat.id} className={activeCategory === cat.id ? "active" : ""} onClick={() => setActiveCategory(cat.id)}>
            {cat.emoji} {cat.name}
          </button>
        ))}
      </div>

      <div className="products-toolbar">
        <span>{sorted.length} produk</span>
        <div className="toolbar-actions">
          <button className="add-product-btn" onClick={openAddForm}><Plus size={15} /> Tambah Produk</button>
          <label>Urutkan
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="terlaris">Terlaris</option>
              <option value="termurah">Termurah</option>
              <option value="termahal">Termahal</option>
            </select>
          </label>
        </div>
      </div>

      <div className="product-grid">
        {sorted.map(product => {
          const metrics = calculateProductMetrics(product);
          return (
            <article className={`product-card ${product.active === false ? "inactive" : ""}`} key={product.id} onClick={() => setDetailProduct(product)}>
              <div className="product-thumb">
                <span className="product-emoji">{product.emoji}</span>
                {product.badge && <span className="product-badge">{product.badge}</span>}
                {product.active === false && <span className="product-inactive-tag">Nonaktif</span>}
                <button className="product-wishlist" onClick={e => { e.stopPropagation(); notify(`${product.name} disimpan`); }}><Heart size={16} /></button>
              </div>
              <div className="product-info">
                <h3>{product.name}</h3>
                {product.description && <p className="product-desc">{product.description}</p>}
                <div className="product-price">
                  <b>{formatRupiah(product.price)}</b>
                  {product.originalPrice && <s>{formatRupiah(product.originalPrice)}</s>}
                </div>
                {metrics.discountAmount > 0 && <div className="product-metrics">
                  <span className="metric-chip discount">-{formatRupiah(metrics.discountAmount)}</span>
                  <span className="metric-chip profit">Laba {formatRupiah(metrics.grossProfit)}</span>
                </div>}
                {warehouseList.length > 0 && (() => {
                  const stok = getTotalAvailable(product.id);
                  return <div className="product-metrics">
                    <span className={`metric-chip ${stok > 0 ? "profit" : "discount"}`}>{stok > 0 ? `📦 Stok ${stok}` : "📦 Stok Habis"}</span>
                  </div>;
                })()}
                <div className="product-card-actions">
                  <button className="product-add" onClick={e => { e.stopPropagation(); addToCart(product); }}><Plus size={16} /> Tambah</button>
                  <button className="product-edit" onClick={e => { e.stopPropagation(); openStockModal(product); }} title="Kelola Stok"><Package size={14} /></button>
                  <button className="product-edit" onClick={e => { e.stopPropagation(); openEditForm(product); }}><Pencil size={14} /></button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {sorted.length === 0 && productList.length === 0 && (
        <div className="empty-state">
          <span>🛍️</span>
          <h3>Katalog masih kosong</h3>
          <p>Muat produk Jilbab, Niqab, Manset, Kaos Kaki & Linen Spray sesuai Master Data — buku belum termasuk, input manual lewat "Tambah Produk".</p>
          <button className="primary" style={{ marginTop: 14 }} onClick={loadMasterCatalog}>Muat Katalog Master Data (Non-Buku)</button>
        </div>
      )}
      {sorted.length === 0 && productList.length > 0 && <div className="empty-state"><span>🔍</span><h3>Tidak ada produk ditemukan</h3><p>Coba kata kunci atau kategori lain</p></div>}
    </>}

    {infoTab === "modifikasi" && <div className="info-section">
      <h2>Request / Modifikasi</h2>
      <p className="info-sub">Tambahan biaya untuk modifikasi Amna Jilbab</p>
      {modifikasiInfo.map(item => (
        <div className="info-card" key={item.name}>
          <span className="info-emoji">{item.emoji}</span>
          <div className="info-main">
            <b>{item.name}</b>
            {item.note && <small>{item.note}</small>}
          </div>
          <span className="info-price">{item.price > 0 ? `+${formatRupiah(item.price)}` : "Kesepakatan"}</span>
        </div>
      ))}
    </div>}

    {infoTab === "ongkir" && <div className="info-section">
      <h2>Ongkir</h2>
      <p className="info-sub">Tarif pengiriman</p>
      {ongkirInfo.map(item => (
        <div className="info-card" key={item.name}>
          <span className="info-emoji">{item.emoji}</span>
          <div className="info-main">
            <b>{item.name}</b>
            {item.note && <small>{item.note}</small>}
          </div>
          <span className="info-price">{item.price ? formatRupiah(item.price) : "Menyesuaikan"}</span>
        </div>
      ))}
    </div>}

    {infoTab === "shopee" && <div className="info-section">
      <h2>Split Shopee</h2>
      <p className="info-sub">Perhitungan biaya saat checkout via Shopee</p>
      {splitShopeeInfo.map(item => (
        <div className="info-card shopee-card" key={item.name}>
          <span className="info-emoji">{item.emoji}</span>
          <div className="info-main">
            <b>{item.name}</b>
            <small>{item.note}</small>
            <small>{item.detail}</small>
            {item.shopee != null && <div className="shopee-row"><span>Total Checkout Shopee</span><b>{formatRupiah(item.shopee)}</b></div>}
            <div className="shopee-row"><span>Transfer Manual</span><b>{item.transfer}</b></div>
            <a href={item.link} target="_blank" rel="noreferrer" className="shopee-link">Buka Link Shopee <ExternalLink size={12} /></a>
          </div>
        </div>
      ))}
      <div className="info-note">
        <b>Catatan:</b>
        <ul>
          <li>Untuk invoice DP Amna, DP tetap Rp100.000.</li>
          <li>Potongan Rp1.500 baru mengurangi pelunasan produk, bukan pembayaran DP.</li>
          <li>Jika checkout full melalui Shopee, ongkir mengikuti tarif Shopee.</li>
        </ul>
      </div>
    </div>}

    {infoTab === "rekening" && <div className="info-section">
      <h2>Rekening</h2>
      <p className="info-sub">Rekening tujuan pembayaran per kategori</p>
      {rekeningInfo.map(item => (
        <div className="info-card rekening-card" key={item.name}>
          <span className="info-emoji">{item.emoji}</span>
          <div className="info-main">
            <b>{item.name}</b>
            <small>{item.bank}</small>
            <div className="rekening-number">
              <b>{item.number}</b>
              <button onClick={() => copyText(item.number, "Nomor rekening")}><Copy size={14} /></button>
            </div>
            <small>a/n {item.owner}</small>
          </div>
        </div>
      ))}
    </div>}

    {cartCount > 0 && (
      <div className="cart-bar">
        <div className="cart-bar-info">
          <b>{cartCount} item</b>
          <span>{formatRupiah(cartTotal)}</span>
        </div>
        <button onClick={() => notify("Checkout akan segera hadir")}>Lihat Keranjang <ChevronRight size={16} /></button>
      </div>
    )}

    <BottomNav />


    {notice && <div className="toast"><Check size={17} />{notice}</div>}

    {detailProduct && (
      <div className="overlay" onClick={() => setDetailProduct(null)}>
        <section className="modal product-detail" onClick={e => e.stopPropagation()}>
          <button className="close" onClick={() => setDetailProduct(null)}>×</button>
          <div className="detail-thumb"><span className="product-emoji large">{detailProduct.emoji}</span></div>
          <div className="detail-body">
            <span className="detail-category">{productCategories.find(c => c.id === detailProduct.category)?.name}</span>
            <h2>{detailProduct.name}</h2>
            {detailProduct.description && <p>{detailProduct.description}</p>}
            {detailProduct.variants && (
              <div className="detail-variants">
                <small>Pilihan warna:</small>
                <div className="variant-chips">{detailProduct.variants.map(v => <span key={v}>{v}</span>)}</div>
              </div>
            )}
            <div className="detail-price">
              <b>{formatRupiah(detailProduct.price)}</b>
              {detailProduct.originalPrice && <s>{formatRupiah(detailProduct.originalPrice)}</s>}
            </div>
            {(() => {
              const m = calculateProductMetrics(detailProduct);
              return (
                <div className="detail-metrics">
                  <div className="detail-metric-row"><span>HPP / Modal</span><b>{formatRupiah(m.hpp)}</b></div>
                  <div className="detail-metric-row"><span>Diskon</span><b>{m.discountAmount > 0 ? `-${formatRupiah(m.discountAmount)}` : "—"}</b></div>
                  <div className="detail-metric-row"><span>Harga setelah diskon</span><b>{formatRupiah(m.priceAfterDiscount)}</b></div>
                  <div className="detail-metric-row highlight"><span>Laba kotor / pcs</span><b>{formatRupiah(m.grossProfit)}</b></div>
                  {detailProduct.feeMarketer ? <div className="detail-metric-row"><span>Fee marketer / pcs</span><b>{formatRupiah(detailProduct.feeMarketer)}</b></div> : null}
                </div>
              );
            })()}
            <div className="detail-actions">
              <button className="primary" onClick={() => { addToCart(detailProduct); setDetailProduct(null); }}><ShoppingCart size={17} /> Tambah ke Keranjang</button>
              <button className="secondary" onClick={() => { openEditForm(detailProduct); setDetailProduct(null); }}><Pencil size={15} /> Edit Produk</button>
            </div>
          </div>
        </section>
      </div>
    )}

    {/* ===== ADD/EDIT PRODUCT FORM ===== */}
    {showForm && (
      <div className="overlay" onClick={() => setShowForm(false)}>
        <section className="modal product-form" onClick={e => e.stopPropagation()}>
          <button className="close" onClick={() => setShowForm(false)}>×</button>
          <p className="eyebrow">{editingProduct ? "EDIT PRODUK" : "PRODUK BARU"}</p>
          <h2>{editingProduct ? "Edit Produk" : "Tambah Produk Baru"}</h2>

          <label>Nama Produk *
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Contoh: Amna Jilbab M · Polos" />
          </label>

          <label>Kategori
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              {productCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.emoji} {cat.name}</option>)}
            </select>
          </label>

          <div className="form-grid-2">
            <label>Harga Jual (Rp) *
              <MoneyInput value={Number(form.price) || 0} onChange={n => setForm({ ...form, price: n ? String(n) : "" })} placeholder="250.000" />
            </label>
            <label>Harga Normal (Rp)
              <MoneyInput value={Number(form.originalPrice) || 0} onChange={n => setForm({ ...form, originalPrice: n ? String(n) : "" })} placeholder="Opsional" />
            </label>
          </div>

          <div className="form-grid-2">
            <label>Modal Kotor (Rp)
              <MoneyInput value={Number(form.modalKotor) || 0} onChange={n => setForm({ ...form, modalKotor: n ? String(n) : "" })} placeholder="150.000" />
            </label>
            <label>Biaya Operasional (Rp)
              <MoneyInput value={Number(form.biayaOperasional) || 0} onChange={n => setForm({ ...form, biayaOperasional: n ? String(n) : "" })} placeholder="30.000" />
            </label>
          </div>
          <div className="hpp-total-preview">Total HPP: <b>{formatRupiah((Number(form.modalKotor) || 0) + (Number(form.biayaOperasional) || 0))}</b></div>

          <label>Fee Marketer (Rp/pcs)
            <MoneyInput value={Number(form.feeMarketer) || 0} onChange={n => setForm({ ...form, feeMarketer: n ? String(n) : "" })} placeholder="Kosongkan / 0 kalau produk ini tidak pakai fee marketer" />
          </label>

          <label>Diskon Default
            <div className="discount-input-row">
              <select value={form.discountType} onChange={e => setForm({ ...form, discountType: e.target.value as "percent" | "nominal" })}>
                <option value="percent">Persen (%)</option>
                <option value="nominal">Nominal (Rp)</option>
              </select>
              {form.discountType === "percent" ? (
                <input type="number" min="0" max="100" value={form.discountDefault} onChange={e => setForm({ ...form, discountDefault: e.target.value })} placeholder="10" />
              ) : (
                <MoneyInput value={Number(form.discountDefault) || 0} onChange={n => setForm({ ...form, discountDefault: n ? String(n) : "" })} placeholder="20.000" />
              )}
            </div>
          </label>

          <label>Emoji
            <div className="emoji-picker">
              {emojiOptions.map(e => (
                <button key={e} className={form.emoji === e ? "selected" : ""} onClick={() => setForm({ ...form, emoji: e })}>{e}</button>
              ))}
            </div>
          </label>

          <label>Deskripsi (opsional)
            <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Catatan singkat" />
          </label>

          <label>Collection Default (opsional)
            {collectionList.length === 0 ? (
              <p className="field-hint" style={{ margin: "4px 0 0" }}>Belum ada Collection — buat dulu di tab Collection Workspace.</p>
            ) : (
              <>
                <p className="field-hint" style={{ margin: "4px 0 10px" }}>Tiap produk ini ditambahkan ke order, Collection yang dicentang di sini otomatis ikut tercentang juga — gak perlu pilih manual tiap order lagi.</p>
                <div className="category-chips">
                  {collectionList.map(c => (
                    <button
                      type="button"
                      key={c.id}
                      className={`category-chip ${form.defaultCollectionIds.includes(c.id) ? "active" : ""}`}
                      onClick={() => toggleFormCollection(c.id)}
                    >
                      {c.icon} {c.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </label>

          <label className="checkbox-label">
            <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} />
            Produk aktif
          </label>

          {(() => {
            const price = Number(form.price) || 0;
            const hpp = (Number(form.modalKotor) || 0) + (Number(form.biayaOperasional) || 0);
            const discVal = Number(form.discountDefault) || 0;
            const discAmt = form.discountType === "percent" ? Math.round(price * Math.min(discVal, 100) / 100) : Math.min(discVal, price);
            const afterDisc = price - discAmt;
            const profit = afterDisc - hpp;
            return (
              <div className="form-preview">
                <div><span>Harga jual</span><b>{formatRupiah(price)}</b></div>
                <div><span>Diskon</span><b>{discAmt > 0 ? `-${formatRupiah(discAmt)}` : "—"}</b></div>
                <div><span>Harga setelah diskon</span><b>{formatRupiah(afterDisc)}</b></div>
                <div><span>HPP</span><b>{formatRupiah(hpp)}</b></div>
                <div className="highlight"><span>Laba kotor / pcs</span><b>{formatRupiah(profit)}</b></div>
              </div>
            );
          })()}

          <div className="form-actions">
            {editingProduct && <button className="danger" onClick={() => setShowDeleteConfirm(true)}><Trash2 size={15} /> Hapus</button>}
            <button className="primary" onClick={handleSaveProduct}><Check size={16} /> {editingProduct ? "Simpan Perubahan" : "Tambah Produk"}</button>
          </div>
        </section>
      </div>
    )}

    {/* ===== DELETE CONFIRM ===== */}
    {showDeleteConfirm && (
      <div className="overlay" onClick={() => setShowDeleteConfirm(false)}>
        <section className="modal confirm-modal" onClick={e => e.stopPropagation()}>
          <h2>Hapus Produk?</h2>
          <p>Produk <b>{editingProduct?.name}</b> akan dihapus permanen dari daftar.</p>
          <div className="confirm-actions">
            <button className="secondary" onClick={() => setShowDeleteConfirm(false)}>Batal</button>
            <button className="danger" onClick={handleDeleteProduct}><Trash2 size={15} /> Hapus</button>
          </div>
        </section>
      </div>
    )}

    {stockModalProduct && (
      <div className="overlay" onClick={() => setStockModalProduct(null)}>
        <section className="modal marketer-modal" onClick={e => e.stopPropagation()}>
          <button className="close" onClick={() => setStockModalProduct(null)}>×</button>
          <p className="eyebrow">KELOLA STOK</p>
          <h2>{stockModalProduct.emoji} {stockModalProduct.name}</h2>
          {warehouseList.length === 0 ? (
            <p className="field-hint">Belum ada gudang terdaftar.</p>
          ) : (
            warehouseList.map(w => (
              <label key={w.id}>{w.name} ({w.code})
                <input
                  type="number"
                  min="0"
                  value={stockForm[w.id] ?? "0"}
                  onChange={e => setStockForm({ ...stockForm, [w.id]: e.target.value })}
                  placeholder="0"
                />
              </label>
            ))
          )}
          <p className="marketer-modal-hint">Angka di sini adalah stok fisik yang benar-benar ada di gudang sekarang — dipakai buat mengurangi otomatis tiap ada order "Ready Stock", dan buat koreksi manual (barang baru datang, hasil cek fisik, dst).</p>
          <div className="form-actions">
            <button className="primary" onClick={handleSaveStock}><Check size={16} /> Simpan Stok</button>
          </div>
        </section>
      </div>
    )}
  </main>;
}
