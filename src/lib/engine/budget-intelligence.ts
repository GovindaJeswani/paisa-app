/**
 * Budget & Goal Intelligence Engine
 *
 * Doesn't just show "80% used" — tells you what it MEANS.
 * "80% used with 9 days left — you may exceed by ₹1,200"
 */

import { format, startOfMonth, endOfMonth, differenceInDays, differenceInMonths, addMonths } from "date-fns";
import { db } from "../db";
import { formatCurrency } from "../utils";
import type { Budget, Goal, Transaction } from "../types";

// ─── Budget Intelligence ───

export interface BudgetInsight {
  budget: Budget;
  spent: number;
  remaining: number;
  percentUsed: number;
  daysElapsed: number;
  daysLeft: number;
  dailyPace: number;          // current daily spending rate
  expectedPace: number;       // what pace would use 100% evenly
  projectedTotal: number;     // where you'll end up at current pace
  projectedOverspend: number; // how much over budget (0 if under)
  status: "on_track" | "ahead" | "behind" | "over" | "danger";
  message: string;            // Human-readable intelligence
  categoryName?: string;
  categoryIcon?: string;
}

export async function analyzeBudgets(monthTxns: Transaction[]): Promise<BudgetInsight[]> {
  const budgets = await db.budgets.filter((b) => b.isActive).toArray();
  if (budgets.length === 0) return [];

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const daysInMonth = differenceInDays(monthEnd, monthStart) + 1;
  const daysElapsed = Math.max(1, differenceInDays(now, monthStart) + 1);
  const daysLeft = Math.max(1, daysInMonth - daysElapsed);

  const results: BudgetInsight[] = [];

  for (const budget of budgets) {
    const relevantTxns = budget.categoryId
      ? monthTxns.filter((t) => t.type === "expense" && t.categoryId === budget.categoryId)
      : monthTxns.filter((t) => t.type === "expense");

    const spent = relevantTxns.reduce((s, t) => s + t.amount, 0);
    const remaining = Math.max(0, budget.amount - spent);
    const percentUsed = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;

    const dailyPace = spent / daysElapsed;
    const expectedPace = budget.amount / daysInMonth;
    const projectedTotal = Math.round(dailyPace * daysInMonth);
    const projectedOverspend = Math.max(0, projectedTotal - budget.amount);

    // Status
    let status: BudgetInsight["status"];
    if (percentUsed >= 100) status = "over";
    else if (percentUsed >= 90) status = "danger";
    else if (dailyPace > expectedPace * 1.15) status = "behind"; // spending faster than expected
    else if (dailyPace < expectedPace * 0.85) status = "ahead"; // spending slower
    else status = "on_track";

    // Human message
    let message: string;
    if (status === "over") {
      message = `Over budget by ${formatCurrency(spent - budget.amount)}.`;
    } else if (status === "danger") {
      message = `${Math.round(percentUsed)}% used with ${daysLeft} days left. You may exceed by ~${formatCurrency(projectedOverspend)}.`;
    } else if (status === "behind") {
      message = `Spending faster than expected. At this pace, you'll use ~${formatCurrency(projectedTotal)} (${Math.round((projectedTotal / budget.amount) * 100)}%).`;
    } else if (status === "ahead") {
      message = `Under your usual pace — ${formatCurrency(remaining)} remaining with ${daysLeft} days left.`;
    } else {
      message = `On track. ${formatCurrency(remaining)} remaining for ${daysLeft} days (~${formatCurrency(Math.round(remaining / daysLeft))}/day).`;
    }

    // Get category info
    let categoryName: string | undefined;
    let categoryIcon: string | undefined;
    if (budget.categoryId) {
      const cat = await db.categories.get(budget.categoryId);
      if (cat) { categoryName = cat.name; categoryIcon = cat.icon; }
    }

    results.push({
      budget, spent, remaining, percentUsed, daysElapsed, daysLeft,
      dailyPace, expectedPace, projectedTotal, projectedOverspend,
      status, message, categoryName, categoryIcon,
    });
  }

  return results.sort((a, b) => b.percentUsed - a.percentUsed);
}

// ─── Goal Intelligence ───

export interface GoalInsight {
  goal: Goal;
  percentComplete: number;
  remaining: number;
  monthsElapsed: number;
  monthlyRate: number;       // average monthly contribution
  monthsNeeded: number;      // at current rate, months to complete
  projectedDate: string;     // when will this be done
  isOnTrack: boolean;        // on track for deadline?
  monthsBehind: number;      // how far behind (0 if on track)
  recommendedMonthly: number; // what monthly contribution is needed
  message: string;
}

export async function analyzeGoals(): Promise<GoalInsight[]> {
  const goals = await db.goals.filter((g) => g.isActive && !g.isCompleted).toArray();
  if (goals.length === 0) return [];

  const now = new Date();
  const results: GoalInsight[] = [];

  for (const goal of goals) {
    const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
    const percentComplete = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;

    const createdDate = new Date(goal.createdAt);
    const monthsElapsed = Math.max(1, differenceInMonths(now, createdDate) || 1);
    const monthlyRate = goal.currentAmount / monthsElapsed;

    const monthsNeeded = monthlyRate > 0 ? Math.ceil(remaining / monthlyRate) : 999;
    const projectedDate = monthsNeeded < 999
      ? format(addMonths(now, monthsNeeded), "MMM yyyy")
      : "Unknown";

    // Deadline analysis
    let isOnTrack = true;
    let monthsBehind = 0;
    let recommendedMonthly = goal.monthlyContribution || 0;

    if (goal.deadline) {
      const deadlineDate = new Date(goal.deadline);
      const monthsUntilDeadline = Math.max(1, differenceInMonths(deadlineDate, now) || 1);
      recommendedMonthly = Math.ceil(remaining / monthsUntilDeadline);

      if (monthlyRate > 0 && monthsNeeded > monthsUntilDeadline) {
        isOnTrack = false;
        monthsBehind = monthsNeeded - monthsUntilDeadline;
      }
    }

    // Message
    let message: string;
    if (percentComplete >= 100) {
      message = "Goal reached! 🎉";
    } else if (!isOnTrack && goal.deadline) {
      message = `About ${monthsBehind} month${monthsBehind !== 1 ? "s" : ""} behind. Need ~${formatCurrency(recommendedMonthly)}/month to finish on time.`;
    } else if (monthlyRate > 0) {
      message = `At ${formatCurrency(Math.round(monthlyRate))}/month, you'll reach this by ${projectedDate}.`;
    } else {
      message = `${formatCurrency(remaining)} to go. Start contributing to see projections.`;
    }

    results.push({
      goal, percentComplete, remaining, monthsElapsed, monthlyRate,
      monthsNeeded, projectedDate, isOnTrack, monthsBehind,
      recommendedMonthly, message,
    });
  }

  return results;
}
