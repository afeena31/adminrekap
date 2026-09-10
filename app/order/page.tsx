"use client";


import { ArrowLeft, Bell, Check, ChevronLeft, ChevronRight, Copy, FileText, MessageCircle, Minus, Plus, Search, Trash2, Landmark } from "lucide-react";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BottomNav } from "../components/BottomNav";
import { goBack } from "../lib/goBack";


import { formatRupiah, jilbabSizes, jilbabPads, jilbabModifikasi, AMNA_DEFAULT_FABRIC, AMNA_DEFAULT_COLOR, ongkirOptions, invoiceTypeInfo, determineRekening, SPLIT_BILL_PRODUK, type Product, type InvoiceType } from "../data/products";
import { toDisplayCustomer, createNewCustomer, EMPTY_CUSTOMER, type Customer, type CustomerAddress } from "../data/customers";
import { getProducts, getMarketers, getActiveMarketers, addMarketer, saveOrder, updateOrder, deleteOrder, getOrders, getOrderById, saveFee, removeFeeForOrder, getNextInvoiceNumber, getBatchNames, addBatchName, calculateDiscount, calculateOrderFee, getPaymentsForOrder, addPayment, deletePayment, markPaymentWithdrawn, removePaymentsForOrder, recordPaymentForOrder, productionStageOrder, productionStageInfo, shipmentStageInfo, getWarehouses, getTotalAvailable, adjustStock, getInventory, inventoryAvailable, type OrderItemSnapshot, type Inventory, type DiscountType, type OrderRecord, type FeeRecord, type PaymentRecord, type ProductionStage, type ShipmentStage, type CustomRequest, type Marketer, type MarketerStatus, type Warehouse } from "../data/store";
import { getCustomers, getCustomer as getCentralCustomer, addCustomer, getCustomerAddresses, addAddress } from "../data/central";
import { getOrCreateBatchCollection, syncOrderBatchCollection, removeOrderFromAllCollections, getCollections, getCollectionIdsForItem, setCategoriesForItem, removeItemLinksForOrder, type Collection } from "../data/collections";
import { NewCustomerForm } from "../components/NewCustomerForm";
import { MoneyInput } from "../components/MoneyInput";
import { useAuth } from "../data/authContext";

const NEW_CUSTOMER_OPTION = "__new_customer__";

async function loadFirstCustomer(): Promise<Customer> {
  const first = (await getCustomers())[0];
  return first ? toDisplayCustomer(first, await getCustomerAddresses(first.id)) : EMPTY_CUSTOMER;
}







type OrderItem = {
  id: string;
  name: string;
  emoji: string;
  qty: number;
  price: number;
  hpp: number;
  feeMarketer: number;
  detail?: string;
  category?: string;
  productId?: string;
  // ===== Atribut terstruktur Amna Jilbab =====
  size?: string;
  pad?: string;
  fabric?: string;
  color?: string;
  modifications?: string[];
  customRequests?: CustomRequest[];
  additionalPrice?: number;
  finalPrice?: number;
  productionStage?: ProductionStage;
  shipmentStage?: ShipmentStage;
  stockSource?: "ready" | "po";
  warehouseId?: string;
};


type Invoice = {
  number: string;
  date: string;
  customer: string;
  phone: string;
  address: string;
  items: OrderItem[];
  type: InvoiceType;
  ongkir: number;
  ongkirLabel: string;
  splitShopee: boolean;
  dp: number;
  note: string;
  discountType: DiscountType;
  discountValue: number;
  discountAmount: number;
  subtotal: number;
  total: number;
  marketerName: string | null;
  batch?: string;
};


const fmt = (v: number) => v.toLocaleString("id-ID");

export default function OrderPage() {
  return <Suspense fallback={null}><OrderPageInner /></Suspense>;
}

function OrderPageInner() {
  // Tahap 7 — dipakai HANYA di addJilbab (di bawah) buat cegah bug
  // fallback-cost: baseProduct?.hpp gak ketemu bisa berarti "produknya
  // emang belum ada" (Owner, wajar dikasih taksiran) ATAU "produknya ada
  // tapi cost-nya udah di-strip krn Admin" (Tahap 4) — dua hal beda yang
  // gak bisa dibedain cuma dari nilai `undefined`-nya aja.
  const { role: authRole } = useAuth();
  const isOwner = authRole === "owner";
  const searchParams = useSearchParams();
  const initialCustomerId = searchParams.get("customerId");
  const initialOrderId = searchParams.get("orderId");
  const [orderIdLoaded, setOrderIdLoaded] = useState(false);
  // Mulai dari EMPTY_CUSTOMER (bukan langsung baca localStorage) supaya render
  // pertama di server & di client sama — data asli dimuat lewat HYDRATION FIX
  // useEffect di bawah, sama seperti productList/marketers/existingOrders.
  const [customer, setCustomer] = useState<Customer>(EMPTY_CUSTOMER);
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [recipientName, setRecipientName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [items, setItems] = useState<OrderItem[]>([]);
  const [notice, setNotice] = useState("");
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [showJilbabForm, setShowJilbabForm] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [variantPickProduct, setVariantPickProduct] = useState<Product | null>(null);
  const [ongkirId, setOngkirId] = useState("id-jawa");
  const [customOngkir, setCustomOngkir] = useState(0);
  const [customOngkirLabel, setCustomOngkirLabel] = useState("");
  const [dpAmount, setDpAmount] = useState(0);
  const [orderPayments, setOrderPayments] = useState<PaymentRecord[]>([]);
  const [topUpAmount, setTopUpAmount] = useState(0);
  const [note, setNote] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [amnaStatus, setAmnaStatus] = useState<"po" | "lunas">("po");
  const [batch, setBatch] = useState("Batch 7");
  const [batchNames, setBatchNames] = useState<string[]>(["Batch 7", "Batch 8"]);
  const [newBatchInput, setNewBatchInput] = useState("");
  const [discountType, setDiscountType] = useState<DiscountType>("percent");

  const [discountValue, setDiscountValue] = useState(0);
  const [marketerId, setMarketerId] = useState<string>("");
  // Nominal fee marketer untuk order INI SAJA — beda order bisa beda nominal
  // (kadang malah Rp0 kalau fee-nya sudah dipotong langsung di sistem lain),
  // jadi bukan sekadar dihitung otomatis dari defaultFee marketer/produk.
  const [feeOverride, setFeeOverride] = useState<number | null>(null);
  const [marketerSearch, setMarketerSearch] = useState("");
  const [showMarketerModal, setShowMarketerModal] = useState(false);
  const [mkName, setMkName] = useState("");
  const [mkFee, setMkFee] = useState(0);
  const [mkSaveToMaster, setMkSaveToMaster] = useState(true);

  // ===== EDIT ORDER state =====
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [showOrderList, setShowOrderList] = useState(false);
  const [existingOrders, setExistingOrders] = useState<OrderRecord[]>([]);
  const [deleteOrderConfirmOpen, setDeleteOrderConfirmOpen] = useState(false);



  // ===== TAMBAH ALAMAT state =====
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [addrLabel, setAddrLabel] = useState("");
  const [addrRecipient, setAddrRecipient] = useState("");
  const [addrPhone, setAddrPhone] = useState("");
  const [addrAddress, setAddrAddress] = useState("");
  const [addrLandmark, setAddrLandmark] = useState("");
  const [addrCourier, setAddrCourier] = useState("");
  const [addrNote, setAddrNote] = useState("");
  const [addrIsDefault, setAddrIsDefault] = useState(false);

  // Jilbab form state


  const [jSize, setJSize] = useState("L");
  const [jPad, setJPad] = useState("nonpad");
  const [jMods, setJMods] = useState<string[]>([]);
  const [jQty, setJQty] = useState(1);
  const [jRequestName, setJRequestName] = useState("");
  const [jRequestPrice, setJRequestPrice] = useState(0);


  const [productList, setProductList] = useState<Product[]>([]);
  const [marketers, setMarketers] = useState<Marketer[]>([]);
  const [customerAddresses, setCustomerAddresses] = useState<CustomerAddress[]>([]);
  // Kosong dulu di render pertama (server tidak punya localStorage) — diisi di
  // HYDRATION FIX effect di bawah, sama seperti productList/marketers.
  const [customerList, setCustomerList] = useState<{ id: string; name: string; city: string }[]>([]);
  const [collectionsList, setCollectionsList] = useState<Collection[]>([]);
  const [warehouseList, setWarehouseList] = useState<Warehouse[]>([]);
  const [inventoryList, setInventoryList] = useState<Inventory[]>([]);
  // Kategori Produk yang dicentang per-item (bukan per-invoice) — key: item.id,
  // value: daftar collectionId. Diisi ulang dari getCollectionIdsForItem saat
  // order dibuka utk diedit; disimpan lewat setCategoriesForItem tiap Generate
  // Invoice diklik.
  const [itemCategoryMap, setItemCategoryMap] = useState<Record<string, string[]>>({});

  const notify = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2600); };

  // ===== HYDRATION FIX: Muat data dari localStorage setelah hydration =====
  // Data global (marketer/produk/batch/collection/daftar order & customer) HARUS
  // selalu dimuat sekali di awal, gak boleh digantung ke resolusi customer di
  // bawah — kalau customer masih 0 (localStorage kosong), loadFirstCustomer()
  // balikin customer.id "" lagi, jadi effect customer.id gak akan pernah
  // "berubah" dan dependency [customer.id] gak pernah retrigger. Sebelumnya
  // ini 1 effect gabung, jadi marketer/produk/dll ikut kosong selamanya di
  // kondisi 0 customer.
  useEffect(() => {
    // Order/Fee/Payment/Batch Nama sudah pindah ke Supabase (Tahap 6 migrasi
    // backend) — async.
    getOrders().then(setExistingOrders);
    getProducts().then(setProductList);
    getMarketers().then(setMarketers);
    // Customer sekarang Supabase (Tahap 5 migrasi backend) — async.
    getCustomers().then(setCustomerList);
    getBatchNames().then(setBatchNames);
    getCollections().then(setCollectionsList);
    // Gudang & Stok sudah pindah ke Supabase (Tahap 4 migrasi backend) —
    // async, dimuat terpisah dari getter localStorage lain di atas.
    getWarehouses().then(setWarehouseList);
    getInventory().then(setInventoryList);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (customer.id === "") {
        // Kalau datang dari profil customer (?customerId=...), langsung pilihkan
        // customer itu — bukan customer pertama di daftar.
        const fromParam = initialCustomerId ? await getCentralCustomer(initialCustomerId) : undefined;
        const first = fromParam ? toDisplayCustomer(fromParam, await getCustomerAddresses(fromParam.id)) : await loadFirstCustomer();
        if (cancelled) return;
        setCustomer(first);
        setSelectedAddressId(first.defaultAddressId || "");
        return;
      }
      const addrs = await getCustomerAddresses(customer.id);
      if (!cancelled) setCustomerAddresses(addrs);
    })();
    return () => { cancelled = true; };
  }, [customer.id, initialCustomerId]);

  // ===== CUSTOMER & SHIPPING ADDRESS =====
  // Alamat default otomatis terpilih saat customer dipilih.
  // Nama Penerima, No HP, dan Alamat otomatis terisi dari alamat terpilih.
  // Alamat digabung dari seed (customers.ts) + alamat yang disimpan user (localStorage).
  const selectedAddress: CustomerAddress | undefined = customerAddresses.find(a => a.id === selectedAddressId);


  const handleCustomerChange = async (customerId: string) => {
    if (customerId === NEW_CUSTOMER_OPTION) { setNewCustomerOpen(true); return; }
    const central = await getCentralCustomer(customerId);
    if (!central) return;
    const all = await getCustomerAddresses(customerId);
    const c = toDisplayCustomer(central, all);
    setCustomer(c);
    const defAddr = all.find(a => a.isDefault) || all[0];
    setSelectedAddressId(defAddr?.id || "");
    setRecipientName(defAddr?.recipientName || "");
    setPhone(defAddr?.phone || "");
    setAddress(defAddr ? `${defAddr.address}${defAddr.landmark ? ` (${defAddr.landmark})` : ""}` : "");
  };

  // ===== CUSTOMER BARU LANGSUNG DARI HALAMAN ORDER =====
  const handleCreateCustomer = async (name: string, city: string) => {
    const created = createNewCustomer(name, city);
    await addCustomer(created);
    getCustomers().then(setCustomerList);
    setCustomer(toDisplayCustomer(created, []));
    setCustomerAddresses([]);
    setSelectedAddressId("");
    setRecipientName("");
    setPhone("");
    setAddress("");
    setNewCustomerOpen(false);
    notify(`Profil ${name} berhasil dibuat`);
  };

  const handleAddressChange = (addrId: string) => {
    setSelectedAddressId(addrId);
    const addr = customerAddresses.find(a => a.id === addrId);
    if (!addr) return;
    setRecipientName(addr.recipientName);
    setPhone(addr.phone);
    setAddress(addr.address + (addr.landmark ? ` (${addr.landmark})` : ""));
  };

  // ===== SIMPAN ALAMAT BARU (permanen) =====
  const handleSaveAddress = async () => {
    if (!addrLabel.trim() || !addrAddress.trim()) {
      notify("Label dan alamat wajib diisi");
      return;
    }
    const newAddr: CustomerAddress = {
      id: "addr-" + Date.now(),
      customerId: customer.id,
      label: addrLabel.trim(),
      recipientName: addrRecipient.trim() || customer.name,
      phone: addrPhone.trim(),
      address: addrAddress.trim(),
      landmark: addrLandmark.trim() || undefined,
      courier: addrCourier.trim() || undefined,
      note: addrNote.trim() || undefined,
      isDefault: addrIsDefault,
    };
    await addAddress(newAddr);
    setCustomerAddresses(await getCustomerAddresses(customer.id));
    // Pilih alamat yang baru disimpan
    setSelectedAddressId(newAddr.id);
    setRecipientName(newAddr.recipientName);
    setPhone(newAddr.phone);
    setAddress(newAddr.address + (newAddr.landmark ? ` (${newAddr.landmark})` : ""));
    // Reset form
    setAddrLabel(""); setAddrRecipient(""); setAddrPhone(""); setAddrAddress("");
    setAddrLandmark(""); setAddrCourier(""); setAddrNote(""); setAddrIsDefault(false);
    setShowAddressModal(false);
    notify("Alamat disimpan permanen");
  };



  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const discountAmount = calculateDiscount(subtotal, discountType, discountValue);
  const ongkir = ongkirId === "custom" ? customOngkir : (ongkirOptions.find(o => o.id === ongkirId)?.price || 0);
  // Split Bill Shopee: begitu ongkir dipilih "Shopee", customer otomatis checkout
  // lewat trik Split Bill (lihat Master Data bagian 9) — Rp1.500 dari situ SUDAH
  // otomatis terhitung sebagai bagian yang lunas, admin tidak perlu tambah manual.
  const splitShopee = ongkirId === "shopee";
  const splitShopeeCredit = splitShopee ? SPLIT_BILL_PRODUK : 0;
  // "total" adalah TOTAL UTUH invoice (dipakai buildInvoiceText & disimpan ke
  // orderRecord.total) — JANGAN kurangi DP di sini. Sebelumnya DP ikut
  // dikurangkan di sini, jadi order.total yang tersimpan jadi salah (bahkan
  // bisa negatif kalau DP >= subtotal+ongkir), merusak semua yang baca
  // order.total (Payment/Outstanding, Collection stats, invoice "Sisa
  // Pelunasan" yang sendirinya menghitung total - dp lagi → dp kepotong dua kali).
  const total = subtotal - discountAmount + ongkir;
  // Fee marketer: gunakan fee per produk jika tersedia, jika tidak gunakan defaultFee marketer
  const selectedMarketer = marketers.find(m => m.id === marketerId);
  const totalFee = items.reduce((sum, item) => {
    const feePerUnit = item.feeMarketer > 0 ? item.feeMarketer : (selectedMarketer?.defaultFee || 0);
    return sum + feePerUnit * item.qty;
  }, 0);
  // Nominal yang benar-benar dipakai: hasil ketikan admin (feeOverride) kalau
  // ada, kalau belum diisi pakai perkiraan otomatis (totalFee) sebagai saran awal.
  const effectiveFee = marketerId ? (feeOverride ?? totalFee) : 0;



  // ===== DECISION TREE (sesuai Operating Manual) =====
  const hasAmna = items.some(i => i.category === "amna-jilbab");
  const hasBuku = items.some(i => ["buku-parenting", "boardbook", "lebah-asaqu"].includes(i.category || ""));
  const hasReady = items.some(i => ["niqab", "aksesoris"].includes(i.category || ""));
  const hasLainnya = items.some(i => i.category === "lainnya");

  const determineType = (): InvoiceType => {
    if (hasAmna && (hasBuku || hasReady || hasLainnya)) return "gabungan";
    if (hasAmna) return amnaStatus === "po" ? "po-amna" : "pelunasan-amna";
    if (hasBuku && hasReady) return "gabungan";
    if (hasBuku) return "buku";
    if (hasReady) return "ready";
    return "gabungan";
  };

  const invoiceType = determineType();

  const toggleMod = (id: string) => {
    setJMods(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);
  };

  const addJilbab = () => {
    const size = jilbabSizes.find(s => s.id === jSize)!;
    const pad = jilbabPads.find(p => p.id === jPad)!;
    const mods = jilbabModifikasi.filter(m => jMods.includes(m.id));
    const hasRequest = jMods.includes("request-khusus");
    const customRequests: CustomRequest[] = hasRequest && jRequestName.trim()
      ? [{ name: jRequestName.trim(), price: jRequestPrice }]
      : [];
    const additionalPrice = mods.reduce((sum, m) => sum + m.price, 0) + (hasRequest ? jRequestPrice : 0);
    const unitPrice = size.price + additionalPrice;

    // Atribut terstruktur
    const modNames = mods.map(m => m.name);
    const detail = `Size ${size.name} · ${pad.name} · ${AMNA_DEFAULT_FABRIC} · ${AMNA_DEFAULT_COLOR}${modNames.length ? " · " + modNames.join(", ") : ""}${customRequests.length ? " · Request: " + customRequests[0].name : ""}`;

    // Find matching product for fee/hpp snapshot. Taksiran default
    // (180000/15000) HANYA layak dipakai kalau baseProduct memang gak
    // ketemu di katalog — bukan saat baseProduct ADA tapi cost-nya cuma
    // gak kekirim krn Admin yang login (get_products() strip HPP/fee utk
    // Admin sejak Tahap 4). Tanpa pembeda ini, tiap Admin nambah Amna
    // Jilbab bakal nyimpen HPP/fee TAKSIRAN sbg kalau itu data ASLI —
    // salah & bisa nyasarin laporan laba Owner nanti.
    const baseProduct = productList.find(p => p.category === "amna-jilbab" && p.name.includes(size.name));
    const hpp = isOwner ? (baseProduct?.hpp || 180000) : (baseProduct?.hpp || 0);
    const fee = isOwner ? (baseProduct?.feeMarketer || 15000) : (baseProduct?.feeMarketer || 0);

    const newItemId = "jilbab-" + Date.now();
    setItems(prev => [...prev, {
      id: newItemId,
      name: "Amna Jilbab",
      emoji: "🧕",
      qty: jQty,
      price: unitPrice,
      hpp,
      feeMarketer: fee,
      detail,
      category: "amna-jilbab",
      productId: baseProduct?.id,
      size: size.name,
      pad: pad.name,
      fabric: AMNA_DEFAULT_FABRIC,
      color: AMNA_DEFAULT_COLOR,
      modifications: modNames,
      customRequests,
      additionalPrice,
      finalPrice: unitPrice,
    }]);
    // Collection Default produk (Katalog) otomatis tercentang — disaring dulu
    // terhadap collectionsList (lihat penjelasan sama di addProduct di bawah).
    const validJilbabDefaultCollections = (baseProduct?.defaultCollectionIds || []).filter(id => collectionsList.some(c => c.id === id));
    if (validJilbabDefaultCollections.length > 0) {
      setItemCategoryMap(prev => ({ ...prev, [newItemId]: validJilbabDefaultCollections }));
    }
    setShowJilbabForm(false);
    setJMods([]);
    setJQty(1);
    setJRequestName("");
    setJRequestPrice(0);
    notify("Jilbab ditambahkan ke order");
  };


  // variant diisi dari Product.variants (mis. warna Manset) — DITANYAKAN
  // dulu kalau produknya punya >1 varian (lihat picker di bawah), supaya
  // tersimpan di item.detail dan ikut kebaca di semua tempat yang nampilin
  // detail item (invoice, WA, rincian Collection). Sebelumnya field
  // Product.variants ada datanya tapi TIDAK PERNAH ditanyakan sama sekali
  // di sini — jadi mis. "Manset Standar" (5 warna) gak pernah kejelasan
  // warna apa yang benar-benar dipesan.
  const addProduct = (product: Product, variant?: string) => {
    const newItemId = product.id + "-" + Date.now();
    setItems(prev => [...prev, {
      id: newItemId,
      name: product.name,
      emoji: product.emoji,
      qty: 1,
      price: product.price,
      hpp: product.hpp || 0,
      feeMarketer: product.feeMarketer || 0,
      category: product.category,
      productId: product.id,
      detail: variant,
    }]);
    // Collection Default produk (Katalog) otomatis tercentang — gak perlu
    // pilih manual per order lagi kalau produknya sudah diberi default.
    // Disaring dulu terhadap collectionsList (Collection yg masih aktif/gak
    // dihapus) — kalau gak, Collection yg sudah dihapus tapi masih nyantol
    // sbg default produk lama bakal nautkan item ke id Collection yg gak
    // ada lagi (invisible di chip, tapi tetap kesimpen sbg tautan mati).
    const validDefaultCollections = (product.defaultCollectionIds || []).filter(id => collectionsList.some(c => c.id === id));
    if (validDefaultCollections.length > 0) {
      setItemCategoryMap(prev => ({ ...prev, [newItemId]: validDefaultCollections }));
    }
    setShowProductPicker(false);
    setVariantPickProduct(null);
    notify(`${product.name}${variant ? ` (${variant})` : ""} ditambahkan`);
  };

  const updateQty = (id: string, delta: number) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, qty: Math.max(1, item.qty + delta) } : item));
  };

  const updateProductionStage = (id: string, stage: ProductionStage) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, productionStage: stage } : item));
  };

  const updateShipmentStage = (id: string, stage: ShipmentStage | "") => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, shipmentStage: stage || undefined } : item));
  };

  // Produk yang sama bisa PO di satu order & Ready Stock di order lain
  // (mis. Niqab/Manset kadang PO kadang sisa stok jadi ready) — ditandai
  // per-item di sini, bukan tetap di Product. Ganti ke "po" bersihkan
  // warehouseId (gak relevan lagi).
  const updateStockSource = (id: string, source: "ready" | "po") => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, stockSource: source, warehouseId: source === "po" ? undefined : item.warehouseId } : item));
  };
  const updateItemWarehouse = (id: string, warehouseId: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, warehouseId: warehouseId || undefined } : item));
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
    setItemCategoryMap(prev => {
      const { [id]: _removed, ...rest } = prev;
      return rest;
    });
  };

  const toggleItemCategory = (itemId: string, collectionId: string) => {
    setItemCategoryMap(prev => {
      const current = prev[itemId] || [];
      const next = current.includes(collectionId) ? current.filter(c => c !== collectionId) : [...current, collectionId];
      return { ...prev, [itemId]: next };
    });
  };

  // ===== GENERATE INVOICE TEXT (sesuai Operating Manual) =====
  const buildInvoiceText = (inv: Invoice): string => {
    const lines: string[] = [];
    lines.push("🌸 AFEENA & YASLA");
    lines.push("INVOICE");
    lines.push("");
    lines.push("Nama: " + inv.customer);
    if (inv.phone) lines.push("No. HP: " + inv.phone);
    if (inv.address) lines.push("Alamat: " + inv.address);
    lines.push("");
    if (inv.batch) {
      lines.push("Batch: " + inv.batch);
      lines.push("");
    }
    lines.push("Pesanan:");
    inv.items.forEach(item => {
      lines.push(`- ${item.name}${item.detail ? ` (${item.detail})` : ""} x${item.qty} = ${fmt(item.price * item.qty)}`);
      // Info utk customer (estimasi ready/pembayaran) — diambil dari data
      // produk SAAT INI (bukan snapshot historis, gak masalah krn ini info
      // umum bukan angka yang perlu akurat-per-order), biar customer gak
      // perlu tanya ulang "kapan ready"/"kapan bayar".
      const productInfo = productList.find(p => p.id === item.productId);
      if (productInfo?.estimasiReady) lines.push(`  Estimasi ready: ${productInfo.estimasiReady}`);
      if (productInfo?.estimasiPembayaran) lines.push(`  Estimasi pembayaran: ${productInfo.estimasiPembayaran}`);
    });

    const totalBeratGram = inv.items.reduce((sum, item) => {
      const productInfo = productList.find(p => p.id === item.productId);
      return sum + (productInfo?.beratGram || 0) * item.qty;
    }, 0);
    if (totalBeratGram > 0) {
      lines.push("");
      lines.push(`Estimasi Berat Paket: ${(totalBeratGram / 1000).toLocaleString("id-ID", { maximumFractionDigits: 2 })} kg`);
    }

    if (inv.discountAmount > 0) {
      lines.push("");
      lines.push("Diskon: " + (inv.discountType === "percent" ? `${inv.discountValue}%` : formatRupiah(inv.discountValue)));
      lines.push("-" + fmt(inv.discountAmount));
    }
    if (inv.ongkir > 0) {
      lines.push("");
      lines.push("Ongkir: " + inv.ongkirLabel);
      lines.push(fmt(inv.ongkir));
    }
    lines.push("");
    const splitCredit = inv.splitShopee ? SPLIT_BILL_PRODUK : 0;
    if (inv.type === "po-amna" || inv.dp > 0 || splitCredit > 0) {
      lines.push("TOTAL:");
      lines.push("Rp" + fmt(inv.total));
      if (inv.dp > 0) {
        lines.push("");
        lines.push("Deposit:");
        lines.push("Rp" + fmt(inv.dp));
      }
      if (splitCredit > 0) {
        lines.push("");
        lines.push("Split Bill Shopee (sudah checkout):");
        lines.push("Rp" + fmt(splitCredit));
      }
      lines.push("");
      lines.push("Sisa Pelunasan:");
      lines.push("Rp" + fmt(Math.max(0, inv.total - inv.dp - splitCredit)));
    } else {
      lines.push("TOTAL:");
      lines.push("Rp" + fmt(inv.total));
    }
    if (inv.note) {
      lines.push("");
      lines.push("Catatan:");
      lines.push(inv.note);
    }
    lines.push("");
    lines.push("Pembayaran:");
    const rek = determineRekening(inv.items.map(i => i.category || "lainnya"));
    if (rek) {
      lines.push(rek.name);
      lines.push(rek.bank);
      lines.push(rek.number);
      lines.push("a/n " + rek.owner);
    }
    lines.push("");
    lines.push("Terima kasih 🌸");
    return lines.join("\n");
  };

  const generateInvoice = async () => {
    if (items.length === 0) { notify("Tambahkan produk dulu"); return; }
    const now = new Date();
    const number = await getNextInvoiceNumber();
    const type = determineType();
    const ongkirLabel = ongkirId === "custom" ? (customOngkirLabel.trim() || "Ongkir lainnya") : (ongkirOptions.find(o => o.id === ongkirId)?.name || "");
    const marketer = marketers.find(m => m.id === marketerId);

    const inv: Invoice = {
      number,
      date: now.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }),
      customer: customer.name,
      phone,
      address,

      items,
      type,
      ongkir,
      ongkirLabel,
      splitShopee,
      dp: dpAmount,
      note,
      discountType,
      discountValue,
      discountAmount,
      subtotal,
      total,
      marketerName: marketer?.name || null,
      batch: hasAmna ? batch : undefined,
    };

    setInvoice(inv);

    // ===== SAVE ORDER RECORD (snapshot) =====
    // Jika sedang edit, gunakan ID & nomor order yang sudah ada
    const existingOrder = editingOrderId ? await getOrderById(editingOrderId) : undefined;
    const orderId = existingOrder?.id || "ORD-" + Date.now();
    const orderNumber = existingOrder?.number || "ORD/" + now.getFullYear() + "/" + String(now.getMonth() + 1).padStart(2, "0") + "/" + String(now.getDate()).padStart(2, "0") + "-" + String(Math.floor(1000 + Math.random() * 9000));


    const snapshots: OrderItemSnapshot[] = items.map(item => ({
      id: item.id,
      productId: item.productId || "",
      name: item.name,
      emoji: item.emoji,
      qty: item.qty,
      price: item.price,
      hpp: item.hpp,
      feeMarketer: item.feeMarketer,
      discount: 0,
      detail: item.detail,
      category: item.category,
      // ===== Atribut terstruktur Amna Jilbab =====
      size: item.size,
      pad: item.pad,
      fabric: item.fabric,
      color: item.color,
      modifications: item.modifications,
      customRequests: item.customRequests,
      additionalPrice: item.additionalPrice,
      finalPrice: item.finalPrice,
      productionStage: item.productionStage || "po",
      shipmentStage: item.shipmentStage,
      stockSource: item.stockSource,
      warehouseId: item.warehouseId,
    }));

    // ===== REKONSILIASI STOK GUDANG =====
    // Cuma item "Ready Stock" (stockSource==="ready") yang benar-benar
    // memotong Inventory — item "PO"/tanpa tanda SENGAJA tidak menyentuh
    // stok sama sekali (barangnya belum ada fisiknya). Dikerjakan dgn pola
    // "kembalikan yang lama dulu, baru potong yang baru" — aman dipakai
    // baik utk order baru (existingOrder.items kosong, restore jadi no-op)
    // maupun edit (qty/gudang/sumber berubah bebas tanpa bikin stok nyimpang).
    for (const oldItem of existingOrder?.items || []) {
      if (oldItem.stockSource === "ready" && oldItem.productId && oldItem.warehouseId) {
        await adjustStock(oldItem.productId, oldItem.warehouseId, oldItem.qty);
      }
    }
    for (const item of snapshots) {
      if (item.stockSource === "ready" && item.productId && item.warehouseId) {
        await adjustStock(item.productId, item.warehouseId, -item.qty);
      }
    }
    getInventory().then(setInventoryList);


    const orderRecord: OrderRecord = {
      id: orderId,
      number: orderNumber,
      date: now.toISOString(),
      customer: customer.name,
      customerId: customer.id,
      phone,
      address,


      items: snapshots,
      discountType,
      discountValue,
      discountAmount,
      ongkir,
      ongkirLabel,
      // order.dp = TOTAL yang sudah beneran diterima (dipakai Payment/Outstanding
      // di seluruh app) — termasuk Rp1.500 Split Bill Shopee yang otomatis lunas
      // lewat checkout Shopee, bukan cuma DP manual yang diketik admin.
      dp: dpAmount + splitShopeeCredit,
      note,
      internalNote: internalNote.trim() || undefined,
      marketerId: marketer?.id || null,
      marketerName: marketer?.name || null,
      totalFee: effectiveFee,
      subtotal,
      total,
      status: "confirmed",
      batch: hasAmna ? batch : undefined,
      createdAt: Date.now(),
    };

    // ===== KATEGORI PRODUK: simpan tautan per-item ke Collection =====
    // Dipanggil utk KEDUA mode (baru & edit) — key-nya orderId+itemId, jadi
    // aman idempotent baik order baru maupun order yang sudah ada sebelumnya.
    for (const item of snapshots) {
      await setCategoriesForItem(orderId, item.id, itemCategoryMap[item.id] || []);
    }
    // Item yang ADA di order lama tapi sudah gak ada di snapshots sekarang
    // (dihapus admin selama sesi edit ini) — bersihkan tautan kategorinya
    // juga, supaya gak jadi sampah nyangkut selamanya di
    // umayasla_collection_order_items menunjuk item yang sudah gak ada.
    if (existingOrder) {
      const currentItemIds = new Set(snapshots.map(item => item.id));
      for (const oldItem of existingOrder.items) {
        if (!currentItemIds.has(oldItem.id)) await setCategoriesForItem(orderId, oldItem.id, []);
      }
    }

    if (editingOrderId) {
      await updateOrder(orderRecord);
      // ===== SINKRON RIWAYAT PEMBAYARAN — SPLIT BILL SHOPEE =====
      // dp di atas sudah dihitung ulang pakai splitShopeeCredit dari ongkir yang
      // dipilih SEKARANG di form, tapi baris PaymentRecord "Split Bill Shopee"
      // cuma pernah dibuat sekali saat order BARU dibuat (blok di bawah, cabang
      // else). Kalau admin ganti ongkir ke/dari Shopee pas EDIT, order.dp ikut
      // berubah tapi Riwayat Pembayaran bisa nyimpang (dp nambah 1.500 tanpa
      // baris baru, atau baris lama masih ada padahal dp sudah dikurangi lagi).
      // Disamakan di sini: tambah/hapus baris ledger biar order.dp & Riwayat
      // Pembayaran tetap 1:1, sama seperti alur order baru.
      const shopeePayment = (await getPaymentsForOrder(orderId)).find(p => p.note === "Split Bill Shopee (checkout otomatis)");
      if (splitShopeeCredit > 0 && !shopeePayment) {
        await addPayment({
          id: "pay-" + Date.now() + "-shopee",
          orderId,
          orderNumber,
          customerId: customer.id || null,
          customerName: customer.name,
          productSummary: snapshots.map(s => s.name).join(", "),
          amount: splitShopeeCredit,
          dateReceived: now.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }),
          status: "belum-ditarik",
          dateWithdrawn: null,
          note: "Split Bill Shopee (checkout otomatis)",
          createdAt: Date.now(),
        });
      } else if (splitShopeeCredit === 0 && shopeePayment) {
        await deletePayment(shopeePayment.id);
      }
      setOrderPayments(await getPaymentsForOrder(orderId));
    } else {
      await saveOrder(orderRecord);
      // ===== RIWAYAT PEMBAYARAN: catat top up awal (kalau ada) =====
      // Order baru (bukan edit) — dpAmount manual & kredit Split Bill Shopee
      // dicatat sebagai baris riwayat TERPISAH sejak awal, bukan cuma angka
      // tunggal di order.dp yang gak jelas asalnya dari transfer yang mana.
      const productSummary = snapshots.map(s => s.name).join(", ");
      const newPayments: PaymentRecord[] = [];
      if (dpAmount > 0) {
        newPayments.push({
          id: "pay-" + Date.now() + "-dp",
          orderId,
          orderNumber,
          customerId: customer.id || null,
          customerName: customer.name,
          productSummary,
          amount: dpAmount,
          dateReceived: now.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }),
          status: "belum-ditarik",
          dateWithdrawn: null,
          note: "DP saat order dibuat",
          createdAt: Date.now(),
        });
      }
      if (splitShopeeCredit > 0) {
        newPayments.push({
          id: "pay-" + Date.now() + "-shopee",
          orderId,
          orderNumber,
          customerId: customer.id || null,
          customerName: customer.name,
          productSummary,
          amount: splitShopeeCredit,
          dateReceived: now.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }),
          status: "belum-ditarik",
          dateWithdrawn: null,
          note: "Split Bill Shopee (checkout otomatis)",
          createdAt: Date.now(),
        });
      }
      for (const p of newPayments) await addPayment(p);
      setOrderPayments(await getPaymentsForOrder(orderId));
      // Order baru langsung masuk mode edit (bukan cuma tampil invoice lalu
      // form di baliknya balik ke "Buat Order Baru" kosong) — supaya "Riwayat
      // Pembayaran"/"Catat Pembayaran" untuk order yang BARU SAJA dibuat ini
      // langsung kelihatan & bisa dipakai, tanpa admin harus keluar dulu lalu
      // cari lagi lewat "Edit Order yang Sudah Ada". "Selesai" di invoice
      // tetap mereset semuanya kalau admin mau mulai order baru yang lain.
      setEditingOrderId(orderId);
    }

    // ===== SINKRON COLLECTION "PO BATCH" =====
    // Non-fatal — kegagalan di sini tidak boleh menggagalkan order yang sudah tersimpan.
    try {
      await syncOrderBatchCollection(orderId, hasAmna ? batch : undefined, existingOrder?.batch);
    } catch {
      // ignore
    }

    // ===== SAVE FEE RECORD =====

    if (marketer && effectiveFee > 0) {
      // Satu baris merangkum nominal yang diketik admin untuk order ini —
      // bukan dihitung ulang per-produk, supaya jumlahnya selalu cocok dengan
      // apa yang benar-benar disepakati (bisa beda dari perkiraan otomatis).
      const feeItems = [{
        productName: items.map(i => i.name).join(", "),
        qty: 1,
        feePerUnit: effectiveFee,
        feeTotal: effectiveFee,
      }];


      const feeRecord: FeeRecord = {
        id: "fee-" + Date.now(),
        orderId,
        orderNumber,
        invoiceNumber: number,
        marketerId: marketer.id,
        marketerName: marketer.name,
        date: now.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }),
        items: feeItems,
        totalFee: effectiveFee,
        status: "belum-diambil",
        paidDate: null,
        note: "",
        createdAt: Date.now(),
      };
      await saveFee(feeRecord);
    } else if (editingOrderId) {
      // Marketer/fee dihapus saat edit — bersihkan FeeRecord lama order ini
      // supaya gak nyangkut selamanya di halaman Fee.
      await removeFeeForOrder(orderId);
    }

    // Refresh daftar order agar order yang baru dibuat/diedit langsung terlihat.
    setExistingOrders(await getOrders());
  };

  // ===== LOAD ORDER KE FORM (EDIT MODE) =====
  const loadOrderIntoForm = async (order: OrderRecord) => {
    // Load customer
    const centralC = (order.customerId ? await getCentralCustomer(order.customerId) : undefined) || (await getCustomers())[0];
    const all = centralC ? await getCustomerAddresses(centralC.id) : [];
    const c = centralC ? toDisplayCustomer(centralC, all) : EMPTY_CUSTOMER;
    setCustomer(c);
    // Set selected address to default if available
    const defAddr = all.find(a => a.isDefault) || all[0];
    setSelectedAddressId(defAddr?.id || "");
    setRecipientName(order.phone);
    setPhone(order.phone);
    setAddress(order.address);


    // Load items
    const loadedItems: OrderItem[] = order.items.map(item => ({
      id: item.id,
      name: item.name,
      emoji: item.emoji,
      qty: item.qty,
      price: item.price,
      hpp: item.hpp,
      feeMarketer: item.feeMarketer,
      detail: item.detail,
      category: item.category,
      productId: item.productId,
      size: item.size,
      pad: item.pad,
      fabric: item.fabric,
      color: item.color,
      modifications: item.modifications,
      customRequests: item.customRequests,
      additionalPrice: item.additionalPrice,
      finalPrice: item.finalPrice,
      productionStage: item.productionStage,
      shipmentStage: item.shipmentStage,
      stockSource: item.stockSource,
      warehouseId: item.warehouseId,
    }));
    setItems(loadedItems);
    const loadedCategoryMap: Record<string, string[]> = {};
    for (const item of loadedItems) { loadedCategoryMap[item.id] = await getCollectionIdsForItem(order.id, item.id); }
    setItemCategoryMap(loadedCategoryMap);

    // Load settings
    setDiscountType(order.discountType);
    setDiscountValue(order.discountValue);
    const matchedOngkir = ongkirOptions.find(o => o.name === order.ongkirLabel);
    setOngkirId(matchedOngkir ? matchedOngkir.id : "custom");
    setCustomOngkir(order.ongkir);
    setCustomOngkirLabel(matchedOngkir ? "" : order.ongkirLabel);
    // order.dp tersimpan SUDAH termasuk Rp1.500 Split Bill Shopee (lihat generateInvoice)
    // — kurangi lagi di sini supaya field DP manual di form kembali menampilkan
    // angka yang benar-benar diketik admin, bukan dobel dengan kredit otomatis.
    const loadedSplitShopee = matchedOngkir?.id === "shopee";
    setDpAmount(order.dp - (loadedSplitShopee ? SPLIT_BILL_PRODUK : 0));
    setOrderPayments(await getPaymentsForOrder(order.id));
    setTopUpAmount(0);
    setNote(order.note);
    setInternalNote(order.internalNote || "");
    setMarketerId(order.marketerId || "");
    setFeeOverride(order.marketerId ? order.totalFee : null);
    if (order.batch) setBatchNames(await addBatchName(order.batch));
    setBatch(order.batch || "Batch 7");

    // Set editing mode
    setEditingOrderId(order.id);
    setShowOrderList(false);
    notify(`Order ${order.number} dimuat untuk diedit`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ===== TAMBAH PEMBAYARAN (top up) =====
  // Admin cukup input NOMINAL TRANSFER YANG MASUK (bukan total baru) — beda
  // dari field DP lama yang minta angka kumulatif dan gampang salah hitung.
  // Langsung tersimpan (gak perlu tunggu klik "Generate Invoice" lagi) supaya
  // dpAmount di form tetap sinkron kalau admin lanjut edit hal lain.
  const handleAddPayment = async () => {
    if (!editingOrderId || topUpAmount <= 0) return;
    const existingOrder = await getOrderById(editingOrderId);
    if (!existingOrder) return;
    const { updatedOrder } = await recordPaymentForOrder(existingOrder, topUpAmount);
    // Dasar kredit Split Bill Shopee dari ongkir yang BENERAN tersimpan di
    // order (existingOrder.ongkirLabel), BUKAN dari pilihan ongkir di form
    // (ongkirId/splitShopeeCredit) — kalau admin sempat ganti ongkir di form
    // tapi belum klik Generate Invoice, keduanya bisa beda dan bikin dpAmount
    // salah hitung (bahkan bisa negatif). Math.max(0, ...) jaga-jaga tambahan.
    const persistedSplitShopee = ongkirOptions.find(o => o.name === existingOrder.ongkirLabel)?.id === "shopee";
    setDpAmount(Math.max(0, updatedOrder.dp - (persistedSplitShopee ? SPLIT_BILL_PRODUK : 0)));
    setOrderPayments(await getPaymentsForOrder(editingOrderId));
    setExistingOrders(await getOrders());
    setTopUpAmount(0);
    notify(`Pembayaran ${formatRupiah(topUpAmount)} dicatat`);
  };

  const handleDeletePayment = async (payment: PaymentRecord) => {
    if (!editingOrderId) return;
    const existingOrder = await getOrderById(editingOrderId);
    if (!existingOrder) return;
    const newDp = Math.max(0, existingOrder.dp - payment.amount);
    await updateOrder({ ...existingOrder, dp: newDp });
    await deletePayment(payment.id);
    const persistedSplitShopee = ongkirOptions.find(o => o.name === existingOrder.ongkirLabel)?.id === "shopee";
    setDpAmount(Math.max(0, newDp - (persistedSplitShopee ? SPLIT_BILL_PRODUK : 0)));
    setOrderPayments(await getPaymentsForOrder(editingOrderId));
    setExistingOrders(await getOrders());
    notify(`Pembayaran ${formatRupiah(payment.amount)} dihapus`);
  };

  const handleTogglePaymentWithdrawn = async (payment: PaymentRecord) => {
    const nextStatus = payment.status === "sudah-ditarik" ? "belum-ditarik" : "sudah-ditarik";
    const dateWithdrawn = nextStatus === "sudah-ditarik" ? new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : null;
    await markPaymentWithdrawn(payment.id, nextStatus, dateWithdrawn);
    if (editingOrderId) setOrderPayments(await getPaymentsForOrder(editingOrderId));
  };

  // ===== HAPUS ORDER =====
  // Ikut membersihkan FeeRecord & tautan Collection order ini supaya tidak
  // ada catatan lain yang menunjuk ke order yang sudah tidak ada.
  const handleDeleteOrder = async () => {
    if (!editingOrderId) return;
    const deletedId = editingOrderId;
    const deletedNumber = existingOrders.find(o => o.id === deletedId)?.number || "";
    // Order yang mau dihapus mungkin punya item "Ready Stock" yang udah
    // motong Inventory — kembalikan dulu sebelum order-nya beneran hilang,
    // supaya stok gudang gak nyangkut "hilang" nunjuk order yang udah gak ada.
    const orderBeingDeleted = await getOrderById(deletedId);
    for (const item of orderBeingDeleted?.items || []) {
      if (item.stockSource === "ready" && item.productId && item.warehouseId) {
        await adjustStock(item.productId, item.warehouseId, item.qty);
      }
    }
    await deleteOrder(deletedId);
    await removeFeeForOrder(deletedId);
    await removePaymentsForOrder(deletedId);
    await removeItemLinksForOrder(deletedId);
    try { await removeOrderFromAllCollections(deletedId); } catch { /* non-fatal */ }
    setEditingOrderId(null);
    setItems([]);
    setItemCategoryMap({});
    setDpAmount(0);
    setOrderPayments([]);
    setTopUpAmount(0);
    setNote("");
    setInternalNote("");
    setDiscountValue(0);
    setMarketerId("");
    setBatch("Batch 7");
    setDeleteOrderConfirmOpen(false);
    setExistingOrders(await getOrders());
    notify(`Order ${deletedNumber} dihapus permanen`);
  };

  // Datang dari tab Order di profil customer (?orderId=...) — langsung buka
  // order itu dalam mode edit, sekali saja.
  useEffect(() => {
    if (orderIdLoaded || !initialOrderId) return;
    getOrderById(initialOrderId).then(order => { if (order) loadOrderIntoForm(order); });
    setOrderIdLoaded(true);
  }, [initialOrderId, orderIdLoaded]);

  const copyInvoice = () => {
    if (!invoice) return;
    const text = buildInvoiceText(invoice);
    navigator.clipboard?.writeText(text);
    notify("Invoice disalin ke clipboard");
  };

  // ===== KIRIM INVOICE LANGSUNG KE WHATSAPP CUSTOMER =====
  const sendInvoiceToWhatsApp = () => {
    if (!invoice) return;
    const digits = (invoice.phone || "").replace(/[^0-9]/g, "");
    if (!digits) { notify("Nomor HP customer belum diisi"); return; }
    const waNumber = digits.startsWith("0") ? "62" + digits.slice(1) : digits;
    const text = buildInvoiceText(invoice);
    window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(text)}`, "_blank");
  };


  return <main className="app-shell order-page">
    <header className="topbar">
      <button className="icon-btn" aria-label="Kembali" onClick={goBack}><ArrowLeft size={21} /></button>

      <div className="brand">UmayasLa<span>·</span> Order</div>
      <div className="header-actions"><button className="icon-btn"><Bell size={19} /></button></div>
    </header>

    <div className="order-hero">
      <h1>{editingOrderId ? "Edit Order" : "Buat Order Baru"}</h1>
      <p>{editingOrderId ? "Ubah detail order yang sudah ada" : "Pilih produk, atur detail, dan generate invoice sesuai manual"}</p>
    </div>

    {/* ===== EDIT ORDER SECTION ===== */}
    <div className="edit-order-section">
      {editingOrderId ? (
        <div className="editing-banner">
          <span className="editing-icon"><FileText size={16} /></span>
          <div>
            <b>Sedang mengedit order</b>
            <small>{existingOrders.find(o => o.id === editingOrderId)?.number || ""} · {existingOrders.find(o => o.id === editingOrderId)?.customer || ""}</small>
          </div>
          <button className="delete-order-btn" onClick={() => setDeleteOrderConfirmOpen(true)} aria-label="Hapus order"><Trash2 size={14} /></button>
          <button className="cancel-edit-btn" onClick={() => {
            setEditingOrderId(null);
            setItems([]);
            setItemCategoryMap({});
            setDpAmount(0);
            setOrderPayments([]);
            setTopUpAmount(0);
            setNote("");
            setInternalNote("");
            setDiscountValue(0);
            setMarketerId("");
            setBatch("Batch 7");
            notify("Mode edit dibatalkan");
          }}>Batal Edit</button>
        </div>
      ) : (
        <button className="edit-order-toggle" onClick={() => setShowOrderList(!showOrderList)}>
          <FileText size={16} />
          <span>Edit Order yang Sudah Ada</span>
          <ChevronRight size={16} className={showOrderList ? "open" : ""} />
        </button>
      )}

      {showOrderList && !editingOrderId && (
        <div className="order-list">
          <p className="panel-hint">Pilih order untuk dimuat ke form dan diedit.</p>
          {existingOrders.length === 0 && <p className="panel-hint">Belum ada order tersimpan.</p>}
          {existingOrders.map(order => (
            <button key={order.id} className="order-list-item" onClick={() => loadOrderIntoForm(order)}>
              <span className="order-list-emoji">{order.items[0]?.emoji || "🛒"}</span>
              <div className="order-list-info">
                <b>{order.number}</b>
                <small>{order.customer} · {new Date(order.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</small>
                <small>{order.items.map(i => `${i.name} x${i.qty}`).join(", ")}</small>
                {order.batch && <small className="order-list-batch">📦 {order.batch}</small>}
                {order.internalNote && <small className="order-list-batch" title={order.internalNote}>📌 Ada catatan internal</small>}
              </div>
              <div className="order-list-right">
                <b>{formatRupiah(order.total)}</b>
                <span className={`order-status ${order.status}`}>{order.status === "paid" ? "Lunas" : order.status === "confirmed" ? "Confirmed" : "Draft"}</span>
              </div>
              <ChevronRight size={16} />
            </button>
          ))}
        </div>
      )}
    </div>

    {/* ===== CUSTOMER & SHIPPING ADDRESS ===== */}

    <div className="order-customer">
      <label>Customer</label>
      <div className="address-select-row">
        <select value={customer.id} onChange={e => handleCustomerChange(e.target.value)}>
          {customerList.length === 0 && <option value="">— Belum ada customer —</option>}
          {customerList.map(c => <option key={c.id} value={c.id}>{c.name} · {c.city}</option>)}
        </select>
        <button type="button" className="add-address-btn" onClick={() => setNewCustomerOpen(true)}>
          <Plus size={15} /> Baru
        </button>
      </div>
      <small className="customer-wa">Nama WA: {customer.waName}</small>

      <label>Shipping Address</label>
      <div className="address-select-row">
        <select value={selectedAddressId} onChange={e => handleAddressChange(e.target.value)}>
          {customerAddresses.length === 0 && <option value="">— Belum ada alamat —</option>}
          {customerAddresses.map(a => (
            <option key={a.id} value={a.id}>{a.isDefault ? "⭐ " : ""}{a.label}</option>
          ))}
        </select>
        <button className="add-address-btn" onClick={() => setShowAddressModal(true)}>
          <Plus size={15} /> Tambah
        </button>
      </div>

      <div className="customer-fields">
        <label>Nama Penerima
          <input value={recipientName} onChange={e => setRecipientName(e.target.value)} placeholder="Nama penerima" />
        </label>
        <label>No HP
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="No. HP penerima" />
        </label>
        <label>Alamat
          <textarea value={address} onChange={e => setAddress(e.target.value)} placeholder="Alamat lengkap" />
        </label>
      </div>
    </div>

    {/* ===== CUSTOMER BARU MODAL ===== */}
    {newCustomerOpen && <NewCustomerForm onClose={() => setNewCustomerOpen(false)} onSave={handleCreateCustomer} />}

    {/* ===== TAMBAH ALAMAT MODAL ===== */}
    {showAddressModal && <div className="overlay" onClick={() => setShowAddressModal(false)}>
      <section className="modal address-modal" onClick={e => e.stopPropagation()}>
        <button className="close" onClick={() => setShowAddressModal(false)}>×</button>
        <h2>Tambah Alamat</h2>
        <p className="address-modal-hint">Alamat akan disimpan permanen dan bisa dipilih lagi di order berikutnya.</p>
        <label>Label Alamat *
          <input value={addrLabel} onChange={e => setAddrLabel(e.target.value)} placeholder="Contoh: Alamat Tegal, Rumah Bandung, Kantor" />
        </label>
        <label>Nama Penerima
          <input value={addrRecipient} onChange={e => setAddrRecipient(e.target.value)} placeholder={customer.name} />
        </label>
        <label>No HP Penerima
          <input value={addrPhone} onChange={e => setAddrPhone(e.target.value)} placeholder="No. HP penerima" />
        </label>
        <label>Alamat Lengkap *
          <textarea value={addrAddress} onChange={e => setAddrAddress(e.target.value)} placeholder="Alamat lengkap pengiriman" />
        </label>
        <label>Patokan / Landmark (opsional)
          <input value={addrLandmark} onChange={e => setAddrLandmark(e.target.value)} placeholder="Contoh: Depan masjid besar" />
        </label>
        <label>Kurir Favorit (opsional)
          <input value={addrCourier} onChange={e => setAddrCourier(e.target.value)} placeholder="Contoh: J&T, ID Express" />
        </label>
        <label>Catatan (opsional)
          <input value={addrNote} onChange={e => setAddrNote(e.target.value)} placeholder="Contoh: Kirim jam kerja" />
        </label>
        <label className="checkbox-label">
          <input type="checkbox" checked={addrIsDefault} onChange={e => setAddrIsDefault(e.target.checked)} />
          Jadikan alamat default
        </label>
        <button className="primary" onClick={handleSaveAddress}><Check size={16} /> Simpan Alamat</button>
      </section>
    </div>}


    {/* ===== MARKETER SELECTION (smart search + tambah langsung) ===== */}
    <div className="order-marketer">
      <label>Marketer</label>
      <div className="marketer-search">
        <Search size={16} />
        <input
          value={marketerSearch}
          onChange={e => setMarketerSearch(e.target.value)}
          placeholder="Cari marketer..."
        />
      </div>
      <div className="marketer-options">
        <button className={marketerId === "" ? "selected" : ""} onClick={() => { setMarketerId(""); setMarketerSearch(""); setFeeOverride(null); }}>
          <span>— Tanpa marketer —</span>
        </button>
        {marketers.filter(m => m.status === "aktif")
          .filter(m => m.name.toLowerCase().includes(marketerSearch.toLowerCase()))
          .map(m => (
            <button key={m.id} className={marketerId === m.id ? "selected" : ""} onClick={() => {
              setMarketerId(m.id);
              setMarketerSearch("");
              const suggested = items.reduce((sum, item) => {
                const feePerUnit = item.feeMarketer > 0 ? item.feeMarketer : (m.defaultFee || 0);
                return sum + feePerUnit * item.qty;
              }, 0);
              setFeeOverride(suggested);
            }}>
              <span>{m.name}</span>
              {m.defaultFee > 0 && <small>Fee {formatRupiah(m.defaultFee)}</small>}
            </button>
          ))}
        {marketerSearch.trim() && !marketers.some(m => m.status === "aktif" && m.name.toLowerCase() === marketerSearch.trim().toLowerCase()) && (

          <button className="add-new" onClick={() => { setMkName(marketerSearch.trim()); setShowMarketerModal(true); }}>
            <Plus size={15} /> Tambahkan "{marketerSearch.trim()}"
          </button>
        )}
      </div>
      <button className="add-marketer-btn" onClick={() => { setMkName(""); setMkFee(0); setMkSaveToMaster(true); setShowMarketerModal(true); }}>
        <Plus size={15} /> Tambah Marketer
      </button>
      {marketerId && (
        <div className="marketer-fee-preview">
          <label htmlFor="marketer-fee-input">Fee marketer untuk order ini</label>
          <MoneyInput
            id="marketer-fee-input"
            value={feeOverride || 0}
            onChange={setFeeOverride}
            placeholder="Contoh: 15.000, atau 0 kalau sudah dipotong sistem"
          />
          <small>Internal · tidak tampil di invoice customer. Bisa diisi 0 kalau fee sudah dipotong langsung.</small>
        </div>
      )}
    </div>

    {/* ===== TAMBAH MARKETER MODAL ===== */}
    {showMarketerModal && <div className="overlay" onClick={() => setShowMarketerModal(false)}>
      <section className="modal marketer-modal" onClick={e => e.stopPropagation()}>
        <button className="close" onClick={() => setShowMarketerModal(false)}>×</button>
        <h2>Tambah Marketer</h2>
        <label>Nama Marketer
          <input value={mkName} onChange={e => setMkName(e.target.value)} placeholder="Nama marketer" />
        </label>
        <label>Fee Default (opsional)
          <MoneyInput value={mkFee} onChange={setMkFee} placeholder="Contoh: 15.000" />
        </label>
        <label>Status</label>
        <div className="segmented">
          <button className={mkSaveToMaster ? "active" : ""} onClick={() => setMkSaveToMaster(true)}>Simpan ke Master Marketer</button>
          <button className={!mkSaveToMaster ? "active" : ""} onClick={() => setMkSaveToMaster(false)}>Hanya Order ini</button>
        </div>
        <p className="marketer-modal-hint">
          {mkSaveToMaster
            ? "Marketer akan tersimpan di master dan muncul di dropdown order berikutnya."
            : "Marketer hanya dipakai pada order ini dan tidak masuk ke database master."}
        </p>
        <button className="primary" disabled={!mkName.trim()} onClick={async () => {
          const name = mkName.trim();
          if (!name) return;
          const existing = marketers.find(m => m.name.toLowerCase() === name.toLowerCase());
          if (existing) {
            setMarketerId(existing.id);
            setShowMarketerModal(false);
            setMarketerSearch("");
            notify("Marketer sudah ada, dipilih otomatis");
            return;
          }
          const newMk: Marketer = {
            id: "mk-" + Date.now(),
            name,
            defaultFee: mkFee,
            status: "aktif",
            joinedAt: new Date().toISOString().slice(0, 10),
          };
          const updated = await addMarketer(newMk, mkSaveToMaster);
          setMarketers(updated);
          setMarketerId(newMk.id);
          setShowMarketerModal(false);
          setMarketerSearch("");
          notify(mkSaveToMaster ? "Marketer ditambahkan ke master" : "Marketer dipakai untuk order ini");
        }}><Check size={16} /> Simpan Marketer</button>
      </section>
    </div>}



    {/* ===== ITEM LIST ===== */}
    <div className="order-items">
      <div className="order-items-head">
        <h2>Item Order</h2>
        <span>{items.length} item</span>
      </div>

      {items.length === 0 && <div className="order-empty">
        <span>🛒</span>
        <p>Belum ada item. Tambahkan produk untuk memulai order.</p>
      </div>}

      {items.map(item => (
        <div className="order-item-block" key={item.id}>
          <div className="order-item">
            <span className="order-item-emoji">{item.emoji}</span>
            <div className="order-item-info">
              <b>{item.name}</b>
              {item.detail && <small>{item.detail}</small>}
              <div className="order-item-price">{formatRupiah(item.price)}</div>
              {item.feeMarketer > 0 && <small className="fee-tag">Fee {formatRupiah(item.feeMarketer)}/pcs</small>}
            </div>
            <div className="order-item-actions">
              <div className="qty-control">
                <button onClick={() => updateQty(item.id, -1)}><Minus size={14} /></button>
                <span>{item.qty}</span>
                <button onClick={() => updateQty(item.id, 1)}><Plus size={14} /></button>
              </div>
              <button className="remove-btn" onClick={() => removeItem(item.id)}><Trash2 size={15} /></button>
            </div>
          </div>
          {/* ===== KATEGORI PRODUK — tautkan item ini ke Collection Workspace ===== */}
          <div className="order-item-categories">
            <small className="category-label">🏷️ Kategori Produk</small>
            {collectionsList.length === 0 ? (
              <small className="field-hint">Belum ada Collection — buat dulu di tab Collection Workspace.</small>
            ) : (
              <div className="category-chips">
                {collectionsList.map(col => {
                  const active = (itemCategoryMap[item.id] || []).includes(col.id);
                  return (
                    <button
                      type="button"
                      key={col.id}
                      className={`category-chip ${active ? "active" : ""}`}
                      onClick={() => toggleItemCategory(item.id, col.id)}
                    >
                      {col.icon} {col.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {/* ===== SUMBER STOK — PO (default) atau Ready Stock dari gudang ===== */}
          {/* Produk yang sama bisa PO di 1 order & Ready Stock di order lain
              (mis. Niqab/Manset kadang PO kadang sisa stok), makanya ditandai
              per-item di sini, bukan tetap per Product. */}
          <div className="order-item-stages">
            <div className="order-item-stage-field">
              <small className="category-label">📦 Sumber Stok</small>
              <select value={item.stockSource || "po"} onChange={e => updateStockSource(item.id, e.target.value as "ready" | "po")}>
                <option value="po">📝 PO / Pre-Order</option>
                <option value="ready">✅ Ready Stock</option>
              </select>
            </div>
            {item.stockSource === "ready" && (
              <div className="order-item-stage-field">
                <small className="category-label">🏬 Gudang</small>
                <select value={item.warehouseId || ""} onChange={e => updateItemWarehouse(item.id, e.target.value)}>
                  <option value="">— Pilih gudang —</option>
                  {/* Gudang nonaktif tetap ditampilkan KALAU sedang terpilih di item
                      ini — supaya value dropdown gak "hilang" (gak match opsi manapun)
                      cuma karena gudangnya dinonaktifkan belakangan. Gudang nonaktif
                      lain (belum pernah dipilih) tetap disembunyikan dari pilihan baru. */}
                  {warehouseList.filter(w => w.active || w.id === item.warehouseId).map(w => {
                    const inv = item.productId ? inventoryList.find(i => i.productId === item.productId && i.warehouseId === w.id) : undefined;
                    const avail = inv ? inventoryAvailable(inv) : 0;
                    return <option key={w.id} value={w.id}>{w.name}{w.active ? "" : " (nonaktif)"} (sisa {avail})</option>;
                  })}
                </select>
              </div>
            )}
          </div>
          {/* ===== TAHAP PRODUKSI & PENGIRIMAN — per item, gak per-invoice ===== */}
          <div className="order-item-stages">
            <div className="order-item-stage-field">
              <small className="category-label">🏭 Tahap Produksi</small>
              <select value={item.productionStage || "po"} onChange={e => updateProductionStage(item.id, e.target.value as ProductionStage)}>
                {productionStageOrder.map(stage => <option key={stage} value={stage}>{productionStageInfo[stage].emoji} {productionStageInfo[stage].name}</option>)}
              </select>
            </div>
            <div className="order-item-stage-field">
              <small className="category-label">🚚 Tahap Pengiriman</small>
              <select value={item.shipmentStage || ""} onChange={e => updateShipmentStage(item.id, e.target.value as ShipmentStage | "")}>
                <option value="">— Perlu Diresi —</option>
                {(Object.keys(shipmentStageInfo) as ShipmentStage[]).map(stage => <option key={stage} value={stage}>{shipmentStageInfo[stage].emoji} {shipmentStageInfo[stage].name}</option>)}
              </select>
            </div>
          </div>
        </div>
      ))}
    </div>

    {/* ===== ADD PRODUCT BUTTONS ===== */}
    <div className="add-product-buttons">
      <button className="add-jilbab-btn" onClick={() => setShowJilbabForm(true)}>
        <span className="add-btn-emoji">🧕</span>
        <div><b>Amna Jilbab</b><small>Size, pad, modifikasi</small></div>

        <ChevronRight size={18} />
      </button>
      <button className="add-other-btn" onClick={() => setShowProductPicker(true)}>
        <span className="add-btn-emoji">🛍️</span>
        <div><b>Produk Lainnya</b><small>Buku, niqab, aksesoris, dll</small></div>
        <ChevronRight size={18} />
      </button>
    </div>

    {/* ===== INVOICE SETTINGS ===== */}
    <div className="invoice-settings">
      <h2>Pengaturan Invoice</h2>

      <div className="invoice-type-banner">
        <span className="type-emoji">{invoiceType === "po-amna" ? "💰" : invoiceType === "pelunasan-amna" ? "✅" : invoiceType === "buku" ? "📚" : invoiceType === "ready" ? "🛍️" : "📦"}</span>
        <div>
          <b>{invoiceTypeInfo[invoiceType].name}</b>
          <small>{invoiceTypeInfo[invoiceType].desc}</small>
        </div>
      </div>

      {hasAmna && <div className="setting-row">
        <label>Status Amna</label>
        <div className="segmented">
          <button className={amnaStatus === "po" ? "active" : ""} onClick={() => setAmnaStatus("po")}>PO / DP</button>
          <button className={amnaStatus === "lunas" ? "active" : ""} onClick={() => setAmnaStatus("lunas")}>Pelunasan</button>
        </div>
      </div>}

      {hasAmna && <div className="setting-row">
        <label>Batch Produksi</label>
        <select value={batch} onChange={e => setBatch(e.target.value)}>
          {batchNames.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <div className="add-batch-row" style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input
            type="text"
            value={newBatchInput}
            onChange={e => setNewBatchInput(e.target.value)}
            placeholder="Sudah sampai Batch 10? Ketik di sini"
            style={{ flex: 1 }}
          />
          <button
            type="button"
            className="secondary"
            onClick={async () => {
              const name = newBatchInput.trim();
              if (!name) return;
              const updated = await addBatchName(name);
              setBatchNames(updated);
              setBatch(name);
              setNewBatchInput("");
              await getOrCreateBatchCollection(name);
              notify(`Batch "${name}" ditambahkan`);
            }}
          >
            <Plus size={15} /> Tambah Batch
          </button>
        </div>
        <small className="batch-hint">Pilih batch produksi untuk order ini, atau tambahkan batch baru kalau belum ada di daftar.</small>
      </div>}

      {/* ===== DISCOUNT ===== */}

      <div className="setting-row">
        <label>Diskon</label>
        <div className="discount-row">
          <select value={discountType} onChange={e => { setDiscountType(e.target.value as DiscountType); setDiscountValue(0); }}>
            <option value="percent">Persen (%)</option>
            <option value="nominal">Nominal (Rp)</option>
          </select>
          {discountType === "percent" ? (
            <input
              type="number"
              min="0"
              max="100"
              value={discountValue || ""}
              placeholder="10"
              onChange={e => setDiscountValue(Math.max(0, Number(e.target.value) || 0))}
            />
          ) : (
            <MoneyInput value={discountValue} onChange={setDiscountValue} placeholder="20.000" />
          )}
        </div>
        {discountAmount > 0 && <div className="discount-preview">Diskon: <b>-{formatRupiah(discountAmount)}</b></div>}
      </div>

      <div className="setting-row">
        <label>Ongkir</label>
        <select value={ongkirId} onChange={e => setOngkirId(e.target.value)}>
          {ongkirOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        {ongkirId === "custom" && <>
          <input type="text" value={customOngkirLabel} placeholder="Nama ekspedisi (contoh: JNE, SiCepat)" onChange={e => setCustomOngkirLabel(e.target.value)} style={{ marginBottom: 8 }} />
          <MoneyInput placeholder="Nominal ongkir" value={customOngkir} onChange={setCustomOngkir} />
        </>}
        {ongkirId !== "custom" && <div className="ongkir-preview">Ongkir: <b>{formatRupiah(ongkir)}</b></div>}
      </div>

      {splitShopee && <div className="shopee-split-info">
        <p>🛒 <b>Split Bill Shopee aktif</b> (ongkir = Shopee) — Rp{fmt(SPLIT_BILL_PRODUK)} dari Total Tagihan otomatis dianggap sudah terbayar lewat checkout Shopee. Sisa yang perlu ditransfer manual sudah dikurangi otomatis di bawah.</p>
        <p className="muted">Detail biaya admin per kategori ada di halaman Katalog → tab Split Shopee.</p>
      </div>}

      {editingOrderId ? (
        <div className="setting-row payment-history-block">
          <label>Riwayat Pembayaran</label>
          <div className="payment-total-preview">Total dibayar: <b>{formatRupiah(dpAmount + splitShopeeCredit)}</b></div>
          {orderPayments.length === 0 && <p className="field-hint">Belum ada pembayaran tercatat untuk order ini.</p>}
          {orderPayments.map(p => (
            <div className="payment-row" key={p.id}>
              <div className="payment-row-info">
                <b>{formatRupiah(p.amount)}</b>
                <small>{p.dateReceived}{p.note ? ` · ${p.note}` : ""}</small>
                <small className={p.status === "sudah-ditarik" ? "payment-withdrawn" : "payment-pending"}>
                  {p.status === "sudah-ditarik" ? `✅ Sudah ditarik · ${p.dateWithdrawn}` : "🕒 Belum ditarik"}
                </small>
              </div>
              <div className="payment-row-actions">
                <button type="button" onClick={() => handleTogglePaymentWithdrawn(p)} aria-label="Tandai status tarik" title={p.status === "sudah-ditarik" ? "Tandai belum ditarik" : "Tandai sudah ditarik"}><Landmark size={14} /></button>
                <button type="button" onClick={() => handleDeletePayment(p)} aria-label="Hapus pembayaran" title="Hapus"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
          <div className="payment-topup-row">
            <MoneyInput value={topUpAmount} onChange={setTopUpAmount} placeholder="Nominal transfer masuk" />
            <button type="button" className="add-payment-btn" onClick={handleAddPayment}><Plus size={15} /> Catat Pembayaran</button>
          </div>
        </div>
      ) : (
        <div className="setting-row">
          <label>DP / Deposit (Rp)</label>
          <MoneyInput value={dpAmount} onChange={setDpAmount} placeholder="0" />
        </div>
      )}

      <div className="setting-row">
        <label>Catatan (opsional)</label>
        <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Contoh: kirim sekalian jika semua barang ready" />
        <small className="field-hint">Catatan ini ikut tampil di invoice & pesan WhatsApp ke customer.</small>
      </div>

      <div className="setting-row">
        <label>📌 Catatan Internal (opsional)</label>
        <textarea value={internalNote} onChange={e => setInternalNote(e.target.value)} placeholder="Contoh: customer sensitif warna, jangan kirim sebelum dikonfirmasi ulang" />
        <small className="field-hint">Khusus admin — TIDAK PERNAH ikut ke invoice atau WhatsApp customer.</small>
      </div>
    </div>

    {/* ===== TOTAL ===== */}
    <div className="order-summary">
      <div className="summary-row"><span>Subtotal</span><b>{formatRupiah(subtotal)}</b></div>
      {discountAmount > 0 && <div className="summary-row"><span>Diskon</span><b>-{formatRupiah(discountAmount)}</b></div>}
      <div className="summary-row"><span>Ongkir</span><b>{ongkir > 0 ? formatRupiah(ongkir) : "—"}</b></div>
      <div className="summary-row total-row"><span>Total Tagihan</span><b>{formatRupiah(total)}</b></div>
      {dpAmount > 0 && <div className="summary-row"><span>DP / Deposit</span><b>-{formatRupiah(dpAmount)}</b></div>}
      {splitShopeeCredit > 0 && <div className="summary-row"><span>Split Bill Shopee (produk)</span><b>-{formatRupiah(splitShopeeCredit)}</b></div>}
      {(dpAmount > 0 || splitShopeeCredit > 0) && <div className="summary-row"><span>Sisa Pelunasan</span><b>{formatRupiah(Math.max(0, total - dpAmount - splitShopeeCredit))}</b></div>}
      {marketerId && effectiveFee > 0 && <div className="summary-row fee-row"><span>Fee marketer (internal)</span><b>{formatRupiah(effectiveFee)}</b></div>}
    </div>

    <button className="primary generate-invoice" onClick={generateInvoice}><FileText size={17} /> Generate Invoice</button>

    {/* ===== JILBAB FORM MODAL ===== */}
    {showJilbabForm && <div className="overlay" onClick={() => setShowJilbabForm(false)}>
      <section className="modal jilbab-form" onClick={e => e.stopPropagation()}>
        <button className="close" onClick={() => setShowJilbabForm(false)}>×</button>
        <p className="eyebrow">AMNA JILBAB · PITCH BLACK ANTI UV</p>
        <h2>Konfigurasi Jilbab</h2>

        <label>Size
          <div className="option-grid size-grid">
            {jilbabSizes.map(s => (
              <button key={s.id} className={jSize === s.id ? "selected" : ""} onClick={() => setJSize(s.id)}>
                <b>{s.name}</b><small>{formatRupiah(s.price)}</small>
              </button>
            ))}
          </div>
        </label>

        <label>Pad
          <div className="option-grid">
            {jilbabPads.map(p => (
              <button key={p.id} className={jPad === p.id ? "selected" : ""} onClick={() => setJPad(p.id)}>
                <b>{p.name}</b>
              </button>
            ))}
          </div>
        </label>

        <div className="jilbab-fixed-info">
          <div><span>Kain</span><b>{AMNA_DEFAULT_FABRIC}</b></div>
          <div><span>Warna</span><b>{AMNA_DEFAULT_COLOR}</b></div>
        </div>

        <label>Modifikasi
          <div className="mod-check-list">
            {jilbabModifikasi.map(m => (
              <label key={m.id} className={jMods.includes(m.id) ? "selected" : ""}>
                <input type="checkbox" checked={jMods.includes(m.id)} onChange={() => toggleMod(m.id)} />
                <span>{m.name}</span>
                {m.price > 0 && <b>+{formatRupiah(m.price)}</b>}
              </label>
            ))}
          </div>
        </label>

        {jMods.includes("request-khusus") && <div className="request-fields">
          <label>Nama Request
            <input value={jRequestName} onChange={e => setJRequestName(e.target.value)} placeholder="Contoh: Lebar wajah 30 cm, Tali kanan kiri bagian dalam, Panjang custom, dll." />
          </label>
          <label>Harga Tambahan (Rp)
            <MoneyInput value={jRequestPrice} onChange={setJRequestPrice} placeholder="Contoh: 8.000" />
          </label>
        </div>}

        <div className="jilbab-qty">
          <label>Jumlah</label>
          <div className="qty-control large">
            <button onClick={() => setJQty(Math.max(1, jQty - 1))}><Minus size={16} /></button>
            <span>{jQty}</span>
            <button onClick={() => setJQty(jQty + 1)}><Plus size={16} /></button>
          </div>
        </div>

        <div className="jilbab-price-preview">
          <span>Harga dasar</span>
          <b>{formatRupiah(jilbabSizes.find(s => s.id === jSize)!.price)}</b>
          {jilbabModifikasi.filter(m => jMods.includes(m.id) && m.price > 0).map(m => (
            <span key={m.id}>{m.name}</span>
          ))}
          {jMods.includes("request-khusus") && jRequestPrice > 0 && <span>Request Khusus</span>}
          <span>Harga satuan</span>
          <b>{formatRupiah(jilbabSizes.find(s => s.id === jSize)!.price + jilbabModifikasi.filter(m => jMods.includes(m.id)).reduce((s, m) => s + m.price, 0) + (jMods.includes("request-khusus") ? jRequestPrice : 0))}</b>
          <span>Total ({jQty} pcs)</span>
          <b className="total">{formatRupiah((jilbabSizes.find(s => s.id === jSize)!.price + jilbabModifikasi.filter(m => jMods.includes(m.id)).reduce((s, m) => s + m.price, 0) + (jMods.includes("request-khusus") ? jRequestPrice : 0)) * jQty)}</b>
        </div>

        {/* ===== PREVIEW PRODUK ===== */}
        <div className="jilbab-preview">
          <h3>Preview Produk</h3>
          <div className="preview-title">Jilbab {AMNA_DEFAULT_FABRIC}</div>
          <div className="preview-row"><span>Size</span><b>{jilbabSizes.find(s => s.id === jSize)!.name}</b></div>
          <div className="preview-row"><span>Pad</span><b>{jilbabPads.find(p => p.id === jPad)!.name}</b></div>
          <div className="preview-row"><span>Warna</span><b>{AMNA_DEFAULT_COLOR}</b></div>
          {jMods.length > 0 && <div className="preview-mods">
            <span>Modifikasi</span>
            <div>
              {jilbabModifikasi.filter(m => jMods.includes(m.id) && m.id !== "request-khusus").map(m => (
                <div key={m.id} className="preview-mod">✓ {m.name} <small>(+{formatRupiah(m.price)})</small></div>
              ))}
              {jMods.includes("request-khusus") && jRequestName.trim() && (
                <div className="preview-mod">✓ Request: {jRequestName.trim()} {jRequestPrice > 0 && <small>(+{formatRupiah(jRequestPrice)})</small>}</div>
              )}
            </div>
          </div>}
          <div className="preview-total">
            <span>Harga Produk</span>
            <b>{formatRupiah(jilbabSizes.find(s => s.id === jSize)!.price + jilbabModifikasi.filter(m => jMods.includes(m.id)).reduce((s, m) => s + m.price, 0) + (jMods.includes("request-khusus") ? jRequestPrice : 0))}</b>
          </div>
        </div>

        <button className="primary" onClick={addJilbab}><Plus size={17} /> Tambahkan ke Order</button>

      </section>
    </div>}


    {/* ===== PRODUCT PICKER MODAL ===== */}
    {showProductPicker && <div className="overlay" onClick={() => { setShowProductPicker(false); setVariantPickProduct(null); }}>
      <section className="modal product-picker" onClick={e => e.stopPropagation()}>
        <button className="close" onClick={() => { setShowProductPicker(false); setVariantPickProduct(null); }}>×</button>
        {variantPickProduct ? (
          <>
            <button type="button" className="quick-payment-back" onClick={() => setVariantPickProduct(null)}><ChevronLeft size={16} /> Kembali</button>
            <h2>Pilih Warna/Varian</h2>
            <p className="field-hint" style={{ marginBottom: 14 }}>{variantPickProduct.emoji} {variantPickProduct.name} · {formatRupiah(variantPickProduct.price)}</p>
            <div className="warna-chips">
              {variantPickProduct.variants!.map(v => (
                <button key={v} type="button" onClick={() => addProduct(variantPickProduct, v)}>{v}</button>
              ))}
            </div>
          </>
        ) : (
          <>
            <h2>Pilih Produk</h2>
            <div className="picker-search">
              <Search size={16} />
              <input placeholder="Cari produk..." value={productSearch} onChange={e => setProductSearch(e.target.value)} />
            </div>
            <div className="picker-list">
              {productList
                .filter(p => p.category !== "amna-jilbab" && p.active !== false)
                .filter(p => p.name.toLowerCase().includes(productSearch.trim().toLowerCase()))
                .map(p => (
                <button key={p.id} onClick={() => (p.variants && p.variants.length > 1) ? setVariantPickProduct(p) : addProduct(p, p.variants?.[0])}>
                  <span className="picker-emoji">{p.emoji}</span>
                  <div><b>{p.name}</b><small>{formatRupiah(p.price)}</small></div>
                  <Plus size={16} />
                </button>
              ))}
            </div>
          </>
        )}
      </section>
    </div>}

    {/* ===== INVOICE MODAL ===== */}
    {invoice && <div className="overlay" onClick={() => setInvoice(null)}>
      <section className="modal invoice-modal" onClick={e => e.stopPropagation()}>
        <button className="close" onClick={() => setInvoice(null)}>×</button>
        <div className="invoice-head">
          <div className="invoice-brand">Afeena & YasLa</div>
          <div className="invoice-title">INVOICE</div>
          <div className="invoice-type-tag">{invoiceTypeInfo[invoice.type].name}</div>
          <div className="invoice-meta">
            <span>No: <b>{invoice.number}</b></span>
            <span>Tanggal: <b>{invoice.date}</b></span>
            <span>Customer: <b>{invoice.customer}</b></span>
            {invoice.phone && <span>No. HP: <b>{invoice.phone}</b></span>}
            {invoice.address && <span>Alamat: <b>{invoice.address}</b></span>}
            {invoice.marketerName && <span>Marketer: <b>{invoice.marketerName}</b></span>}
            {invoice.batch && <span>Batch: <b>{invoice.batch}</b></span>}
          </div>

        </div>
        <div className="invoice-items">
          {invoice.items.map((item, i) => {
            const productInfo = productList.find(p => p.id === item.productId);
            return (
              <div className="invoice-item" key={i}>
                <div className="invoice-item-name">
                  {item.emoji} {item.name}{item.detail && <small>{item.detail}</small>}
                  {productInfo?.estimasiReady && <small>Estimasi ready: {productInfo.estimasiReady}</small>}
                  {productInfo?.estimasiPembayaran && <small>Estimasi pembayaran: {productInfo.estimasiPembayaran}</small>}
                </div>
                <div className="invoice-item-qty">x{item.qty}</div>
                <div className="invoice-item-price">{formatRupiah(item.price * item.qty)}</div>
              </div>
            );
          })}
          {invoice.discountAmount > 0 && <div className="invoice-item">
            <div className="invoice-item-name">🏷️ Diskon <small>{invoice.discountType === "percent" ? `${invoice.discountValue}%` : formatRupiah(invoice.discountValue)}</small></div>
            <div className="invoice-item-price">-{formatRupiah(invoice.discountAmount)}</div>
          </div>}
          {invoice.ongkir > 0 && <div className="invoice-item">
            <div className="invoice-item-name">🚚 Ongkir <small>{invoice.ongkirLabel}</small></div>
            <div className="invoice-item-price">{formatRupiah(invoice.ongkir)}</div>
          </div>}
        </div>
        <div className="invoice-totals">
          {(() => {
            const totalBeratGram = invoice.items.reduce((sum, item) => {
              const productInfo = productList.find(p => p.id === item.productId);
              return sum + (productInfo?.beratGram || 0) * item.qty;
            }, 0);
            return totalBeratGram > 0 ? (
              <div><span>Estimasi Berat Paket</span><b>{(totalBeratGram / 1000).toLocaleString("id-ID", { maximumFractionDigits: 2 })} kg</b></div>
            ) : null;
          })()}
          <div><span>Subtotal</span><b>{formatRupiah(invoice.subtotal)}</b></div>
          {invoice.discountAmount > 0 && <div><span>Diskon</span><b>-{formatRupiah(invoice.discountAmount)}</b></div>}
          {invoice.ongkir > 0 && <div><span>Ongkir</span><b>{formatRupiah(invoice.ongkir)}</b></div>}
          {invoice.dp > 0 && <div><span>DP / Deposit</span><b>-{formatRupiah(invoice.dp)}</b></div>}
          {invoice.splitShopee && <div><span>Split Bill Shopee (produk)</span><b>-{formatRupiah(SPLIT_BILL_PRODUK)}</b></div>}
          <div className="invoice-grand"><span>Total Tagihan</span><b>{formatRupiah(invoice.total)}</b></div>
          {(invoice.type === "po-amna" || invoice.dp > 0 || invoice.splitShopee) && <div className="invoice-sisa">
            <span>Sisa Pelunasan</span><b>{formatRupiah(Math.max(0, invoice.total - invoice.dp - (invoice.splitShopee ? SPLIT_BILL_PRODUK : 0)))}</b>
          </div>}
        </div>
        {invoice.note && <div className="invoice-note"><b>Catatan:</b> {invoice.note}</div>}
        <div className="invoice-actions">
          <button className="primary" onClick={sendInvoiceToWhatsApp}><MessageCircle size={16} /> Kirim ke WhatsApp</button>
          <button className="secondary" onClick={copyInvoice}><Copy size={16} /> Salin Invoice</button>
        </div>
        <div className="invoice-actions">
          <button className="secondary" onClick={() => { setInvoice(null); setItems([]); setItemCategoryMap({}); setDpAmount(0); setOrderPayments([]); setTopUpAmount(0); setNote(""); setInternalNote(""); setDiscountValue(0); setMarketerId(""); setEditingOrderId(null); notify("Order baru siap dibuat"); }}><Check size={16} /> Selesai</button>
        </div>
      </section>
    </div>}

    {deleteOrderConfirmOpen && (
      <div className="overlay" onClick={() => setDeleteOrderConfirmOpen(false)}>
        <section className="modal confirm-modal" onClick={e => e.stopPropagation()}>
          <h2>Hapus Order Ini?</h2>
          <p>Order <b>{existingOrders.find(o => o.id === editingOrderId)?.number}</b> akan dihapus permanen, termasuk fee marketer dan tautan Collection yang terkait. Tindakan ini tidak bisa dibatalkan.</p>
          <div className="confirm-actions">
            <button className="secondary" onClick={() => setDeleteOrderConfirmOpen(false)}>Batal</button>
            <button className="danger" onClick={handleDeleteOrder}><Trash2 size={15} /> Hapus</button>
          </div>
        </section>
      </div>
    )}

    <BottomNav />




    {notice && <div className="toast"><Check size={17} />{notice}</div>}
  </main>;
}
