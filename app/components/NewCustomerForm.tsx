"use client";

import { useState } from "react";

export function NewCustomerForm({ onClose, onSave }: { onClose: () => void; onSave: (name: string, city: string) => void }) {
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  return (
    <div className="overlay" onClick={onClose}>
      <section className="modal new-form" onClick={event => event.stopPropagation()}>
        <button className="close" onClick={onClose}>×</button>
        <h2>Customer Baru</h2>
        <p>Mulai dari profilnya. Order pertama dapat ditambahkan setelah ini.</p>
        <label>Nama customer
          <input value={name} onChange={event => setName(event.target.value)} placeholder="Contoh: Ummu Maryam"/>
        </label>
        <label>Kota / domisili
          <input value={city} onChange={event => setCity(event.target.value)} placeholder="Contoh: Jakarta Timur"/>
        </label>
        <button className="primary" disabled={!name.trim()} onClick={() => onSave(name.trim(), city.trim() || "Belum diisi")}>Buat Profil Customer</button>
      </section>
    </div>
  );
}
