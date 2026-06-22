import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/BottomNav";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Pocket Router",
  description: "Track your money allocations across high-interest savings accounts.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#f4f4f5", // zinc-100
};

import { ClientProviders } from "@/components/ClientProviders";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased dark">
      <body className={`${inter.className} min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 flex flex-col`}>
        <ClientProviders>
          {/* Main responsive wrapper */}
          <div className="flex-1 w-full flex flex-col pb-28">
            {children}
          </div>
          <BottomNav />
        </ClientProviders>
      </body>
    </html>
  );
}
