"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("[Paisa] SW registered:", reg.scope);
        })
        .catch((err) => {
          console.log("[Paisa] SW registration failed:", err);
        });
    }
  }, []);

  return null;
}
