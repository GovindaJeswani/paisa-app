"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";

export function useCategories(type?: "expense" | "income" | "both") {
  return useLiveQuery(async () => {
    const all = await db.categories.orderBy("sortOrder").toArray();
    if (type) {
      return all.filter((c) => c.type === type || c.type === "both");
    }
    return all;
  }, [type]) ?? [];
}

export function useCategory(id: string) {
  return useLiveQuery(() => db.categories.get(id), [id]);
}

export function useCategoryMap() {
  return useLiveQuery(async () => {
    const cats = await db.categories.toArray();
    const map = new Map<string, (typeof cats)[0]>();
    for (const cat of cats) {
      map.set(cat.id, cat);
    }
    return map;
  }) ?? new Map();
}
