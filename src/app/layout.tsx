import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ConditionalTopBar } from "@/components/ConditionalTopBar";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Fast Order",
  icons: {
    icon: "/brand/fastorder-icon-tab-192.png",
    shortcut: "/brand/fastorder-icon-tab-192.png",
    apple: "/brand/fastorder-icon-tab-512.png",
  },
  description: "Sistema ágil de gestión de pedidos",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body className={cn(inter.className, "min-h-screen bg-background font-sans antialiased")}>
        <div className="flex-col md:flex">
          <ConditionalTopBar />
          <main className="flex-1 space-y-4 p-8 pt-6">
            {children}
          </main>
          <Toaster />
        </div>
      </body>
    </html>
  );
}
