"use client";

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, FileSpreadsheet, MessageSquare, Mail, FileJson, Camera,
  Check, AlertTriangle, X, Loader2, ChevronDown,
} from "lucide-react";
import { db } from "@/lib/db";
import { cn, formatCurrency, generateId } from "@/lib/utils";
import { createTransaction } from "@/lib/engine/transaction-service";
import { categorizeByKeywords, categorizeMerchant } from "@/lib/engine/categorizer";
import { parseSMS, parseBulkSMS, type ParsedSMS } from "@/lib/engine/sms-parser";
import { parseCSV, type CSVParseResult, type ParsedCSVTransaction } from "@/lib/engine/csv-parser";
import { extractFromImage, type OCRResult } from "@/lib/engine/ocr-engine";

type Tab = "sms" | "csv" | "receipt" | "json";

interface ImportableItem {
  amount: number;
  type: "expense" | "income";
  merchant: string;
  date: string;
  time?: string;
  bank?: string;
  source: Tab;
  confidence: number;
  selected: boolean;
}

export default function ImportPage() {
  const [tab, setTab] = useState<Tab>("sms");
  const [items, setItems] = useState<ImportableItem[]>([]);
  const [imported, setImported] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // SMS state
  const [smsText, setSmsText] = useState("");

  // CSV state
  const [csvResult, setCsvResult] = useState<CSVParseResult | null>(null);

  // OCR state
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);

  // --- SMS: Parse pasted bank messages ---
  const handleParseSMS = useCallback(() => {
    setError(null);
    const results = parseBulkSMS(smsText);
    if (results.length === 0) {
      setError("Could not find any bank transactions in the text. Paste actual bank SMS messages.");
      return;
    }
    setItems(results.map((r) => ({
      amount: r.amount,
      type: r.type === "credit" ? "income" : "expense",
      merchant: r.merchant || r.bank || "Unknown",
      date: r.date || new Date().toISOString().slice(0, 10),
      time: r.time,
      bank: r.bank,
      source: "sms",
      confidence: r.confidence,
      selected: true,
    })));
  }, [smsText]);

  // --- CSV: Upload and parse ---
  const handleCSVUpload = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,.txt";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setProcessing(true);
      setError(null);
      try {
        const text = await file.text();
        const result = parseCSV(text);
        setCsvResult(result);
        if (result.errors.length > 0) setError(result.errors.join(". "));
        setItems(result.transactions.map((t) => ({
          amount: t.amount,
          type: t.type === "credit" ? "income" : "expense",
          merchant: t.description,
          date: t.date,
          bank: result.detectedBank,
          source: "csv",
          confidence: 70,
          selected: true,
        })));
      } catch { setError("Failed to read CSV file."); }
      finally { setProcessing(false); }
    };
    input.click();
  }, []);

  // --- Receipt OCR ---
  const handleReceiptUpload = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setProcessing(true);
      setError(null);
      setOcrProgress(0);
      setOcrResult(null);
      try {
        const result = await extractFromImage(file, setOcrProgress);
        setOcrResult(result);
        if (result.amount) {
          setItems([{
            amount: result.amount,
            type: "expense",
            merchant: result.merchant || "Unknown",
            date: result.date || new Date().toISOString().slice(0, 10),
            source: "receipt",
            confidence: Math.round(result.confidence),
            selected: true,
          }]);
        } else {
          setError("Could not extract an amount from the image. Try a clearer photo.");
        }
      } catch { setError("OCR failed. Try a different image."); }
      finally { setProcessing(false); }
    };
    input.click();
  }, []);

  // --- JSON restore ---
  const handleJSONUpload = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setProcessing(true);
      setError(null);
      try {
        const data = JSON.parse(await file.text());
        let count = 0;
        if (data.transactions) { await db.transactions.bulkPut(data.transactions); count += data.transactions.length; }
        if (data.accounts) await db.accounts.bulkPut(data.accounts);
        if (data.persons) await db.persons.bulkPut(data.persons);
        if (data.goals) await db.goals.bulkPut(data.goals);
        if (data.budgets) await db.budgets.bulkPut(data.budgets);
        if (data.recurringTransactions) await db.recurringTransactions.bulkPut(data.recurringTransactions);
        if (data.merchantMappings) await db.merchantMappings.bulkPut(data.merchantMappings);
        setImported(count);
      } catch { setError("Invalid JSON file. Make sure it's a Paisa backup."); }
      finally { setProcessing(false); }
    };
    input.click();
  }, []);

  // --- Import all selected items ---
  const handleImportAll = useCallback(async () => {
    const selected = items.filter((i) => i.selected);
    if (selected.length === 0) return;
    setProcessing(true);
    let count = 0;
    for (const item of selected) {
      // Auto-categorize
      let categoryId = "cat_other";
      if (item.merchant) {
        const mc = await categorizeMerchant(item.merchant);
        if (mc) categoryId = mc.categoryId;
        else {
          const kc = await categorizeByKeywords(item.merchant);
          if (kc) categoryId = kc.categoryId;
        }
      }
      await createTransaction({
        amount: item.amount, type: item.type, categoryId,
        merchant: item.merchant, date: item.date, time: item.time,
        importSource: item.source === "sms" ? "sms" : item.source === "csv" ? "csv" : item.source === "receipt" ? "receipt" : "json",
        confidence: item.confidence, confirmed: item.confidence >= 80,
      });
      count++;
    }
    setImported(count);
    setItems([]);
    setProcessing(false);
  }, [items]);

  const toggleItem = (idx: number) => {
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, selected: !it.selected } : it));
  };

  const selectedCount = items.filter((i) => i.selected).length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-4">
      <h1 className="text-xl font-bold text-text-primary">Import Transactions</h1>

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto hide-scrollbar">
        {([
          { key: "sms" as Tab, icon: MessageSquare, label: "Bank SMS" },
          { key: "csv" as Tab, icon: FileSpreadsheet, label: "CSV Statement" },
          { key: "receipt" as Tab, icon: Camera, label: "Receipt / Photo" },
          { key: "json" as Tab, icon: FileJson, label: "Backup Restore" },
        ]).map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => { setTab(t.key); setItems([]); setImported(0); setError(null); setCsvResult(null); setOcrResult(null); }}
              className={cn("flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap transition-all",
                tab === t.key ? "bg-accent-light text-accent" : "text-text-tertiary hover:bg-surface-secondary"
              )}>
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Success */}
      {imported > 0 && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 rounded-xl bg-income-light p-3">
          <Check size={16} className="text-income" />
          <span className="text-sm font-semibold text-income">Successfully imported {imported} transactions!</span>
        </motion.div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-expense-light p-3">
          <AlertTriangle size={14} className="text-expense shrink-0 mt-0.5" />
          <span className="text-xs text-expense">{error}</span>
        </div>
      )}

      {/* ── SMS Tab ── */}
      {tab === "sms" && items.length === 0 && (
        <div className="space-y-3">
          <div className="card-elevated p-4">
            <h3 className="text-sm font-bold text-text-primary mb-2">Paste your bank SMS messages</h3>
            <p className="text-xs text-text-tertiary mb-3">
              Copy-paste one or more bank transaction SMS. We detect amounts, merchants, dates, and account details from HDFC, SBI, ICICI, Axis, Kotak, and 15+ other Indian banks.
            </p>
            <textarea
              value={smsText} onChange={(e) => setSmsText(e.target.value)}
              placeholder={"Example:\nINR 420.00 debited from A/c **1234 to Swiggy on 05-09-26.\n\nRs.1,200.00 spent on HDFC Credit Card ending 5678 at Amazon.\n\n(Paste multiple messages separated by blank lines)"}
              rows={8}
              className="w-full rounded-xl border border-border bg-surface px-3.5 py-3 text-xs text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent resize-none font-mono"
            />
            <button onClick={handleParseSMS} disabled={!smsText.trim()}
              className="mt-3 w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-white disabled:opacity-40 hover:bg-accent-hover transition-colors">
              Parse Messages
            </button>
          </div>
          <div className="rounded-xl bg-surface-secondary p-3 text-[10px] text-text-tertiary">
            <p className="font-bold mb-1">Supported banks:</p>
            <p>HDFC, SBI, ICICI, Axis, Kotak, BOB, PNB, Yes Bank, IDBI, Canara, Union, IndusInd, Federal, IOB, Central, Paytm, PhonePe, GPay, CRED, Amazon Pay</p>
          </div>
        </div>
      )}

      {/* ── CSV Tab ── */}
      {tab === "csv" && items.length === 0 && (
        <div className="space-y-3">
          <button onClick={handleCSVUpload} disabled={processing}
            className="w-full card-elevated p-6 flex flex-col items-center gap-3 text-center hover:bg-surface-hover transition-colors active:scale-[0.98] disabled:opacity-50">
            {processing ? <Loader2 size={28} className="text-accent animate-spin" /> : <Upload size={28} className="text-accent" />}
            <div>
              <h3 className="text-sm font-bold text-text-primary">Upload bank statement CSV</h3>
              <p className="text-xs text-text-tertiary mt-1">Auto-detects HDFC, SBI, ICICI, Axis, Kotak formats</p>
            </div>
          </button>
          {csvResult && (
            <div className="rounded-xl bg-surface-secondary p-3 text-xs text-text-secondary">
              <p><span className="font-bold">Bank detected:</span> {csvResult.detectedBank}</p>
              <p><span className="font-bold">Date range:</span> {csvResult.dateRange.start} to {csvResult.dateRange.end}</p>
              <p><span className="font-bold">Total debits:</span> {formatCurrency(csvResult.totalDebits)} · <span className="font-bold">Credits:</span> {formatCurrency(csvResult.totalCredits)}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Receipt Tab ── */}
      {tab === "receipt" && items.length === 0 && (
        <div className="space-y-3">
          <button onClick={handleReceiptUpload} disabled={processing}
            className="w-full card-elevated p-6 flex flex-col items-center gap-3 text-center hover:bg-surface-hover transition-colors active:scale-[0.98] disabled:opacity-50">
            {processing ? (
              <div className="text-center">
                <Loader2 size={28} className="text-accent animate-spin mx-auto" />
                <p className="text-xs text-accent font-semibold mt-2">Reading image... {Math.round(ocrProgress * 100)}%</p>
              </div>
            ) : (
              <Camera size={28} className="text-accent" />
            )}
            <div>
              <h3 className="text-sm font-bold text-text-primary">Scan receipt or screenshot</h3>
              <p className="text-xs text-text-tertiary mt-1">Uses real OCR (Tesseract.js) — runs entirely on your device</p>
            </div>
          </button>
          {ocrResult && (
            <div className="card-elevated p-4 space-y-2">
              <h3 className="text-xs font-bold text-text-primary">Extracted text</h3>
              <pre className="text-[10px] text-text-tertiary bg-surface-secondary rounded-lg p-2.5 max-h-32 overflow-y-auto whitespace-pre-wrap font-mono">
                {ocrResult.rawText}
              </pre>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {ocrResult.amount && <div className="bg-surface-secondary rounded-lg p-2"><span className="text-text-tertiary">Amount:</span> <span className="font-bold">{formatCurrency(ocrResult.amount)}</span></div>}
                {ocrResult.merchant && <div className="bg-surface-secondary rounded-lg p-2"><span className="text-text-tertiary">Merchant:</span> <span className="font-bold">{ocrResult.merchant}</span></div>}
                {ocrResult.date && <div className="bg-surface-secondary rounded-lg p-2"><span className="text-text-tertiary">Date:</span> <span className="font-bold">{ocrResult.date}</span></div>}
                {ocrResult.upiId && <div className="bg-surface-secondary rounded-lg p-2"><span className="text-text-tertiary">UPI:</span> <span className="font-bold font-mono">{ocrResult.upiId}</span></div>}
              </div>
              <p className="text-[10px] text-text-tertiary">OCR confidence: {Math.round(ocrResult.confidence)}%</p>
            </div>
          )}
        </div>
      )}

      {/* ── JSON Tab ── */}
      {tab === "json" && (
        <button onClick={handleJSONUpload} disabled={processing}
          className="w-full card-elevated p-6 flex flex-col items-center gap-3 text-center hover:bg-surface-hover transition-colors disabled:opacity-50">
          {processing ? <Loader2 size={28} className="text-accent animate-spin" /> : <FileJson size={28} className="text-investment" />}
          <div>
            <h3 className="text-sm font-bold text-text-primary">Restore from Paisa backup</h3>
            <p className="text-xs text-text-tertiary mt-1">Import a previously exported JSON file</p>
          </div>
        </button>
      )}

      {/* ── Parsed items list ── */}
      {items.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-text-primary">{items.length} transactions detected</h3>
            <button onClick={() => setItems([])} className="text-xs text-text-tertiary hover:text-text-secondary"><X size={14} /></button>
          </div>

          <div className="max-h-72 overflow-y-auto space-y-1.5 rounded-xl border border-border-light p-1.5">
            {items.map((item, i) => (
              <button key={i} onClick={() => toggleItem(i)}
                className={cn("w-full flex items-center gap-3 rounded-xl p-2.5 text-left transition-all",
                  item.selected ? "bg-surface border border-accent/20" : "bg-surface-secondary opacity-50"
                )}>
                <div className={cn("flex h-5 w-5 items-center justify-center rounded-md border text-xs",
                  item.selected ? "border-accent bg-accent text-white" : "border-border"
                )}>
                  {item.selected && <Check size={12} />}
                </div>
                <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold shrink-0",
                  item.type === "income" ? "bg-income-light text-income" : "bg-expense-light text-expense"
                )}>
                  {item.type === "income" ? "+" : "−"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-text-primary truncate">{item.merchant || "Unknown"}</p>
                  <p className="text-[10px] text-text-tertiary">{item.date}{item.bank ? ` · ${item.bank}` : ""}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-bold tabular-nums text-text-primary">{formatCurrency(item.amount)}</span>
                  {item.confidence < 80 && <p className="text-[8px] text-warning font-semibold">Low conf.</p>}
                </div>
              </button>
            ))}
          </div>

          <button onClick={handleImportAll} disabled={processing || selectedCount === 0}
            className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-white disabled:opacity-40 hover:bg-accent-hover transition-colors">
            {processing ? (
              <span className="flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" /> Importing...</span>
            ) : (
              `Import ${selectedCount} Transaction${selectedCount !== 1 ? "s" : ""}`
            )}
          </button>
        </div>
      )}
    </motion.div>
  );
}
