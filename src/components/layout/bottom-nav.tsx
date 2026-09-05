"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Home, CalendarDays, BarChart3, Wallet } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/calendar", icon: CalendarDays, label: "Calendar" },
  { href: "/insights", icon: BarChart3, label: "Insights" },
  { href: "/money", icon: Wallet, label: "Money" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden">
      <div className="glass-card border-t border-nav-border">
        <div className="mx-auto flex h-[60px] max-w-lg items-center justify-around px-2">
          {NAV_ITEMS.map((item) => {
            const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-2xl transition-all tap-target",
                  isActive ? "text-nav-active" : "text-nav-inactive active:scale-95"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="navIndicator"
                    className="absolute inset-0 rounded-2xl bg-accent-light"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} className="relative z-10" />
                <span className={cn("text-[10px] relative z-10", isActive ? "font-bold" : "font-medium")}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
        <div className="h-[env(safe-area-inset-bottom)]" />
      </div>
    </nav>
  );
}
