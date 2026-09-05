"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Loader2, Check, ArrowRight, FileText } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { extractFromImage, type OCRResult } from "@/lib/engine/ocr-engine";
import { createTransaction } from "@/lib/engine/transaction-service";
import { categorizeByKeywords, categorizeMerchant } from "@/lib/engine/categorizer";

export default function ReceiptsPage() {
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<OCRResult | null>(null);
  const [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  // Editable fields
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [date, setDate] = useState("");

  const handleScan = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      // Show preview
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target?.result as string);
      reader.readAsDataURL(file);

      setScanning(true);
      setProgress(0);
      setResult(null);
      setSaved(false);

      try {
        const ocrResult = await extractFromImage(file, setProgress);
        setResult(ocrResult);
        setAmount(ocrResult.amount ? String(ocrResult.amount) : "");
        setMerchant(ocrResult.merchant || "");
        setDate(ocrResult.date || new Date().toISOString().slice(0, 10));
      } catch {
        setResult(null);
      } finally {
        setScanning(false);
      }
    };
    input.click();
  }, []);

  const handleSave = useCallback(async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;

    // Auto-categorize
    let categoryId = "cat_other";
    if (merchant) {
      const mc = await categorizeMerchant(merchant);
      if (mc) categoryId = mc.categoryId;
      else {
        const kc = await categorizeByKeywords(merchant);
        if (kc) categoryId = kc.categoryId;
      }
    }

    await createTransaction({
      amount: amt,
      type: "expense",
      categoryId,
      merchant: merchant || undefined,
      date: date || undefined,
      importSource: "receipt",
      confidence: result?.confidence ? Math.round(result.confidence) : 60,
      confirmed: true,
      note: result?.transactionRef ? `Ref: ${result.transactionRef}` : undefined,
    });

    setSaved(true);
  }, [amount, merchant, date, result]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-4">
      <h1 className="text-xl font-bold text-text-primary">Scan Receipt</h1>
      <p className="text-xs text-text-tertiary -mt-3">Powered by Tesseract.js — OCR runs on your device, nothing uploaded</p>

      {/* Scan button / progress */}
      {!result && !scanning && (
        <button onClick={handleScan}
          className="w-full card-elevated p-8 flex flex-col items-center gap-4 text-center hover:bg-surface-hover transition-colors active:scale-[0.98]">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl hero-gradient shadow-lg">
            <Camera size={36} className="text-white" />
          </div>
          <div>
            <h3 className="text-base font-bold text-text-primary">Take a photo or pick from gallery</h3>
            <p className="text-xs text-text-tertiary mt-1">Works with receipts, UPI screenshots, bank statements</p>
          </div>
        </button>
      )}

      {/* Scanning progress */}
      {scanning && (
        <div className="card-elevated p-6 text-center">
          {preview && (
            <div className="rounded-xl overflow-hidden mb-4 border border-border-light max-h-40 mx-auto">
              <img src={preview} alt="Scanning" className="w-full max-h-40 object-contain bg-surface-secondary" />
            </div>
          )}
          <Loader2 size={32} className="text-accent animate-spin mx-auto" />
          <p className="text-sm font-semibold text-text-primary mt-3">Reading image...</p>
          <div className="w-full h-2 rounded-full bg-surface-secondary mt-3 overflow-hidden">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <p className="text-[10px] text-text-tertiary mt-1">{Math.round(progress * 100)}%</p>
        </div>
      )}

      {/* Result + editable form */}
      {result && !saved && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Preview image */}
          {preview && (
            <div className="rounded-xl overflow-hidden border border-border-light max-h-48">
              <img src={preview} alt="Receipt" className="w-full max-h-48 object-contain bg-surface-secondary" />
            </div>
          )}

          {/* Extracted data — editable */}
          <div className="card-elevated p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-text-primary">Extracted Data</h3>
              <span className="text-[10px] font-semibold text-text-tertiary bg-surface-secondary rounded-full px-2 py-0.5">
                {Math.round(result.confidence)}% confidence
              </span>
            </div>

            <div>
              <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-1 block">Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-tertiary font-bold">₹</span>
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface pl-7 pr-3 py-2.5 text-lg font-extrabold text-text-primary outline-none focus:border-accent tabular-nums" />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-1 block">Merchant</label>
              <input type="text" value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="Who was this?"
                className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent" />
            </div>

            <div>
              <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-1 block">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent text-text-primary" />
            </div>

            {/* Line items if found */}
            {result.items.length > 0 && (
              <div>
                <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-1 block">Items detected</label>
                <div className="space-y-1">
                  {result.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-xs bg-surface-secondary rounded-lg px-2.5 py-1.5">
                      <span className="text-text-secondary">{item.name}</span>
                      <span className="font-bold tabular-nums">{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* UPI ID / Ref */}
            {(result.upiId || result.transactionRef) && (
              <div className="flex gap-3 text-[10px] text-text-tertiary">
                {result.upiId && <span>UPI: <span className="font-mono">{result.upiId}</span></span>}
                {result.transactionRef && <span>Ref: <span className="font-mono">{result.transactionRef}</span></span>}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button onClick={handleSave} disabled={!amount || parseFloat(amount) <= 0}
                className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-semibold text-white disabled:opacity-40 hover:bg-accent-hover transition-colors">
                Save Transaction
              </button>
              <button onClick={handleScan} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-text-secondary hover:bg-surface-secondary transition-colors">
                Rescan
              </button>
            </div>
          </div>

          {/* Raw OCR text (collapsible) */}
          <details className="text-[10px]">
            <summary className="text-text-tertiary cursor-pointer hover:text-text-secondary font-semibold flex items-center gap-1">
              <FileText size={11} /> View raw OCR text
            </summary>
            <pre className="mt-1 p-2.5 bg-surface-secondary rounded-lg text-text-tertiary overflow-x-auto whitespace-pre-wrap font-mono max-h-32 overflow-y-auto">
              {result.rawText}
            </pre>
          </details>
        </motion.div>
      )}

      {/* Success */}
      {saved && (
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="card-elevated p-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-income-light mx-auto">
            <Check size={32} className="text-income" />
          </div>
          <h3 className="text-base font-bold text-text-primary mt-3">Transaction saved!</h3>
          <p className="text-xs text-text-tertiary mt-1">From receipt scan</p>
          <button onClick={() => { setResult(null); setSaved(false); setPreview(null); }}
            className="mt-4 flex items-center gap-1.5 mx-auto text-sm font-semibold text-accent hover:gap-2.5 transition-all">
            Scan another <ArrowRight size={14} />
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}
