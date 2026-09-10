import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Paisa — Simple Expense Tracker",
  description: "Track your daily expenses. Simple, fast, beautiful.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width", initialScale: 1, maximumScale: 1, userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#6366F1" },
    { media: "(prefers-color-scheme: dark)", color: "#0F172A" },
  ],
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full bg-bg text-text">
        <div className="mx-auto max-w-lg min-h-screen flex flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}
