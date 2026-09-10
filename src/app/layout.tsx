import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UMD Tennis Court Alerts",
  description: "Get notified when Eppley tennis court slots open for booking",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-neutral-900 antialiased">{children}</body>
    </html>
  );
}
