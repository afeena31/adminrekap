"use client";

import { ArrowLeft, Bell, Factory, Truck, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BottomNav } from "../components/BottomNav";
import { goBack } from "../lib/goBack";
import {
  getOrders,
  productionStageOrder,
  productionStageInfo,
  shipmentStageInfo,
  type OrderRecord,
  type ProductionStage,
  type ShipmentStage,
} from "../data/store";

type BoardMode = "produksi" | "pengiriman";

const shipmentStageColumns: ShipmentStage[] = ["antre-packing", "sudah-dipacking", "proses-resi", "dalam-pengiriman", "ditunda", "selesai", "retur", "refund"];
// productionStageOrder (store.ts) SENGAJA gak lagi termasuk "siap-kirim"
// (rute baru berhenti di "Proses Packing") — tapi item LAMA yang masih
// bertahap "siap-kirim" tetap perlu kolom sendiri di papan ini, kalau
// enggak dia hilang total dari SEMUA kolom (gak match filter manapun).
const productionStageColumns: ProductionStage[] = [...productionStageOrder, "siap-kirim"];

// ===== PAPAN PRODUKSI & PENGIRIMAN — lintas customer =====
// Tahap 4 (lanjutan kecil): item order ASLI (productionStage/shipmentStage,
// store.ts) dikelompokkan per tahap di SATU layar, lintas semua customer —
// jawaban ke "lihat semua yang lagi QC sekarang, siapa saja customernya"
// tanpa harus buka profil customer satu-satu.
export default function ProduksiPage() {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [mode, setMode] = useState<BoardMode>("produksi");

  // HYDRATION FIX: kosong dulu di render pertama, diisi setelah mount.
  useEffect(() => {
    setOrders(getOrders());
  }, []);

  const allItems = orders.flatMap(order => order.items.map(item => ({ order, item })));

  const productionGroups = productionStageColumns.map(stage => ({
    stage,
    info: productionStageInfo[stage],
    items: allItems.filter(({ item }) => (item.productionStage || "po") === stage),
  }));

  const shipmentGroups = shipmentStageColumns.map(stage => ({
    stage,
    info: shipmentStageInfo[stage],
    items: allItems.filter(({ item }) => item.shipmentStage === stage),
  }));
  const shipmentBelumDiisi = allItems.filter(({ item }) => !item.shipmentStage).length;

  const groups: { stage: ProductionStage | ShipmentStage; info: { name: string; emoji: string }; items: typeof allItems }[] =
    mode === "produksi" ? productionGroups : shipmentGroups;

  return (
    <main className="app-shell produksi-page">
      <header className="topbar">
        <button className="icon-btn" aria-label="Kembali" onClick={goBack}><ArrowLeft size={21} /></button>
        <div className="brand">UmayasLa<span>·</span> Papan Produksi</div>
        <div className="header-actions"><button className="icon-btn"><Bell size={19} /></button></div>
      </header>

      <div className="produksi-hero">
        <h1>Papan Produksi &amp; Pengiriman</h1>
        <p>Semua produk lintas-customer, dikelompokkan per tahap.</p>
      </div>

      <div className="segmented produksi-mode-switch">
        <button className={mode === "produksi" ? "active" : ""} onClick={() => setMode("produksi")}><Factory size={15} /> Produksi</button>
        <button className={mode === "pengiriman" ? "active" : ""} onClick={() => setMode("pengiriman")}><Truck size={15} /> Pengiriman</button>
      </div>

      {mode === "pengiriman" && shipmentBelumDiisi > 0 && (
        <p className="panel-hint produksi-note">{shipmentBelumDiisi} produk belum diisi tahap pengirimannya (tersembunyi di sini — isi lewat halaman Order).</p>
      )}

      {groups.map(group => (
        <section className="card produksi-group" key={group.stage}>
          <div className="section-head">
            <h2>{group.info.emoji} {group.info.name}</h2>
            <span className="ready">{group.items.length}</span>
          </div>
          {group.items.length === 0 && <p className="panel-hint">Tidak ada produk di tahap ini.</p>}
          {group.items.map(({ order, item }) => (
            <Link key={order.id + "-" + item.id} href={`/order?orderId=${order.id}`} className="order-item produksi-item">
              <span className="order-item-emoji">{item.emoji}</span>
              <div className="order-item-info">
                <b>{item.name}</b>
                <small>{order.customer} · {order.number}</small>
              </div>
              <span className="produksi-item-qty">{item.qty} pcs</span>
              <ChevronRight size={16} />
            </Link>
          ))}
        </section>
      ))}

      <BottomNav />
    </main>
  );
}
