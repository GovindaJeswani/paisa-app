import { db } from "../db";
import type { Transaction } from "../types";

export interface DuplicateCandidate {
  existing: Transaction;
  similarity: number; // 0–100
}

/**
 * Check if a new transaction might be a duplicate of an existing one.
 * Returns potential matches sorted by similarity (highest first).
 */
export async function findDuplicates(
  amount: number,
  date: string,
  merchant?: string,
  accountId?: string
): Promise<DuplicateCandidate[]> {
  // Look for transactions on the same date (±1 day) with the same amount
  const candidates = await db.transactions
    .where("date")
    .between(
      new Date(new Date(date).getTime() - 86400000).toISOString().slice(0, 10),
      new Date(new Date(date).getTime() + 86400000).toISOString().slice(0, 10),
      true,
      true
    )
    .filter((t) => Math.abs(t.amount - amount) < 0.01)
    .toArray();

  return candidates
    .map((existing) => {
      let similarity = 50; // same amount + same date range

      // Same exact date
      if (existing.date === date) similarity += 20;

      // Same merchant
      if (
        merchant &&
        existing.merchant &&
        existing.merchant.toLowerCase() === merchant.toLowerCase()
      ) {
        similarity += 20;
      }

      // Same account
      if (accountId && existing.accountId === accountId) {
        similarity += 10;
      }

      return { existing, similarity: Math.min(100, similarity) };
    })
    .filter((d) => d.similarity >= 60)
    .sort((a, b) => b.similarity - a.similarity);
}
