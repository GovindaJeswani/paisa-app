"use client";

import { format, parseISO } from "date-fns";
import { motion } from "framer-motion";
import { X } from "lucide-react";
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

  const totalExpense = transactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);
  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.amount, 0);

  const dateObj = parseISO(date);
  const dateLabel = getRelativeDate(dateObj);
  const fullDate = format(dateObj, "EEEE, d MMMM yyyy");

  // Group expenses by category
  const categoryBreakdown = new Map<string, number>();
  for (const t of transactions) {
    if (t.type === "expense") {
      categoryBreakdown.set(
        t.categoryId,
        (categoryBreakdown.get(t.categoryId) || 0) + t.amount
      );
    }
  }

  const sortedCategories = Array.from(categoryBreakdown.entries())
    .map(([id, amount]) => ({ category: categoryMap.get(id), amount }))
    .filter((c) => c.category)
    .sort((a, b) => b.amount - a.amount);

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 20, opacity: 0 }}
      transition={{ type: "spring", damping: 30, stiffness: 350 }}
      className="border-t border-border bg-surface px-4 py-4 max-h-[45vh] overflow-y-auto"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-sm font-bold text-text-primary">{dateLabel}</p>
          <p className="text-xs text-text-tertiary">{fullDate}</p>
        </div>
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-surface-secondary"
        >
          <X size={14} className="text-text-tertiary" />
        </button>
      </div>

      {transactions.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-2xl mb-1">🌤️</p>
          <p className="text-sm text-text-tertiary">No transactions</p>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="flex items-center gap-4 mb-3">
            {totalExpense > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-expense" />
                <span className="text-xs font-semibold text-expense">
                  −{formatCurrency(totalExpense)}
                </span>
              </div>
            )}
            {totalIncome > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-income" />
                <span className="text-xs font-semibold text-income">
                  +{formatCurrency(totalIncome)}
                </span>
              </div>
            )}
            <span className="text-xs text-text-tertiary">
              {transactions.length} transaction{transactions.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Category breakdown */}
          {sortedCategories.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {sortedCategories.map(({ category, amount }) => (
                <span
                  key={category!.id}
                  className="flex items-center gap-1 rounded-full bg-surface-secondary px-2 py-1 text-[10px] font-medium text-text-secondary"
                >
                  <span>{category!.icon}</span>
                  {formatCurrency(amount)}
                </span>
              ))}
            </div>
          )}

          {/* Timeline */}
          <div className="space-y-0.5">
            {transactions
              .sort((a, b) => (a.time || "").localeCompare(b.time || ""))
              .map((t) => (
                <TransactionCard key={t.id} transaction={t} compact />
              ))}
          </div>
        </>
      )}
    </motion.div>
  );
}
