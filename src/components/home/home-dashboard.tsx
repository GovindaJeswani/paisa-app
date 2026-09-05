"use client";

import { useMemo } from "react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { ArrowRight, Sparkles, TrendingUp, TrendingDown, Zap } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn, formatCurrency, getGreeting, percentOf } from "@/lib/utils";
import { useTransactions, useRecentTransactions, useTransactionCount } from "@/lib/hooks/use-transactions";
import { useGoals } from "@/lib/hooks/use-goals";
import { useBudgets } from "@/lib/hooks/use-budgets";
import { calculateMonthSummary } from "@/lib/engine/calculator";
import { useCategoryMap } from "@/lib/hooks/use-categories";
import {
  TransactionCard,
  TransactionGroup,
} from "@/components/transactions/transaction-card";

const EASE: [number, number, number, number] = [0.4, 0, 0.2, 1];

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE } },
};

export function HomeDashboard() {
  const totalCount = useTransactionCount();
  const now = new Date();
  const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");

  const monthTransactions = useTransactions(monthStart, monthEnd);
  const weekTransactions = useTransactions(weekStart, weekEnd);
  const recentTransactions = useRecentTransactions(10);
  const goals = useGoals();
  const categoryMap = useCategoryMap();

  const monthSummary = useMemo(() => calculateMonthSummary(monthTransactions), [monthTransactions]);

  const weekExpense = useMemo(
    () => weekTransactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0),
    [weekTransactions]
  );

  const recentGrouped = useMemo(() => {
    const groups = new Map<string, typeof recentTransactions>();
    for (const t of recentTransactions) {
      const existing = groups.get(t.date) || [];
      existing.push(t);
      groups.set(t.date, existing);
    }
    return Array.from(groups.entries()).slice(0, 3);
  }, [recentTransactions]);

  if (totalCount === 0) return <EmptyHomeDashboard />;

  const availableThisMonth =
    monthSummary.totalIncome - monthSummary.totalExpense - monthSummary.totalSaving - monthSummary.totalInvestment;

  const savingsRate = monthSummary.totalIncome > 0
    ? percentOf(monthSummary.totalSaving + monthSummary.totalInvestment, monthSummary.totalIncome)
    : 0;

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-5 pb-4">
      {/* ===== Hero gradient card — fully contained, no overflow ===== */}
      <motion.div
        variants={fadeUp}
        className="hero-gradient rounded-2xl px-4 py-5 sm:px-5 relative overflow-hidden"
      >
        {/* Decorative — smaller on mobile so they never push layout */}
        <div className="absolute -top-10 -right-10 h-28 w-28 rounded-full bg-white/10 pointer-events-none" />
        <div className="absolute -bottom-6 -left-6 h-16 w-16 rounded-full bg-white/5 pointer-events-none" />

        <div className="relative z-10">
          <p className="text-sm text-white/70">{getGreeting()} 👋</p>

          {/* Amount — scales down on tiny screens */}
          <h1 className="mt-1.5 text-3xl sm:text-4xl font-extrabold text-white tabular-nums tracking-tight leading-none animate-count-up break-words">
            {formatCurrency(Math.max(0, availableThisMonth))}
          </h1>
          <p className="mt-1 text-xs text-white/60">
            Available in {format(now, "MMMM")}
          </p>

          {/* Mini stats — wraps on small screens instead of overflowing */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5 sm:gap-2">
            <div className="flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5">
              <TrendingUp size={10} />
              <span className="text-[10px] sm:text-[11px] font-semibold tabular-nums">
                +{formatCurrency(monthSummary.totalIncome, true)}
              </span>
            </div>
            <div className="flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5">
              <TrendingDown size={10} />
              <span className="text-[10px] sm:text-[11px] font-semibold tabular-nums">
                −{formatCurrency(monthSummary.totalExpense, true)}
              </span>
            </div>
            {savingsRate > 0 && (
              <div className="flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5">
                <Zap size={10} />
                <span className="text-[10px] sm:text-[11px] font-semibold">{savingsRate}% saved</span>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Quick stats */}
      <motion.div variants={fadeUp} className="grid grid-cols-3 gap-2">
        <StatCard label="This week" amount={weekExpense} type="expense" icon="📅" />
        <StatCard label="Saved" amount={monthSummary.totalSaving} type="saving" icon="💰" />
        <StatCard label="Invested" amount={monthSummary.totalInvestment} type="investment" icon="📈" />
      </motion.div>

      {/* Top spending */}
      {monthSummary.topCategories.length > 0 && (
        <motion.div variants={fadeUp}>
          <SectionHeader title="Where your money went" href="/insights" />
          <div className="space-y-2 stagger-children">
            {monthSummary.topCategories.slice(0, 5).map((item) => {
              const cat = categoryMap.get(item.categoryId);
              if (!cat) return null;
              const pct = monthSummary.totalExpense > 0 ? (item.amount / monthSummary.totalExpense) * 100 : 0;
              return (
                <div key={item.categoryId} className="flex items-center gap-3 card-elevated p-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-lg shrink-0"
                    style={{ backgroundColor: `${cat.color}18` }}
                  >
                    {cat.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[13px] font-semibold text-text-primary truncate">{cat.name}</span>
                      <span className="text-[13px] font-bold text-text-primary tabular-nums shrink-0">
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full rounded-full bg-surface-secondary overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, pct)}%` }}
                        transition={{ duration: 0.6, delay: 0.2, ease: EASE }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: cat.color }}
                      />
                    </div>
                    <span className="text-[10px] text-text-tertiary mt-0.5 block">{Math.round(pct)}%</span>
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
          <div className="flex gap-2.5 overflow-x-auto hide-scrollbar pb-1 -mx-1 px-1">
            {goals.slice(0, 4).map((goal) => {
              const pct = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
              const radius = 26;
              const circumference = 2 * Math.PI * radius;
              const offset = circumference - (Math.min(100, pct) / 100) * circumference;
              return (
                <Link
                  key={goal.id}
                  href="/goals"
                  className="shrink-0 card-elevated p-3 w-[130px] flex flex-col items-center text-center"
                >
                  <svg width="62" height="62" viewBox="0 0 62 62">
                    <circle cx="31" cy="31" r={radius} stroke="var(--surface-secondary)" strokeWidth="4.5" fill="none" />
                    <circle
                      cx="31" cy="31" r={radius}
                      stroke={goal.color || "var(--accent)"}
                      strokeWidth="4.5" fill="none"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={offset}
                      className="progress-ring-circle"
                    />
                    <text x="31" y="33" textAnchor="middle" fill="var(--text-primary)" fontSize="12" fontWeight="700">
                      {Math.round(pct)}%
                    </text>
                  </svg>
                  <span className="mt-1.5 text-[11px] font-semibold text-text-primary leading-tight truncate w-full">
                    {goal.icon} {goal.name}
                  </span>
                  <span className="text-[9px] text-text-tertiary mt-0.5 tabular-nums">
                    {formatCurrency(goal.currentAmount, true)} / {formatCurrency(goal.targetAmount, true)}
                  </span>
                </Link>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Recent transactions */}
      {recentGrouped.length > 0 && (
        <motion.div variants={fadeUp}>
          <SectionHeader title="Recent" href="/transactions" />
          <div className="space-y-1">
            {recentGrouped.map(([date, txns]) => (
              <TransactionGroup key={date} date={date} transactions={txns} />
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

function StatCard({ label, amount, type, icon }: { label: string; amount: number; type: string; icon: string }) {
  return (
    <div className="card-elevated p-2.5 sm:p-3 flex flex-col">
      <div className="flex items-center gap-1 mb-1">
        <span className="text-sm">{icon}</span>
        <span className="text-[9px] sm:text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">{label}</span>
      </div>
      <span className={cn(
        "text-base sm:text-lg font-extrabold tabular-nums",
        type === "income" ? "text-income" : type === "expense" ? "text-expense" : type === "saving" ? "text-saving" : "text-investment"
      )}>
        {formatCurrency(amount, true)}
      </span>
    </div>
  );
}

function SectionHeader({ title, href }: { title: string; href: string }) {
  return (
    <div className="flex items-center justify-between mb-2.5">
      <h3 className="text-[13px] font-bold text-text-primary">{title}</h3>
      <Link href={href} className="text-xs text-accent font-semibold flex items-center gap-0.5 hover:gap-1.5 transition-all">
        See all <ArrowRight size={12} />
      </Link>
    </div>
  );
}

function EmptyHomeDashboard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-12 text-center px-2"
    >
      <div className="mb-6 animate-float">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl hero-gradient shadow-lg">
          <span className="text-5xl">₹</span>
        </div>
      </div>
      <h1 className="text-2xl font-extrabold text-text-primary">Welcome to Paisa</h1>
      <p className="mt-2 max-w-[280px] text-sm text-text-secondary leading-relaxed">
        Your money, organized automatically. Start by adding your first transaction.
      </p>
      <div className="mt-8 flex flex-col items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-text-tertiary">
          <Sparkles size={14} className="text-accent" />
          <span>Tap <span className="font-bold text-accent">+</span> to get started</span>
        </div>
        <div className="flex flex-wrap justify-center gap-1.5">
          {["Spent 300 on lunch", "Salary 85000", "Lent OP 2000"].map((ex) => (
            <span key={ex} className="rounded-full border border-border-light px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-secondary transition-colors cursor-default">
              &ldquo;{ex}&rdquo;
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
