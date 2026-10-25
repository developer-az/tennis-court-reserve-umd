import type { Metadata, Viewport } from "next";
import { Barlow, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const sans = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const display = Barlow({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "UMD Tennis Court Alerts",
  description: "See which Eppley tennis courts are open and get an email when a slot opens or a court frees up.",
};

export const viewport: Viewport = {
  themeColor: "#1c1916",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body className="min-h-screen bg-paper font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
