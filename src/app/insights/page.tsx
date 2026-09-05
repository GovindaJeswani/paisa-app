"use client";

import { useMemo } from "react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn, formatCurrency, percentOf } from "@/lib/utils";
import { useTransactions } from "@/lib/hooks/use-transactions";
import { useCategoryMap } from "@/lib/hooks/use-categories";
import { calculateMonthSummary } from "@/lib/engine/calculator";

export default function InsightsPage() {
  const now = new Date();
  const currentStart = format(startOfMonth(now), "yyyy-MM-dd");
  const currentEnd = format(endOfMonth(now), "yyyy-MM-dd");
  const prevMonth = subMonths(now, 1);
  const prevStart = format(startOfMonth(prevMonth), "yyyy-MM-dd");
  const prevEnd = format(endOfMonth(prevMonth), "yyyy-MM-dd");

  const currentTxns = useTransactions(currentStart, currentEnd);
  const prevTxns = useTransactions(prevStart, prevEnd);
  const categoryMap = useCategoryMap();

  const currentSummary = useMemo(
    () => calculateMonthSummary(currentTxns),
    [currentTxns]
  );
  const prevSummary = useMemo(
    () => calculateMonthSummary(prevTxns),
    [prevTxns]
  );

  const expenseChange =
    prevSummary.totalExpense > 0
      ? ((currentSummary.totalExpense - prevSummary.totalExpense) /
          prevSummary.totalExpense) *
        100
      : 0;

  const savingsRate =
    currentSummary.totalIncome > 0
      ? percentOf(
          currentSummary.totalSaving + currentSummary.totalInvestment,
          currentSummary.totalIncome
        )
      : 0;

  const hasData = currentTxns.length > 0 || prevTxns.length > 0;

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <span className="text-4xl mb-3">📊</span>
        <h2 className="text-lg font-bold text-text-primary">No insights yet</h2>
        <p className="mt-1 text-sm text-text-secondary max-w-xs">
          Add some transactions and your spending patterns, trends, and insights
          will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-4">
      <div>
        <h1 className="text-xl font-bold text-text-primary">Insights</h1>
        <p className="text-xs text-text-tertiary mt-0.5">
          {format(now, "MMMM yyyy")}
        </p>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-border-light bg-surface p-3.5">
          <p className="text-[10px] font-medium text-text-tertiary uppercase tracking-wider">
            Total Spent
          </p>
          <p className="mt-1 text-xl font-bold text-expense tabular-nums">
            {formatCurrency(currentSummary.totalExpense)}
          </p>
          <ChangeIndicator change={expenseChange} inverted />
        </div>
        <div className="rounded-xl border border-border-light bg-surface p-3.5">
          <p className="text-[10px] font-medium text-text-tertiary uppercase tracking-wider">
            Savings Rate
          </p>
          <p className="mt-1 text-xl font-bold text-saving tabular-nums">
            {savingsRate}%
          </p>
          <p className="text-[10px] text-text-tertiary mt-0.5">of income</p>
        </div>
      </div>

      {/* Monthly comparison */}
      <div className="rounded-xl border border-border-light bg-surface p-4">
        <h3 className="text-sm font-semibold text-text-primary mb-3">
          vs Last Month
        </h3>
        <div className="space-y-3">
          <ComparisonRow
            label="Income"
            current={currentSummary.totalIncome}
            previous={prevSummary.totalIncome}
            type="income"
          />
          <ComparisonRow
            label="Expenses"
            current={currentSummary.totalExpense}
            previous={prevSummary.totalExpense}
            type="expense"
            inverted
          />
          <ComparisonRow
            label="Savings"
            current={currentSummary.totalSaving}
            previous={prevSummary.totalSaving}
            type="saving"
          />
        </div>
      </div>

      {/* Smart insights */}
      <div>
        <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2.5">
          Observations
        </h3>
        <div className="space-y-2">
          {currentSummary.totalExpense > 0 && (
            <InsightCard
              emoji="📊"
              text={`Average daily spending: ${formatCurrency(currentSummary.avgDailyExpense)}`}
              severity="info"
            />
          )}
          {expenseChange > 10 && (
            <InsightCard
              emoji="📈"
              text={`Spending is ${Math.round(Math.abs(expenseChange))}% higher than last month.`}
              severity="warning"
            />
          )}
          {expenseChange < -10 && (
            <InsightCard
              emoji="📉"
              text={`Spending is ${Math.round(Math.abs(expenseChange))}% lower than last month. Great job!`}
              severity="positive"
            />
          )}
          {savingsRate >= 20 && (
            <InsightCard
              emoji="🎯"
              text={`You're saving ${savingsRate}% of your income — above the recommended 20%.`}
              severity="positive"
            />
          )}
          {currentSummary.topCategories[0] && (
            <InsightCard
              emoji={categoryMap.get(currentSummary.topCategories[0].categoryId)?.icon || "📦"}
              text={`${categoryMap.get(currentSummary.topCategories[0].categoryId)?.name || "Unknown"} is your biggest expense at ${formatCurrency(currentSummary.topCategories[0].amount)}.`}
              severity="info"
            />
          )}
          {currentSummary.transactionCount > 0 && (
            <InsightCard
              emoji="📝"
              text={`${currentSummary.transactionCount} transactions this month across ${currentSummary.topCategories.length}+ categories.`}
              severity="info"
            />
          )}
        </div>
      </div>

      {/* Category breakdown */}
      <div>
        <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2.5">
          By Category
        </h3>
        <div className="space-y-1.5">
          {currentSummary.topCategories.map((item) => {
            const cat = categoryMap.get(item.categoryId);
            if (!cat) return null;
            const pct =
              currentSummary.totalExpense > 0
                ? (item.amount / currentSummary.totalExpense) * 100
                : 0;
            return (
              <div
                key={item.categoryId}
                className="flex items-center gap-3 rounded-xl border border-border-light bg-surface p-3"
              >
                <span className="text-lg">{cat.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-text-primary">
                      {cat.name}
                    </span>
                    <span className="text-sm font-semibold text-text-primary tabular-nums">
                      {formatCurrency(item.amount)}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1 w-full rounded-full bg-surface-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, pct)}%`,
                        backgroundColor: cat.color,
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-text-tertiary mt-0.5 block">
                    {Math.round(pct)}% of total
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ChangeIndicator({
  change,
  inverted = false,
}: {
  change: number;
  inverted?: boolean;
}) {
  if (Math.abs(change) < 1) {
    return (
      <div className="flex items-center gap-1 mt-0.5">
        <Minus size={10} className="text-text-tertiary" />
        <span className="text-[10px] text-text-tertiary">No change</span>
      </div>
    );
  }

  const isUp = change > 0;
  const isGood = inverted ? !isUp : isUp;
  const Icon = isUp ? TrendingUp : TrendingDown;

  return (
    <div className="flex items-center gap-1 mt-0.5">
      <Icon
        size={10}
        className={isGood ? "text-income" : "text-expense"}
      />
      <span
        className={cn(
          "text-[10px] font-medium",
          isGood ? "text-income" : "text-expense"
        )}
      >
        {Math.round(Math.abs(change))}% vs last month
      </span>
    </div>
  );
}

function ComparisonRow({
  label,
  current,
  previous,
  type,
  inverted = false,
}: {
  label: string;
  current: number;
  previous: number;
  type: "income" | "expense" | "saving";
  inverted?: boolean;
}) {
  const change =
    previous > 0 ? ((current - previous) / previous) * 100 : 0;
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-text-secondary">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-xs text-text-tertiary tabular-nums">
          {formatCurrency(previous)}
        </span>
        <span className="text-xs text-text-tertiary">→</span>
        <span
          className={cn(
            "text-sm font-semibold tabular-nums",
            type === "income"
              ? "text-income"
              : type === "expense"
              ? "text-expense"
              : "text-saving"
          )}
        >
          {formatCurrency(current)}
        </span>
      </div>
    </div>
  );
}

function InsightCard({
  emoji,
  text,
  severity,
}: {
  emoji: string;
  text: string;
  severity: "info" | "warning" | "positive" | "negative";
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-xl border p-3",
        severity === "positive" && "border-income/20 bg-income-light",
        severity === "negative" && "border-expense/20 bg-expense-light",
        severity === "warning" && "border-warning/20 bg-warning-light",
        severity === "info" && "border-border-light bg-surface"
      )}
    >
      <span className="text-sm shrink-0">{emoji}</span>
      <p className="text-xs text-text-secondary leading-relaxed">{text}</p>
    </div>
  );
}
