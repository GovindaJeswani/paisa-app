"use client";

import { format, eachDayOfInterval, addDays, isToday } from "date-fns";
import { cn, formatCurrency } from "@/lib/utils";
import { useCategoryMap } from "@/lib/hooks/use-categories";
import type { Transaction } from "@/lib/types";

interface CalendarWeekViewProps {
  weekStart: Date;
  transactions: Transaction[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}

export function CalendarWeekView({ weekStart, transactions, selectedDate, onSelectDate }: CalendarWeekViewProps) {
  const categoryMap = useCategoryMap();
  const days = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });

  return (
    <div className="flex-1 overflow-y-auto px-2 pb-2">
      <div className="space-y-1.5">
        {days.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const dayTxns = transactions.filter((t) => t.date === dateStr);
          const totalExpense = dayTxns.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
          const totalIncome = dayTxns.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
          const today = isToday(day);
          const isSelected = selectedDate === dateStr;

          return (
            <button
              key={dateStr}
              onClick={() => onSelectDate(isSelected ? "" : dateStr)}
              className={cn(
                "w-full rounded-xl p-3 text-left transition-all",
                isSelected ? "bg-accent-light ring-1 ring-accent/30" :
                today ? "bg-surface-secondary" : "hover:bg-surface-secondary",
                "card-elevated"
              )}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold",
                    today ? "bg-accent text-white" : "bg-surface-secondary text-text-primary"
                  )}>
                    {format(day, "d")}
                  </div>
                  <div>
                    <p className={cn("text-xs font-bold", today ? "text-accent" : "text-text-primary")}>
                      {format(day, "EEEE")}
                    </p>
                    <p className="text-[10px] text-text-tertiary">{format(day, "d MMM")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {totalIncome > 0 && <span className="text-xs font-bold text-income tabular-nums">+{formatCurrency(totalIncome, true)}</span>}
                  {totalExpense > 0 && <span className="text-xs font-bold text-expense tabular-nums">−{formatCurrency(totalExpense, true)}</span>}
                </div>
              </div>

              {/* Transaction previews */}
              {dayTxns.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {dayTxns.slice(0, 4).map((t) => {
                    const cat = categoryMap.get(t.categoryId);
                    return (
                      <span key={t.id} className="flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-[9px] font-medium text-text-secondary">
                        <span className="text-[10px]">{cat?.icon || "📦"}</span>
                        {formatCurrency(t.amount, true)}
                      </span>
                    );
                  })}
                  {dayTxns.length > 4 && (
                    <span className="rounded-full bg-surface px-2 py-0.5 text-[9px] font-medium text-text-tertiary">
                      +{dayTxns.length - 4} more
                    </span>
                  )}
                </div>
              )}

              {dayTxns.length === 0 && (
                <p className="text-[10px] text-text-tertiary mt-0.5">No transactions</p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
