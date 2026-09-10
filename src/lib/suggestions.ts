import { db } from "./db";

// Build suggestions from past expense descriptions
export async function getDescriptionSuggestions(): Promise<string[]> {
  const expenses = await db.expenses.orderBy("createdAt").reverse().limit(200).toArray();
  const counts = new Map<string, number>();
  for (const e of expenses) {
    const d = e.description.toLowerCase().trim();
    if (d.length > 1) counts.set(d, (counts.get(d) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([d]) => d.charAt(0).toUpperCase() + d.slice(1));
}

// Location suggestions from past entries
export async function getLocationSuggestions(): Promise<string[]> {
  const expenses = await db.expenses.toArray();
  const counts = new Map<string, number>();
  for (const e of expenses) {
    if (e.location && e.location.length > 1) {
      counts.set(e.location, (counts.get(e.location) || 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([l]) => l);
}

// Common locations for India
export const COMMON_LOCATIONS = [
  "Home", "Office", "College", "Hostel", "PG",
  "Canteen", "Mall", "Market", "Station", "Hospital",
];
