"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, Calendar, ChevronLeft, ChevronRight, X, Trash2, ArrowDown } from "lucide-react";
import { db, guessCategory, CATEGORIES, getCategoryEmoji, getCategoryName, type Expense } from "@/lib/db";
import { cn, formatMoney, getGreeting, toDateStr, friendlyDate } from "@/lib/utils";

export default function Home() {
  const [showAdd, setShowAdd] = useState(false);
  const [tab, setTab] = useState<"home" | "calendar">("home");

  return (
    <>
      {tab === "home" ? <HomeTab /> : <CalendarTab />}

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

      {/* Add expense sheet */}
      {showAdd && <AddExpenseSheet onClose={() => setShowAdd(false)} />}
    </>
  );
}

// ════════════════════════════════════════════════════════
// HOME TAB
// ════════════════════════════════════════════════════════

function HomeTab() {
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-31`;

  const expenses = useLiveQuery(
    () => db.expenses.where("date").between(monthStart, monthEnd, true, true).reverse().sortBy("date")
  ) ?? [];

  const monthTotal = expenses.reduce((s, e) => s + e.amount, 0);
  const todayTotal = expenses.filter((e) => e.date === toDateStr(now)).reduce((s, e) => s + e.amount, 0);

  // Group by date
  const grouped = useMemo(() => {
    const map = new Map<string, Expense[]>();
    for (const e of expenses) {
      const arr = map.get(e.date) || [];
      arr.push(e);
      map.set(e.date, arr);
    }
    return Array.from(map.entries());
  }, [expenses]);

  // Category breakdown
  const catBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenses) map.set(e.category, (map.get(e.category) || 0) + e.amount);
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  const monthName = now.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <div className="flex-1 px-4 pt-5 pb-4 overflow-y-auto">
      {/* Header */}
      <p className="text-sm text-text2">{getGreeting()} 👋</p>

      {/* Month total hero */}
      <div className="mt-3 rounded-2xl bg-accent p-5 text-white relative overflow-hidden">
        <div className="absolute -top-8 -right-8 h-28 w-28 rounded-full bg-white/10" />
        <p className="text-xs text-white/60">{monthName}</p>
        <p className="text-3xl font-extrabold tabular-nums mt-1">{formatMoney(monthTotal)}</p>
        <p className="text-xs text-white/60 mt-1">spent this month</p>
        <div className="mt-3 flex gap-3">
          <div className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold">
            Today: {formatMoney(todayTotal)}
          </div>
          <div className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold">
            {expenses.length} expenses
          </div>
        </div>
      </div>

      {/* Category breakdown */}
      {catBreakdown.length > 0 && (
        <div className="mt-5">
          <h3 className="text-xs font-bold text-text3 uppercase tracking-wider mb-2">Where it went</h3>
          <div className="flex gap-2 overflow-x-auto hide-scroll pb-1">
            {catBreakdown.slice(0, 6).map(([cat, amount]) => (
              <div key={cat} className="shrink-0 rounded-xl border border-border bg-surface p-3 min-w-[100px]">
                <span className="text-lg">{getCategoryEmoji(cat)}</span>
                <p className="text-xs font-bold text-text mt-1 tabular-nums">{formatMoney(amount)}</p>
                <p className="text-[10px] text-text3">{getCategoryName(cat)}</p>
              </div>
            ))}
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

  const handleDelete = async () => {
    await db.expenses.delete(expense.id);
  };

  return (
    <div className="flex items-center gap-3 rounded-xl bg-surface border border-border p-3 active:bg-surface2 transition-colors"
      onClick={() => setShowDelete(!showDelete)}>
      <div className="flex h-10 w-10 items-center justify-center rounded-xl text-lg"
        style={{ backgroundColor: "var(--accent-bg)" }}>
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
// CALENDAR TAB
// ════════════════════════════════════════════════════════

function CalendarTab() {
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

  // Build calendar grid
  const firstDay = new Date(y, m, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const offset = firstDay === 0 ? 6 : firstDay - 1; // Mon start
  const days: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const today = toDateStr(new Date());
  const selectedExpenses = selectedDate ? expenses.filter((e) => e.date === selectedDate) : [];

  const prev = () => setMonth(new Date(y, m - 1, 1));
  const next = () => setMonth(new Date(y, m + 1, 1));

  return (
    <div className="flex-1 px-4 pt-5 pb-4 overflow-y-auto">
      {/* Month nav */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-text">{month.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</h2>
          <p className="text-xs text-text3">Total: <span className="font-bold text-red tabular-nums">{formatMoney(monthTotal)}</span></p>
        </div>
        <div className="flex gap-1">
          <button onClick={prev} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-surface2 transition-colors">
            <ChevronLeft size={16} className="text-text2" />
          </button>
          <button onClick={() => { setMonth(new Date()); setSelectedDate(today); }}
            className="px-2 py-1 text-[11px] font-semibold text-accent hover:bg-accent-bg rounded-lg transition-colors">
            Today
          </button>
          <button onClick={next} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-surface2 transition-colors">
            <ChevronRight size={16} className="text-text2" />
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="text-center text-[9px] font-bold text-text3 uppercase py-1">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
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
                isSelected ? "bg-accent-bg ring-1 ring-accent/30" : isToday ? "bg-surface2" : "hover:bg-surface2"
              )}>
              <span className={cn("text-xs font-medium", isToday && "text-accent font-bold", isSelected && "text-accent font-bold")}>
                {day}
              </span>
              {total > 0 && (
                <span className="text-[8px] font-bold text-red tabular-nums mt-0.5">{formatMoney(total)}</span>
              )}
              {total > 0 && <div className="h-1 w-1 rounded-full bg-red mt-0.5" />}
            </button>
          );
        })}
      </div>

      {/* Selected day detail */}
      {selectedDate && (
        <div className="mt-4 anim-up">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-text">{friendlyDate(selectedDate)}</h3>
            <span className="text-sm font-bold text-red tabular-nums">{formatMoney(selectedExpenses.reduce((s, e) => s + e.amount, 0))}</span>
          </div>
          {selectedExpenses.length === 0 ? (
            <p className="text-xs text-text3 text-center py-4">No expenses this day</p>
          ) : (
            <div className="space-y-1">
              {selectedExpenses.map((e) => <ExpenseRow key={e.id} expense={e} />)}
            </div>
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

  // Auto-detect category as user types description
  const detectedCategory = useMemo(() => guessCategory(desc), [desc]);

  const handleSave = useCallback(async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0 || !desc.trim()) return;
    setSaving(true);
    const now = new Date();
    await db.expenses.add({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      amount: amt,
      description: desc.trim(),
      category: category || detectedCategory,
      date,
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
            <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-surface2">
              <X size={18} className="text-text2" />
            </button>
          </div>

          {saved ? (
            <div className="flex flex-col items-center py-8 anim-fade">
              <div className="h-16 w-16 rounded-full bg-green-bg flex items-center justify-center">
                <span className="text-green text-2xl">✓</span>
              </div>
              <p className="text-sm text-text2 mt-3">Expense added!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Amount — big and prominent */}
              <div>
                <label className="text-[10px] font-bold text-text3 uppercase tracking-wider mb-1 block">Amount</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-text3 font-bold">₹</span>
                  <input ref={amountRef} type="number" inputMode="decimal" value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-xl border border-border bg-surface2 pl-10 pr-4 py-4 text-2xl font-extrabold text-text tabular-nums outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                  />
                </div>
              </div>

              {/* Description — auto-detects category */}
              <div>
                <label className="text-[10px] font-bold text-text3 uppercase tracking-wider mb-1 block">What was it for?</label>
                <input type="text" value={desc} onChange={(e) => setDesc(e.target.value)}
                  placeholder="e.g. Evening snacks, Uber to office, Coffee"
                  className="w-full rounded-xl border border-border bg-surface2 px-4 py-3 text-sm text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                />
                {desc.trim() && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-text2 anim-fade">
                    <span className="text-sm">{getCategoryEmoji(detectedCategory)}</span>
                    <span>Auto: <span className="font-semibold text-accent">{getCategoryName(detectedCategory)}</span></span>
                  </div>
                )}
              </div>

              {/* Category — tap to override */}
              <div>
                <label className="text-[10px] font-bold text-text3 uppercase tracking-wider mb-1.5 block">
                  Category {category ? "" : "(auto-detected)"}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map((cat) => {
                    const active = category ? category === cat : detectedCategory === cat;
                    return (
                      <button key={cat} onClick={() => setCategory(cat === category ? "" : cat)}
                        className={cn("rounded-full px-2.5 py-1.5 text-[11px] font-semibold border transition-all flex items-center gap-1",
                          active ? "border-accent bg-accent-bg text-accent" : "border-border text-text2 hover:bg-surface2"
                        )}>
                        {getCategoryEmoji(cat)} {getCategoryName(cat)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date — default today, can change */}
              <div>
                <label className="text-[10px] font-bold text-text3 uppercase tracking-wider mb-1 block">Date</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface2 px-4 py-3 text-sm text-text outline-none focus:border-accent transition-all"
                />
              </div>

              {/* Save button */}
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
