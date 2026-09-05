"use client";

import { useState, useMemo, useCallback } from "react";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth,
  addMonths, subMonths, startOfWeek, endOfWeek, isToday, addWeeks, subWeeks,
} from "date-fns";
import { ChevronLeft, ChevronRight, CalendarDays, List, Clock, LayoutGrid } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, formatCurrency } from "@/lib/utils";
import { useTransactions } from "@/lib/hooks/use-transactions";
import { calculateDaySummaries, calculateDaySummary } from "@/lib/engine/calculator";
import { useCategoryMap } from "@/lib/hooks/use-categories";
import { CalendarDayDetail } from "./calendar-day-detail";
import { CalendarWeekView } from "./calendar-week-view";
import { CalendarTimelineView } from "./calendar-timeline-view";

type CalendarView = "month" | "week" | "timeline";
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function MoneyCalendar() {
  const [view, setView] = useState<CalendarView>("month");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const startDate = format(monthStart, "yyyy-MM-dd");
  const endDate = format(monthEnd, "yyyy-MM-dd");

  // For week view — get a broader range
  const weekViewStart = format(startOfWeek(currentWeek, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const weekViewEnd = format(endOfWeek(currentWeek, { weekStartsOn: 1 }), "yyyy-MM-dd");

  const transactions = useTransactions(
    view === "week" ? weekViewStart : startDate,
    view === "week" ? weekViewEnd : endDate
  );
  const categoryMap = useCategoryMap();

  const daySummaries = useMemo(() => {
    return calculateDaySummaries(currentMonth.getFullYear(), currentMonth.getMonth(), transactions);
  }, [transactions, currentMonth]);

  const monthTotal = useMemo(() => {
    let expense = 0, income = 0;
    for (const [, s] of daySummaries) { expense += s.totalExpense; income += s.totalIncome; }
    return { expense, income };
  }, [daySummaries]);

  const calendarDays = useMemo(() => {
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [monthStart, monthEnd]);

  const navigateMonth = useCallback((dir: "prev" | "next") => {
    setCurrentMonth((m) => dir === "prev" ? subMonths(m, 1) : addMonths(m, 1));
    setSelectedDate(null);
  }, []);

  const navigateWeek = useCallback((dir: "prev" | "next") => {
    setCurrentWeek((w) => dir === "prev" ? subWeeks(w, 1) : addWeeks(w, 1));
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Header with view switcher */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-text-primary">
            {view === "week"
              ? `${format(startOfWeek(currentWeek, { weekStartsOn: 1 }), "d MMM")} – ${format(endOfWeek(currentWeek, { weekStartsOn: 1 }), "d MMM yyyy")}`
              : format(currentMonth, "MMMM yyyy")
            }
          </h2>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-income font-medium">+{formatCurrency(monthTotal.income)}</span>
            <span className="text-xs text-expense font-medium">−{formatCurrency(monthTotal.expense)}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => view === "week" ? navigateWeek("prev") : navigateMonth("prev")} className="flex h-8 w-8 items-center justify-center rounded-xl hover:bg-surface-secondary transition-colors" aria-label="Previous">
            <ChevronLeft size={16} className="text-text-secondary" />
          </button>
          <button onClick={() => { setCurrentMonth(new Date()); setCurrentWeek(new Date()); setSelectedDate(format(new Date(), "yyyy-MM-dd")); }} className="rounded-lg px-2 py-1 text-[11px] font-semibold text-accent hover:bg-accent-light transition-colors">
            Today
          </button>
          <button onClick={() => view === "week" ? navigateWeek("next") : navigateMonth("next")} className="flex h-8 w-8 items-center justify-center rounded-xl hover:bg-surface-secondary transition-colors" aria-label="Next">
            <ChevronRight size={16} className="text-text-secondary" />
          </button>
        </div>
      </div>

      {/* View switcher tabs */}
      <div className="px-4 pb-2 flex gap-1">
        {([
          { key: "month", icon: LayoutGrid, label: "Month" },
          { key: "week", icon: CalendarDays, label: "Week" },
          { key: "timeline", icon: Clock, label: "Timeline" },
        ] as const).map((v) => {
          const Icon = v.icon;
          return (
            <button key={v.key} onClick={() => setView(v.key)}
              className={cn("flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-all",
                view === v.key ? "bg-accent-light text-accent" : "text-text-tertiary hover:bg-surface-secondary"
              )}>
              <Icon size={13} /> {v.label}
            </button>
          );
        })}
      </div>

      {/* Views */}
      {view === "month" && (
        <>
          {/* Weekday headers */}
          <div className="grid grid-cols-7 px-2">
            {WEEKDAYS.map((day) => (
              <div key={day} className="flex items-center justify-center py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">{day}</div>
            ))}
          </div>

          {/* Month grid */}
          <div className="grid grid-cols-7 px-2 gap-y-0.5 flex-1">
            {calendarDays.map((day) => {
              const dateStr = format(day, "yyyy-MM-dd");
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isSelected = selectedDate === dateStr;
              const today = isToday(day);
              const summary = daySummaries.get(dateStr);
              const hasActivity = summary && summary.transactionCount > 0;

              return (
                <button key={dateStr} onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                  className={cn("relative flex flex-col items-center rounded-xl py-1.5 px-0.5 transition-all min-h-[56px]",
                    !isCurrentMonth && "opacity-25", isSelected ? "bg-accent-light ring-1 ring-accent/30" : "hover:bg-surface-secondary",
                    today && !isSelected && "bg-surface-secondary"
                  )}>
                  <span className={cn("text-xs font-medium leading-none", today && "text-accent font-bold", isSelected && "text-accent font-bold", !today && !isSelected && "text-text-primary")}>
                    {format(day, "d")}
                  </span>
                  {hasActivity && isCurrentMonth && (
                    <div className="mt-1 flex flex-col items-center gap-0.5">
                      {summary.totalExpense > 0 && <span className="text-[7px] font-bold text-expense tabular-nums leading-none">{formatCurrency(summary.totalExpense, true)}</span>}
                      {summary.totalIncome > 0 && <span className="text-[7px] font-bold text-income tabular-nums leading-none">+{formatCurrency(summary.totalIncome, true)}</span>}
                      <div className="flex items-center gap-0.5 mt-0.5">
                        {summary.totalExpense > 0 && <div className="h-1 w-1 rounded-full bg-[var(--cal-dot-expense)]" />}
                        {summary.totalIncome > 0 && <div className="h-1 w-1 rounded-full bg-[var(--cal-dot-income)]" />}
                        {summary.totalSaving > 0 && <div className="h-1 w-1 rounded-full bg-[var(--cal-dot-saving)]" />}
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      {view === "week" && (
        <CalendarWeekView
          weekStart={startOfWeek(currentWeek, { weekStartsOn: 1 })}
          transactions={transactions}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />
      )}

      {view === "timeline" && (
        <CalendarTimelineView
          month={currentMonth}
          transactions={transactions}
        />
      )}

      {/* Day detail */}
      <AnimatePresence>
        {selectedDate && (view === "month" || view === "week") && (
          <CalendarDayDetail date={selectedDate} onClose={() => setSelectedDate(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
