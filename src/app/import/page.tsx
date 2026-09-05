"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileSpreadsheet, MessageSquare, Mail, FileJson, Check, AlertTriangle, X } from "lucide-react";
import { db } from "@/lib/db";
import { cn, formatCurrency, generateId } from "@/lib/utils";
import { createTransaction } from "@/lib/engine/transaction-service";
import { parseNaturalLanguage } from "@/lib/engine/nl-parser";
import type { Transaction, ImportSource } from "@/lib/types";

// --- SMS Simulator templates ---
const SMS_TEMPLATES = [
  "INR 420.00 debited from A/c **1234 to Swiggy on 05-09-26. Avl bal: INR 42,580.00",
  "Rs.1,200.00 spent on HDFC Credit Card ending 5678 at Amazon on 04-09-26",
  "UPI: Rs.250 paid to Uber via HDFC Bank A/c on 03-09-26. UPI Ref: 426891234",
  "Salary credited INR 85,000.00 to A/c **1234 on 01-09-26. Avl bal: INR 1,27,580",
  "INR 649.00 debited for Netflix subscription from Card ending 5678 on 02-09-26",
  "Rs.5,000 transferred to SBI A/c via NEFT on 03-09-26. Ref: HDFC0926123",
  "UPI: Rs.180 paid to Chai Point via GPay on 05-09-26. UPI Ref: 783451290",
  "INR 15,000.00 debited from A/c **1234 for Rent payment on 05-09-26",
];

// SMS parser
function parseSMS(sms: string): Partial<Transaction> | null {
  const amountMatch = sms.match(/(?:INR|Rs\.?)\s*([\d,]+(?:\.\d{2})?)/i);
  if (!amountMatch) return null;
  const amount = parseFloat(amountMatch[1].replace(/,/g, ""));

  const isCredit = /credit|salary|received|deposited/i.test(sms);
  const type = isCredit ? "income" : "expense";

  // Extract merchant
  const merchantPatterns = [/(?:to|at|for)\s+([A-Za-z\s]+?)(?:\s+(?:on|via|from))/i, /(?:to|at)\s+([A-Za-z]+)/i];
  let merchant = "";
  for (const p of merchantPatterns) {
    const m = sms.match(p);
    if (m) { merchant = m[1].trim(); break; }
  }

  // Extract date
  const dateMatch = sms.match(/(\d{2})-(\d{2})-(\d{2,4})/);
  let date = new Date().toISOString().slice(0, 10);
  if (dateMatch) {
    const y = dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3];
    date = `${y}-${dateMatch[2]}-${dateMatch[1]}`;
  }

  return { amount, type: type as Transaction["type"], merchant, date, importSource: "sms" as ImportSource, confidence: 70, confirmed: false };
}

// CSV parser
function parseCSV(text: string): Partial<Transaction>[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].toLowerCase().split(",").map((h) => h.trim().replace(/"/g, ""));
  const amountIdx = headers.findIndex((h) => h.includes("amount") || h.includes("debit") || h.includes("credit"));
  const dateIdx = headers.findIndex((h) => h.includes("date"));
  const descIdx = headers.findIndex((h) => h.includes("description") || h.includes("narration") || h.includes("particular") || h.includes("merchant"));

  if (amountIdx === -1) return [];

  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((c) => c.trim().replace(/"/g, ""));
    const amount = parseFloat(cols[amountIdx]?.replace(/,/g, "") || "0");
    if (!amount || amount <= 0) return null;
    return {
      amount: Math.abs(amount),
      type: "expense" as Transaction["type"],
      merchant: cols[descIdx] || "",
      date: cols[dateIdx] || new Date().toISOString().slice(0, 10),
      importSource: "csv" as ImportSource,
      confidence: 60,
      confirmed: false,
    };
  }).filter(Boolean) as Partial<Transaction>[];
}

export default function ImportPage() {
  const [tab, setTab] = useState<"csv" | "sms" | "email" | "json">("csv");
  const [csvText, setCsvText] = useState("");
  const [parsedItems, setParsedItems] = useState<Partial<Transaction>[]>([]);
  const [imported, setImported] = useState(0);
  const [processing, setProcessing] = useState(false);

  const handleCSVUpload = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".csv";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      setCsvText(text);
      const parsed = parseCSV(text);
      setParsedItems(parsed);
    };
    input.click();
  }, []);

  const handleJSONUpload = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setProcessing(true);
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (data.transactions) {
          await db.transactions.bulkPut(data.transactions);
          setImported(data.transactions.length);
        }
        if (data.accounts) await db.accounts.bulkPut(data.accounts);
        if (data.persons) await db.persons.bulkPut(data.persons);
        if (data.goals) await db.goals.bulkPut(data.goals);
        if (data.budgets) await db.budgets.bulkPut(data.budgets);
      } catch { alert("Invalid JSON file"); }
      finally { setProcessing(false); }
    };
    input.click();
  }, []);

  const handleSimulateSMS = useCallback(() => {
    const parsed = SMS_TEMPLATES.map(parseSMS).filter(Boolean) as Partial<Transaction>[];
    setParsedItems(parsed);
  }, []);

  const handleImportAll = useCallback(async () => {
    setProcessing(true);
    let count = 0;
    for (const item of parsedItems) {
      if (!item.amount) continue;
      const nl = await parseNaturalLanguage(item.merchant || "");
      await createTransaction({
        amount: item.amount,
        type: item.type || "expense",
        categoryId: nl.categoryId || "cat_other",
        merchant: item.merchant,
        date: item.date,
        importSource: item.importSource || "csv",
        confidence: item.confidence || 60,
        confirmed: false,
      });
      count++;
    }
    setImported(count);
    setParsedItems([]);
    setProcessing(false);
  }, [parsedItems]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-4">
      <h1 className="text-xl font-bold text-text-primary">Import Transactions</h1>

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto hide-scrollbar">
        {([
          { key: "csv", icon: FileSpreadsheet, label: "CSV File" },
          { key: "sms", icon: MessageSquare, label: "SMS (Simulated)" },
          { key: "email", icon: Mail, label: "Email (Simulated)" },
          { key: "json", icon: FileJson, label: "JSON Backup" },
        ] as const).map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => { setTab(t.key); setParsedItems([]); setImported(0); }}
              className={cn("flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap transition-all",
                tab === t.key ? "bg-accent-light text-accent" : "text-text-tertiary hover:bg-surface-secondary"
              )}>
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Success banner */}
      {imported > 0 && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 rounded-xl bg-income-light p-3">
          <Check size={16} className="text-income" />
          <span className="text-sm font-semibold text-income">Imported {imported} transactions!</span>
        </motion.div>
      )}

      {/* CSV tab */}
      {tab === "csv" && (
        <div className="space-y-3">
          <div className="card-elevated p-4 text-center">
            <Upload size={32} className="mx-auto text-text-tertiary mb-2" />
            <p className="text-sm font-semibold text-text-primary mb-1">Upload CSV bank statement</p>
            <p className="text-xs text-text-tertiary mb-3">Supports most Indian bank CSV exports</p>
            <button onClick={handleCSVUpload} className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover transition-colors">
              Choose File
            </button>
          </div>
          <div className="rounded-xl bg-surface-secondary p-3">
            <p className="text-[10px] font-semibold text-text-tertiary mb-1">Expected columns:</p>
            <p className="text-[10px] text-text-tertiary">Date, Description/Narration, Amount/Debit/Credit</p>
          </div>
        </div>
      )}

      {/* SMS tab */}
      {tab === "sms" && (
        <div className="space-y-3">
          <div className="card-elevated p-4">
            <p className="text-sm font-semibold text-text-primary mb-1">📱 Simulated Bank SMS</p>
            <p className="text-xs text-text-tertiary mb-3">In a real app, this would read your SMS. Here we simulate common Indian bank message formats.</p>
            <button onClick={handleSimulateSMS} className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover transition-colors">
              Simulate Incoming SMS
            </button>
          </div>
          <div className="space-y-1.5">
            {SMS_TEMPLATES.slice(0, 3).map((sms, i) => (
              <div key={i} className="rounded-xl bg-surface-secondary p-2.5 text-[10px] text-text-secondary font-mono">{sms}</div>
            ))}
          </div>
        </div>
      )}

      {/* Email tab */}
      {tab === "email" && (
        <div className="card-elevated p-4 text-center">
          <Mail size={32} className="mx-auto text-text-tertiary mb-2" />
          <p className="text-sm font-semibold text-text-primary mb-1">Gmail Import</p>
          <p className="text-xs text-text-tertiary mb-3">Connect Gmail to automatically detect transaction emails from banks, UPI, and shopping sites.</p>
          <div className="rounded-xl border border-border-light bg-surface-secondary p-3">
            <p className="text-[11px] text-text-tertiary">🔒 This feature requires OAuth integration and will be available in a future update. Your email data would be processed locally.</p>
          </div>
        </div>
      )}

      {/* JSON tab */}
      {tab === "json" && (
        <div className="card-elevated p-4 text-center">
          <FileJson size={32} className="mx-auto text-text-tertiary mb-2" />
          <p className="text-sm font-semibold text-text-primary mb-1">Restore from Backup</p>
          <p className="text-xs text-text-tertiary mb-3">Import a Paisa JSON backup file</p>
          <button onClick={handleJSONUpload} disabled={processing} className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50 transition-colors">
            {processing ? "Importing..." : "Choose JSON File"}
          </button>
        </div>
      )}

      {/* Parsed items preview */}
      {parsedItems.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-text-primary">{parsedItems.length} transactions detected</h3>
            <button onClick={() => setParsedItems([])} className="text-xs text-text-tertiary hover:text-text-secondary"><X size={14} /></button>
          </div>
          <div className="max-h-60 overflow-y-auto space-y-1.5">
            {parsedItems.map((item, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-border-light bg-surface p-2.5">
                <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold",
                  item.type === "income" ? "bg-income-light text-income" : "bg-expense-light text-expense"
                )}>
                  {item.type === "income" ? "+" : "−"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-text-primary truncate">{item.merchant || "Unknown"}</p>
                  <p className="text-[10px] text-text-tertiary">{item.date}</p>
                </div>
                <span className="text-xs font-bold tabular-nums text-text-primary">{formatCurrency(item.amount || 0)}</span>
                {(item.confidence || 100) < 80 && <AlertTriangle size={12} className="text-warning shrink-0" />}
              </div>
            ))}
          </div>
          <button onClick={handleImportAll} disabled={processing}
            className="w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-white disabled:opacity-50 hover:bg-accent-hover transition-colors">
            {processing ? "Importing..." : `Import All ${parsedItems.length} Transactions`}
          </button>
        </div>
      )}
    </motion.div>
  );
}
