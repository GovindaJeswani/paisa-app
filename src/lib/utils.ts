import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(n: number): string {
  return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 0 && h < 5) return "Good night";     // 12am - 5am
  if (h < 12) return "Good morning";              // 5am - 12pm
  if (h < 17) return "Good afternoon";             // 12pm - 5pm
  if (h < 21) return "Good evening";               // 5pm - 9pm
  return "Good night";                             // 9pm - 12am
}

// FIXED: uses local timezone, not UTC
export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function friendlyDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const now = new Date();
  const today = toDateStr(now);
  const yesterday = toDateStr(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  if (dateStr === today) return "Today";
  if (dateStr === yesterday) return "Yesterday";
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}
