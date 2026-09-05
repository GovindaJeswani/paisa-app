"use client";

import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { motion } from "framer-motion";
import { cn, formatCurrency } from "@/lib/utils";
import { useCategoryMap } from "@/lib/hooks/use-categories";
import type { Transaction } from "@/lib/types";

interface TransactionCardProps {
  transaction: Transaction;
  compact?: boolean;
  onClick?: () => void;
}

const TYPE_STYLES: Record<string, { color: string; prefix: string; bgClass: string }> = {
  income: { color: "text-income", prefix: "+", bgClass: "bg-income-light" },
  expense: { color: "text-expense", prefix: "−", bgClass: "bg-expense-light" },
  saving: { color: "text-saving", prefix: "", bgClass: "bg-saving-light" },
  investment: { color: "text-investment", prefix: "", bgClass: "bg-investment-light" },
  transfer: { color: "text-transfer", prefix: "", bgClass: "bg-transfer-light" },
  lend: { color: "text-warning", prefix: "−", bgClass: "bg-warning-light" },
  borrow: { color: "text-warning", prefix: "+", bgClass: "bg-warning-light" },
  repayment: { color: "text-income", prefix: "+", bgClass: "bg-income-light" },
  settlement: { color: "text-text-tertiary", prefix: "", bgClass: "bg-surface-secondary" },
};

export function TransactionCard({ transaction, compact = false, onClick }: TransactionCardProps) {
  const categoryMap = useCategoryMap();
  const router = useRouter();
  const category = categoryMap.get(transaction.categoryId);
  const style = TYPE_STYLES[transaction.type] || TYPE_STYLES.expense;

  const handleClick = () => {
    if (onClick) { onClick(); return; }
    router.push(`/transactions/${transaction.id}`);
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl px-3 text-left transition-all hover:bg-surface-hover active:scale-[0.98]",
        compact ? "py-2.5" : "py-3"
      )}
    >
      {/* Category icon */}
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg"
        style={{ backgroundColor: category?.color ? `${category.color}15` : "var(--surface-secondary)" }}
      >
        {category?.icon || "📦"}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[13px] font-semibold text-text-primary">
            {transaction.merchant || transaction.note || category?.name || "Transaction"}
          </p>
          <span className={cn("shrink-0 text-[13px] font-bold tabular-nums", style.color)}>
            {style.prefix}{formatCurrency(transaction.amount)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {category && (
            <span className="text-[11px] text-text-tertiary">{category.name}</span>
          )}
          {transaction.time && (
            <>
              <span className="text-text-tertiary text-[8px]">•</span>
              <span className="text-[11px] text-text-tertiary">{transaction.time}</span>
            </>
          )}
          {transaction.personId && (
            <>
              <span className="text-text-tertiary text-[8px]">•</span>
              <span className="text-[11px] text-text-tertiary">👤</span>
            </>
          )}
        </div>
      </div>
    </button>
  );
}

// Grouped by date
interface TransactionGroupProps {
  date: string;
  transactions: Transaction[];
  onTransactionClick?: (t: Transaction) => void;
}

export function TransactionGroup({ date, transactions, onTransactionClick }: TransactionGroupProps) {
  const totalExpense = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const totalIncome = transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const net = totalIncome - totalExpense;

  const dateLabel = (() => {
    const d = parseISO(date);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diff = (today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24);
    if (diff === 0) return "Today";
    if (diff === 1) return "Yesterday";
    return format(d, "EEE, d MMM");
  })();

  return (
    <div>
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider">{dateLabel}</span>
        <div className="flex items-center gap-2">
          {totalIncome > 0 && (
            <span className="text-[10px] font-bold text-income tabular-nums">+{formatCurrency(totalIncome, true)}</span>
          )}
          {totalExpense > 0 && (
            <span className="text-[10px] font-bold text-expense tabular-nums">−{formatCurrency(totalExpense, true)}</span>
          )}
        </div>
      </div>
      <div>
        {transactions.map((t) => (
          <TransactionCard key={t.id} transaction={t} onClick={() => onTransactionClick?.(t)} />
        ))}
      </div>
    </div>
  );
}
