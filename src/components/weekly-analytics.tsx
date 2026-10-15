"use client";

import { useState, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft, ChevronRight, X, TrendingUp, TrendingDown, Calendar, Lightbulb } from "lucide-react";
import { db, getCategoryEmoji, getCategoryName, normalizeCategoryForChart, type Expense } from "@/lib/db";
import { cn, formatMoney, toDateStr, friendlyDate } from "@/lib/utils";
import { calculateSummary, calculateComparison, getHighestSpendingDay, type FinancialSummary } from "@/lib/calculations";

// ════════════════════════════════════════════════════════
// WEEKLY ANALYTICS SHEET
// ════════════════════════════════════════════════════════

export function WeeklyAnalyticsSheet({ onClose }: { onClose: () => void }) {
  const [weekOffset, setWeekOffset] = useState(0);

  // Calculate week date range
  const { weekStart, weekEnd, weekDates } = useMemo(() => {
    const now = new Date();
    const baseDate = new Date(now.getTime() + weekOffset * 7 * 86400000);
    const dow = baseDate.getDay() === 0 ? 6 : baseDate.getDay() - 1;
    const monday = new Date(baseDate.getTime() - dow * 86400000);
    const sunday = new Date(monday.getTime() + 6 * 86400000);
    const dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday.getTime() + i * 86400000);
      return toDateStr(d);
    });
    return { weekStart: toDateStr(monday), weekEnd: toDateStr(sunday), weekDates: dates };
  }, [weekOffset]);

  // Previous week for comparison
  const { prevWeekDates } = useMemo(() => {
    const now = new Date();
    const baseDate = new Date(now.getTime() + (weekOffset - 1) * 7 * 86400000);
    const dow = baseDate.getDay() === 0 ? 6 : baseDate.getDay() - 1;
    const monday = new Date(baseDate.getTime() - dow * 86400000);
    const dates = Array.from({ length: 7 }, (_, i) => toDateStr(new Date(monday.getTime() + i * 86400000)));
    return { prevWeekDates: dates };
  }, [weekOffset]);

  // Fetch expenses for both weeks
  const allExpenses = useLiveQuery(() => db.expenses.toArray()) ?? [];

  const currentWeekExps = useMemo(() =>
    allExpenses.filter((e) => weekDates.includes(e.date)),
    [allExpenses, weekDates]
  );

  const prevWeekExps = useMemo(() =>
    allExpenses.filter((e) => prevWeekDates.includes(e.date)),
    [allExpenses, prevWeekDates]
  );

  const summary = useMemo(() => calculateSummary(currentWeekExps), [currentWeekExps]);
  const comparison = useMemo(() => calculateComparison(currentWeekExps, prevWeekExps), [currentWeekExps, prevWeekExps]);
  const highestDay = useMemo(() => getHighestSpendingDay(currentWeekExps), [currentWeekExps]);

  // Category breakdown
  const catBreakdown = useMemo(() => {
    const map = new Map<string, { amount: number; emoji: string; count: number }>();
    for (const e of currentWeekExps.filter((e) => e.type === "expense")) {
      const name = normalizeCategoryForChart(e.category);
      const ex = map.get(name) || { amount: 0, emoji: getCategoryEmoji(e.category), count: 0 };
      ex.amount += e.amount; ex.count++;
      map.set(name, ex);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].amount - a[1].amount);
  }, [currentWeekExps]);

  // Daily chart data
  const dailyChart = useMemo(() => {
    return weekDates.map((ds) => {
      const d = new Date(ds + "T00:00:00");
      const dayExps = currentWeekExps.filter((e) => e.date === ds && e.type === "expense");
      return {
        date: ds,
        label: d.toLocaleDateString("en-IN", { weekday: "short" }),
        dayNum: d.getDate(),
        amount: dayExps.reduce((s, e) => s + e.amount, 0),
        isToday: ds === toDateStr(new Date()),
      };
    });
  }, [weekDates, currentWeekExps]);

  const maxDaily = Math.max(...dailyChart.map((d) => d.amount), 1);
  const avgDaily = summary.totalExpenses / 7;

  // Insights
  const insights = useMemo(() => {
    const tips: string[] = [];
    if (comparison.changePercent !== null) {
      if (comparison.changePercent > 0) {
        tips.push(`You spent ${Math.abs(Math.round(comparison.changePercent))}% more than last week`);
      } else if (comparison.changePercent < 0) {
        tips.push(`You spent ${Math.abs(Math.round(comparison.changePercent))}% less than last week 🎉`);
      } else {
        tips.push("Same spending as last week");
      }
    }
    if (catBreakdown.length > 0) {
      tips.push(`${catBreakdown[0][1].emoji} ${catBreakdown[0][0]} was your highest category`);
    }
    if (highestDay) {
      tips.push(`${friendlyDate(highestDay.date)} was your most expensive day (${formatMoney(highestDay.amount)})`);
    }
    if (summary.totalInvestments > 0) {
      tips.push(`You made ${formatMoney(summary.totalInvestments)} in investment contributions`);
    }
    return tips;
  }, [comparison, catBreakdown, highestDay, summary]);

  const weekLabel = (() => {
    const s = new Date(weekStart + "T00:00:00");
    const e = new Date(weekEnd + "T00:00:00");
    return `${s.getDate()} ${s.toLocaleDateString("en-IN", { month: "short" })} — ${e.getDate()} ${e.toLocaleDateString("en-IN", { month: "short", year: "numeric" })}`;
  })();

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-surface shadow-xl anim-up max-h-[92vh] overflow-y-auto">
        <div className="flex justify-center py-2"><div className="h-1 w-10 rounded-full bg-border" /></div>
        <div className="px-5 pb-8 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-text">Weekly Analytics</h2>
            <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-surface2"><X size={18} className="text-text2" /></button>
          </div>

          {/* Week selector */}
          <div className="flex items-center justify-between">
            <button onClick={() => setWeekOffset((o) => o - 1)} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-surface2">
              <ChevronLeft size={16} className="text-text2" />
            </button>
            <div className="text-center">
              <p className="text-sm font-bold text-text">{weekLabel}</p>
              {weekOffset === 0 && <span className="text-[9px] font-bold text-accent">This Week</span>}
            </div>
            <div className="flex gap-1">
              {weekOffset !== 0 && (
                <button onClick={() => setWeekOffset(0)} className="px-2 py-1 text-[10px] font-semibold text-accent hover:bg-accent-bg rounded-lg">Today</button>
              )}
              <button onClick={() => setWeekOffset((o) => o + 1)} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-surface2">
                <ChevronRight size={16} className="text-text2" />
              </button>
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-border bg-surface p-3">
              <p className="text-[9px] font-bold text-text3 uppercase">Expenses</p>
              <p className="text-lg font-extrabold text-red tabular-nums">{formatMoney(summary.totalExpenses)}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-3">
              <p className="text-[9px] font-bold text-text3 uppercase">Income</p>
              <p className="text-lg font-extrabold text-green tabular-nums">{formatMoney(summary.totalIncome)}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-3">
              <p className="text-[9px] font-bold text-text3 uppercase">Avg / Day</p>
              <p className="text-lg font-extrabold text-text tabular-nums">{formatMoney(Math.round(avgDaily))}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-3">
              <p className="text-[9px] font-bold text-text3 uppercase">Transactions</p>
              <p className="text-lg font-extrabold text-text tabular-nums">{summary.transactionCount}</p>
            </div>
          </div>

          {/* vs Last Week */}
          {comparison.changePercent !== null && (
            <div className={cn("rounded-xl p-3 text-center", comparison.change <= 0 ? "bg-green-bg" : "bg-red-bg")}>
              <div className="flex items-center justify-center gap-1.5">
                {comparison.change <= 0 ? <TrendingDown size={16} className="text-green" /> : <TrendingUp size={16} className="text-red" />}
                <p className={cn("text-sm font-bold", comparison.change <= 0 ? "text-green" : "text-red")}>
                  {comparison.change <= 0 ? `${Math.abs(Math.round(comparison.changePercent))}% less` : `${Math.round(comparison.changePercent)}% more`} than last week
                </p>
              </div>
              <p className="text-[10px] text-text3 mt-0.5">
                Last week: {formatMoney(comparison.previousTotal)}
              </p>
            </div>
          )}

          {/* Daily chart */}
          {summary.totalExpenses > 0 && (
            <div>
              <h3 className="text-xs font-bold text-text3 uppercase tracking-wider mb-2">Daily Spending</h3>
              <div className="flex items-end gap-2 h-24">
                {dailyChart.map((d, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                    {d.amount > 0 && <span className="text-[7px] font-bold text-text3 tabular-nums">{formatMoney(d.amount)}</span>}
                    <div className={cn("w-full rounded-t-md transition-all", d.isToday ? "bg-accent" : "bg-accent/30")}
                      style={{ height: `${Math.max(3, (d.amount / maxDaily) * 64)}px` }} />
                    <span className={cn("text-[9px] font-bold", d.isToday ? "text-accent" : "text-text3")}>{d.label}</span>
                    <span className="text-[8px] text-text3">{d.dayNum}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Category breakdown */}
          {catBreakdown.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-text3 uppercase tracking-wider mb-2">By Category</h3>
              <div className="space-y-2">
                {catBreakdown.map(([name, { amount, emoji, count }]) => {
                  const pct = summary.totalExpenses > 0 ? Math.round((amount / summary.totalExpenses) * 100) : 0;
                  return (
                    <div key={name} className="flex items-center gap-3">
                      <span className="text-base w-6 text-center">{emoji}</span>
                      <div className="flex-1">
                        <div className="flex justify-between text-[11px] mb-0.5">
                          <span className="font-semibold text-text">{name} <span className="text-text3">({count})</span></span>
                          <span className="font-bold text-text tabular-nums">{formatMoney(amount)} · {pct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-surface2 overflow-hidden">
                          <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Insights */}
          {insights.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-text3 uppercase tracking-wider mb-2">
                <Lightbulb size={12} className="inline mr-1" />Insights
              </h3>
              <div className="space-y-1.5">
                {insights.map((tip, i) => (
                  <div key={i} className="rounded-xl bg-accent-bg/50 border border-accent/10 p-2.5 text-[11px] text-text2">
                    {tip}
                  </div>
                ))}
              </div>
            </div>
          )}

          {summary.transactionCount === 0 && (
            <div className="text-center py-8">
              <Calendar size={28} className="text-text3 mx-auto mb-2" />
              <p className="text-sm text-text3">No transactions this week</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
