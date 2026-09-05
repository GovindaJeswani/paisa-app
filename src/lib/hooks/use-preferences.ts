"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";
import type { UserPreferences } from "../types";

export function usePreferences(): UserPreferences | undefined {
  return useLiveQuery(() => db.userPreferences.get("default"));
}

export async function updatePreferences(
  updates: Partial<UserPreferences>
): Promise<void> {
  await db.userPreferences.update("default", {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}
