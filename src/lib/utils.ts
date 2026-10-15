import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(n: number): string {
  if (n % 1 === 0) {
    return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
  }
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatTime12(time24: string): string {
  if (!time24) return "";
  const [h, m] = time24.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
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


// Week helpers
export function getWeekRange(offset: number = 0): { start: string; end: string; dates: string[] } {
  const now = new Date();
  const baseDate = new Date(now.getTime() + offset * 7 * 86400000);
  const dow = baseDate.getDay() === 0 ? 6 : baseDate.getDay() - 1;
  const monday = new Date(baseDate.getTime() - dow * 86400000);
  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday.getTime() + i * 86400000);
    return toDateStr(d);
  });
  return { start: dates[0], end: dates[6], dates };
}

export function getMonthRange(year: number, month: number): { start: string; end: string } {
  const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const end = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}
