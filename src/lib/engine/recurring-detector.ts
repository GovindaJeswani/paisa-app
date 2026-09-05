/**
 * Recurring Transaction Detection Engine
 *
 * Analyzes historical transactions to find recurring patterns.
 * Only suggests — never auto-creates without user confirmation.
 */

import { differenceInDays, parseISO } from "date-fns";
import { db } from "../db";
import type { Transaction } from "../types";

export interface RecurringCandidate {
  merchant: string;
  amount: number;
  frequency: "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly";
  occurrences: number;
  avgDaysBetween: number;
  confidence: number;
  lastDate: string;
  categoryId: string;
}

export async function detectRecurringPatterns(): Promise<RecurringCandidate[]> {
  const allTxns = await db.transactions.orderBy("date").toArray();
  const existing = await db.recurringTransactions.toArray();
  const existingNames = new Set(existing.map((r) => r.name.toLowerCase()));

  // Group by merchant (only expenses)
  const merchantGroups = new Map<string, Transaction[]>();
  for (const t of allTxns) {
    if (!t.merchant || t.type !== "expense") continue;
    const key = t.merchant.toLowerCase();
    const group = merchantGroups.get(key) || [];
    group.push(t);
    merchantGroups.set(key, group);
  }

  const candidates: RecurringCandidate[] = [];

  for (const [merchant, txns] of merchantGroups) {
    if (txns.length < 3) continue; // Need at least 3 occurrences
    if (existingNames.has(merchant)) continue; // Already tracked

    // Sort by date
    const sorted = txns.sort((a, b) => a.date.localeCompare(b.date));

    // Calculate intervals between occurrences
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const days = differenceInDays(parseISO(sorted[i].date), parseISO(sorted[i - 1].date));
      if (days > 0) intervals.push(days);
    }

    if (intervals.length < 2) continue;

    // Average interval
    const avgInterval = intervals.reduce((s, d) => s + d, 0) / intervals.length;

    // Check if amounts are consistent (within 15% of average)
    const amounts = sorted.map((t) => t.amount);
    const avgAmount = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    const amountConsistency = amounts.every((a) => Math.abs(a - avgAmount) < avgAmount * 0.15);

    if (!amountConsistency) continue; // Amounts too variable

    // Check if intervals are consistent
    const intervalStdDev = Math.sqrt(
      intervals.reduce((s, d) => s + Math.pow(d - avgInterval, 2), 0) / intervals.length
    );
    const intervalConsistency = intervalStdDev / avgInterval;

    if (intervalConsistency > 0.4) continue; // Intervals too variable

    // Determine frequency
    let frequency: RecurringCandidate["frequency"];
    if (avgInterval >= 5 && avgInterval <= 9) frequency = "weekly";
    else if (avgInterval >= 12 && avgInterval <= 18) frequency = "biweekly";
    else if (avgInterval >= 25 && avgInterval <= 35) frequency = "monthly";
    else if (avgInterval >= 80 && avgInterval <= 100) frequency = "quarterly";
    else if (avgInterval >= 350 && avgInterval <= 380) frequency = "yearly";
    else continue; // Doesn't match a known frequency

    // Confidence
    let confidence = 50;
    if (amountConsistency) confidence += 20;
    if (intervalConsistency < 0.2) confidence += 15;
    if (sorted.length >= 4) confidence += 10;
    if (sorted.length >= 6) confidence += 5;

    candidates.push({
      merchant: sorted[0].merchant || merchant,
      amount: Math.round(avgAmount),
      frequency,
      occurrences: sorted.length,
      avgDaysBetween: Math.round(avgInterval),
      confidence: Math.min(95, confidence),
      lastDate: sorted[sorted.length - 1].date,
      categoryId: sorted[0].categoryId,
    });
  }

  return candidates.sort((a, b) => b.confidence - a.confidence);
}
