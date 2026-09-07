"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, X, Check, Loader2, ChevronRight } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { parseBulkSMS } from "@/lib/engine/sms-parser";
import { createTransaction } from "@/lib/engine/transaction-service";
import { categorizeMerchant, categorizeByKeywords } from "@/lib/engine/categorizer";

/**
 * Quick SMS import widget — shown on the home screen.
 * Users paste bank SMS messages and they get imported instantly.
 */
export function SMSQuickImport() {
  const [isOpen, setIsOpen] = useState(false);
  const [smsText, setSmsText] = useState("");
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ count: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleImport = useCallback(async () => {
    if (!smsText.trim()) return;
    setProcessing(true);
    setError(null);
    setResult(null);

    try {
      const parsed = parseBulkSMS(smsText);
      if (parsed.length === 0) {
        setError("No bank transactions found. Make sure you're pasting actual bank SMS messages.");
        setProcessing(false);
        return;
      }

      let count = 0;
      let total = 0;
      for (const sms of parsed) {
        let categoryId = "cat_other";
        if (sms.merchant) {
          const mc = await categorizeMerchant(sms.merchant);
          if (mc) categoryId = mc.categoryId;
          else {
            const kc = await categorizeByKeywords(sms.merchant);
            if (kc) categoryId = kc.categoryId;
          }
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
        total += sms.amount;
      }

      setResult({ count, total });
      setSmsText("");
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setProcessing(false);
    }
  }, [smsText]);

  const handleClose = () => {
    setIsOpen(false);
    setResult(null);
    setError(null);
    setSmsText("");
  };

  return (
    <>
      {/* Trigger button — compact card on home */}
      <button
        onClick={() => setIsOpen(true)}
        className="w-full flex items-center gap-3 rounded-xl border border-dashed border-accent/30 bg-accent-light/50 p-3 text-left hover:bg-accent-light transition-colors"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 shrink-0">
          <MessageSquare size={16} className="text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-bold text-text-primary">Paste bank SMS to import</p>
          <p className="text-[10px] text-text-tertiary">Copy your bank messages → paste here → auto-import</p>
        </div>
        <ChevronRight size={14} className="text-accent shrink-0" />
      </button>

      {/* Bottom sheet */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={handleClose} />

            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 350 }}
              className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-surface shadow-xl max-h-[80vh] overflow-y-auto"
            >
              <div className="flex justify-center py-2"><div className="h-1 w-10 rounded-full bg-border" /></div>
              <div className="px-5 pb-8">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-text-primary">Import Bank SMS</h2>
                    <p className="text-[11px] text-text-tertiary mt-0.5">Paste one or more bank messages below</p>
                  </div>
                  <button onClick={handleClose} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface-secondary">
                    <X size={18} className="text-text-secondary" />
                  </button>
                </div>

                {/* Success */}
                {result && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="mb-4 flex items-center gap-3 rounded-xl bg-income-light p-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-income/20">
                      <Check size={20} className="text-income" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-income">
                        {result.count} transaction{result.count !== 1 ? "s" : ""} imported!
                      </p>
                      <p className="text-[11px] text-text-secondary">
                        Total: {formatCurrency(result.total)}
                      </p>
                    </div>
                  </motion.div>
                )}

                {/* Error */}
                {error && (
                  <div className="mb-4 rounded-xl bg-expense-light p-3 text-xs text-expense">
                    {error}
                  </div>
                )}

                {/* Input */}
                <textarea
                  value={smsText}
                  onChange={(e) => { setSmsText(e.target.value); setResult(null); setError(null); }}
                  placeholder={"Paste your bank SMS here. Examples:\n\nINR 420.00 debited from A/c XX1234 at Swiggy on 05-09-26.\n\nRs.1,200 spent on HDFC Credit Card ending 5678 at Amazon.\n\n(Separate multiple messages with blank lines)"}
                  rows={7}
                  className="w-full rounded-xl border border-border bg-surface-secondary px-3.5 py-3 text-[12px] text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent resize-none font-mono leading-relaxed"
                  autoFocus
                />

                <button
                  onClick={handleImport}
                  disabled={!smsText.trim() || processing}
                  className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-bold text-white disabled:opacity-40 hover:bg-accent-hover transition-colors"
                >
                  {processing ? (
                    <><Loader2 size={16} className="animate-spin" /> Parsing & Importing...</>
                  ) : (
                    <><MessageSquare size={16} /> Parse & Import</>
                  )}
                </button>

                {/* How it works */}
                <div className="mt-4 rounded-xl bg-surface-secondary p-3">
                  <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-1.5">How it works</p>
                  <div className="space-y-1.5 text-[11px] text-text-secondary">
                    <p>1. Open your SMS app on this phone</p>
                    <p>2. Long-press to select and copy bank messages</p>
                    <p>3. Paste them here (multiple messages OK)</p>
                    <p>4. We detect amount, merchant, date, bank automatically</p>
                  </div>
                  <p className="mt-2 text-[10px] text-text-tertiary">
                    Supports: HDFC, SBI, ICICI, Axis, Kotak, and 15+ other Indian banks. UPI messages too.
                  </p>
                </div>
              </div>
              <div className="h-[env(safe-area-inset-bottom)]" />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
