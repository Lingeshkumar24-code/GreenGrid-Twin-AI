import type { Metadata } from "next";
import type { ReactNode } from "react";
import Nav from "@/components/Nav";
import DataModeBadge from "@/components/DataModeBadge";
import "./globals.css";

export const metadata: Metadata = {
  title: "GreenGrid Twin AI",
  description: "AI-powered digital twin for sustainable campus monitoring and resource optimization.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="flex h-screen bg-charcoal-950 font-body text-ink-100 antialiased">
        <Nav />
        <div className="flex flex-1 flex-col overflow-hidden">
          <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/5 px-6">
            <p className="text-sm text-ink-400">Phase 1 &amp; 2 foundation build</p>
            <DataModeBadge mode="demo" />
          </header>
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </body>
    </html>
  );
}
