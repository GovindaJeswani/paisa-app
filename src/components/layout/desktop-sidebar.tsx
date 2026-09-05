"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Home, CalendarDays, BarChart3, Wallet, Target, Users, Repeat,
  Settings, TrendingUp, CreditCard, PiggyBank, Bot, Upload, Scissors,
  LineChart, Camera, FileDown, Plane,
} from "lucide-react";
import { cn } from "@/lib/utils";

const PRIMARY_ITEMS = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/calendar", icon: CalendarDays, label: "Calendar" },
  { href: "/insights", icon: BarChart3, label: "Insights" },
  { href: "/money", icon: Wallet, label: "Money" },
];

const SECONDARY_ITEMS = [
  { href: "/accounts", icon: CreditCard, label: "Accounts" },
  { href: "/budgets", icon: PiggyBank, label: "Budgets" },
  { href: "/goals", icon: Target, label: "Goals" },
  { href: "/recurring", icon: Repeat, label: "Recurring" },
  { href: "/people", icon: Users, label: "People" },
  { href: "/splits", icon: Scissors, label: "Splits" },
  { href: "/investments", icon: TrendingUp, label: "Investments" },
  { href: "/net-worth", icon: LineChart, label: "Net Worth" },
];

const TOOLS_ITEMS = [
  { href: "/ask", icon: Bot, label: "Ask Paisa" },
  { href: "/import", icon: Upload, label: "Import" },
  { href: "/receipts", icon: Camera, label: "Receipts" },
  { href: "/export", icon: FileDown, label: "Export" },
  { href: "/trips", icon: Plane, label: "Trips" },
];

export function DesktopSidebar() {
  const pathname = usePathname();

  const renderItem = (item: (typeof PRIMARY_ITEMS)[0]) => {
    const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
    const Icon = item.icon;
    return (
      <Link key={item.href} href={item.href}
        className={cn("flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all",
          isActive ? "bg-accent-light text-accent" : "text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
        )}>
        <Icon size={17} strokeWidth={isActive ? 2.5 : 2} />
        <span>{item.label}</span>
      </Link>
    );
  };

  return (
    <aside className="hidden md:flex md:w-56 lg:w-64 flex-col border-r border-border bg-surface h-screen sticky top-0">
      <div className="flex items-center gap-2.5 px-5 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg hero-gradient text-white font-bold text-sm">₹</div>
        <span className="text-lg font-bold text-text-primary tracking-tight">Paisa</span>
      </div>

      <div className="flex flex-col gap-0.5 px-3 mt-1">{PRIMARY_ITEMS.map(renderItem)}</div>

      <div className="mx-5 my-3 h-px bg-border-light" />

      <div className="flex flex-col gap-0.5 px-3 flex-1 overflow-y-auto">
        <p className="px-3 pb-1 text-[9px] font-bold uppercase tracking-widest text-text-tertiary">Manage</p>
        {SECONDARY_ITEMS.map(renderItem)}

        <div className="mt-3" />
        <p className="px-3 pb-1 text-[9px] font-bold uppercase tracking-widest text-text-tertiary">Tools</p>
        {TOOLS_ITEMS.map(renderItem)}
      </div>

      <div className="border-t border-border-light px-3 py-2.5">
        <Link href="/settings"
          className={cn("flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all",
            pathname.startsWith("/settings") ? "bg-accent-light text-accent" : "text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
          )}>
          <Settings size={17} /> <span>Settings</span>
        </Link>
      </div>
    </aside>
  );
}
