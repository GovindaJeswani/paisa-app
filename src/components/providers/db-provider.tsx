"use client";

import { useEffect, useState, type ReactNode } from "react";
import { initializeDB } from "@/lib/db";

export function DBProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initializeDB().then(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <p className="text-sm text-text-secondary">Loading Paisa...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
