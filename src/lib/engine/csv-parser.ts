/**
 * Production CSV parser for Indian bank statements.
 * Auto-detects bank format and column layout.
 * Handles HDFC, SBI, ICICI, Axis, Kotak, and generic formats.
 */

export interface ParsedCSVTransaction {
  date: string;
  description: string;
  amount: number;
  type: "debit" | "credit";
  balance?: number;
  reference?: string;
  raw: string;
}

export interface CSVParseResult {
  transactions: ParsedCSVTransaction[];
  detectedBank: string;
  totalDebits: number;
  totalCredits: number;
  dateRange: { start: string; end: string };
  errors: string[];
}

// Bank-specific column mappings
interface ColumnMapping {
  date: number;
  description: number;
  debit: number;
  credit: number;
  balance?: number;
  reference?: number;
}

// Known bank header patterns
const BANK_SIGNATURES: { bank: string; headers: RegExp[] }[] = [
  {
    bank: "HDFC",
    headers: [/narration/i, /chq.*no/i, /value\s*dt/i, /withdrawal/i, /deposit/i, /closing\s*balance/i],
  },
  {
    bank: "SBI",
    headers: [/txn\s*date/i, /description/i, /ref\s*no/i, /debit/i, /credit/i, /balance/i],
  },
  {
    bank: "ICICI",
    headers: [/transaction\s*date/i, /transaction\s*remark/i, /withdrawal/i, /deposit/i, /balance/i],
  },
  {
    bank: "Axis",
    headers: [/tran\s*date/i, /particulars/i, /debit/i, /credit/i, /balance/i],
  },
  {
    bank: "Kotak",
    headers: [/date/i, /description/i, /dr\s*amount/i, /cr\s*amount/i, /balance/i],
  },
];

function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, ""));
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^"|"$/g, ""));
  return result;
}

function detectBank(headers: string[]): { bank: string; mapping: ColumnMapping } | null {
  const headerStr = headers.join(" ").toLowerCase();

  for (const sig of BANK_SIGNATURES) {
    const matchCount = sig.headers.filter((h) => h.test(headerStr)).length;
    if (matchCount >= 3) {
      const mapping = detectColumns(headers, sig.bank);
      if (mapping) return { bank: sig.bank, mapping };
    }
  }

  // Generic auto-detection
  const mapping = detectColumnsGeneric(headers);
  if (mapping) return { bank: "Generic", mapping };

  return null;
}

function detectColumns(headers: string[], _bank: string): ColumnMapping | null {
  const h = headers.map((s) => s.toLowerCase().trim());

  const dateIdx = h.findIndex((c) => /date|txn.*date|tran.*date|value.*dt/i.test(c));
  const descIdx = h.findIndex((c) => /narration|description|particular|remark|detail/i.test(c));
  const debitIdx = h.findIndex((c) => /debit|withdrawal|dr.*amount|withdraw/i.test(c));
  const creditIdx = h.findIndex((c) => /credit|deposit|cr.*amount/i.test(c));
  const balIdx = h.findIndex((c) => /balance|closing.*bal/i.test(c));
  const refIdx = h.findIndex((c) => /ref|reference|chq|cheque/i.test(c));

  if (dateIdx === -1 || descIdx === -1 || (debitIdx === -1 && creditIdx === -1)) return null;

  return {
    date: dateIdx,
    description: descIdx,
    debit: debitIdx >= 0 ? debitIdx : -1,
    credit: creditIdx >= 0 ? creditIdx : -1,
    balance: balIdx >= 0 ? balIdx : undefined,
    reference: refIdx >= 0 ? refIdx : undefined,
  };
}

function detectColumnsGeneric(headers: string[]): ColumnMapping | null {
  const h = headers.map((s) => s.toLowerCase().trim());

  const dateIdx = h.findIndex((c) => /date/i.test(c));
  const descIdx = h.findIndex((c) => /desc|narr|particular|remark|detail|merchant|payee/i.test(c));

  // Single amount column (positive/negative)
  const amountIdx = h.findIndex((c) => /amount|amt|sum|value/i.test(c));
  if (dateIdx >= 0 && amountIdx >= 0) {
    return {
      date: dateIdx,
      description: descIdx >= 0 ? descIdx : amountIdx,
      debit: amountIdx,
      credit: -1, // Will detect from sign
    };
  }

  // Separate debit/credit columns
  const debitIdx = h.findIndex((c) => /debit|withdraw|dr|spent/i.test(c));
  const creditIdx = h.findIndex((c) => /credit|deposit|cr|received/i.test(c));

  if (dateIdx >= 0 && (debitIdx >= 0 || creditIdx >= 0)) {
    return {
      date: dateIdx,
      description: descIdx >= 0 ? descIdx : dateIdx,
      debit: debitIdx >= 0 ? debitIdx : -1,
      credit: creditIdx >= 0 ? creditIdx : -1,
    };
  }

  return null;
}

function parseDate(dateStr: string): string {
  const cleaned = dateStr.trim();

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = cleaned.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (dmy) {
    const d = dmy[1].padStart(2, "0");
    const m = dmy[2].padStart(2, "0");
    let y = dmy[3];
    if (y.length === 2) y = `20${y}`;
    return parseInt(m) <= 12 ? `${y}-${m}-${d}` : `${y}-${d}-${m}`;
  }

  // YYYY-MM-DD
  const ymd = cleaned.match(/(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, "0")}-${ymd[3].padStart(2, "0")}`;

  // DD Mon YYYY
  const monthMap: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };
  const named = cleaned.match(/(\d{1,2})\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*[\s,]*(\d{2,4})/i);
  if (named) {
    let y = named[3]; if (y.length === 2) y = `20${y}`;
    return `${y}-${monthMap[named[2].toLowerCase().slice(0, 3)]}-${named[1].padStart(2, "0")}`;
  }

  return cleaned; // Return as-is if unparseable
}

function parseAmount(str: string): number {
  if (!str) return 0;
  const cleaned = str.replace(/[₹,\s"']/g, "").replace(/^Rs\.?/i, "").trim();
  if (!cleaned || cleaned === "-" || cleaned === "") return 0;
  return Math.abs(parseFloat(cleaned)) || 0;
}

export function parseCSV(csvText: string): CSVParseResult {
  const errors: string[] = [];
  const lines = csvText.trim().split(/\r?\n/).filter((l) => l.trim());

  if (lines.length < 2) {
    return { transactions: [], detectedBank: "Unknown", totalDebits: 0, totalCredits: 0, dateRange: { start: "", end: "" }, errors: ["File has fewer than 2 lines"] };
  }

  // Find header row — skip blank/metadata rows at the top
  let headerIdx = 0;
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const cols = splitCSVLine(lines[i]);
    if (cols.length >= 3 && /date|narr|desc|amount|debit|credit|particular/i.test(cols.join(" "))) {
      headerIdx = i;
      break;
    }
  }

  const headers = splitCSVLine(lines[headerIdx]);
  const detection = detectBank(headers);

  if (!detection) {
    return { transactions: [], detectedBank: "Unknown", totalDebits: 0, totalCredits: 0, dateRange: { start: "", end: "" }, errors: ["Could not detect column layout. Expected columns: Date, Description, Debit/Credit or Amount"] };
  }

  const { bank, mapping } = detection;
  const transactions: ParsedCSVTransaction[] = [];

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i]);
    if (cols.length < 3) continue;

    const dateRaw = cols[mapping.date] || "";
    const date = parseDate(dateRaw);
    if (!date || date.length < 8) continue;

    const description = cols[mapping.description] || "";
    const debitAmt = mapping.debit >= 0 ? parseAmount(cols[mapping.debit]) : 0;
    const creditAmt = mapping.credit >= 0 ? parseAmount(cols[mapping.credit]) : 0;

    // Handle single-column amount (negative = debit)
    let amount: number;
    let type: "debit" | "credit";

    if (mapping.credit === -1 && debitAmt !== 0) {
      // Single amount column — check if negative
      const rawAmt = cols[mapping.debit] || "";
      if (rawAmt.trim().startsWith("-") || rawAmt.includes("DR")) {
        amount = Math.abs(debitAmt);
        type = "debit";
      } else {
        amount = debitAmt;
        type = "credit";
      }
    } else if (debitAmt > 0 && creditAmt === 0) {
      amount = debitAmt;
      type = "debit";
    } else if (creditAmt > 0 && debitAmt === 0) {
      amount = creditAmt;
      type = "credit";
    } else if (debitAmt > 0) {
      amount = debitAmt;
      type = "debit";
    } else {
      continue; // No amount found
    }

    if (amount <= 0) continue;

    const balance = mapping.balance !== undefined ? parseAmount(cols[mapping.balance]) : undefined;
    const reference = mapping.reference !== undefined ? cols[mapping.reference]?.trim() : undefined;

    transactions.push({ date, description, amount, type, balance, reference, raw: lines[i] });
  }

  const totalDebits = transactions.filter((t) => t.type === "debit").reduce((s, t) => s + t.amount, 0);
  const totalCredits = transactions.filter((t) => t.type === "credit").reduce((s, t) => s + t.amount, 0);
  const dates = transactions.map((t) => t.date).sort();
  const dateRange = { start: dates[0] || "", end: dates[dates.length - 1] || "" };

  return { transactions, detectedBank: bank, totalDebits, totalCredits, dateRange, errors };
}
