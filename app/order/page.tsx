"use client";


import { ArrowLeft, Bell, Check, ChevronRight, Copy, FileText, MessageCircle, Minus, Plus, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BottomNav } from "../components/BottomNav";
import { goBack } from "../lib/goBack";


import { products, formatRupiah, jilbabSizes, jilbabPads, jilbabModifikasi, AMNA_DEFAULT_FABRIC, AMNA_DEFAULT_COLOR, ongkirOptions, invoiceTypeInfo, determineRekening, type Product, type InvoiceType } from "../data/products";
import { toDisplayCustomer, createNewCustomer, EMPTY_CUSTOMER, type Customer, type CustomerAddress } from "../data/customers";
import { getProducts, getMarketers, getActiveMarketers, addMarketer, saveOrder, updateOrder, deleteOrder, getOrders, getOrderById, saveFee, removeFeeForOrder, getNextInvoiceNumber, getBatchNames, addBatchName, calculateDiscount, calculateOrderFee, getCustomerAddresses, saveAddress, type OrderItemSnapshot, type DiscountType, type OrderRecord, type FeeRecord, type CustomRequest, type Marketer, type MarketerStatus } from "../data/store";
import { getCustomers, getCustomer as getCentralCustomer, addCustomer, syncOrdersFromStore, refreshCentralOrderFromStore } from "../data/central";
import { getOrCreateBatchCollection, syncOrderBatchCollection, removeOrderFromAllCollections } from "../data/collections";
import { NewCustomerForm } from "../components/NewCustomerForm";
import { MoneyInput } from "../components/MoneyInput";

const NEW_CUSTOMER_OPTION = "__new_customer__";

function loadFirstCustomer(): Customer {
  const first = getCustomers()[0];
  return first ? toDisplayCustomer(first, getCustomerAddresses(first.id)) : EMPTY_CUSTOMER;
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
  const [ongkirId, setOngkirId] = useState("id-jawa");
  const [customOngkir, setCustomOngkir] = useState(0);
  const [customOngkirLabel, setCustomOngkirLabel] = useState("");
  const [splitShopee, setSplitShopee] = useState(false);
  const [dpAmount, setDpAmount] = useState(0);
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


  const [productList, setProductList] = useState<ReturnType<typeof getProducts>>([]);
  const [marketers, setMarketers] = useState<ReturnType<typeof getMarketers>>([]);
  const [customerAddresses, setCustomerAddresses] = useState<CustomerAddress[]>(() => getCustomerAddresses(customer.id));
  // Kosong dulu di render pertama (server tidak punya localStorage) — diisi di
  // HYDRATION FIX effect di bawah, sama seperti productList/marketers.
  const [customerList, setCustomerList] = useState<{ id: string; name: string; city: string }[]>([]);

  const notify = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2600); };

  // ===== HYDRATION FIX: Muat data dari localStorage setelah hydration =====
  useEffect(() => {
    if (customer.id === "") {
      // Kalau datang dari profil customer (?customerId=...), langsung pilihkan
      // customer itu — bukan customer pertama di daftar.
      const fromParam = initialCustomerId ? getCentralCustomer(initialCustomerId) : undefined;
      const first = fromParam ? toDisplayCustomer(fromParam, getCustomerAddresses(fromParam.id)) : loadFirstCustomer();
      setCustomer(first);
      setSelectedAddressId(first.defaultAddressId || "");
      return; // effect ini jalan lagi begitu customer.id berubah, lanjutkan di sana
    }
    setExistingOrders(getOrders());
    setProductList(getProducts());
    setMarketers(getMarketers());
    setCustomerAddresses(getCustomerAddresses(customer.id));
    setCustomerList(getCustomers());
    setBatchNames(getBatchNames());
  }, [customer.id]);

  // ===== CUSTOMER & SHIPPING ADDRESS =====
  // Alamat default otomatis terpilih saat customer dipilih.
  // Nama Penerima, No HP, dan Alamat otomatis terisi dari alamat terpilih.
  // Alamat digabung dari seed (customers.ts) + alamat yang disimpan user (localStorage).
  const selectedAddress: CustomerAddress | undefined = customerAddresses.find(a => a.id === selectedAddressId);


  const handleCustomerChange = (customerId: string) => {
    if (customerId === NEW_CUSTOMER_OPTION) { setNewCustomerOpen(true); return; }
    const central = getCentralCustomer(customerId);
    if (!central) return;
    const c = toDisplayCustomer(central, getCustomerAddresses(customerId));
    setCustomer(c);
    const all = getCustomerAddresses(customerId);
    const defAddr = all.find(a => a.isDefault) || all[0];
    setSelectedAddressId(defAddr?.id || "");
    setRecipientName(defAddr?.recipientName || "");
    setPhone(defAddr?.phone || "");
    setAddress(defAddr ? `${defAddr.address}${defAddr.landmark ? ` (${defAddr.landmark})` : ""}` : "");
  };

  // ===== CUSTOMER BARU LANGSUNG DARI HALAMAN ORDER =====
  const handleCreateCustomer = (name: string, city: string) => {
    const created = createNewCustomer(name, city);
    addCustomer(created);
    setCustomerList(getCustomers());
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
  const handleSaveAddress = () => {
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
    saveAddress(newAddr);
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

    // Find matching product for fee/hpp snapshot
    const baseProduct = productList.find(p => p.category === "amna-jilbab" && p.name.includes(size.name));
    const hpp = baseProduct?.hpp || 180000;
    const fee = baseProduct?.feeMarketer || 15000;

    setItems(prev => [...prev, {
      id: "jilbab-" + Date.now(),
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
    setShowJilbabForm(false);
    setJMods([]);
    setJQty(1);
    setJRequestName("");
    setJRequestPrice(0);
    notify("Jilbab ditambahkan ke order");
  };


  const addProduct = (product: Product) => {
    setItems(prev => [...prev, {
      id: product.id + "-" + Date.now(),
      name: product.name,
      emoji: product.emoji,
      qty: 1,
      price: product.price,
      hpp: product.hpp || 0,
      feeMarketer: product.feeMarketer || 0,
      category: product.category,
      productId: product.id,
    }]);
    setShowProductPicker(false);
    notify(`${product.name} ditambahkan`);
  };

  const updateQty = (id: string, delta: number) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, qty: Math.max(1, item.qty + delta) } : item));
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
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
    });

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
    if (inv.type === "po-amna") {
      lines.push("TOTAL:");
      lines.push("Rp" + fmt(inv.total));
      lines.push("");
      lines.push("Deposit:");
      lines.push("Rp" + fmt(inv.dp));
      lines.push("");
      lines.push("Sisa Pelunasan:");
      lines.push("Rp" + fmt(inv.total - inv.dp));
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

  const generateInvoice = () => {
    if (items.length === 0) { notify("Tambahkan produk dulu"); return; }
    const now = new Date();
    const number = getNextInvoiceNumber();
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
    const existingOrder = editingOrderId ? getOrderById(editingOrderId) : undefined;
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
    }));


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
      dp: dpAmount,
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
    if (editingOrderId) {
      updateOrder(orderRecord);
      // PHASE 11C: Re-project edited order into central (idempotent by order ID).
      // Non-authoritative — if projection fails, legacy edit is preserved.
      try {
        refreshCentralOrderFromStore(orderId);
      } catch {
        // Projection failure is non-authoritative; legacy edit already saved.
      }
    } else {
      saveOrder(orderRecord);
      // PHASE 11C: Project new order into central (idempotent by order ID).
      // Non-authoritative — if projection fails, legacy order is preserved.
      try {
        syncOrdersFromStore();
      } catch {
        // Projection failure is non-authoritative; legacy order already saved.
      }
    }

    // ===== SINKRON COLLECTION "PO BATCH" =====
    // Non-fatal — kegagalan di sini tidak boleh menggagalkan order yang sudah tersimpan.
    try {
      syncOrderBatchCollection(orderId, hasAmna ? batch : undefined, existingOrder?.batch);
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
      saveFee(feeRecord);
    } else if (editingOrderId) {
      // Marketer/fee dihapus saat edit — bersihkan FeeRecord lama order ini
      // supaya gak nyangkut selamanya di halaman Fee.
      removeFeeForOrder(orderId);
    }

    // Refresh daftar order agar order yang baru dibuat/diedit langsung terlihat.
    setExistingOrders(getOrders());
  };

  // ===== LOAD ORDER KE FORM (EDIT MODE) =====
  const loadOrderIntoForm = (order: OrderRecord) => {
    // Load customer
    const centralC = (order.customerId ? getCentralCustomer(order.customerId) : undefined) || getCustomers()[0];
    const c = centralC ? toDisplayCustomer(centralC, getCustomerAddresses(centralC.id)) : EMPTY_CUSTOMER;
    setCustomer(c);
    // Set selected address to default if available
    const all = getCustomerAddresses(c.id);
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
    }));
    setItems(loadedItems);

    // Load settings
    setDiscountType(order.discountType);
    setDiscountValue(order.discountValue);
    const matchedOngkir = ongkirOptions.find(o => o.name === order.ongkirLabel);
    setOngkirId(matchedOngkir ? matchedOngkir.id : "custom");
    setCustomOngkir(order.ongkir);
    setCustomOngkirLabel(matchedOngkir ? "" : order.ongkirLabel);
    setDpAmount(order.dp);
    setNote(order.note);
    setInternalNote(order.internalNote || "");
    setMarketerId(order.marketerId || "");
    setFeeOverride(order.marketerId ? order.totalFee : null);
    if (order.batch) setBatchNames(addBatchName(order.batch));
    setBatch(order.batch || "Batch 7");

    // Set editing mode
    setEditingOrderId(order.id);
    setShowOrderList(false);
    notify(`Order ${order.number} dimuat untuk diedit`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ===== HAPUS ORDER =====
  // Ikut membersihkan FeeRecord & tautan Collection order ini supaya tidak
  // ada catatan lain yang menunjuk ke order yang sudah tidak ada.
  const handleDeleteOrder = () => {
    if (!editingOrderId) return;
    const deletedId = editingOrderId;
    const deletedNumber = existingOrders.find(o => o.id === deletedId)?.number || "";
    deleteOrder(deletedId);
    removeFeeForOrder(deletedId);
    try { removeOrderFromAllCollections(deletedId); } catch { /* non-fatal */ }
    setEditingOrderId(null);
    setItems([]);
    setDpAmount(0);
    setNote("");
    setInternalNote("");
    setDiscountValue(0);
    setMarketerId("");
    setBatch("Batch 7");
    setDeleteOrderConfirmOpen(false);
    setExistingOrders(getOrders());
    notify(`Order ${deletedNumber} dihapus permanen`);
  };

  // Datang dari tab Order di profil customer (?orderId=...) — langsung buka
  // order itu dalam mode edit, sekali saja.
  useEffect(() => {
    if (orderIdLoaded || !initialOrderId) return;
    const order = getOrderById(initialOrderId);
    if (order) loadOrderIntoForm(order);
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
            setDpAmount(0);
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
        <button className="primary" disabled={!mkName.trim()} onClick={() => {
          const name = mkName.trim();
          if (!name) return;
          const existing = getMarketers().find(m => m.name.toLowerCase() === name.toLowerCase());
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
          addMarketer(newMk, mkSaveToMaster);
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
        <div className="order-item" key={item.id}>
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
            onClick={() => {
              const name = newBatchInput.trim();
              if (!name) return;
              const updated = addBatchName(name);
              setBatchNames(updated);
              setBatch(name);
              setNewBatchInput("");
              getOrCreateBatchCollection(name);
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
          <select value={discountType} onChange={e => setDiscountType(e.target.value as DiscountType)}>
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

      <div className="setting-row">
        <label className="checkbox-label">
          <input type="checkbox" checked={splitShopee} onChange={e => setSplitShopee(e.target.checked)} />
          Split Shopee (checkout via Shopee)
        </label>
      </div>

      {splitShopee && <div className="shopee-split-info">
        <p>📚 Buku: Shopee <b>Rp3.385</b> (Rp1.500 produk + Rp1.885 admin) · Transfer: Total − Rp1.500</p>
        <p>🧕 Afeena: Shopee <b>Rp3.500</b> (Rp1.500 produk + Rp2.000 admin) · Transfer: Total − Rp1.500</p>
        <p>💰 DP Amna: Tetap Rp100.000, potongan Rp1.500 dihitung saat pelunasan</p>
      </div>}

      <div className="setting-row">
        <label>DP / Deposit (Rp)</label>
        <MoneyInput value={dpAmount} onChange={setDpAmount} placeholder="0" />
      </div>

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
      {dpAmount > 0 && <div className="summary-row"><span>Sisa Pelunasan</span><b>{formatRupiah(total - dpAmount)}</b></div>}
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
          <div className="preview-title">Amna Jilbab {AMNA_DEFAULT_FABRIC}</div>
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
    {showProductPicker && <div className="overlay" onClick={() => setShowProductPicker(false)}>
      <section className="modal product-picker" onClick={e => e.stopPropagation()}>
        <button className="close" onClick={() => setShowProductPicker(false)}>×</button>
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
            <button key={p.id} onClick={() => addProduct(p)}>
              <span className="picker-emoji">{p.emoji}</span>
              <div><b>{p.name}</b><small>{formatRupiah(p.price)}</small></div>
              <Plus size={16} />
            </button>
          ))}
        </div>
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
          {invoice.items.map((item, i) => (
            <div className="invoice-item" key={i}>
              <div className="invoice-item-name">{item.emoji} {item.name}{item.detail && <small>{item.detail}</small>}</div>
              <div className="invoice-item-qty">x{item.qty}</div>
              <div className="invoice-item-price">{formatRupiah(item.price * item.qty)}</div>
            </div>
          ))}
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
          <div><span>Subtotal</span><b>{formatRupiah(invoice.subtotal)}</b></div>
          {invoice.discountAmount > 0 && <div><span>Diskon</span><b>-{formatRupiah(invoice.discountAmount)}</b></div>}
          {invoice.ongkir > 0 && <div><span>Ongkir</span><b>{formatRupiah(invoice.ongkir)}</b></div>}
          {invoice.dp > 0 && <div><span>DP / Deposit</span><b>-{formatRupiah(invoice.dp)}</b></div>}
          <div className="invoice-grand"><span>Total Tagihan</span><b>{formatRupiah(invoice.total)}</b></div>
          {invoice.type === "po-amna" && <div className="invoice-sisa">
            <span>Sisa Pelunasan</span><b>{formatRupiah(invoice.total - invoice.dp)}</b>
          </div>}
        </div>
        {invoice.note && <div className="invoice-note"><b>Catatan:</b> {invoice.note}</div>}
        <div className="invoice-actions">
          <button className="primary" onClick={sendInvoiceToWhatsApp}><MessageCircle size={16} /> Kirim ke WhatsApp</button>
          <button className="secondary" onClick={copyInvoice}><Copy size={16} /> Salin Invoice</button>
        </div>
        <div className="invoice-actions">
          <button className="secondary" onClick={() => { setInvoice(null); setItems([]); setDpAmount(0); setNote(""); setInternalNote(""); setDiscountValue(0); setMarketerId(""); setEditingOrderId(null); notify("Order baru siap dibuat"); }}><Check size={16} /> Selesai</button>
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
