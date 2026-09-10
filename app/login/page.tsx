"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";
import { useAuth } from "../data/authContext";

export default function LoginPage() {
  const { signIn, session, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Kalau sudah login (mis. buka /login manual pas session masih aktif),
  // langsung lempar ke Dashboard — bukan nampilin form login lagi.
  if (!loading && session) {
    router.replace("/");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) { setError("Email dan password wajib diisi"); return; }
    setError("");
    setSubmitting(true);
    const { error: signInError } = await signIn(email.trim(), password);
    setSubmitting(false);
    if (signInError) {
      setError(signInError === "Invalid login credentials" ? "Email atau password salah" : signInError);
      return;
    }
    router.replace("/");
  };

  return (
    <main className="app-shell login-page">
      <section className="modal new-form login-card">
        <div className="login-brand">
          <span className="login-brand-leaf">🌿</span>
          <h1>UmayasLa</h1>
        </div>
        <p>Masuk untuk mengelola order, customer, dan operasional Afeena &amp; Yasla.</p>
        <form onSubmit={handleSubmit}>
          <label>Email
            <input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} placeholder="nama@email.com" />
          </label>
          <label>Password
            <input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" />
          </label>
          {error && <p className="login-error">{error}</p>}
          <button type="submit" className="primary" disabled={submitting}>
            <LogIn size={16} /> {submitting ? "Masuk..." : "Masuk"}
          </button>
        </form>
      </section>
    </main>
  );
}
