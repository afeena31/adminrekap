"use client";

import { useState } from "react";
import { Search, ChevronRight, ChevronLeft, Check } from "lucide-react";
import { getCustomers, type Customer as CentralCustomer } from "../data/central";
import { getOrdersForCustomer, recordPaymentForOrder, formatRupiah, type OrderRecord } from "../data/store";
import { MoneyInput } from "./MoneyInput";

// ===== TOMBOL PINTAS "CATAT PEMBAYARAN" =====
// Dipakai dari header profil customer & Dashboard — admin sering cuma perlu
// catat transferan yang baru masuk TANPA buka form Order lengkap dulu (cari
// "Edit Order yang Sudah Ada", scroll ke Riwayat Pembayaran, dst). Modal ini
// cuma alur pintas ke fungsi yang SAMA (recordPaymentForOrder, store.ts) yang
// dipakai form Order — bukan sistem pencatatan pembayaran kedua yang terpisah.
export function QuickPaymentModal({ onClose, onRecorded }: { onClose: () => void; onRecorded?: () => void }) {
  const [query, setQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CentralCustomer | null>(null);
  const [unpaidOrders, setUnpaidOrders] = useState<OrderRecord[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [amount, setAmount] = useState(0);
  const [done, setDone] = useState<{ orderNumber: string; sisa: number } | null>(null);

  const q = query.toLowerCase().trim();
  const results = q ? getCustomers().filter(c => c.name.toLowerCase().includes(q) || c.waName.toLowerCase().includes(q)) : [];

  const pickCustomer = (c: CentralCustomer) => {
    setSelectedCustomer(c);
    const orders = getOrdersForCustomer(c.id).filter(o => o.total - o.dp > 0);
    setUnpaidOrders(orders);
    setSelectedOrderId(orders.length === 1 ? orders[0].id : "");
    setAmount(0);
  };

  const back = () => {
    setSelectedCustomer(null);
    setUnpaidOrders([]);
    setSelectedOrderId("");
    setAmount(0);
    setQuery("");
  };

  const selectedOrder = unpaidOrders.find(o => o.id === selectedOrderId) || null;

  const handleSubmit = () => {
    if (!selectedOrder || amount <= 0) return;
    const { updatedOrder } = recordPaymentForOrder(selectedOrder, amount);
    setDone({ orderNumber: updatedOrder.number, sisa: updatedOrder.total - updatedOrder.dp });
    onRecorded?.();
  };

  return (
    <div className="overlay" onClick={onClose}>
      <section className="modal quick-payment" onClick={e => e.stopPropagation()}>
        <button className="close" onClick={onClose}>×</button>
        <p className="eyebrow">CATAT PEMBAYARAN CEPAT</p>

        {done ? (
          <div className="quick-payment-success">
            <span className="quick-payment-success-icon"><Check size={28} /></span>
            <h2>Pembayaran Tercatat</h2>
            <p>{formatRupiah(amount)} untuk order <b>{done.orderNumber}</b> berhasil dicatat.</p>
            <p className="muted">Sisa Pelunasan sekarang: <b>{formatRupiah(done.sisa)}</b></p>
            <div className="form-actions">
              <button className="secondary" onClick={back}>Catat Lagi</button>
              <button className="primary" onClick={onClose}>Selesai</button>
            </div>
          </div>
        ) : !selectedCustomer ? (
          <>
            <h2>Cari Customer</h2>
            <div className="find-input">
              <Search size={18} />
              <input autoFocus placeholder="Ketik nama customer..." value={query} onChange={e => setQuery(e.target.value)} />
            </div>
            {q && results.length === 0 && <p className="panel-hint" style={{ marginTop: 12 }}>Tidak ada customer dengan nama itu.</p>}
            {results.map(c => (
              <button key={c.id} className="customer-result" onClick={() => pickCustomer(c)}>
                <span className="mini-avatar">{c.initials || c.name.charAt(0)}</span>
                <span>{c.name} · {c.city}</span>
                <ChevronRight size={18} />
              </button>
            ))}
          </>
        ) : (
          <>
            <button type="button" className="quick-payment-back" onClick={back}><ChevronLeft size={16} /> Ganti Customer</button>
            <h2>{selectedCustomer.name}</h2>
            {unpaidOrders.length === 0 ? (
              <p className="panel-hint" style={{ marginTop: 12 }}>Customer ini tidak punya tagihan yang belum lunas.</p>
            ) : (
              <>
                <label>Order yang dibayar
                  <div className="quick-payment-order-list">
                    {unpaidOrders.map(o => (
                      <button
                        type="button"
                        key={o.id}
                        className={`quick-payment-order-row ${selectedOrderId === o.id ? "active" : ""}`}
                        onClick={() => setSelectedOrderId(o.id)}
                      >
                        <div>
                          <b>{o.number}</b>
                          <small>{o.items.map(i => i.name).join(", ")}</small>
                        </div>
                        <span className="quick-payment-order-sisa">Sisa {formatRupiah(o.total - o.dp)}</span>
                      </button>
                    ))}
                  </div>
                </label>
                {selectedOrder && (
                  <>
                    <label>Nominal transfer hari ini (Rp)
                      <MoneyInput value={amount} onChange={setAmount} placeholder="0" />
                    </label>
                    {amount > 0 && (
                      <p className="quick-payment-preview">
                        Sisa Pelunasan setelah ini: <b>{formatRupiah(Math.max(0, selectedOrder.total - selectedOrder.dp - amount))}</b>
                      </p>
                    )}
                    <div className="form-actions">
                      <button className="primary" disabled={amount <= 0} onClick={handleSubmit}><Check size={16} /> Catat Pembayaran</button>
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
}
