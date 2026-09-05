"use client";

import { useMemo, useState, useEffect } from "react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { ArrowRight, Sparkles, TrendingUp, TrendingDown, Zap, X, Bell } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { cn, formatCurrency, getGreeting, percentOf } from "@/lib/utils";
import { useTransactions, useRecentTransactions, useTransactionCount } from "@/lib/hooks/use-transactions";
import { useGoals } from "@/lib/hooks/use-goals";
import { useBudgets } from "@/lib/hooks/use-budgets";
import { calculateMonthSummary } from "@/lib/engine/calculator";
import { useCategoryMap } from "@/lib/hooks/use-categories";
import { generateInsights, checkProgressiveSuggestions, type SmartInsight, type SmartSuggestion } from "@/lib/engine/intelligence";
import { TransactionGroup } from "@/components/transactions/transaction-card";
import { db } from "@/lib/db";
import type { Budget, Goal } from "@/lib/types";

const EASE: [number, number, number, number] = [0.4, 0, 0.2, 1];
const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE } } };

export function HomeDashboard() {
  const totalCount = useTransactionCount();
  const now = new Date();
  const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");

  const monthTxns = useTransactions(monthStart, monthEnd);
  const weekTxns = useTransactions(weekStart, weekEnd);
  const recentTxns = useRecentTransactions(8);
  const goals = useGoals();
  const budgets = useBudgets();
  const categoryMap = useCategoryMap();

  const summary = useMemo(() => calculateMonthSummary(monthTxns), [monthTxns]);
  const weekExpense = useMemo(() => weekTxns.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0), [weekTxns]);

  // Intelligence
  const [insights, setInsights] = useState<SmartInsight[]>([]);
  const [suggestions, setSuggestions] = useState<SmartSuggestion[]>([]);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (totalCount >= 3) {
      generateInsights().then(setInsights).catch(() => {});
      checkProgressiveSuggestions().then(setSuggestions).catch(() => {});
    }
  }, [totalCount, monthTxns.length]);

  const recentGrouped = useMemo(() => {
    const groups = new Map<string, typeof recentTxns>();
    for (const t of recentTxns) { const g = groups.get(t.date) || []; g.push(t); groups.set(t.date, g); }
    return Array.from(groups.entries()).slice(0, 3);
  }, [recentTxns]);

  if (totalCount === 0) return <EmptyHome />;

  const available = summary.totalIncome - summary.totalExpense - summary.totalSaving - summary.totalInvestment;
  const savingsRate = summary.totalIncome > 0 ? percentOf(summary.totalSaving + summary.totalInvestment, summary.totalIncome) : 0;

  // Pace calculation
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - dayOfMonth;
  const projectedExpense = dayOfMonth > 0 ? Math.round((summary.totalExpense / dayOfMonth) * daysInMonth) : 0;
  const safeToSpend = daysLeft > 0 ? Math.max(0, Math.round(available / daysLeft)) : 0;

  // Visible suggestions (not dismissed)
  const visibleSuggestions = suggestions.filter((s) => !dismissedSuggestions.has(s.id)).slice(0, 1);

  // Budget alerts
  const budgetAlerts = budgets.filter((b) => {
    const spent = b.categoryId
      ? monthTxns.filter((t) => t.type === "expense" && t.categoryId === b.categoryId).reduce((s, t) => s + t.amount, 0)
      : summary.totalExpense;
    return (spent / b.amount) * 100 >= 80;
  });

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4 pb-4">
      {/* Hero */}
      <motion.div variants={fadeUp} className="hero-gradient rounded-2xl px-4 py-4 sm:px-5 sm:py-5 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 h-28 w-28 rounded-full bg-white/10 pointer-events-none" />
        <div className="relative z-10">
          <p className="text-[13px] text-white/70">{getGreeting()} 👋</p>
          <h1 className="mt-1 text-3xl sm:text-4xl font-extrabold text-white tabular-nums tracking-tight leading-none">
            {formatCurrency(Math.max(0, available))}
          </h1>
          <p className="mt-0.5 text-[11px] text-white/50">available in {format(now, "MMMM")}</p>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <Pill><TrendingUp size={10} /> +{formatCurrency(summary.totalIncome, true)}</Pill>
            <Pill><TrendingDown size={10} /> −{formatCurrency(summary.totalExpense, true)}</Pill>
            {savingsRate > 0 && <Pill><Zap size={10} /> {savingsRate}% saved</Pill>}
          </div>
        </div>
      </motion.div>

      {/* Safe to spend + Forecast row */}
      <motion.div variants={fadeUp} className="grid grid-cols-3 gap-2">
        <MiniCard icon="🛡️" label="Safe/day" value={formatCurrency(safeToSpend)} color="text-accent" />
        <MiniCard icon="📅" label="This week" value={formatCurrency(weekExpense, true)} color="text-expense" />
        <MiniCard icon="🔮" label="Projected" value={formatCurrency(projectedExpense, true)} color={projectedExpense > summary.totalIncome ? "text-expense" : "text-text-primary"} />
      </motion.div>

      {/* Progressive suggestion — ONE at a time */}
      <AnimatePresence>
        {visibleSuggestions.map((s) => (
          <motion.div key={s.id} variants={fadeUp} exit={{ opacity: 0, height: 0 }}
            className="rounded-xl border border-accent/20 bg-accent-light p-3.5 flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 shrink-0">
              <Sparkles size={16} className="text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-text-primary">{s.title}</p>
              <p className="text-[11px] text-text-secondary mt-0.5">{s.body}</p>
              <div className="flex gap-2 mt-2">
                <button onClick={async () => {
                  // Handle suggestion action
                  if (s.type === "add_account" && s.data?.bank) {
                    await db.accounts.add({ id: `acc_${Date.now()}`, name: `${s.data.bank} Savings`, type: "savings", bank: s.data.bank as string, icon: "🏦", color: "#6366F1", balance: 0, isActive: true, createdAt: new Date().toISOString() });
                  } else if (s.type === "suggest_budget" && s.data?.categoryId) {
                    await db.budgets.add({ id: `bud_${Date.now()}`, name: (await db.categories.get(s.data.categoryId as string))?.name || "Budget", categoryId: s.data.categoryId as string, amount: s.data.amount as number, period: "monthly", isActive: true, createdAt: new Date().toISOString() });
                  }
                  setDismissedSuggestions((prev) => new Set([...prev, s.id]));
                }}
                  className="rounded-lg bg-accent px-3 py-1.5 text-[11px] font-bold text-white hover:bg-accent-hover transition-colors">
                  {s.action}
                </button>
                <button onClick={() => setDismissedSuggestions((prev) => new Set([...prev, s.id]))}
                  className="rounded-lg bg-surface px-3 py-1.5 text-[11px] font-semibold text-text-tertiary hover:bg-surface-secondary transition-colors">
                  Not now
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Budget alerts */}
      {budgetAlerts.length > 0 && (
        <motion.div variants={fadeUp}>
          {budgetAlerts.slice(0, 2).map((b) => {
            const cat = b.categoryId ? categoryMap.get(b.categoryId) : null;
            const spent = b.categoryId
              ? monthTxns.filter((t) => t.type === "expense" && t.categoryId === b.categoryId).reduce((s, t) => s + t.amount, 0)
              : summary.totalExpense;
            const pct = Math.round((spent / b.amount) * 100);
            const isOver = pct >= 100;
            return (
              <Link key={b.id} href="/budgets"
                className={cn("flex items-center gap-3 rounded-xl p-3 mb-1.5 border",
                  isOver ? "border-expense/20 bg-expense-light" : "border-warning/20 bg-warning-light"
                )}>
                <span className="text-base">{cat?.icon || "💰"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-bold text-text-primary">
                    {b.name}: {pct}% used{isOver ? " — over budget!" : ""}
                  </p>
                  <p className="text-[10px] text-text-secondary">
                    {formatCurrency(spent)} of {formatCurrency(b.amount)} with {daysLeft} days left
                  </p>
                </div>
              </Link>
            );
          })}
        </motion.div>
      )}

      {/* Smart insight — ONE useful observation */}
      {insights.length > 0 && (
        <motion.div variants={fadeUp}>
          {insights.slice(0, 1).map((insight) => (
            <div key={insight.id}
              className={cn("rounded-xl p-3 flex items-start gap-2.5 border",
                insight.severity === "positive" ? "border-income/15 bg-income-light" :
                insight.severity === "warning" ? "border-warning/15 bg-warning-light" :
                insight.severity === "negative" ? "border-expense/15 bg-expense-light" :
                "border-border-light bg-surface"
              )}>
              <span className="text-base mt-0.5">{insight.icon}</span>
              <p className="text-[12px] text-text-secondary leading-relaxed">{insight.text}</p>
            </div>
          ))}
        </motion.div>
      )}

      {/* Top spending */}
      {summary.topCategories.length > 0 && (
        <motion.div variants={fadeUp}>
          <SectionHeader title="Where your money went" href="/insights" />
          <div className="space-y-1.5">
            {summary.topCategories.slice(0, 4).map((item) => {
              const cat = categoryMap.get(item.categoryId);
              if (!cat) return null;
              const pct = summary.totalExpense > 0 ? (item.amount / summary.totalExpense) * 100 : 0;
              return (
                <div key={item.categoryId} className="flex items-center gap-3 rounded-xl bg-surface border border-border-light p-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg text-base shrink-0"
                    style={{ backgroundColor: `${cat.color}12` }}>{cat.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-semibold text-text-primary">{cat.name}</span>
                      <span className="text-[12px] font-bold text-text-primary tabular-nums">{formatCurrency(item.amount)}</span>
                    </div>
                    <div className="mt-1 h-1 w-full rounded-full bg-surface-secondary overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, pct)}%` }}
                        transition={{ duration: 0.5, delay: 0.1, ease: EASE }}
                        className="h-full rounded-full" style={{ backgroundColor: cat.color }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Goals */}
      {goals.length > 0 && (
        <motion.div variants={fadeUp}>
          <SectionHeader title="Goals" href="/goals" />
          <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1 -mx-1 px-1">
            {goals.slice(0, 4).map((goal) => {
              const pct = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
              const r = 24; const c = 2 * Math.PI * r;
              const offset = c - (Math.min(100, pct) / 100) * c;
              return (
                <Link key={goal.id} href="/goals" className="shrink-0 card-elevated p-3 w-[120px] flex flex-col items-center text-center">
                  <svg width="56" height="56" viewBox="0 0 56 56">
                    <circle cx="28" cy="28" r={r} stroke="var(--surface-secondary)" strokeWidth="4" fill="none" />
                    <circle cx="28" cy="28" r={r} stroke={goal.color || "var(--accent)"} strokeWidth="4" fill="none"
                      strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset} className="progress-ring-circle" />
                    <text x="28" y="30" textAnchor="middle" fill="var(--text-primary)" fontSize="11" fontWeight="700">{Math.round(pct)}%</text>
                  </svg>
                  <span className="mt-1 text-[10px] font-semibold text-text-primary leading-tight truncate w-full">{goal.icon} {goal.name}</span>
                </Link>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Recent */}
      {recentGrouped.length > 0 && (
        <motion.div variants={fadeUp}>
          <SectionHeader title="Recent" href="/transactions" />
          {recentGrouped.map(([date, txns]) => <TransactionGroup key={date} date={date} transactions={txns} />)}
        </motion.div>
      )}
    </motion.div>
  );
}

// ─── Sub-components ───

function Pill({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold">{children}</div>;
}

function MiniCard({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <div className="card-elevated p-2.5 flex flex-col">
      <div className="flex items-center gap-1 mb-1">
        <span className="text-xs">{icon}</span>
        <span className="text-[9px] font-bold text-text-tertiary uppercase tracking-wider">{label}</span>
      </div>
      <span className={cn("text-[15px] font-extrabold tabular-nums", color)}>{value}</span>
    </div>
  );
}

function SectionHeader({ title, href }: { title: string; href: string }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <h3 className="text-[13px] font-bold text-text-primary">{title}</h3>
      <Link href={href} className="text-[11px] text-accent font-semibold flex items-center gap-0.5 hover:gap-1.5 transition-all">
        See all <ArrowRight size={11} />
      </Link>
    </div>
  );
}

function EmptyHome() {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center py-14 text-center px-2">
      <div className="mb-6 animate-float">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl hero-gradient shadow-xl">
          <span className="text-5xl font-extrabold text-white">₹</span>
        </div>
      </div>
      <h1 className="text-2xl font-extrabold text-text-primary">Your money, organized</h1>
      <p className="mt-2 max-w-[280px] text-[13px] text-text-secondary leading-relaxed">
        Just tell Paisa what happened. It understands, remembers, and learns.
      </p>
      <div className="mt-8 flex flex-col items-center gap-3">
        <p className="text-sm text-text-tertiary">
          Tap <span className="font-bold text-accent">+</span> and type naturally
        </p>
        <div className="flex flex-wrap justify-center gap-1.5">
          {["Spent 300 on lunch", "Salary 85000", "Coffee 120"].map((ex) => (
            <span key={ex} className="rounded-full border border-border-light px-3 py-1.5 text-xs text-text-secondary">&ldquo;{ex}&rdquo;</span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
