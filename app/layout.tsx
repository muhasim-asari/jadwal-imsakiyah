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
  icons: {
    icon: "./logo-imsakiyah.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#064e3b" />
        <link
          rel="apple-touch-icon"
          href="https://jadwal-imsakiyah-dusky.vercel.app/logo-imsakiyah-192.png"
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
