import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { DBProvider } from "@/components/providers/db-provider";
import { BottomNav } from "@/components/layout/bottom-nav";
import { DesktopSidebar } from "@/components/layout/desktop-sidebar";
import { FABButton } from "@/components/layout/fab-button";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { ServiceWorkerRegister } from "@/components/pwa/sw-register";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Paisa — Your Money, Organized",
  description:
    "Calendar-first personal finance app. Track expenses, budgets, savings goals. 100% local, 100% private, ₹0 cost.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Paisa",
  },
  openGraph: {
    title: "Paisa — Your Money, Organized",
    description: "A beautiful personal finance app. Calendar-first, local-first, free forever.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#6366F1" },
    { media: "(prefers-color-scheme: dark)", color: "#0B0F1A" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <meta name="theme-color" content="#6366F1" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icons/icon-192.svg" />
      </head>
      <body className="min-h-full flex bg-background text-foreground">
        <ThemeProvider>
          <DBProvider>
            <DesktopSidebar />
            <main className="flex-1 min-h-screen">
              <div className="mx-auto max-w-2xl px-4 pt-4 pb-24 md:pb-8 md:pt-6">
                {children}
              </div>
            </main>
            <FABButton />
            <BottomNav />
            <InstallPrompt />
            <ServiceWorkerRegister />
          </DBProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
