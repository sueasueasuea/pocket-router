import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/BottomNav";
import { ErrorModal } from "@/components/ErrorModal";
import { ClientProviders } from "@/components/ClientProviders";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Pocket Router",
  description: "Track your money allocations across high-interest savings accounts.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Allow pinch-to-zoom — required for a11y (WCAG 1.4.4 Resize Text).
  // Financial apps in particular need users to be able to zoom on numbers.
  themeColor: "#f4f4f5", // zinc-100
};

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
          {/* Global error toast/modal — reacts to lastError in the store. */}
          <ErrorModal />
        </ClientProviders>
      </body>
    </html>
  );
}
