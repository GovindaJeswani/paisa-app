import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  format,
  eachDayOfInterval,
  parseISO,
} from "date-fns";
import { db } from "../db";
import type { Transaction, DaySummary, Budget } from "../types";

// --- Query Helpers ---

export async function getTransactionsForMonth(
  year: number,
  month: number
): Promise<Transaction[]> {
  const start = format(new Date(year, month, 1), "yyyy-MM-dd");
  const end = format(endOfMonth(new Date(year, month, 1)), "yyyy-MM-dd");
  return db.transactions
    .where("date")
    .between(start, end, true, true)
    .toArray();
}

export async function getTransactionsForDateRange(
  startDate: string,
  endDate: string
): Promise<Transaction[]> {
  return db.transactions
    .where("date")
    .between(startDate, endDate, true, true)
    .toArray();
}

export async function getTransactionsForDate(
  date: string
): Promise<Transaction[]> {
  return db.transactions.where("date").equals(date).toArray();
}

// --- Financial Calculations ---

export function sumByType(
  transactions: Transaction[],
  type: string
): number {
  return transactions
    .filter((t) => t.type === type)
    .reduce((sum, t) => sum + t.amount, 0);
}

export function sumByCategory(
  transactions: Transaction[],
  categoryId: string
): number {
  return transactions
    .filter((t) => t.categoryId === categoryId)
    .reduce((sum, t) => sum + t.amount, 0);
}

export function groupByCategory(
  transactions: Transaction[]
): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of transactions) {
    if (t.type === "expense") {
      map.set(t.categoryId, (map.get(t.categoryId) || 0) + t.amount);
    }
  }
  return map;
}

export interface MonthSummary {
  totalIncome: number;
  totalExpense: number;
  totalSaving: number;
  totalInvestment: number;
  totalTransfer: number;
  netCashFlow: number;
  transactionCount: number;
  avgDailyExpense: number;
  topCategories: { categoryId: string; amount: number }[];
}

export function calculateMonthSummary(transactions: Transaction[]): MonthSummary {
  const totalIncome = sumByType(transactions, "income");
  const totalExpense = sumByType(transactions, "expense");
  const totalSaving = sumByType(transactions, "saving");
  const totalInvestment = sumByType(transactions, "investment");
  const totalTransfer = sumByType(transactions, "transfer");

  const categoryMap = groupByCategory(transactions);
  const topCategories = Array.from(categoryMap.entries())
    .map(([categoryId, amount]) => ({ categoryId, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  const daysWithExpenses = new Set(
    transactions.filter((t) => t.type === "expense").map((t) => t.date)
  ).size;

  return {
    totalIncome,
    totalExpense,
    totalSaving,
    totalInvestment,
    totalTransfer,
    netCashFlow: totalIncome - totalExpense - totalSaving - totalInvestment,
    transactionCount: transactions.length,
    avgDailyExpense: daysWithExpenses > 0 ? totalExpense / daysWithExpenses : 0,
    topCategories,
  };
}

export function calculateDaySummary(
  date: string,
  transactions: Transaction[]
): DaySummary {
  const dayTxns = transactions.filter((t) => t.date === date);
  const categoryMap = new Map<string, number>();

  for (const t of dayTxns) {
    if (t.type === "expense") {
      categoryMap.set(t.categoryId, (categoryMap.get(t.categoryId) || 0) + t.amount);
    }
  }

  return {
    date,
    totalExpense: sumByType(dayTxns, "expense"),
    totalIncome: sumByType(dayTxns, "income"),
    totalSaving: sumByType(dayTxns, "saving"),
    totalInvestment: sumByType(dayTxns, "investment"),
    transactionCount: dayTxns.length,
    categories: Array.from(categoryMap.entries()).map(([categoryId, amount]) => ({
      categoryId,
      amount,
    })),
    hasBills: dayTxns.some((t) => t.categoryId?.includes("bill")),
    hasRecurring: dayTxns.some((t) => t.isRecurring),
  };
}

export function calculateDaySummaries(
  year: number,
  month: number,
  transactions: Transaction[]
): Map<string, DaySummary> {
  const start = new Date(year, month, 1);
  const end = endOfMonth(start);
  const days = eachDayOfInterval({ start, end });
  const map = new Map<string, DaySummary>();

  for (const day of days) {
    const dateStr = format(day, "yyyy-MM-dd");
    map.set(dateStr, calculateDaySummary(dateStr, transactions));
  }

  return map;
}

// --- Budget Calculations ---

export async function calculateBudgetProgress(
  budget: Budget,
  transactions: Transaction[]
): Promise<{ spent: number; remaining: number; percentUsed: number; daysLeft: number }> {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const relevantTxns = budget.categoryId
    ? transactions.filter(
        (t) =>
          t.type === "expense" &&
          t.categoryId === budget.categoryId &&
          t.date >= format(monthStart, "yyyy-MM-dd") &&
          t.date <= format(monthEnd, "yyyy-MM-dd")
      )
    : transactions.filter(
        (t) =>
          t.type === "expense" &&
          t.date >= format(monthStart, "yyyy-MM-dd") &&
          t.date <= format(monthEnd, "yyyy-MM-dd")
      );

  const spent = relevantTxns.reduce((sum, t) => sum + t.amount, 0);
  const remaining = Math.max(0, budget.amount - spent);
  const percentUsed = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
  const daysLeft = Math.max(
    0,
    Math.ceil((monthEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  );

  return { spent, remaining, percentUsed, daysLeft };
}

// --- Safe to spend ---

export async function calculateSafeToSpend(): Promise<number> {
  const now = new Date();
  const monthEnd = endOfMonth(now);
  const daysLeft = Math.max(
    1,
    Math.ceil((monthEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  );

  const monthTxns = await getTransactionsForMonth(
    now.getFullYear(),
    now.getMonth()
  );
  const totalIncome = sumByType(monthTxns, "income");
  const totalExpense = sumByType(monthTxns, "expense");
  const totalSaving = sumByType(monthTxns, "saving");
  const totalInvestment = sumByType(monthTxns, "investment");

  // Get upcoming recurring
  const recurring = await db.recurringTransactions
    .filter((r) => !r.isPaused)
    .toArray();

  const upcomingRecurring = recurring
    .filter((r) => r.nextDueDate >= format(now, "yyyy-MM-dd") && r.nextDueDate <= format(monthEnd, "yyyy-MM-dd"))
    .reduce((sum, r) => sum + r.amount, 0);

  const available = totalIncome - totalExpense - totalSaving - totalInvestment - upcomingRecurring;
  return Math.max(0, Math.round(available / daysLeft));
}
