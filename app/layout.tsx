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
  title: "DAM AI — Evidence-First Investigation Workspace",
  description: "An evidence-first AI workspace that verifies claims, suspicious messages, and documents, with a focus on Indian scam messages and government notifications.",
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%23e43d3d'/%3E%3Cpath d='M17 18h19c9 0 15 5 15 14s-6 14-15 14H17V18zm12 9v10h7c3 0 5-2 5-5s-2-5-5-5h-7z' fill='white'/%3E%3C/svg%3E",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#09090b] text-[#f8f8fc]">{children}</body>
    </html>
  );
}
