"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";

export type UserRole = "owner" | "admin";

type AuthState = {
  session: Session | null;
  role: UserRole | null;
  name: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

// Login gate Tahap 2 — SENGAJA belum ngubah data apapun (order/customer/dst
// masih 100% localStorage seperti biasa). Context ini cuma nyimpen: siapa
// yang login (session Supabase) & role-nya (owner/admin, dibaca dari tabel
// `profiles`). Dipakai AuthGate (components/AuthGate.tsx) buat nge-gate
// seluruh app, dan nanti Tahap 7 buat nyembunyiin field modal/HPP dari admin.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (userId: string) => {
    const { data } = await supabase.from("profiles").select("role, name").eq("id", userId).maybeSingle();
    setRole((data?.role as UserRole) || null);
    setName(data?.name || null);
  };

  useEffect(() => {
    // HYDRATION FIX: cek session yang mungkin sudah tersimpan (localStorage
    // punya Supabase sendiri) begitu komponen mount di client.
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) await loadProfile(data.session.user.id);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        loadProfile(newSession.user.id);
      } else {
        setRole(null);
        setName(null);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? error.message : null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return <AuthContext.Provider value={{ session, role, name, loading, signIn, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth() harus dipakai di dalam <AuthProvider>");
  return ctx;
}
