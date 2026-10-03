import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Sora, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "DAM | Defence Against Misinformation — Investigation Workspace",
  description:
    "DAM helps verify public claims, scam messages, fake government circulars, and malicious APKs before you publish, brief, or act.",
  icons: {
    icon: "/assets/favicon-transparent.png",
    shortcut: "/assets/favicon-transparent.png",
    apple: "/assets/favicon-transparent.png",
  },
};

// Proper mobile viewport — prevents unwanted zoom, supports notch-aware layout
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${sora.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#060606] text-[#ffffff]">
        {children}
      </body>
    </html>
  );
}
