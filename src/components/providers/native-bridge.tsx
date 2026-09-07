"use client";

import { useEffect, useState } from "react";
import { createTransaction } from "@/lib/engine/transaction-service";
import { categorizeMerchant, categorizeByKeywords } from "@/lib/engine/categorizer";

interface NativeSMSTransaction {
  amount: number;
  type: "debit" | "credit";
  bank: string;
  merchant?: string;
  date?: string;
  time?: string;
  confidence: number;
  categoryGuess?: string;
  raw: string;
}

declare global {
  interface Window {
    __paisaSMSHandler?: (transactions: NativeSMSTransaction[]) => void;
    __paisaSMSQueue?: NativeSMSTransaction[][];
    __paisaNative?: {
      requestSMSSync: () => void;
      requestSMSPermission: () => void;
      isNativeApp: boolean;
    };
  }
}

/**
 * NativeBridge — listens for SMS transactions from the Android native layer.
 * When the Android app reads bank SMS and sends them via postMessage,
 * this component receives them and creates transactions in the local DB.
 */
export function NativeBridge() {
  const [importCount, setImportCount] = useState(0);

  useEffect(() => {
    // Register the SMS handler
    window.__paisaSMSHandler = async (transactions: NativeSMSTransaction[]) => {
      let count = 0;
      for (const sms of transactions) {
        try {
          // Auto-categorize
          let categoryId = "cat_other";
          if (sms.merchant) {
            const mc = await categorizeMerchant(sms.merchant);
            if (mc) categoryId = mc.categoryId;
            else {
              const kc = await categorizeByKeywords(sms.merchant);
              if (kc) categoryId = kc.categoryId;
            }
          }
          // Use categoryGuess from native parser if we couldn't categorize
          if (categoryId === "cat_other" && sms.categoryGuess) {
            const kc = await categorizeByKeywords(sms.categoryGuess);
            if (kc) categoryId = kc.categoryId;
          }

          await createTransaction({
            amount: sms.amount,
            type: sms.type === "credit" ? "income" : "expense",
            categoryId,
            merchant: sms.merchant || sms.bank || undefined,
            date: sms.date || new Date().toISOString().slice(0, 10),
            time: sms.time,
            importSource: "sms",
            confidence: sms.confidence,
            confirmed: sms.confidence >= 80,
            rawInput: sms.raw,
          });
          count++;
        } catch (err) {
          console.error("[Paisa] Failed to import SMS transaction:", err);
        }
      }

      if (count > 0) {
        setImportCount((prev) => prev + count);
        console.log(`[Paisa] Auto-imported ${count} SMS transactions`);
      }
    };

    // Process any queued messages
    if (window.__paisaSMSQueue) {
      for (const batch of window.__paisaSMSQueue) {
        window.__paisaSMSHandler(batch);
      }
      window.__paisaSMSQueue = [];
    }

    return () => {
      delete window.__paisaSMSHandler;
    };
  }, []);

  // Show a subtle toast when transactions are auto-imported
  if (importCount > 0) {
    return (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] animate-slide-down">
        <div className="glass-card rounded-full px-4 py-2 shadow-lg flex items-center gap-2">
          <span className="text-income text-sm">✓</span>
          <span className="text-xs font-semibold text-text-primary">
            {importCount} transaction{importCount !== 1 ? "s" : ""} auto-imported from SMS
          </span>
        </div>
      </div>
    );
  }

  return null;
}

/**
 * Check if we're running inside the native Android wrapper
 */
export function isNativeApp(): boolean {
  return typeof window !== "undefined" && !!window.__paisaNative?.isNativeApp;
}

/**
 * Request SMS sync from native layer
 */
export function requestSMSSync(): void {
  window.__paisaNative?.requestSMSSync();
}
