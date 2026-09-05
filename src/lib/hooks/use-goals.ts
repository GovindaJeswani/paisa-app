"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";

export function useGoals() {
  return useLiveQuery(
    () => db.goals.filter((g) => g.isActive).toArray()
  ) ?? [];
}

export function useGoal(id: string) {
  return useLiveQuery(() => db.goals.get(id), [id]);
}
