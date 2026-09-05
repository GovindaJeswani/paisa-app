"use client";

import { format, parseISO } from "date-fns";
import { motion } from "framer-motion";
import { X, ArrowUpRight, ArrowDownLeft, PiggyBank, TrendingUp } from "lucide-react";
import { cn, formatCurrency, getRelativeDate } from "@/lib/utils";
import { useTransactionsForDate } from "@/lib/hooks/use-transactions";
import { useCategoryMap } from "@/lib/hooks/use-categories";
import { TransactionCard } from "@/components/transactions/transaction-card";

interface CalendarDayDetailProps {
  date: string;
  onClose: () => void;
}

export function CalendarDayDetail({ date, onClose }: CalendarDayDetailProps) {
  const transactions = useTransactionsForDate(date);
  const categoryMap = useCategoryMap();

  const moneyIn = transactions.filter((t) => t.type === "income" || t.type === "repayment" || t.type === "borrow");
  const moneyOut = transactions.filter((t) => t.type === "expense" || t.type === "lend");
  const saved = transactions.filter((t) => t.type === "saving");
  const invested = transactions.filter((t) => t.type === "investment");

  const totalIn = moneyIn.reduce((s, t) => s + t.amount, 0);
  const totalOut = moneyOut.reduce((s, t) => s + t.amount, 0);
  const totalSaved = saved.reduce((s, t) => s + t.amount, 0);
  const totalInvested = invested.reduce((s, t) => s + t.amount, 0);
  const net = totalIn - totalOut - totalSaved - totalInvested;

  const dateObj = parseISO(date);
  const dateLabel = getRelativeDate(dateObj);
  const fullDate = format(dateObj, "EEEE, d MMMM yyyy");

  // Category breakdown for expenses
  const catBreakdown = new Map<string, number>();
  moneyOut.forEach((t) => catBreakdown.set(t.categoryId, (catBreakdown.get(t.categoryId) || 0) + t.amount));
  const sortedCats = Array.from(catBreakdown.entries())
    .map(([id, amount]) => ({ category: categoryMap.get(id), amount }))
    .filter((c) => c.category)
    .sort((a, b) => b.amount - a.amount);

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 20, opacity: 0 }}
      transition={{ type: "spring", damping: 30, stiffness: 350 }}
      className="border-t border-border bg-surface px-4 py-4 max-h-[50vh] overflow-y-auto"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-sm font-bold text-text-primary">{dateLabel}</p>
          <p className="text-[11px] text-text-tertiary">{fullDate}</p>
        </div>
        <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-surface-secondary">
          <X size={14} className="text-text-tertiary" />
        </button>
      </div>

      {transactions.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-2xl mb-1">🌤️</p>
          <p className="text-sm text-text-tertiary">No transactions this day</p>
        </div>
      ) : (
        <>
          {/* Money flow summary — the key V2 addition */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            {totalIn > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-income-light p-2">
                <ArrowDownLeft size={14} className="text-income shrink-0" />
                <div>
                  <p className="text-[9px] font-bold text-income uppercase tracking-wider">Money in</p>
                  <p className="text-sm font-extrabold text-income tabular-nums">+{formatCurrency(totalIn)}</p>
                </div>
              </div>
            )}
            {totalOut > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-expense-light p-2">
                <ArrowUpRight size={14} className="text-expense shrink-0" />
                <div>
                  <p className="text-[9px] font-bold text-expense uppercase tracking-wider">Money out</p>
                  <p className="text-sm font-extrabold text-expense tabular-nums">−{formatCurrency(totalOut)}</p>
                </div>
              </div>
            )}
            {totalSaved > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-saving-light p-2">
                <PiggyBank size={14} className="text-saving shrink-0" />
                <div>
                  <p className="text-[9px] font-bold text-saving uppercase tracking-wider">Saved</p>
                  <p className="text-sm font-extrabold text-saving tabular-nums">{formatCurrency(totalSaved)}</p>
                </div>
              </div>
            )}
            {totalInvested > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-investment-light p-2">
                <TrendingUp size={14} className="text-investment shrink-0" />
                <div>
                  <p className="text-[9px] font-bold text-investment uppercase tracking-wider">Invested</p>
                  <p className="text-sm font-extrabold text-investment tabular-nums">{formatCurrency(totalInvested)}</p>
                </div>
              </div>
            )}
          </div>

          {/* Net */}
          {(totalIn > 0 || totalOut > 0) && (
            <div className="flex items-center justify-between rounded-lg bg-surface-secondary px-3 py-2 mb-3">
              <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Net</span>
              <span className={cn("text-sm font-extrabold tabular-nums", net >= 0 ? "text-income" : "text-expense")}>
                {net >= 0 ? "+" : "−"}{formatCurrency(Math.abs(net))}
              </span>
            </div>
          )}

          {/* Category chips */}
          {sortedCats.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {sortedCats.map(({ category, amount }) => (
                <span key={category!.id}
                  className="flex items-center gap-1 rounded-full bg-surface-secondary px-2 py-0.5 text-[10px] font-medium text-text-secondary">
                  <span>{category!.icon}</span>{formatCurrency(amount)}
                </span>
              ))}
            </div>
          )}

          {/* Transaction timeline */}
          <div className="space-y-0.5">
            {transactions
              .sort((a, b) => (a.time || "").localeCompare(b.time || ""))
              .map((t) => <TransactionCard key={t.id} transaction={t} compact />)}
          </div>
        </>
      )}
    </motion.div>
  );
}
