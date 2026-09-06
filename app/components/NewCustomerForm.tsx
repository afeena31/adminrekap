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

export type EditableCustomerFields = {
  name: string;
  waName: string;
  city: string;
  phone: string;
  receiver: string;
  receiverPhone: string;
};

export function EditCustomerForm({ customer, onClose, onSave }: { customer: EditableCustomerFields; onClose: () => void; onSave: (data: EditableCustomerFields) => void }) {
  const [name, setName] = useState(customer.name);
  const [waName, setWaName] = useState(customer.waName);
  const [city, setCity] = useState(customer.city);
  const [phone, setPhone] = useState(customer.phone === "-" ? "" : customer.phone);
  const [receiver, setReceiver] = useState(customer.receiver);
  const [receiverPhone, setReceiverPhone] = useState(customer.receiverPhone === "-" ? "" : customer.receiverPhone);

  const save = () => onSave({
    name: name.trim(),
    waName: waName.trim() || name.trim(),
    city: city.trim() || "Belum diisi",
    phone: phone.trim() || "-",
    receiver: receiver.trim() || name.trim(),
    receiverPhone: receiverPhone.trim() || "-",
  });

  return (
    <div className="overlay" onClick={onClose}>
      <section className="modal new-form" onClick={event => event.stopPropagation()}>
        <button className="close" onClick={onClose}>×</button>
        <h2>Edit Profil Customer</h2>
        <label>Nama customer
          <input value={name} onChange={event => setName(event.target.value)} placeholder="Contoh: Ummu Maryam"/>
        </label>
        <label>Nama WhatsApp
          <input value={waName} onChange={event => setWaName(event.target.value)} placeholder="Nama yang tampil di WhatsApp"/>
        </label>
        <label>Kota / domisili
          <input value={city} onChange={event => setCity(event.target.value)} placeholder="Contoh: Jakarta Timur"/>
        </label>
        <label>No. HP customer
          <input value={phone} onChange={event => setPhone(event.target.value)} placeholder="08xx-xxxx-xxxx"/>
        </label>
        <label>Nama penerima utama
          <input value={receiver} onChange={event => setReceiver(event.target.value)} placeholder="Nama penerima paket"/>
        </label>
        <label>No. HP penerima
          <input value={receiverPhone} onChange={event => setReceiverPhone(event.target.value)} placeholder="08xx-xxxx-xxxx"/>
        </label>
        <button className="primary" disabled={!name.trim()} onClick={save}>Simpan Perubahan</button>
      </section>
    </div>
  );
}
