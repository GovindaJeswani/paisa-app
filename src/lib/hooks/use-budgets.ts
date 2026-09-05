"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";

export function useBudgets() {
  return useLiveQuery(
    () => db.budgets.filter((b) => b.isActive).toArray()
  ) ?? [];
}

export function useBudget(id: string) {
  return useLiveQuery(() => db.budgets.get(id), [id]);
}
