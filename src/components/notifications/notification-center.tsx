"use client";

import { useMemo, useState } from "react";
import { format, startOfMonth, endOfMonth, differenceInDays, parseISO } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X, AlertTriangle, CheckCircle2, TrendingUp, Target, Calendar } from "lucide-react";
import { cn, formatCurrency, clampPercent } from "@/lib/utils";
import { useTransactions } from "@/lib/hooks/use-transactions";
import { useBudgets } from "@/lib/hooks/use-budgets";
import { useGoals } from "@/lib/hooks/use-goals";
import { usePersons } from "@/lib/hooks/use-persons";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";

interface Notification {
  id: string;
  icon: string;
  title: string;
  body: string;
  severity: "info" | "warning" | "positive" | "negative";
}

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const now = new Date();
  const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");
  const monthTxns = useTransactions(monthStart, monthEnd);
  const budgets = useBudgets();
  const goals = useGoals();
  const persons = usePersons();
  const recurring = useLiveQuery(() => db.recurringTransactions.filter((r) => !r.isPaused).toArray()) ?? [];

  const notifications = useMemo(() => {
    const items: Notification[] = [];
    const totalExpense = monthTxns.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const totalIncome = monthTxns.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);

    // Budget alerts
    for (const b of budgets) {
      const spent = b.categoryId
        ? monthTxns.filter((t) => t.type === "expense" && t.categoryId === b.categoryId).reduce((s, t) => s + t.amount, 0)
        : totalExpense;
      const pct = b.amount > 0 ? (spent / b.amount) * 100 : 0;
      if (pct >= 90) {
        items.push({ id: `bud_${b.id}`, icon: "⚠️", title: `${b.name} budget ${pct >= 100 ? "exceeded" : "almost full"}`,
          body: `${formatCurrency(spent)} of ${formatCurrency(b.amount)} used (${Math.round(pct)}%)`, severity: pct >= 100 ? "negative" : "warning" });
      }
    }

    // Goal milestones
    for (const g of goals) {
      const pct = g.targetAmount > 0 ? (g.currentAmount / g.targetAmount) * 100 : 0;
      if (pct >= 100) {
        items.push({ id: `goal_${g.id}`, icon: "🎉", title: `${g.name} completed!`, body: `You reached your ${formatCurrency(g.targetAmount)} goal`, severity: "positive" });
      } else if (pct >= 75) {
        items.push({ id: `goal_${g.id}`, icon: "🎯", title: `${g.name} is ${Math.round(pct)}% complete`, body: `${formatCurrency(g.targetAmount - g.currentAmount)} more to go`, severity: "info" });
      }
    }

    // People reminders
    const owedTotal = persons.filter((p) => p.netBalance > 0).reduce((s, p) => s + p.netBalance, 0);
    if (owedTotal > 0) {
      items.push({ id: "people_owed", icon: "💸", title: `${formatCurrency(owedTotal)} owed to you`,
        body: `${persons.filter((p) => p.netBalance > 0).length} people owe you money`, severity: "info" });
    }

    // Upcoming recurring
    const upcoming = recurring.filter((r) => {
      const daysUntil = differenceInDays(parseISO(r.nextDueDate), now);
      return daysUntil >= 0 && daysUntil <= 3;
    });
    for (const r of upcoming.slice(0, 2)) {
      const daysUntil = differenceInDays(parseISO(r.nextDueDate), now);
      items.push({ id: `rec_${r.id}`, icon: "📅", title: `${r.name} due ${daysUntil === 0 ? "today" : daysUntil === 1 ? "tomorrow" : `in ${daysUntil} days`}`,
        body: formatCurrency(r.amount), severity: "info" });
    }

    // Savings rate
    if (totalIncome > 0) {
      const savingAndInvest = monthTxns.filter((t) => t.type === "saving" || t.type === "investment").reduce((s, t) => s + t.amount, 0);
      const rate = (savingAndInvest / totalIncome) * 100;
      if (rate >= 20) {
        items.push({ id: "savings_rate", icon: "📈", title: `Saving ${Math.round(rate)}% of income`, body: "Above the recommended 20% — great job!", severity: "positive" });
      }
    }

    return items;
  }, [monthTxns, budgets, goals, persons, recurring, now]);

  const unreadCount = notifications.length;

  return (
    <>
      {/* Bell button — shown in the home page header */}
      <button onClick={() => setIsOpen(true)} className="relative flex h-9 w-9 items-center justify-center rounded-xl hover:bg-surface-secondary transition-colors">
        <Bell size={18} className="text-text-secondary" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-expense px-1 text-[9px] font-bold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Sheet */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 350 }}
              className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-surface shadow-xl max-h-[70vh] overflow-y-auto"
            >
              <div className="flex justify-center py-2"><div className="h-1 w-10 rounded-full bg-border" /></div>
              <div className="px-5 pb-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-text-primary">Notifications</h2>
                  <button onClick={() => setIsOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface-secondary">
                    <X size={16} className="text-text-secondary" />
                  </button>
                </div>

                {notifications.length === 0 ? (
                  <div className="py-12 text-center">
                    <span className="text-3xl">🔔</span>
                    <p className="text-sm text-text-tertiary mt-2">You're all caught up</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {notifications.map((n) => (
                      <div key={n.id} className={cn(
                        "flex items-start gap-3 rounded-xl border p-3 transition-colors",
                        n.severity === "positive" && "border-income/20 bg-income-light",
                        n.severity === "negative" && "border-expense/20 bg-expense-light",
                        n.severity === "warning" && "border-warning/20 bg-warning-light",
                        n.severity === "info" && "border-border-light bg-surface"
                      )}>
                        <span className="text-lg shrink-0 mt-0.5">{n.icon}</span>
                        <div>
                          <p className="text-sm font-semibold text-text-primary">{n.title}</p>
                          <p className="text-xs text-text-secondary mt-0.5">{n.body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="h-[env(safe-area-inset-bottom)]" />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
