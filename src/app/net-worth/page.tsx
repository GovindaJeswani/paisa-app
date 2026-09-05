"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Shield, Zap, Target, AlertTriangle, CheckCircle2 } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { cn, formatCurrency, percentOf, clampPercent } from "@/lib/utils";
import { useAccounts } from "@/lib/hooks/use-accounts";
import { useGoals } from "@/lib/hooks/use-goals";
import { useBudgets } from "@/lib/hooks/use-budgets";
import { useTransactions } from "@/lib/hooks/use-transactions";
import { usePersons } from "@/lib/hooks/use-persons";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { calculateMonthSummary } from "@/lib/engine/calculator";

export default function NetWorthPage() {
  const accounts = useAccounts();
  const goals = useGoals();
  const budgets = useBudgets();
  const persons = usePersons();
  const investments = useLiveQuery(() => db.investments.filter((i) => i.isActive).toArray()) ?? [];

  const now = new Date();
  const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");
  const monthTxns = useTransactions(monthStart, monthEnd);
  const summary = useMemo(() => calculateMonthSummary(monthTxns), [monthTxns]);

  // Net Worth calculation
  const assets = useMemo(() => {
    const bankBalance = accounts.filter((a) => a.type !== "credit_card" && a.type !== "loan" && a.balance > 0).reduce((s, a) => s + a.balance, 0);
    const investmentTotal = investments.reduce((s, i) => s + (i.currentValue || i.amount), 0);
    const owedToYou = persons.filter((p) => p.netBalance > 0).reduce((s, p) => s + p.netBalance, 0);
    return { bankBalance, investmentTotal, owedToYou, total: bankBalance + investmentTotal + owedToYou };
  }, [accounts, investments, persons]);

  const liabilities = useMemo(() => {
    const creditCards = accounts.filter((a) => a.type === "credit_card" && a.balance < 0).reduce((s, a) => s + Math.abs(a.balance), 0);
    const loans = accounts.filter((a) => a.type === "loan" && a.balance < 0).reduce((s, a) => s + Math.abs(a.balance), 0);
    const youOwe = persons.filter((p) => p.netBalance < 0).reduce((s, p) => s + Math.abs(p.netBalance), 0);
    return { creditCards, loans, youOwe, total: creditCards + loans + youOwe };
  }, [accounts, persons]);

  const netWorth = assets.total - liabilities.total;

  // Financial Health Score (0–100)
  const healthScore = useMemo(() => {
    let score = 50; // base
    const savingsRate = summary.totalIncome > 0 ? (summary.totalSaving + summary.totalInvestment) / summary.totalIncome : 0;
    if (savingsRate >= 0.2) score += 15; else if (savingsRate >= 0.1) score += 8;
    // Budget adherence
    const budgetCount = budgets.length;
    if (budgetCount > 0) score += 5;
    // Emergency fund
    const emergencyGoal = goals.find((g) => g.name.toLowerCase().includes("emergency"));
    if (emergencyGoal) {
      const pct = emergencyGoal.currentAmount / emergencyGoal.targetAmount;
      if (pct >= 1) score += 15; else if (pct >= 0.5) score += 8;
    }
    // Low debt
    if (liabilities.total === 0) score += 10; else if (liabilities.total < assets.total * 0.3) score += 5;
    // Goal progress
    if (goals.length > 0) score += 5;
    return Math.min(100, Math.max(0, score));
  }, [summary, budgets, goals, liabilities, assets]);

  // Safe to spend today
  const safeToSpend = useMemo(() => {
    const daysLeft = Math.max(1, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate() + 1);
    const available = summary.totalIncome - summary.totalExpense - summary.totalSaving - summary.totalInvestment;
    return Math.max(0, Math.round(available / daysLeft));
  }, [summary, now]);

  const healthColor = healthScore >= 70 ? "text-income" : healthScore >= 40 ? "text-warning" : "text-expense";
  const healthBg = healthScore >= 70 ? "bg-income" : healthScore >= 40 ? "bg-warning" : "bg-expense";

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-4">
      <h1 className="text-xl font-bold text-text-primary">Financial Overview</h1>

      {/* Net Worth hero */}
      <div className="hero-gradient rounded-2xl p-5 relative overflow-hidden">
        <div className="absolute -top-8 -right-8 h-28 w-28 rounded-full bg-white/10 pointer-events-none" />
        <p className="text-xs text-white/70">Net Worth</p>
        <p className="text-3xl font-extrabold text-white tabular-nums mt-0.5 animate-count-up">{formatCurrency(netWorth)}</p>
        <div className="flex items-center gap-3 mt-2">
          <div className="flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5">
            <TrendingUp size={10} />
            <span className="text-[10px] font-semibold">Assets: {formatCurrency(assets.total, true)}</span>
          </div>
          <div className="flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5">
            <TrendingDown size={10} />
            <span className="text-[10px] font-semibold">Liabilities: {formatCurrency(liabilities.total, true)}</span>
          </div>
        </div>
      </div>

      {/* Safe to spend + Health score row */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="card-elevated p-3.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Shield size={13} className="text-accent" />
            <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Safe to spend</span>
          </div>
          <p className="text-2xl font-extrabold text-accent tabular-nums">{formatCurrency(safeToSpend)}</p>
          <p className="text-[10px] text-text-tertiary mt-0.5">per day this month</p>
        </div>
        <div className="card-elevated p-3.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Zap size={13} className={healthColor} />
            <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Money Health</span>
          </div>
          <div className="flex items-center gap-2">
            <p className={cn("text-2xl font-extrabold tabular-nums", healthColor)}>{healthScore}</p>
            <span className="text-sm text-text-tertiary">/100</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-surface-secondary overflow-hidden mt-1.5">
            <div className={cn("h-full rounded-full transition-all", healthBg)} style={{ width: `${healthScore}%` }} />
          </div>
        </div>
      </div>

      {/* Health breakdown */}
      <div className="card-elevated p-4">
        <h3 className="text-sm font-bold text-text-primary mb-3">Health Breakdown</h3>
        <div className="space-y-2.5">
          <HealthItem
            label="Savings rate"
            value={summary.totalIncome > 0 ? `${percentOf(summary.totalSaving + summary.totalInvestment, summary.totalIncome)}% of income` : "No income data"}
            isGood={summary.totalIncome > 0 && (summary.totalSaving + summary.totalInvestment) / summary.totalIncome >= 0.2}
          />
          <HealthItem label="Debt level" value={liabilities.total === 0 ? "No debt — great!" : formatCurrency(liabilities.total)} isGood={liabilities.total === 0} />
          <HealthItem label="Budget tracking" value={budgets.length > 0 ? `${budgets.length} budgets active` : "No budgets set"} isGood={budgets.length > 0} />
          <HealthItem label="Goal progress" value={goals.length > 0 ? `${goals.length} goals active` : "No goals set"} isGood={goals.length > 0} />
          <HealthItem label="Emergency fund" value={goals.find((g) => g.name.toLowerCase().includes("emergency")) ? "In progress" : "Not started"} isGood={!!goals.find((g) => g.name.toLowerCase().includes("emergency"))} />
        </div>
      </div>

      {/* Assets breakdown */}
      <div className="card-elevated p-4">
        <h3 className="text-sm font-bold text-text-primary mb-3 flex items-center gap-1.5"><TrendingUp size={14} className="text-income" /> Assets</h3>
        <div className="space-y-2">
          <BreakdownRow label="Bank accounts" amount={assets.bankBalance} color="text-income" />
          <BreakdownRow label="Investments" amount={assets.investmentTotal} color="text-investment" />
          <BreakdownRow label="Owed to you" amount={assets.owedToYou} color="text-accent" />
          <div className="border-t border-border-light pt-2 flex items-center justify-between">
            <span className="text-sm font-bold text-text-primary">Total Assets</span>
            <span className="text-sm font-extrabold text-income tabular-nums">{formatCurrency(assets.total)}</span>
          </div>
        </div>
      </div>

      {/* Liabilities */}
      <div className="card-elevated p-4">
        <h3 className="text-sm font-bold text-text-primary mb-3 flex items-center gap-1.5"><TrendingDown size={14} className="text-expense" /> Liabilities</h3>
        {liabilities.total === 0 ? (
          <p className="text-sm text-text-tertiary">No liabilities — you're debt free! 🎉</p>
        ) : (
          <div className="space-y-2">
            <BreakdownRow label="Credit cards" amount={liabilities.creditCards} color="text-expense" />
            <BreakdownRow label="Loans" amount={liabilities.loans} color="text-expense" />
            <BreakdownRow label="You owe people" amount={liabilities.youOwe} color="text-warning" />
            <div className="border-t border-border-light pt-2 flex items-center justify-between">
              <span className="text-sm font-bold text-text-primary">Total Liabilities</span>
              <span className="text-sm font-extrabold text-expense tabular-nums">{formatCurrency(liabilities.total)}</span>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function HealthItem({ label, value, isGood }: { label: string; value: string; isGood: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      {isGood ? <CheckCircle2 size={14} className="text-income shrink-0" /> : <AlertTriangle size={14} className="text-warning shrink-0" />}
      <div className="flex-1">
        <span className="text-xs font-semibold text-text-primary">{label}</span>
        <p className="text-[10px] text-text-tertiary">{value}</p>
      </div>
    </div>
  );
}

function BreakdownRow({ label, amount, color }: { label: string; amount: number; color: string }) {
  if (amount === 0) return null;
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-text-secondary">{label}</span>
      <span className={cn("text-xs font-bold tabular-nums", color)}>{formatCurrency(amount)}</span>
    </div>
  );
}
