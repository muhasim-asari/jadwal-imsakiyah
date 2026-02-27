import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Jadwal Imsakiyah Ramadhan 2026 - Jadwal Sholat dan Imsakiyah Lengkap",
  description: "Jadwal Imsakiyah Ramadhan 2026 lengkap dengan waktu sholat untuk seluruh kota di Indonesia...",
  // Tambahkan bagian icons di bawah ini
  icons: {
    icon: "./logo-imsakiyah.png", // Pastikan file ada di folder /public/logo-imsakiyah.png
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
