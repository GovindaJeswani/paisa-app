"use client";

import { format, eachDayOfInterval, startOfMonth, endOfMonth } from "date-fns";
import { cn, formatCurrency } from "@/lib/utils";
import { useCategoryMap } from "@/lib/hooks/use-categories";
import type { Transaction } from "@/lib/types";

interface CalendarTimelineViewProps {
  month: Date;
  transactions: Transaction[];
}

const TYPE_COLORS: Record<string, string> = {
  income: "border-income bg-income",
  expense: "border-expense bg-expense",
  saving: "border-saving bg-saving",
  investment: "border-investment bg-investment",
  transfer: "border-transfer bg-transfer",
  lend: "border-warning bg-warning",
  borrow: "border-warning bg-warning",
};

export function CalendarTimelineView({ month, transactions }: CalendarTimelineViewProps) {
  const categoryMap = useCategoryMap();
  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });

  // Group transactions by date, only dates that have transactions
  const grouped = days
    .map((day) => {
      const dateStr = format(day, "yyyy-MM-dd");
      const dayTxns = transactions
        .filter((t) => t.date === dateStr)
        .sort((a, b) => (a.time || "00:00").localeCompare(b.time || "00:00"));
      return { date: day, dateStr, transactions: dayTxns };
    })
    .filter((g) => g.transactions.length > 0)
    .reverse(); // Most recent first

  if (grouped.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center py-12">
          <span className="text-3xl">📅</span>
          <p className="text-sm text-text-tertiary mt-2">No transactions this month</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 pb-4">
      <div className="relative">
        {/* Vertical timeline line */}
        <div className="absolute left-[18px] top-0 bottom-0 w-0.5 bg-border-light" />

        {grouped.map((group) => (
          <div key={group.dateStr} className="relative mb-4">
            {/* Date marker */}
            <div className="flex items-center gap-3 mb-2">
              <div className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full bg-surface border-2 border-border shrink-0">
                <span className="text-[11px] font-bold text-text-primary">{format(group.date, "d")}</span>
              </div>
              <div>
                <p className="text-xs font-bold text-text-primary">{format(group.date, "EEEE")}</p>
                <p className="text-[10px] text-text-tertiary">{format(group.date, "d MMMM yyyy")}</p>
              </div>
            </div>

            {/* Transactions for this day */}
            <div className="ml-[18px] pl-6 border-l-0 space-y-1.5">
              {group.transactions.map((t) => {
                const cat = categoryMap.get(t.categoryId);
                const dotColor = TYPE_COLORS[t.type] || "border-border bg-text-tertiary";
                const isIncome = t.type === "income" || t.type === "repayment";

                return (
                  <div key={t.id} className="flex items-start gap-3 relative">
                    {/* Time dot on the line */}
                    <div className="absolute -left-[27px] top-2.5">
                      <div className={cn("h-2 w-2 rounded-full", dotColor.split(" ")[1])} />
                    </div>

                    {/* Time */}
                    <div className="shrink-0 w-10">
                      <span className="text-[10px] font-mono text-text-tertiary tabular-nums">
                        {t.time || "—"}
                      </span>
                    </div>

                    {/* Transaction card */}
                    <div className="flex-1 flex items-center gap-2.5 rounded-xl bg-surface border border-border-light p-2.5">
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-sm shrink-0"
                        style={{ backgroundColor: cat?.color ? `${cat.color}15` : "var(--surface-secondary)" }}
                      >
                        {cat?.icon || "📦"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-text-primary truncate">
                          {t.merchant || t.note || cat?.name || "Transaction"}
                        </p>
                        <p className="text-[10px] text-text-tertiary">{cat?.name}</p>
                      </div>
                      <span className={cn(
                        "text-[12px] font-bold tabular-nums shrink-0",
                        isIncome ? "text-income" : "text-expense"
                      )}>
                        {isIncome ? "+" : "−"}{formatCurrency(t.amount)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
