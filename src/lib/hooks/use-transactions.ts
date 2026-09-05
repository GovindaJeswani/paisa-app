"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";
import type { Transaction } from "../types";

export function useTransactions(startDate?: string, endDate?: string) {
  return useLiveQuery(async () => {
    if (startDate && endDate) {
      return db.transactions
        .where("date")
        .between(startDate, endDate, true, true)
        .reverse()
        .sortBy("date");
    }
    return db.transactions.orderBy("date").reverse().toArray();
  }, [startDate, endDate]) ?? [];
}

export function useTransactionsForDate(date: string) {
  return useLiveQuery(
    () => db.transactions.where("date").equals(date).toArray(),
    [date]
  ) ?? [];
}

export function useRecentTransactions(limit = 10) {
  return useLiveQuery(async () => {
    return db.transactions.orderBy("createdAt").reverse().limit(limit).toArray();
  }, [limit]) ?? [];
}

export function useTransactionCount() {
  return useLiveQuery(() => db.transactions.count()) ?? 0;
}
