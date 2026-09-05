/**
 * Real OCR engine using Tesseract.js — runs entirely in-browser, no API needed.
 * Extracts financial data from receipt images, UPI screenshots, bank statements.
 */
import { createWorker, type Worker } from "tesseract.js";

export interface OCRResult {
  rawText: string;
  amount: number | null;
  merchant: string | null;
  date: string | null;
  items: { name: string; amount: number }[];
  confidence: number;
  upiId: string | null;
  transactionRef: string | null;
}

let worker: Worker | null = null;

async function getWorker(): Promise<Worker> {
  if (!worker) {
    worker = await createWorker("eng", 1, {
      logger: (m) => {
        if (typeof window !== "undefined" && (window as unknown as Record<string, unknown>).__ocrProgress) {
          (window as unknown as Record<string, (p: number) => void>).__ocrProgress(
            m.status === "recognizing text" ? m.progress : 0
          );
        }
      },
    });
  }
  return worker;
}

export async function extractFromImage(
  imageSource: File | string,
  onProgress?: (progress: number) => void
): Promise<OCRResult> {
  if (onProgress) {
    (window as unknown as Record<string, unknown>).__ocrProgress = onProgress;
  }

  const w = await getWorker();
  const { data } = await w.recognize(imageSource);
  const rawText = data.text;
  const confidence = data.confidence;

  // Clean up progress callback
  if (typeof window !== "undefined") {
    delete (window as unknown as Record<string, unknown>).__ocrProgress;
  }

  // Extract financial data from the OCR text
  const amount = extractAmount(rawText);
  const merchant = extractMerchant(rawText);
  const date = extractDate(rawText);
  const items = extractLineItems(rawText);
  const upiId = extractUPIId(rawText);
  const transactionRef = extractTransactionRef(rawText);

  return {
    rawText,
    amount,
    merchant,
    date,
    items,
    confidence,
    upiId,
    transactionRef,
  };
}

// --- Amount extraction (handles Indian formats) ---
function extractAmount(text: string): number | null {
  const patterns = [
    // UPI / bank specific
    /(?:Total|Grand\s*Total|Amount|Paid|Debited|Credited|Net\s*Amount|Bill\s*Amount|You\s*(?:paid|sent|received))\s*:?\s*(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{1,2})?)/i,
    /(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{1,2})?)\s*(?:Debited|Credited|Paid|Total)/i,
    // Google Pay / PhonePe / Paytm screenshot formats
    /(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/i,
    // Reverse format
    /([\d,]+(?:\.\d{1,2})?)\s*(?:₹|Rs\.?|INR)/i,
    // Standalone large amounts (likely total)
    /\b(\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?)\b/,
  ];

  // Try patterns in order of specificity
  for (const pattern of patterns) {
    const matches = text.match(new RegExp(pattern, "gi"));
    if (matches) {
      // For generic patterns, pick the largest amount (likely the total)
      let best = 0;
      for (const match of matches) {
        const numMatch = match.match(/([\d,]+(?:\.\d{1,2})?)/);
        if (numMatch) {
          const val = parseFloat(numMatch[1].replace(/,/g, ""));
          if (val > best && val < 10000000) best = val;
        }
      }
      if (best > 0) return best;
    }
  }

  return null;
}

// --- Merchant extraction ---
function extractMerchant(text: string): string | null {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  // UPI: "Paid to [merchant]" or "To: [merchant]"
  for (const line of lines) {
    const paid = line.match(/(?:Paid\s+to|To|Merchant|Store|Shop)\s*:?\s*(.+)/i);
    if (paid) {
      const name = paid[1].trim().replace(/[^a-zA-Z0-9\s&.-]/g, "").trim();
      if (name.length > 1 && name.length < 60) return name;
    }
  }

  // First non-numeric, non-date line is often the merchant name
  for (const line of lines.slice(0, 5)) {
    const cleaned = line.replace(/[^a-zA-Z\s&.-]/g, "").trim();
    if (cleaned.length > 3 && cleaned.length < 50 && !/^(date|time|bill|invoice|receipt|total|amount|tax|gst)/i.test(cleaned)) {
      return cleaned;
    }
  }

  return null;
}

// --- Date extraction ---
function extractDate(text: string): string | null {
  const patterns = [
    // DD/MM/YYYY or DD-MM-YYYY
    /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/,
    // DD/MM/YY
    /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2})\b/,
    // DD Mon YYYY (e.g., "05 Sep 2026")
    /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+(\d{4})/i,
    // Mon DD, YYYY
    /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+(\d{1,2}),?\s+(\d{4})/i,
  ];

  const monthMap: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      if (/jan|feb|mar/i.test(match[0])) {
        // Named month format
        if (/^\d/.test(match[1])) {
          // DD Mon YYYY
          const m = monthMap[match[2].toLowerCase().slice(0, 3)];
          return `${match[3]}-${m}-${match[1].padStart(2, "0")}`;
        } else {
          // Mon DD YYYY
          const m = monthMap[match[1].toLowerCase().slice(0, 3)];
          return `${match[3]}-${m}-${match[2].padStart(2, "0")}`;
        }
      }
      // Numeric format
      const day = match[1].padStart(2, "0");
      const month = match[2].padStart(2, "0");
      let year = match[3];
      if (year.length === 2) year = `20${year}`;
      if (parseInt(month) <= 12) return `${year}-${month}-${day}`;
      // MM/DD/YYYY fallback
      return `${year}-${day}-${month}`;
    }
  }

  return null;
}

// --- Line items extraction ---
function extractLineItems(text: string): { name: string; amount: number }[] {
  const items: { name: string; amount: number }[] = [];
  const lines = text.split("\n");

  for (const line of lines) {
    // Pattern: "Item name ... amount" or "Item name Rs. amount"
    const match = line.match(/^(.{3,40}?)\s+(?:Rs\.?|₹|INR)?\s*(\d[\d,]*(?:\.\d{1,2})?)\s*$/);
    if (match) {
      const name = match[1].trim();
      const amount = parseFloat(match[2].replace(/,/g, ""));
      if (amount > 0 && amount < 100000 && !/total|tax|gst|discount|subtotal/i.test(name)) {
        items.push({ name, amount });
      }
    }
  }

  return items;
}

// --- UPI ID extraction ---
function extractUPIId(text: string): string | null {
  const match = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z]+)/);
  return match ? match[1] : null;
}

// --- Transaction reference ---
function extractTransactionRef(text: string): string | null {
  const patterns = [
    /(?:Ref|Reference|Txn|Transaction)\s*(?:No|Number|ID|#)?\s*:?\s*([A-Z0-9]{8,20})/i,
    /(?:UPI\s*Ref)\s*:?\s*(\d{10,12})/i,
    /\b(\d{12})\b/, // 12-digit UPI ref
  ];
  for (const p of patterns) {
    const match = text.match(p);
    if (match) return match[1];
  }
  return null;
}

export async function terminateOCR(): Promise<void> {
  if (worker) {
    await worker.terminate();
    worker = null;
  }
}
