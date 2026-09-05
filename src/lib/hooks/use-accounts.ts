"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";

export function useAccounts() {
  return useLiveQuery(
    () => db.accounts.filter((a) => a.isActive).toArray()
  ) ?? [];
}

export function useAccount(id: string) {
  return useLiveQuery(() => db.accounts.get(id), [id]);
}
