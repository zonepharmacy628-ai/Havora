import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"], display: "swap", style: ["normal", "italic"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: { default: "HAVORA — Luxury stays, homes & experiences", template: "%s · HAVORA" },
  description:
    "Discover extraordinary villas, apartments and hotels in the world's most beautiful destinations. Reserve online and pay at the property.",
  openGraph: { siteName: "HAVORA", type: "website" },
};

export const viewport: Viewport = { themeColor: "#08111f", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${inter.variable} ${playfair.variable}`}>
      <body className="flex min-h-screen flex-col">{children}</body>
    </html>
  );
}
