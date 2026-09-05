"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";

export function usePersons() {
  return useLiveQuery(() => db.persons.toArray()) ?? [];
}

export function usePerson(id: string) {
  return useLiveQuery(() => db.persons.get(id), [id]);
}
