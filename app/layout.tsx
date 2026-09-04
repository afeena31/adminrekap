import type { Metadata } from "next";
import "./globals.css";
import "./customer.css";
import "./products.css";
import "./order.css";
import "./fees.css";
import "./marketers.css";
import "./collections.css";
import "./dashboard.css";



export const metadata: Metadata = { title: "UmayasLa · Customer Workspace", description: "Ruang kerja customer" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>;
}
