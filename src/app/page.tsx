"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Plus, Calendar, ChevronLeft, ChevronRight, X, Trash2, ArrowDown, ArrowUp,
  LayoutGrid, List, Clock, MessageSquare, Check, Loader2, Sun, Moon,
  TrendingUp, TrendingDown, Target, RotateCcw, LogIn, LogOut, Cloud, CloudOff, RefreshCw,
} from "lucide-react";
import { db, guessCategory, isIncomeKeyword, QUICK_CATEGORIES, CATEGORIES, getCategoryEmoji, getCategoryName, normalizeCategoryForChart, initSettings, type Expense } from "@/lib/db";
import { cn, formatMoney, getGreeting, toDateStr, friendlyDate } from "@/lib/utils";
import { signInWithGoogle, signOutUser, onAuthChange, getCurrentUser, syncToCloud, syncFromCloud, syncExpenseToCloud, deleteExpenseFromCloud, listenToCloudChanges, isFirebaseConfigured } from "@/lib/firebase";
import type { User } from "firebase/auth";

// ── init DB settings on load ──
if (typeof window !== "undefined") initSettings();

export default function Home() {
  const [showAdd, setShowAdd] = useState(false);
  const [showSMS, setShowSMS] = useState(false);
  const [showQuick, setShowQuick] = useState(false);
  const [tab, setTab] = useState<"home" | "calendar">("home");
  const [user, setUser] = useState<User | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthChange((u) => setUser(u));
    return unsub;
  }, []);

  // Real-time cloud sync listener
  useEffect(() => {
    if (!user) return;
    const unsub = listenToCloudChanges(user.uid, () => {
      // Dexie live queries will auto-update the UI
    });
    return unsub;
  }, [user]);

  const handleSync = useCallback(async () => {
    if (!user) return;
    setSyncing(true);
    try {
      await syncToCloud(user.uid);
      await syncFromCloud(user.uid);
    } catch (err) {
      console.error("Sync failed:", err);
    }
    setSyncing(false);
  }, [user]);

  return (
    <>
      {tab === "home" ? <HomeTab onSMS={() => setShowSMS(true)} user={user} syncing={syncing} onSync={handleSync} /> : <CalendarTab />}

      {/* Bottom nav */}
      <nav className="sticky bottom-0 border-t border-border bg-surface/80 backdrop-blur-xl flex safe-b">
        <button onClick={() => setTab("home")}
          className={cn("flex-1 py-3 flex flex-col items-center gap-0.5 text-[10px] font-semibold", tab === "home" ? "text-accent" : "text-text3")}>
          <ArrowDown size={20} strokeWidth={tab === "home" ? 2.5 : 1.8} /> Expenses
        </button>

        {/* FAB — long press for quick add, tap for full form */}
        <div className="flex items-center justify-center -mt-5 z-10">
          <button onClick={() => setShowAdd(true)} onContextMenu={(e) => { e.preventDefault(); setShowQuick(true); }}
            className="h-14 w-14 rounded-full bg-accent text-white flex items-center justify-center shadow-lg shadow-accent/30 active:scale-90 transition-transform">
            <Plus size={26} strokeWidth={2.5} />
          </button>
        </div>

        <button onClick={() => setTab("calendar")}
          className={cn("flex-1 py-3 flex flex-col items-center gap-0.5 text-[10px] font-semibold", tab === "calendar" ? "text-accent" : "text-text3")}>
          <Calendar size={20} strokeWidth={tab === "calendar" ? 2.5 : 1.8} /> Calendar
        </button>
      </nav>

      {showAdd && <AddExpenseSheet onClose={() => setShowAdd(false)} />}
      {showSMS && <SMSImportSheet onClose={() => setShowSMS(false)} />}
      {showQuick && <QuickNumpad onClose={() => setShowQuick(false)} />}
    </>
  );
}

// ════════════════════════════════════════════════════════
// DARK MODE TOGGLE
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
    const next = !dark; setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("paisa-dark", String(next));
  };
  return (
    <button onClick={toggle} className="h-9 w-9 flex items-center justify-center rounded-xl hover:bg-surface2 transition-colors">
      {dark ? <Sun size={18} className="text-orange" /> : <Moon size={18} className="text-text3" />}
    </button>
  );
}

// ════════════════════════════════════════════════════════
// HOME TAB — with pie chart, daily limit, streaks, income
// ════════════════════════════════════════════════════════

// ── Daily money tips (rotates daily, no API needed) ──
const MONEY_TIPS = [
  "💡 50/30/20 rule: needs, wants, savings",
  "☕ ₹100/day chai = ₹36,500/year",
  "📱 Check your subscriptions. Cancel unused ones",
  "🛒 Make a list before shopping",
  "💰 Save first, spend what's left",
  "🍔 Cooking > ordering. Save 60%",
  "🚌 Metro > cab. Save ₹5K/month",
  "💳 Pay credit card in full. Always",
  "⏰ Wait 24hrs before ₹1000+ purchases",
  "📈 Start SIP with even ₹500/month",
  "🎯 Name your goals. 'Goa fund' works better than 'savings'",
  "📝 Writing goals makes them 42% more likely",
  "🧮 Is that worth X hours of your work?",
  "📱 Uninstall shopping apps for a week",
  "💸 Your biggest expense is the one you don't track",
  "🌙 Sleep on big purchases. Morning brain is smarter",
  "🎮 Free fun exists: parks, YouTube, open-source games",
  "💪 Money fitness = consistency, not intensity",
  "🏠 Rent should be ≤30% of your income",
  "⛽ Combine errands. Save fuel money",
  "🎁 Experiences > things. Memories last longer",
  "📉 Market crashed? Don't panic. Keep your SIP",
  "🔒 Never share UPI PIN or OTP. Ever",
  "🌱 Grow income AND cut expenses. Both matter",
  "🤝 Split bills fairly. No one likes awkward conversations",
  "📅 Bill reminders save late fees",
  "🎓 Best investment = investing in your skills",
  "💸 ₹10 saved daily = ₹3,650/year = vacation fund",
  "🛍️ 'Sale' doesn't mean 'save'. It means 'spend'",
  "🧊 The best budget is the one you actually follow",
];

function DailyTip() {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const tip = MONEY_TIPS[dayOfYear % MONEY_TIPS.length];

  return (
    <div className="mt-3 rounded-xl bg-orange-bg/50 border border-orange/10 p-2.5 flex items-center gap-2.5">
      <span className="text-base">{tip.slice(0, 2)}</span>
      <p className="text-[11px] text-text2 leading-relaxed flex-1">{tip.slice(2).trim()}</p>
    </div>
  );
}

function CollapsibleDay({ date, items, daySpent, dayIncome, defaultOpen }: {
  date: string; items: Expense[]; daySpent: number; dayIncome: number; defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="anim-up">
      <button onClick={() => setOpen(!open)} className="flex items-center justify-between w-full mb-1.5 px-1">
        <div className="flex items-center gap-1.5">
          <ChevronRight size={12} className={cn("text-text3 transition-transform", open && "rotate-90")} />
          <span className="text-[11px] font-bold text-text3 uppercase tracking-wider">{friendlyDate(date)}</span>
          {!open && <span className="text-[10px] text-text3">({items.length})</span>}
        </div>
        <div className="flex gap-2">
          {dayIncome > 0 && <span className="text-[11px] font-bold text-green tabular-nums">+{formatMoney(dayIncome)}</span>}
          {daySpent > 0 && <span className="text-[11px] font-bold text-red tabular-nums">−{formatMoney(daySpent)}</span>}
        </div>
      </button>
      {open && (
        <div className="space-y-1 anim-fade">
          {items.map((e) => <ExpenseRow key={e.id} expense={e} />)}
        </div>
      )}
    </div>
  );
}

function HomeTab({ onSMS, user, syncing, onSync }: { onSMS: () => void; user: User | null; syncing: boolean; onSync: () => void }) {
  const now = new Date();
  const ms = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const me = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-31`;
  const todayStr = toDateStr(now);

  const expenses = useLiveQuery(() => db.expenses.where("date").between(ms, me, true, true).reverse().sortBy("date")) ?? [];

  const monthExpenses = expenses.filter((e) => e.type === "expense");
  const monthIncome = expenses.filter((e) => e.type === "income");
  const monthSpent = monthExpenses.reduce((s, e) => s + e.amount, 0);
  const monthEarned = monthIncome.reduce((s, e) => s + e.amount, 0);
  const todaySpent = monthExpenses.filter((e) => e.date === todayStr).reduce((s, e) => s + e.amount, 0);
  const balance = monthEarned - monthSpent;

  // Tracking streak
  const streak = useMemo(() => {
    let count = 0;
    for (let i = 0; i < 30; i++) {
      const d = toDateStr(new Date(now.getTime() - i * 86400000));
      if (expenses.some((e) => e.date === d)) count++;
      else break;
    }
    return count;
  }, [expenses, now]);

  // Group by date
  const grouped = useMemo(() => {
    const map = new Map<string, Expense[]>();
    for (const e of expenses) { const arr = map.get(e.date) || []; arr.push(e); map.set(e.date, arr); }
    return Array.from(map.entries());
  }, [expenses]);

  // Category breakdown (expenses only)
  const catBreakdown = useMemo(() => {
    const map = new Map<string, { amount: number; emoji: string }>();
    for (const e of monthExpenses) {
      const name = normalizeCategoryForChart(e.category);
      const existing = map.get(name) || { amount: 0, emoji: getCategoryEmoji(e.category) };
      existing.amount += e.amount;
      map.set(name, existing);
    }
    return Array.from(map.entries()).map(([name, { amount, emoji }]) => ({ name, amount, emoji })).sort((a, b) => b.amount - a.amount);
  }, [monthExpenses]);

  // 7-day chart
  const dailySpending = useMemo(() => {
    const days: { label: string; amount: number; isToday: boolean }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const ds = toDateStr(d);
      days.push({ label: d.toLocaleDateString("en-IN", { weekday: "narrow" }), amount: monthExpenses.filter((e) => e.date === ds).reduce((s, e) => s + e.amount, 0), isToday: i === 0 });
    }
    return days;
  }, [monthExpenses, now]);
  const maxDaily = Math.max(...dailySpending.map((d) => d.amount), 1);

  // Days left in month
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - now.getDate();
  const avgDaily = now.getDate() > 0 ? Math.round(monthSpent / now.getDate()) : 0;

  const monthName = now.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <div className="flex-1 px-4 pt-5 pb-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm text-text2">{getGreeting()} 👋</p>
        <div className="flex items-center gap-1">
          {streak > 1 && <span className="text-xs font-bold text-orange bg-orange-bg px-2 py-0.5 rounded-full">🔥 {streak}d</span>}
          {/* Sync button */}
          {user && (
            <button onClick={onSync} disabled={syncing} className="h-9 w-9 flex items-center justify-center rounded-xl hover:bg-surface2 transition-colors">
              {syncing ? <Loader2 size={16} className="text-accent animate-spin" /> : <Cloud size={16} className="text-green" />}
            </button>
          )}
          {/* Google login/logout */}
          {isFirebaseConfigured() && (
            user ? (
              <button onClick={signOutUser} className="h-8 flex items-center gap-1.5 rounded-full bg-surface2 px-2 pr-2.5">
                {user.photoURL ? <img src={user.photoURL} className="h-5 w-5 rounded-full" alt="" /> : <div className="h-5 w-5 rounded-full bg-accent text-white text-[9px] font-bold flex items-center justify-center">{user.displayName?.[0]}</div>}
              </button>
            ) : (
              <button onClick={async () => { await signInWithGoogle(); }} className="h-8 flex items-center gap-1 rounded-full bg-surface2 px-2.5 text-[10px] font-semibold text-text2 hover:bg-accent-bg hover:text-accent transition-colors">
                <LogIn size={12} /> Sign in
              </button>
            )
          )}
          <DarkToggle />
        </div>
      </div>

      {/* Hero card */}
      <div className="mt-2 rounded-2xl bg-accent p-5 text-white relative overflow-hidden">
        <div className="absolute -top-8 -right-8 h-28 w-28 rounded-full bg-white/10" />
        <p className="text-xs text-white/60">{monthName}</p>
        <p className="text-3xl font-extrabold tabular-nums mt-1">{formatMoney(monthSpent)}</p>
        <p className="text-xs text-white/60 mt-0.5">spent this month</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <div className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold flex items-center gap-1">
            <TrendingDown size={10} /> Today: {formatMoney(todaySpent)}
          </div>
          {monthEarned > 0 && (
            <div className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold flex items-center gap-1">
              <TrendingUp size={10} /> Income: {formatMoney(monthEarned)}
            </div>
          )}
          {monthEarned > 0 && (
            <div className={cn("rounded-full px-2.5 py-1 text-[10px] font-semibold", balance >= 0 ? "bg-white/20" : "bg-red/30")}>
              Balance: {formatMoney(balance)}
            </div>
          )}
        </div>
      </div>

      {/* Quick stats row */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-border bg-surface p-2.5 text-center">
          <p className="text-[9px] font-bold text-text3 uppercase">Avg/day</p>
          <p className="text-sm font-extrabold text-text tabular-nums mt-0.5">{formatMoney(avgDaily)}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-2.5 text-center">
          <p className="text-[9px] font-bold text-text3 uppercase">Days left</p>
          <p className="text-sm font-extrabold text-text tabular-nums mt-0.5">{daysLeft}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-2.5 text-center">
          <p className="text-[9px] font-bold text-text3 uppercase">Transactions</p>
          <p className="text-sm font-extrabold text-text tabular-nums mt-0.5">{expenses.length}</p>
        </div>
      </div>

      {/* SMS import */}
      <button onClick={onSMS}
        className="mt-3 w-full flex items-center gap-3 rounded-xl border border-dashed border-accent/30 bg-accent-bg/50 p-2.5 text-left hover:bg-accent-bg transition-colors">
        <MessageSquare size={16} className="text-accent shrink-0" />
        <div className="flex-1">
          <p className="text-[11px] font-bold text-text">Paste bank SMS to import</p>
        </div>
        <ChevronRight size={14} className="text-accent" />
      </button>

      {/* Daily money tip */}
      <DailyTip />

      {/* 7-day bar chart */}
      {monthExpenses.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-bold text-text3 uppercase tracking-wider mb-2">Last 7 days</h3>
          <div className="flex items-end gap-1.5 h-16">
            {dailySpending.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                {d.amount > 0 && <span className="text-[7px] font-bold text-text3 tabular-nums">{formatMoney(d.amount)}</span>}
                <div className={cn("w-full rounded-t-md transition-all", d.isToday ? "bg-accent" : "bg-accent/30")}
                  style={{ height: `${Math.max(3, (d.amount / maxDaily) * 44)}px` }} />
                <span className={cn("text-[9px] font-bold", d.isToday ? "text-accent" : "text-text3")}>{d.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pie chart — visual category breakdown */}
      {catBreakdown.length > 1 && (
        <div className="mt-4">
          <h3 className="text-xs font-bold text-text3 uppercase tracking-wider mb-2">Spending split</h3>
          <div className="flex gap-4 items-center">
            <PieChart data={catBreakdown.map((c) => [c.name, c.amount])} total={monthSpent} />
            <div className="flex-1 space-y-1.5">
              {catBreakdown.slice(0, 5).map((c) => {
                const pct = monthSpent > 0 ? Math.round((c.amount / monthSpent) * 100) : 0;
                return (
                  <div key={c.name} className="flex items-center gap-2">
                    <span className="text-sm">{c.emoji}</span>
                    <div className="flex-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="font-semibold text-text">{c.name}</span>
                        <span className="font-bold text-text tabular-nums">{pct}%</span>
                      </div>
                      <div className="h-1 rounded-full bg-surface2 mt-0.5 overflow-hidden">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Expense list */}
      {grouped.length === 0 ? (
        <div className="mt-14 text-center anim-fade">
          <p className="text-4xl">💸</p>
          <p className="text-base font-bold text-text mt-3">No expenses yet</p>
          <p className="text-sm text-text2 mt-1">Tap <span className="text-accent font-bold">+</span> to add your first one</p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {grouped.map(([date, items], idx) => {
            const daySpent = items.filter((e) => e.type === "expense").reduce((s, e) => s + e.amount, 0);
            const dayIncome = items.filter((e) => e.type === "income").reduce((s, e) => s + e.amount, 0);
            const isToday = date === todayStr;
            return <CollapsibleDay key={date} date={date} items={items} daySpent={daySpent} dayIncome={dayIncome} defaultOpen={isToday || idx === 0} />;
          })}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════
// SIMPLE SVG PIE CHART
// ════════════════════════════════════════════════════════

const PIE_COLORS = ["#6366F1", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6", "#F97316"];

function PieChart({ data, total }: { data: [string, number][]; total: number }) {
  const size = 80;
  const r = 30;
  const cx = size / 2;
  const cy = size / 2;
  let cumulativePercent = 0;

  const slices = data.slice(0, 6).map(([, amount], i) => {
    const percent = total > 0 ? amount / total : 0;
    const startAngle = cumulativePercent * 360;
    cumulativePercent += percent;
    const endAngle = cumulativePercent * 360;

    const startRad = ((startAngle - 90) * Math.PI) / 180;
    const endRad = ((endAngle - 90) * Math.PI) / 180;

    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);

    const largeArc = percent > 0.5 ? 1 : 0;
    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;

    return <path key={i} d={d} fill={PIE_COLORS[i % PIE_COLORS.length]} />;
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      {data.length <= 1 ? (
        <circle cx={cx} cy={cy} r={r} fill={PIE_COLORS[0]} />
      ) : slices}
      <circle cx={cx} cy={cy} r={16} fill="var(--surface)" />
      <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fill="var(--text)" fontSize="9" fontWeight="800">
        {formatMoney(total)}
      </text>
    </svg>
  );
}

// ════════════════════════════════════════════════════════
// EXPENSE ROW — with income indicator
// ════════════════════════════════════════════════════════

function ExpenseRow({ expense }: { expense: Expense }) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editAmt, setEditAmt] = useState(String(expense.amount));
  const [editDesc, setEditDesc] = useState(expense.description);
  const [editCat, setEditCat] = useState(expense.category);
  const isIncome = expense.type === "income";

  const handleDelete = async () => {
    await db.expenses.delete(expense.id);
    // Also delete from cloud if logged in
    const u = getCurrentUser();
    if (u) deleteExpenseFromCloud(u.uid, expense.id).catch(() => {});
  };

  const handleEdit = async () => {
    const amt = parseFloat(editAmt);
    if (!amt || amt <= 0) return;
    const updated = { ...expense, amount: amt, description: editDesc || getCategoryName(editCat), category: editCat };
    await db.expenses.put(updated);
    const u = getCurrentUser();
    if (u) syncExpenseToCloud(u.uid, updated).catch(() => {});
    setEditing(false);
  };

  return (
    <div className={cn("rounded-xl border transition-colors",
      isIncome ? "border-green/20 bg-green-bg" : "border-border bg-surface")}>

      {/* Main row — tap to expand */}
      <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={() => { setExpanded(!expanded); setConfirmDelete(false); setEditing(false); }}>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl text-lg shrink-0",
          isIncome ? "bg-green/10" : "bg-accent-bg")}>
          {isIncome ? "💰" : getCategoryEmoji(expense.category)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-text truncate">{expense.description}</p>
          <p className="text-[11px] text-text3">
            {getCategoryName(expense.category)} · {expense.time}
            {expense.location ? ` · 📍${expense.location}` : ""}
          </p>
        </div>
        <span className={cn("text-[13px] font-bold tabular-nums shrink-0", isIncome ? "text-green" : "text-text")}>
          {isIncome ? "+" : ""}{formatMoney(expense.amount)}
        </span>
      </div>

      {/* Expanded actions */}
      {expanded && !editing && (
        <div className="px-3 pb-3 flex gap-2 anim-fade">
          <button onClick={(e) => { e.stopPropagation(); setEditing(true); }}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-xs font-semibold text-text2 hover:bg-surface2 transition-colors">
            ✏️ Edit
          </button>
          {confirmDelete ? (
            <>
              <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); }}
                className="flex-1 rounded-lg border border-border py-2 text-xs font-semibold text-text2 hover:bg-surface2">
                Cancel
              </button>
              <button onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                className="flex-1 rounded-lg bg-red py-2 text-xs font-bold text-white">
                Yes, Delete
              </button>
            </>
          ) : (
            <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-red/20 py-2 text-xs font-semibold text-red hover:bg-red-bg transition-colors">
              <Trash2 size={12} /> Delete
            </button>
          )}
        </div>
      )}

      {/* Edit form */}
      {expanded && editing && (
        <div className="px-3 pb-3 space-y-2 anim-fade">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-text3 font-bold">₹</span>
              <input type="number" value={editAmt} onChange={(e) => setEditAmt(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface2 pl-6 pr-2 py-2 text-sm font-bold text-text outline-none focus:border-accent tabular-nums" />
            </div>
            <input type="text" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Description"
              className="flex-1 rounded-lg border border-border bg-surface2 px-2.5 py-2 text-sm text-text outline-none focus:border-accent" />
          </div>
          <div className="flex flex-wrap gap-1">
            {CATEGORIES.map((cat) => (
              <button key={cat} onClick={() => setEditCat(cat)}
                className={cn("rounded-full px-2 py-1 text-[10px] font-semibold border transition-all",
                  editCat === cat ? "border-accent bg-accent-bg text-accent" : "border-border text-text3")}>
                {getCategoryEmoji(cat)} {getCategoryName(cat)}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="flex-1 rounded-lg border border-border py-2 text-xs font-semibold text-text2">Cancel</button>
            <button onClick={handleEdit} className="flex-1 rounded-lg bg-accent py-2 text-xs font-bold text-white">Save</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════
// QUICK NUMPAD — Monefy-style: amount → emoji → done
// ════════════════════════════════════════════════════════

function QuickNumpad({ onClose }: { onClose: () => void }) {
  const [amount, setAmount] = useState("0");
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const tap = (n: string) => setAmount((prev) => prev === "0" ? n : prev + n);
  const backspace = () => setAmount((prev) => prev.length > 1 ? prev.slice(0, -1) : "0");

  const handleSave = async (cat: string) => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    const now = new Date();
    await db.expenses.add({
      id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      amount: amt, description: getCategoryName(cat), category: cat, type: "expense",
      date: toDateStr(now),
      time: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
      createdAt: now.toISOString(),
    });
    setSaved(true);
    setTimeout(onClose, 500);
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-surface shadow-xl anim-up">
        <div className="flex justify-center py-2"><div className="h-1 w-10 rounded-full bg-border" /></div>
        <div className="px-4 pb-6">
          {saved ? (
            <div className="flex flex-col items-center py-8 anim-fade">
              <div className="h-14 w-14 rounded-full bg-green-bg flex items-center justify-center"><Check size={28} className="text-green" /></div>
              <p className="text-sm font-bold text-text mt-2">Added!</p>
            </div>
          ) : (
            <>
              {/* Amount display */}
              <div className="text-center py-3">
                <span className="text-3xl font-extrabold text-text tabular-nums">₹{amount}</span>
              </div>

              {/* Category emoji grid — tap to save */}
              <div className="grid grid-cols-4 gap-2 mb-4">
                {QUICK_CATEGORIES.map((c) => (
                  <button key={c.cat} onClick={() => handleSave(c.cat)}
                    disabled={amount === "0"}
                    className="flex flex-col items-center gap-0.5 rounded-xl border border-border p-2.5 hover:bg-accent-bg hover:border-accent active:scale-95 transition-all disabled:opacity-30">
                    <span className="text-2xl">{c.emoji}</span>
                    <span className="text-[9px] font-semibold text-text2">{c.label}</span>
                  </button>
                ))}
              </div>

              {/* Numpad */}
              <div className="grid grid-cols-3 gap-2">
                {["1","2","3","4","5","6","7","8","9",".",  "0", "⌫"].map((key) => (
                  <button key={key}
                    onClick={() => key === "⌫" ? backspace() : key === "." ? (amount.includes(".") ? null : tap(".")) : tap(key)}
                    className="h-12 rounded-xl bg-surface2 text-lg font-bold text-text active:bg-accent active:text-white transition-colors">
                    {key}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════
// CALENDAR TAB — month/week/timeline views
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
    for (const e of expenses) if (e.type === "expense") map.set(e.date, (map.get(e.date) || 0) + e.amount);
    return map;
  }, [expenses]);

  const monthTotal = expenses.filter((e) => e.type === "expense").reduce((s, e) => s + e.amount, 0);
  const today = toDateStr(new Date());
  const selectedExpenses = selectedDate ? expenses.filter((e) => e.date === selectedDate) : [];

  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  const days: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  // Week view
  const weekDays = useMemo(() => {
    const nowDate = new Date();
    const dow = nowDate.getDay() === 0 ? 6 : nowDate.getDay() - 1;
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(nowDate.getTime() - (dow - i) * 86400000);
      const ds = toDateStr(d);
      const dayExp = expenses.filter((e) => e.date === ds);
      return { date: ds, dayName: d.toLocaleDateString("en-IN", { weekday: "short" }), dayNum: d.getDate(), expenses: dayExp, total: dayExp.filter((e) => e.type === "expense").reduce((s, e) => s + e.amount, 0) };
    });
  }, [expenses]);

  // Timeline
  const timeline = useMemo(() => {
    const sorted = [...expenses].sort((a, b) => b.date.localeCompare(a.date) || (b.time || "").localeCompare(a.time || ""));
    const map = new Map<string, Expense[]>();
    for (const e of sorted) { const arr = map.get(e.date) || []; arr.push(e); map.set(e.date, arr); }
    return Array.from(map.entries());
  }, [expenses]);

  const prev = () => setMonth(new Date(y, m - 1, 1));
  const next = () => setMonth(new Date(y, m + 1, 1));
  const goToday = () => { setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1)); setSelectedDate(toDateStr(new Date())); };

  return (
    <div className="flex-1 px-4 pt-5 pb-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-bold text-text">{month.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</h2>
          <p className="text-xs text-text3">Spent: <span className="font-bold text-red tabular-nums">{formatMoney(monthTotal)}</span></p>
        </div>
        <div className="flex gap-1">
          <button onClick={prev} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-surface2"><ChevronLeft size={16} className="text-text2" /></button>
          <button onClick={goToday} className="px-2 py-1 text-[11px] font-semibold text-accent hover:bg-accent-bg rounded-lg">Today</button>
          <button onClick={next} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-surface2"><ChevronRight size={16} className="text-text2" /></button>
        </div>
      </div>

      <div className="flex gap-1 mb-3">
        {([{ k: "month" as CalView, i: LayoutGrid, l: "Month" }, { k: "week" as CalView, i: List, l: "Week" }, { k: "timeline" as CalView, i: Clock, l: "Timeline" }]).map((v) => {
          const I = v.i;
          return <button key={v.k} onClick={() => setView(v.k)} className={cn("flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold", view === v.k ? "bg-accent-bg text-accent" : "text-text3 hover:bg-surface2")}><I size={13} /> {v.l}</button>;
        })}
      </div>

      {view === "month" && (
        <>
          <div className="grid grid-cols-7 mb-1">{["M","T","W","T","F","S","S"].map((d, i) => <div key={i} className="text-center text-[9px] font-bold text-text3 py-1">{d}</div>)}</div>
          <div className="grid grid-cols-7 gap-y-1">
            {days.map((day, i) => {
              if (!day) return <div key={`e${i}`} />;
              const ds = `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const t = dayTotals.get(ds) || 0;
              const isT = ds === today, isS = ds === selectedDate;
              return (
                <button key={ds} onClick={() => setSelectedDate(isS ? null : ds)}
                  className={cn("flex flex-col items-center rounded-xl py-1.5 min-h-[50px]", isS ? "bg-accent-bg ring-1 ring-accent/30" : isT ? "bg-surface2" : "hover:bg-surface2")}>
                  <span className={cn("text-xs font-medium", (isT || isS) && "text-accent font-bold")}>{day}</span>
                  {t > 0 && <span className="text-[7px] font-bold text-red tabular-nums mt-0.5">{formatMoney(t)}</span>}
                  {t > 0 && <div className="h-1 w-1 rounded-full bg-red mt-0.5" />}
                </button>
              );
            })}
          </div>
        </>
      )}

      {view === "week" && (
        <div className="space-y-2">{weekDays.map((d) => {
          const isT = d.date === today;
          return (
            <div key={d.date} className={cn("rounded-xl border p-3", isT ? "border-accent bg-accent-bg" : "border-border bg-surface")}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center text-sm font-bold", isT ? "bg-accent text-white" : "bg-surface2 text-text")}>{d.dayNum}</div>
                  <span className={cn("text-xs font-bold", isT ? "text-accent" : "text-text")}>{d.dayName}</span>
                </div>
                {d.total > 0 && <span className="text-sm font-bold text-red tabular-nums">{formatMoney(d.total)}</span>}
              </div>
              {d.expenses.length > 0 ? (
                <div className="flex flex-wrap gap-1 mt-1">{d.expenses.map((e) => (
                  <span key={e.id} className="flex items-center gap-1 rounded-full bg-surface2 px-2 py-0.5 text-[10px] font-medium text-text2">
                    {getCategoryEmoji(e.category)} {formatMoney(e.amount)}
                  </span>
                ))}</div>
              ) : <p className="text-[10px] text-text3 mt-1">No expenses</p>}
            </div>
          );
        })}</div>
      )}

      {view === "timeline" && (
        timeline.length === 0 ? <p className="text-sm text-text3 text-center py-8">No expenses this month</p> : (
          <div className="relative">
            <div className="absolute left-[18px] top-0 bottom-0 w-0.5 bg-border" />
            {timeline.map(([date, items]) => (
              <div key={date} className="relative mb-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="relative z-10 h-9 w-9 rounded-full bg-surface border-2 border-border flex items-center justify-center">
                    <span className="text-[11px] font-bold text-text">{new Date(date + "T00:00:00").getDate()}</span>
                  </div>
                  <div className="flex-1 flex items-center justify-between">
                    <p className="text-xs font-bold text-text">{friendlyDate(date)}</p>
                    <span className="text-xs font-bold text-red tabular-nums">{formatMoney(items.filter((e) => e.type === "expense").reduce((s, e) => s + e.amount, 0))}</span>
                  </div>
                </div>
                <div className="ml-[18px] pl-6 space-y-1.5">{items.map((e) => (
                  <div key={e.id} className="flex items-center gap-2 rounded-lg bg-surface border border-border p-2">
                    <span className="text-[10px] font-mono text-text3 w-10 shrink-0">{e.time}</span>
                    <div className={cn("h-2 w-2 rounded-full shrink-0", e.type === "income" ? "bg-green" : "bg-red")} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-text truncate">{e.description}</p>
                    </div>
                    <span className={cn("text-[11px] font-bold tabular-nums shrink-0", e.type === "income" ? "text-green" : "text-text")}>
                      {e.type === "income" ? "+" : ""}{formatMoney(e.amount)}
                    </span>
                  </div>
                ))}</div>
              </div>
            ))}
          </div>
        )
      )}

      {view === "month" && selectedDate && (
        <div className="mt-4 anim-up">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-text">{friendlyDate(selectedDate)}</h3>
            <span className="text-sm font-bold text-red tabular-nums">{formatMoney(selectedExpenses.filter((e) => e.type === "expense").reduce((s, e) => s + e.amount, 0))}</span>
          </div>
          {selectedExpenses.length === 0 ? <p className="text-xs text-text3 text-center py-4">No expenses</p>
            : <div className="space-y-1">{selectedExpenses.map((e) => <ExpenseRow key={e.id} expense={e} />)}</div>}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════
// ADD EXPENSE SHEET — full form with income toggle
// ════════════════════════════════════════════════════════

function AddExpenseSheet({ onClose }: { onClose: () => void }) {
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(toDateStr(new Date()));
  const [isIncome, setIsIncome] = useState(false);
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTimeout(() => amountRef.current?.focus(), 100); }, []);
  const detectedCategory = useMemo(() => guessCategory(desc), [desc]);

  // Auto-detect income from description
  useEffect(() => {
    if (desc.trim() && isIncomeKeyword(desc)) setIsIncome(true);
  }, [desc]);

  const handleSave = useCallback(async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    setSaving(true);
    const now = new Date();
    const finalDesc = desc.trim() || getCategoryName(category || detectedCategory);
    const expense: Expense = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      amount: amt, description: finalDesc, category: category || detectedCategory,
      type: isIncome ? "income" : "expense", date,
      location: location || undefined,
      time: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
      createdAt: now.toISOString(),
    };
    await db.expenses.add(expense);
    // Sync to cloud if logged in
    const u = getCurrentUser();
    if (u) syncExpenseToCloud(u.uid, expense).catch(() => {});
    setSaved(true);
    setTimeout(onClose, 600);
  }, [amount, desc, category, date, isIncome, detectedCategory, onClose]);

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-surface shadow-xl anim-up max-h-[90vh] overflow-y-auto">
        <div className="flex justify-center py-2"><div className="h-1 w-10 rounded-full bg-border" /></div>
        <div className="px-5 pb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-text">{saved ? "Saved ✓" : "Add entry"}</h2>
            <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-surface2"><X size={18} className="text-text2" /></button>
          </div>
          {saved ? (
            <div className="flex flex-col items-center py-8 anim-fade">
              <div className={cn("h-16 w-16 rounded-full flex items-center justify-center", isIncome ? "bg-green-bg" : "bg-green-bg")}>
                <Check size={28} className="text-green" />
              </div>
              <p className="text-sm text-text2 mt-3">{isIncome ? "Income" : "Expense"} added!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Expense / Income toggle */}
              <div className="flex rounded-xl border border-border overflow-hidden">
                <button onClick={() => setIsIncome(false)} className={cn("flex-1 py-2.5 text-sm font-bold flex items-center justify-center gap-1.5 transition-colors", !isIncome ? "bg-red-bg text-red" : "text-text3")}>
                  <ArrowDown size={14} /> Expense
                </button>
                <button onClick={() => setIsIncome(true)} className={cn("flex-1 py-2.5 text-sm font-bold flex items-center justify-center gap-1.5 transition-colors", isIncome ? "bg-green-bg text-green" : "text-text3")}>
                  <ArrowUp size={14} /> Income
                </button>
              </div>

              <div>
                <label className="text-[10px] font-bold text-text3 uppercase tracking-wider mb-1 block">Amount</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-text3 font-bold">₹</span>
                  <input ref={amountRef} type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0"
                    className="w-full rounded-xl border border-border bg-surface2 pl-10 pr-4 py-4 text-2xl font-extrabold text-text tabular-nums outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-text3 uppercase tracking-wider mb-1 block">What was it for?</label>
                <input type="text" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={isIncome ? "e.g. Salary, Freelance, Cashback" : "e.g. Evening snacks, Uber, Coffee"}
                  className="w-full rounded-xl border border-border bg-surface2 px-4 py-3 text-sm text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />
                {desc.trim() && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-text2 anim-fade">
                    <span className="text-sm">{getCategoryEmoji(detectedCategory)}</span>
                    <span>Auto: <span className="font-semibold text-accent">{getCategoryName(detectedCategory)}</span></span>
                  </div>
                )}
              </div>

              {!isIncome && (
                <div>
                  <label className="text-[10px] font-bold text-text3 uppercase tracking-wider mb-1.5 block">Category</label>
                  <div className="flex flex-wrap gap-1.5">
                    {CATEGORIES.map((cat) => {
                      const active = category ? category === cat : detectedCategory === cat;
                      return (
                        <button key={cat} onClick={() => setCategory(cat === category ? "" : cat)}
                          className={cn("rounded-full px-2.5 py-1.5 text-[11px] font-semibold border flex items-center gap-1 transition-all",
                            active ? "border-accent bg-accent-bg text-accent" : "border-border text-text2 hover:bg-surface2")}>
                          {getCategoryEmoji(cat)} {getCategoryName(cat)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold text-text3 uppercase tracking-wider mb-1 block">Date</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface2 px-4 py-3 text-sm text-text outline-none focus:border-accent" />
              </div>

              {/* Optional location */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold text-text3 uppercase tracking-wider">📍 Location (optional)</label>
                  <button type="button" onClick={() => {
                    if ("geolocation" in navigator) {
                      navigator.geolocation.getCurrentPosition(
                        async (pos) => {
                          try {
                            const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`);
                            const data = await r.json();
                            const place = data.address?.suburb || data.address?.neighbourhood || data.address?.city_district || data.address?.city || "";
                            if (place) setLocation(place);
                          } catch { setLocation(`${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`); }
                        },
                        () => {},
                        { enableHighAccuracy: false, timeout: 5000 }
                      );
                    }
                  }} className="text-[10px] font-semibold text-accent hover:underline">Auto-detect</button>
                </div>
                <input type="text" value={location} onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Koramangala, MG Road, College"
                  className="w-full rounded-xl border border-border bg-surface2 px-4 py-2.5 text-sm text-text outline-none focus:border-accent" />
              </div>

              <button onClick={handleSave} disabled={saving || !amount || parseFloat(amount) <= 0}
                className={cn("w-full rounded-xl py-3.5 text-sm font-bold text-white disabled:opacity-40 active:scale-[0.98] transition-all",
                  isIncome ? "bg-green hover:bg-green/90" : "bg-accent hover:bg-accent/90")}>
                {saving ? "Saving..." : isIncome ? "Add Income" : "Add Expense"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════
// SMS IMPORT SHEET
// ════════════════════════════════════════════════════════

function SMSImportSheet({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ count: number; total: number } | null>(null);
  const [error, setError] = useState("");

  const handleParse = useCallback(async () => {
    if (!text.trim()) return;
    setLoading(true); setError(""); setResult(null);
    const messages = text.split(/\n{2,}|\r\n{2,}/).map((m) => m.trim()).filter((m) => m.length > 15);
    if (messages.length === 0) messages.push(text.trim());
    let count = 0, total = 0;
    for (const msg of messages) {
      const amtMatch = msg.match(/(?:INR|Rs\.?|₹)\s*([\d,]+(?:\.\d{1,2})?)/i) || msg.match(/([\d,]+(?:\.\d{1,2})?)\s*(?:INR|Rs\.?)/i);
      if (!amtMatch) continue;
      const amount = parseFloat(amtMatch[1].replace(/,/g, ""));
      if (amount <= 0) continue;
      const isCredit = /credited|received|deposited|refund|salary/i.test(msg);
      let merchant = "Bank transaction";
      const mm = msg.match(/(?:at|to|from|for)\s+([A-Za-z][A-Za-z0-9\s&.'_-]{1,30}?)(?:\s+(?:on|via|thru|ref|UPI))/i) || msg.match(/(?:at|to)\s+([A-Za-z][A-Za-z0-9\s&.'_-]{1,25})/i);
      if (mm) merchant = mm[1].trim();
      let date = toDateStr(new Date());
      const dm = msg.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
      if (dm) { let yr = dm[3]; if (yr.length === 2) yr = `20${yr}`; date = `${yr}-${dm[2].padStart(2, "0")}-${dm[1].padStart(2, "0")}`; }
      const now = new Date();
      await db.expenses.add({
        id: `sms_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        amount, description: merchant, category: guessCategory(merchant),
        type: isCredit ? "income" : "expense", date,
        time: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
        createdAt: now.toISOString(),
      });
      count++; total += amount;
    }
    if (count === 0) setError("No transactions found. Paste actual bank SMS."); else { setResult({ count, total }); setText(""); }
    setLoading(false);
  }, [text]);

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-surface shadow-xl anim-up max-h-[85vh] overflow-y-auto">
        <div className="flex justify-center py-2"><div className="h-1 w-10 rounded-full bg-border" /></div>
        <div className="px-5 pb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-text">Import from SMS</h2>
            <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-surface2"><X size={18} className="text-text2" /></button>
          </div>
          {result && (
            <div className="mb-4 flex items-center gap-3 rounded-xl bg-green-bg p-3 anim-fade">
              <Check size={20} className="text-green" />
              <div><p className="text-sm font-bold text-green">{result.count} imported!</p><p className="text-[11px] text-text2">Total: {formatMoney(result.total)}</p></div>
            </div>
          )}
          {error && <div className="mb-4 rounded-xl bg-red-bg p-3 text-xs text-red">{error}</div>}
          <textarea value={text} onChange={(e) => { setText(e.target.value); setResult(null); setError(""); }}
            rows={6} placeholder="Paste bank SMS here..."
            className="w-full rounded-xl border border-border bg-surface2 px-3.5 py-3 text-[12px] text-text placeholder:text-text3 outline-none focus:border-accent resize-none font-mono leading-relaxed" />
          <button onClick={handleParse} disabled={!text.trim() || loading}
            className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-bold text-white disabled:opacity-40">
            {loading ? <><Loader2 size={16} className="animate-spin" /> Parsing...</> : <><MessageSquare size={16} /> Parse & Import</>}
          </button>
        </div>
      </div>
    </div>
  );
}
