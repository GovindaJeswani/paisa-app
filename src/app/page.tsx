"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Plus, Calendar, ChevronLeft, ChevronRight, X, Trash2, ArrowDown,
  LayoutGrid, List, Clock, MessageSquare, Check, Loader2, Sun, Moon,
} from "lucide-react";
import { db, guessCategory, CATEGORIES, getCategoryEmoji, getCategoryName, type Expense } from "@/lib/db";
import { cn, formatMoney, getGreeting, toDateStr, friendlyDate } from "@/lib/utils";

export default function Home() {
  const [showAdd, setShowAdd] = useState(false);
  const [showSMS, setShowSMS] = useState(false);
  const [tab, setTab] = useState<"home" | "calendar">("home");

  return (
    <>
      {tab === "home" ? <HomeTab onOpenSMS={() => setShowSMS(true)} /> : <CalendarTab />}

      {/* Bottom nav */}
      <nav className="sticky bottom-0 border-t border-border bg-surface/80 backdrop-blur-xl flex">
        <button onClick={() => setTab("home")}
          className={cn("flex-1 py-3 flex flex-col items-center gap-0.5 text-[10px] font-semibold transition-colors",
            tab === "home" ? "text-accent" : "text-text3")}>
          <ArrowDown size={20} strokeWidth={tab === "home" ? 2.5 : 1.8} />
          Expenses
        </button>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center justify-center -mt-5 z-10">
          <div className="h-14 w-14 rounded-full bg-accent text-white flex items-center justify-center shadow-lg shadow-accent/30 active:scale-95 transition-transform">
            <Plus size={26} strokeWidth={2.5} />
          </div>
        </button>
        <button onClick={() => setTab("calendar")}
          className={cn("flex-1 py-3 flex flex-col items-center gap-0.5 text-[10px] font-semibold transition-colors",
            tab === "calendar" ? "text-accent" : "text-text3")}>
          <Calendar size={20} strokeWidth={tab === "calendar" ? 2.5 : 1.8} />
          Calendar
        </button>
      </nav>

      {showAdd && <AddExpenseSheet onClose={() => setShowAdd(false)} />}
      {showSMS && <SMSImportSheet onClose={() => setShowSMS(false)} />}
    </>
  );
}

// ════════════════════════════════════════════════════════
// HOME TAB — with spending chart + SMS import button
// ════════════════════════════════════════════════════════

function DarkToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem("paisa-dark");
    const isDark = saved ? saved === "true" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("paisa-dark", String(next));
  };
  return (
    <button onClick={toggle} className="h-9 w-9 flex items-center justify-center rounded-xl hover:bg-surface2 transition-colors" aria-label="Toggle dark mode">
      {dark ? <Sun size={18} className="text-orange" /> : <Moon size={18} className="text-text3" />}
    </button>
  );
}

function HomeTab({ onOpenSMS }: { onOpenSMS: () => void }) {
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-31`;

  const expenses = useLiveQuery(
    () => db.expenses.where("date").between(monthStart, monthEnd, true, true).reverse().sortBy("date")
  ) ?? [];

  const monthTotal = expenses.reduce((s, e) => s + e.amount, 0);
  const todayStr = toDateStr(now);
  const todayTotal = expenses.filter((e) => e.date === todayStr).reduce((s, e) => s + e.amount, 0);

  const grouped = useMemo(() => {
    const map = new Map<string, Expense[]>();
    for (const e of expenses) { const arr = map.get(e.date) || []; arr.push(e); map.set(e.date, arr); }
    return Array.from(map.entries());
  }, [expenses]);

  const catBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenses) map.set(e.category, (map.get(e.category) || 0) + e.amount);
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  // Daily spending for chart (last 7 days)
  const dailySpending = useMemo(() => {
    const days: { label: string; amount: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const ds = toDateStr(d);
      const total = expenses.filter((e) => e.date === ds).reduce((s, e) => s + e.amount, 0);
      days.push({ label: d.toLocaleDateString("en-IN", { weekday: "narrow" }), amount: total });
    }
    return days;
  }, [expenses, now]);

  const maxDaily = Math.max(...dailySpending.map((d) => d.amount), 1);
  const monthName = now.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <div className="flex-1 px-4 pt-5 pb-4 overflow-y-auto">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text2">{getGreeting()} 👋</p>
        <DarkToggle />
      </div>

      {/* Hero */}
      <div className="mt-3 rounded-2xl bg-accent p-5 text-white relative overflow-hidden">
        <div className="absolute -top-8 -right-8 h-28 w-28 rounded-full bg-white/10" />
        <p className="text-xs text-white/60">{monthName}</p>
        <p className="text-3xl font-extrabold tabular-nums mt-1">{formatMoney(monthTotal)}</p>
        <p className="text-xs text-white/60 mt-1">spent this month</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <div className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold">Today: {formatMoney(todayTotal)}</div>
          <div className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold">{expenses.length} expenses</div>
        </div>
      </div>

      {/* SMS import button */}
      <button onClick={onOpenSMS}
        className="mt-4 w-full flex items-center gap-3 rounded-xl border border-dashed border-accent/30 bg-accent-bg/50 p-3 text-left hover:bg-accent-bg transition-colors">
        <div className="h-9 w-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
          <MessageSquare size={16} className="text-accent" />
        </div>
        <div className="flex-1">
          <p className="text-[12px] font-bold text-text">Paste bank SMS to import</p>
          <p className="text-[10px] text-text3">Copy bank messages → paste here → auto-add</p>
        </div>
        <ChevronRight size={14} className="text-accent" />
      </button>

      {/* 7-day spending chart */}
      {expenses.length > 0 && (
        <div className="mt-5">
          <h3 className="text-xs font-bold text-text3 uppercase tracking-wider mb-2">Last 7 days</h3>
          <div className="flex items-end gap-1.5 h-20">
            {dailySpending.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full rounded-t-md bg-accent/20 relative overflow-hidden" style={{ height: `${Math.max(4, (d.amount / maxDaily) * 64)}px` }}>
                  <div className="absolute bottom-0 left-0 right-0 bg-accent rounded-t-md" style={{ height: `${Math.max(2, (d.amount / maxDaily) * 64)}px` }} />
                </div>
                <span className="text-[9px] font-bold text-text3">{d.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category breakdown with bars */}
      {catBreakdown.length > 0 && (
        <div className="mt-5">
          <h3 className="text-xs font-bold text-text3 uppercase tracking-wider mb-2">Where it went</h3>
          <div className="space-y-2">
            {catBreakdown.slice(0, 6).map(([cat, amount]) => {
              const pct = monthTotal > 0 ? (amount / monthTotal) * 100 : 0;
              return (
                <div key={cat} className="flex items-center gap-3">
                  <span className="text-lg w-7 text-center">{getCategoryEmoji(cat)}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-semibold text-text">{getCategoryName(cat)}</span>
                      <span className="text-xs font-bold text-text tabular-nums">{formatMoney(amount)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface2 overflow-hidden">
                      <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Expense list */}
      {grouped.length === 0 ? (
        <div className="mt-16 text-center anim-fade">
          <p className="text-4xl">💸</p>
          <p className="text-base font-bold text-text mt-3">No expenses yet</p>
          <p className="text-sm text-text2 mt-1">Tap <span className="text-accent font-bold">+</span> to add your first one</p>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {grouped.map(([date, items]) => {
            const dayTotal = items.reduce((s, e) => s + e.amount, 0);
            return (
              <div key={date} className="anim-up">
                <div className="flex items-center justify-between mb-1.5 px-1">
                  <span className="text-[11px] font-bold text-text3 uppercase tracking-wider">{friendlyDate(date)}</span>
                  <span className="text-[11px] font-bold text-red tabular-nums">{formatMoney(dayTotal)}</span>
                </div>
                <div className="space-y-1">
                  {items.map((e) => <ExpenseRow key={e.id} expense={e} />)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════
// EXPENSE ROW
// ════════════════════════════════════════════════════════

function ExpenseRow({ expense }: { expense: Expense }) {
  const [showDelete, setShowDelete] = useState(false);
  const handleDelete = async () => { await db.expenses.delete(expense.id); };

  return (
    <div className="flex items-center gap-3 rounded-xl bg-surface border border-border p-3 active:bg-surface2 transition-colors"
      onClick={() => setShowDelete(!showDelete)}>
      <div className="flex h-10 w-10 items-center justify-center rounded-xl text-lg" style={{ backgroundColor: "var(--accent-bg)" }}>
        {getCategoryEmoji(expense.category)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-text truncate">{expense.description}</p>
        <p className="text-[11px] text-text3">{getCategoryName(expense.category)} · {expense.time}</p>
      </div>
      <div className="text-right shrink-0">
        {showDelete ? (
          <button onClick={(e) => { e.stopPropagation(); handleDelete(); }}
            className="flex items-center gap-1 text-red text-xs font-bold bg-red-bg px-2.5 py-1.5 rounded-lg">
            <Trash2 size={12} /> Delete
          </button>
        ) : (
          <span className="text-[13px] font-bold text-text tabular-nums">{formatMoney(expense.amount)}</span>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════
// CALENDAR TAB — with month/week/timeline views
// ════════════════════════════════════════════════════════

type CalView = "month" | "week" | "timeline";

function CalendarTab() {
  const [view, setView] = useState<CalView>("month");
  const [month, setMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const y = month.getFullYear(), m = month.getMonth();
  const startDate = `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const endDate = `${y}-${String(m + 1).padStart(2, "0")}-31`;

  const expenses = useLiveQuery(
    () => db.expenses.where("date").between(startDate, endDate, true, true).toArray(),
    [startDate, endDate]
  ) ?? [];

  const dayTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenses) map.set(e.date, (map.get(e.date) || 0) + e.amount);
    return map;
  }, [expenses]);

  const monthTotal = expenses.reduce((s, e) => s + e.amount, 0);
  const today = toDateStr(new Date());
  const selectedExpenses = selectedDate ? expenses.filter((e) => e.date === selectedDate) : [];

  // Calendar grid for month view
  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  const days: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  // Week view: group by day with full details
  const weekDays = useMemo(() => {
    const result: { date: string; dayName: string; dayNum: number; expenses: Expense[]; total: number }[] = [];
    const nowDate = new Date();
    const dayOfWeek = nowDate.getDay() === 0 ? 6 : nowDate.getDay() - 1; // Mon=0
    for (let i = 0; i < 7; i++) {
      const d = new Date(nowDate.getTime() - (dayOfWeek - i) * 86400000);
      const ds = toDateStr(d);
      const dayExpenses = expenses.filter((e) => e.date === ds);
      result.push({
        date: ds,
        dayName: d.toLocaleDateString("en-IN", { weekday: "short" }),
        dayNum: d.getDate(),
        expenses: dayExpenses,
        total: dayExpenses.reduce((s, e) => s + e.amount, 0),
      });
    }
    return result;
  }, [expenses]);

  // Timeline: all expenses sorted by date desc, grouped
  const timelineGroups = useMemo(() => {
    const sorted = [...expenses].sort((a, b) => b.date.localeCompare(a.date) || (b.time || "").localeCompare(a.time || ""));
    const map = new Map<string, Expense[]>();
    for (const e of sorted) { const arr = map.get(e.date) || []; arr.push(e); map.set(e.date, arr); }
    return Array.from(map.entries());
  }, [expenses]);

  const prev = () => setMonth(new Date(y, m - 1, 1));
  const next = () => setMonth(new Date(y, m + 1, 1));
  const goToday = () => {
    const now = new Date();
    setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(toDateStr(now));
  };

  return (
    <div className="flex-1 px-4 pt-5 pb-4 overflow-y-auto">
      {/* Header + view switcher */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-bold text-text">{month.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</h2>
          <p className="text-xs text-text3">Total: <span className="font-bold text-red tabular-nums">{formatMoney(monthTotal)}</span></p>
        </div>
        <div className="flex gap-1">
          <button onClick={prev} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-surface2"><ChevronLeft size={16} className="text-text2" /></button>
          <button onClick={goToday} className="px-2 py-1 text-[11px] font-semibold text-accent hover:bg-accent-bg rounded-lg transition-colors">Today</button>
          <button onClick={next} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-surface2"><ChevronRight size={16} className="text-text2" /></button>
        </div>
      </div>

      {/* View tabs */}
      <div className="flex gap-1 mb-3">
        {([
          { key: "month" as CalView, icon: LayoutGrid, label: "Month" },
          { key: "week" as CalView, icon: List, label: "Week" },
          { key: "timeline" as CalView, icon: Clock, label: "Timeline" },
        ]).map((v) => {
          const Icon = v.icon;
          return (
            <button key={v.key} onClick={() => setView(v.key)}
              className={cn("flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-all",
                view === v.key ? "bg-accent-bg text-accent" : "text-text3 hover:bg-surface2"
              )}>
              <Icon size={13} /> {v.label}
            </button>
          );
        })}
      </div>

      {/* ── MONTH VIEW ── */}
      {view === "month" && (
        <>
          <div className="grid grid-cols-7 mb-1">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} className="text-center text-[9px] font-bold text-text3 uppercase py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-1">
            {days.map((day, i) => {
              if (day === null) return <div key={`e${i}`} />;
              const dateStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const total = dayTotals.get(dateStr) || 0;
              const isToday = dateStr === today;
              const isSelected = dateStr === selectedDate;
              return (
                <button key={dateStr} onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                  className={cn("flex flex-col items-center rounded-xl py-1.5 transition-all min-h-[52px]",
                    isSelected ? "bg-accent-bg ring-1 ring-accent/30" : isToday ? "bg-surface2" : "hover:bg-surface2")}>
                  <span className={cn("text-xs font-medium", (isToday || isSelected) && "text-accent font-bold")}>{day}</span>
                  {total > 0 && <span className="text-[8px] font-bold text-red tabular-nums mt-0.5">{formatMoney(total)}</span>}
                  {total > 0 && <div className="h-1 w-1 rounded-full bg-red mt-0.5" />}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* ── WEEK VIEW ── */}
      {view === "week" && (
        <div className="space-y-2">
          {weekDays.map((day) => {
            const isToday = day.date === today;
            return (
              <div key={day.date} className={cn("rounded-xl border p-3 transition-all",
                isToday ? "border-accent bg-accent-bg" : "border-border bg-surface")}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center text-sm font-bold",
                      isToday ? "bg-accent text-white" : "bg-surface2 text-text")}>
                      {day.dayNum}
                    </div>
                    <div>
                      <p className={cn("text-xs font-bold", isToday ? "text-accent" : "text-text")}>{day.dayName}</p>
                      <p className="text-[10px] text-text3">{friendlyDate(day.date)}</p>
                    </div>
                  </div>
                  {day.total > 0 && <span className="text-sm font-bold text-red tabular-nums">{formatMoney(day.total)}</span>}
                </div>
                {day.expenses.length > 0 ? (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {day.expenses.map((e) => (
                      <span key={e.id} className="flex items-center gap-1 rounded-full bg-surface2 px-2 py-0.5 text-[10px] font-medium text-text2">
                        {getCategoryEmoji(e.category)} {formatMoney(e.amount)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-text3 mt-1">No expenses</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── TIMELINE VIEW ── */}
      {view === "timeline" && (
        timelineGroups.length === 0 ? (
          <p className="text-sm text-text3 text-center py-8">No expenses this month</p>
        ) : (
          <div className="relative">
            <div className="absolute left-[18px] top-0 bottom-0 w-0.5 bg-border" />
            {timelineGroups.map(([date, items]) => (
              <div key={date} className="relative mb-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="relative z-10 h-9 w-9 rounded-full bg-surface border-2 border-border flex items-center justify-center">
                    <span className="text-[11px] font-bold text-text">{new Date(date + "T00:00:00").getDate()}</span>
                  </div>
                  <div className="flex-1 flex items-center justify-between">
                    <p className="text-xs font-bold text-text">{friendlyDate(date)}</p>
                    <span className="text-xs font-bold text-red tabular-nums">{formatMoney(items.reduce((s, e) => s + e.amount, 0))}</span>
                  </div>
                </div>
                <div className="ml-[18px] pl-6 space-y-1.5">
                  {items.map((e) => (
                    <div key={e.id} className="flex items-center gap-2.5 rounded-lg bg-surface border border-border p-2.5">
                      <span className="text-[10px] font-mono text-text3 w-10 shrink-0">{e.time}</span>
                      <div className="h-2 w-2 rounded-full bg-red shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-text truncate">{e.description}</p>
                        <p className="text-[10px] text-text3">{getCategoryName(e.category)}</p>
                      </div>
                      <span className="text-[12px] font-bold text-text tabular-nums shrink-0">{formatMoney(e.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Selected day detail (month view) */}
      {view === "month" && selectedDate && (
        <div className="mt-4 anim-up">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-text">{friendlyDate(selectedDate)}</h3>
            <span className="text-sm font-bold text-red tabular-nums">{formatMoney(selectedExpenses.reduce((s, e) => s + e.amount, 0))}</span>
          </div>
          {selectedExpenses.length === 0 ? (
            <p className="text-xs text-text3 text-center py-4">No expenses this day</p>
          ) : (
            <div className="space-y-1">{selectedExpenses.map((e) => <ExpenseRow key={e.id} expense={e} />)}</div>
          )}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════
// ADD EXPENSE SHEET
// ════════════════════════════════════════════════════════

function AddExpenseSheet({ onClose }: { onClose: () => void }) {
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(toDateStr(new Date()));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTimeout(() => amountRef.current?.focus(), 100); }, []);
  const detectedCategory = useMemo(() => guessCategory(desc), [desc]);

  const handleSave = useCallback(async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0 || !desc.trim()) return;
    setSaving(true);
    const now = new Date();
    await db.expenses.add({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      amount: amt, description: desc.trim(), category: category || detectedCategory, date,
      time: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
      createdAt: now.toISOString(),
    });
    setSaved(true);
    setTimeout(onClose, 600);
  }, [amount, desc, category, date, detectedCategory, onClose]);

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-surface shadow-xl anim-up max-h-[90vh] overflow-y-auto">
        <div className="flex justify-center py-2"><div className="h-1 w-10 rounded-full bg-border" /></div>
        <div className="px-5 pb-8">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-text">{saved ? "Saved ✓" : "Add expense"}</h2>
            <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-surface2"><X size={18} className="text-text2" /></button>
          </div>
          {saved ? (
            <div className="flex flex-col items-center py-8 anim-fade">
              <div className="h-16 w-16 rounded-full bg-green-bg flex items-center justify-center"><span className="text-green text-2xl">✓</span></div>
              <p className="text-sm text-text2 mt-3">Expense added!</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-text3 uppercase tracking-wider mb-1 block">Amount</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-text3 font-bold">₹</span>
                  <input ref={amountRef} type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0"
                    className="w-full rounded-xl border border-border bg-surface2 pl-10 pr-4 py-4 text-2xl font-extrabold text-text tabular-nums outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-text3 uppercase tracking-wider mb-1 block">What was it for?</label>
                <input type="text" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. Evening snacks, Uber to office, Coffee"
                  className="w-full rounded-xl border border-border bg-surface2 px-4 py-3 text-sm text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all" />
                {desc.trim() && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-text2 anim-fade">
                    <span className="text-sm">{getCategoryEmoji(detectedCategory)}</span>
                    <span>Auto: <span className="font-semibold text-accent">{getCategoryName(detectedCategory)}</span></span>
                  </div>
                )}
              </div>
              <div>
                <label className="text-[10px] font-bold text-text3 uppercase tracking-wider mb-1.5 block">Category {category ? "" : "(auto-detected)"}</label>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map((cat) => {
                    const active = category ? category === cat : detectedCategory === cat;
                    return (
                      <button key={cat} onClick={() => setCategory(cat === category ? "" : cat)}
                        className={cn("rounded-full px-2.5 py-1.5 text-[11px] font-semibold border transition-all flex items-center gap-1",
                          active ? "border-accent bg-accent-bg text-accent" : "border-border text-text2 hover:bg-surface2")}>
                        {getCategoryEmoji(cat)} {getCategoryName(cat)}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-text3 uppercase tracking-wider mb-1 block">Date</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface2 px-4 py-3 text-sm text-text outline-none focus:border-accent transition-all" />
              </div>
              <button onClick={handleSave} disabled={saving || !amount || parseFloat(amount) <= 0 || !desc.trim()}
                className="w-full rounded-xl bg-accent py-3.5 text-sm font-bold text-white disabled:opacity-40 hover:bg-accent/90 active:scale-[0.98] transition-all">
                {saving ? "Saving..." : "Add Expense"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════
// SMS IMPORT SHEET — paste bank SMS, auto-parse, add
// ════════════════════════════════════════════════════════

function SMSImportSheet({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ count: number; total: number } | null>(null);
  const [error, setError] = useState("");

  const handleParse = useCallback(async () => {
    if (!text.trim()) return;
    setLoading(true); setError(""); setResult(null);

    // Simple bank SMS parser
    const messages = text.split(/\n{2,}|\r\n{2,}/).map((m) => m.trim()).filter((m) => m.length > 15);
    if (messages.length === 0) { messages.push(text.trim()); }

    let count = 0;
    let total = 0;

    for (const msg of messages) {
      // Extract amount
      const amtMatch = msg.match(/(?:INR|Rs\.?|₹)\s*([\d,]+(?:\.\d{1,2})?)/i) || msg.match(/([\d,]+(?:\.\d{1,2})?)\s*(?:INR|Rs\.?)/i);
      if (!amtMatch) continue;
      const amount = parseFloat(amtMatch[1].replace(/,/g, ""));
      if (amount <= 0) continue;

      // Is it credit or debit?
      const isCredit = /credited|received|deposited|refund|salary/i.test(msg);
      if (isCredit) continue; // Only import expenses

      // Extract merchant
      let merchant = "Bank transaction";
      const merchantMatch = msg.match(/(?:at|to|from|for)\s+([A-Za-z][A-Za-z0-9\s&.'_-]{1,30}?)(?:\s+(?:on|via|thru|ref|UPI))/i)
        || msg.match(/(?:at|to)\s+([A-Za-z][A-Za-z0-9\s&.'_-]{1,25})/i);
      if (merchantMatch) merchant = merchantMatch[1].trim();

      // Extract date
      let date = toDateStr(new Date());
      const dateMatch = msg.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
      if (dateMatch) {
        let yr = dateMatch[3]; if (yr.length === 2) yr = `20${yr}`;
        date = `${yr}-${dateMatch[2].padStart(2, "0")}-${dateMatch[1].padStart(2, "0")}`;
      }

      const category = guessCategory(merchant);
      const now = new Date();

      await db.expenses.add({
        id: `sms_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        amount, description: merchant, category, date,
        time: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
        createdAt: now.toISOString(),
      });
      count++;
      total += amount;
    }

    if (count === 0) { setError("Could not find expenses in the text. Paste actual bank SMS messages."); }
    else { setResult({ count, total }); setText(""); }
    setLoading(false);
  }, [text]);

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-surface shadow-xl anim-up max-h-[85vh] overflow-y-auto">
        <div className="flex justify-center py-2"><div className="h-1 w-10 rounded-full bg-border" /></div>
        <div className="px-5 pb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-text">Import from SMS</h2>
              <p className="text-[11px] text-text3">Paste bank messages below</p>
            </div>
            <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-surface2"><X size={18} className="text-text2" /></button>
          </div>

          {result && (
            <div className="mb-4 flex items-center gap-3 rounded-xl bg-green-bg p-3 anim-fade">
              <Check size={20} className="text-green" />
              <div>
                <p className="text-sm font-bold text-green">{result.count} expense{result.count > 1 ? "s" : ""} imported!</p>
                <p className="text-[11px] text-text2">Total: {formatMoney(result.total)}</p>
              </div>
            </div>
          )}

          {error && <div className="mb-4 rounded-xl bg-red-bg p-3 text-xs text-red">{error}</div>}

          <textarea value={text} onChange={(e) => { setText(e.target.value); setResult(null); setError(""); }}
            rows={6} placeholder={"Paste bank SMS here:\n\nINR 420.00 debited from A/c XX1234 at Swiggy on 05-09-26\n\nRs.250 paid to Uber via UPI on 04-09-26\n\n(Separate multiple with blank lines)"}
            className="w-full rounded-xl border border-border bg-surface2 px-3.5 py-3 text-[12px] text-text placeholder:text-text3 outline-none focus:border-accent resize-none font-mono leading-relaxed" />

          <button onClick={handleParse} disabled={!text.trim() || loading}
            className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-bold text-white disabled:opacity-40 hover:bg-accent/90 transition-all">
            {loading ? <><Loader2 size={16} className="animate-spin" /> Parsing...</> : <><MessageSquare size={16} /> Parse & Import</>}
          </button>

          <div className="mt-4 rounded-xl bg-surface2 p-3 text-[10px] text-text3 space-y-1">
            <p className="font-bold text-text2">How to use:</p>
            <p>1. Open SMS app → find bank messages</p>
            <p>2. Long-press → Copy the message text</p>
            <p>3. Paste here → we extract amount, merchant, date</p>
            <p>4. Works with HDFC, SBI, ICICI, Axis, UPI, and most Indian banks</p>
          </div>
        </div>
      </div>
    </div>
  );
}
