/**
 * Production SMS parser for Indian banks.
 * Handles real SMS formats from 20+ banks/UPI apps.
 * No simulation — this parses actual bank message text.
 */

export interface ParsedSMS {
  amount: number;
  type: "debit" | "credit";
  bank: string;
  accountLast4?: string;
  merchant?: string;
  date?: string;
  time?: string;
  balance?: number;
  upiRef?: string;
  cardType?: "credit" | "debit";
  cardLast4?: string;
  isUPI: boolean;
  raw: string;
  confidence: number;
}

// Bank identification from sender ID or message content
const BANK_PATTERNS: { pattern: RegExp; bank: string }[] = [
  { pattern: /HDFCBK|HDFC\s*Bank/i, bank: "HDFC" },
  { pattern: /SBIBNK|SBI\b|State\s*Bank/i, bank: "SBI" },
  { pattern: /ICICIB|ICICI\s*Bank/i, bank: "ICICI" },
  { pattern: /AXISBK|Axis\s*Bank/i, bank: "Axis" },
  { pattern: /KOTAKB|Kotak\s*Bank/i, bank: "Kotak" },
  { pattern: /BOBTXN|BOB\b|Bank\s*of\s*Baroda/i, bank: "BOB" },
  { pattern: /PNBSMS|PNB\b|Punjab\s*National/i, bank: "PNB" },
  { pattern: /YESBK|Yes\s*Bank/i, bank: "Yes Bank" },
  { pattern: /IDBIBK|IDBI\s*Bank/i, bank: "IDBI" },
  { pattern: /CANBNK|Canara\s*Bank/i, bank: "Canara" },
  { pattern: /UNIONB|Union\s*Bank/i, bank: "Union" },
  { pattern: /INDBNK|IndusInd/i, bank: "IndusInd" },
  { pattern: /FEDBK|Federal\s*Bank/i, bank: "Federal" },
  { pattern: /IOBSMS|IOB\b|Indian\s*Overseas/i, bank: "IOB" },
  { pattern: /CENTBK|Central\s*Bank/i, bank: "Central" },
  { pattern: /PAYTM|Paytm/i, bank: "Paytm" },
  { pattern: /PhonePe/i, bank: "PhonePe" },
  { pattern: /GPay|Google\s*Pay/i, bank: "GPay" },
  { pattern: /CRED\b/i, bank: "CRED" },
  { pattern: /AMZN|Amazon\s*Pay/i, bank: "Amazon Pay" },
];

export function parseSMS(text: string): ParsedSMS | null {
  const raw = text.trim();
  if (!raw || raw.length < 15) return null;

  // --- Detect bank ---
  let bank = "Unknown";
  for (const { pattern, bank: b } of BANK_PATTERNS) {
    if (pattern.test(raw)) { bank = b; break; }
  }

  // --- Extract amount ---
  const amountPatterns = [
    /(?:INR|Rs\.?|₹)\s*([\d,]+(?:\.\d{1,2})?)/i,
    /([\d,]+(?:\.\d{1,2})?)\s*(?:INR|Rs\.?|₹)/i,
    /(?:amount|amt)\s*(?:of\s*)?(?:INR|Rs\.?|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i,
    /(?:debited|credited|spent|paid|received)\s*(?:INR|Rs\.?|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i,
  ];

  let amount = 0;
  for (const pattern of amountPatterns) {
    const match = raw.match(pattern);
    if (match) {
      amount = parseFloat(match[1].replace(/,/g, ""));
      if (amount > 0) break;
    }
  }

  if (amount <= 0) return null; // Can't parse without an amount

  // --- Detect debit/credit ---
  const isCredit = /credited|received|deposited|refund|cashback|salary|IMPS\s*CR|NEFT\s*CR|income|added/i.test(raw);
  const isDebit = /debited|spent|paid|withdrawn|purchase|deducted|sent|transferred/i.test(raw);
  const type: "debit" | "credit" = isCredit && !isDebit ? "credit" : "debit";

  // --- Account last 4 digits ---
  const accountMatch = raw.match(/(?:A\/c|Ac|Acct|Account|a\/c)\s*(?:no\.?\s*)?(?:ending\s*)?(?:XX|xx|[*X]+)?(\d{4})/i)
    || raw.match(/[*Xx]+(\d{4})/);
  const accountLast4 = accountMatch ? accountMatch[1] : undefined;

  // --- Card details ---
  const cardMatch = raw.match(/(?:Credit|Debit)\s*Card\s*(?:ending|no\.?)?\s*(?:XX|xx|[*X]+)?(\d{4})/i);
  const cardLast4 = cardMatch ? cardMatch[1] : undefined;
  const cardType = /Credit\s*Card/i.test(raw) ? "credit" as const : cardMatch ? "debit" as const : undefined;

  // --- Merchant / recipient ---
  let merchant: string | undefined;
  const merchantPatterns = [
    /(?:at|to|from|for|towards|@)\s+([A-Za-z][A-Za-z0-9\s&.'_-]{1,40})(?:\s+(?:on|via|thru|through|ref|UPI|using))/i,
    /(?:at|to)\s+([A-Za-z][A-Za-z0-9\s&.'_-]{1,30})/i,
    /(?:paid\s+to|sent\s+to|paid)\s+([A-Za-z][A-Za-z0-9\s&.'_-]{1,30})/i,
    /(?:Info|Remark|Desc)\s*:?\s*([A-Za-z][A-Za-z0-9\s&.'_-]{2,40})/i,
  ];
  for (const p of merchantPatterns) {
    const m = raw.match(p);
    if (m) {
      const cleaned = m[1].trim()
        .replace(/\s*(on|via|thru|through|ref|UPI|using|Avl|Available|Bal).*$/i, "")
        .trim();
      if (cleaned.length > 1 && cleaned.length < 50) {
        merchant = cleaned;
        break;
      }
    }
  }

  // --- Date ---
  let date: string | undefined;
  const datePatterns = [
    /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/,
    /(\d{1,2})\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*[\s,]*(\d{2,4})/i,
  ];
  const monthMap: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };
  for (const p of datePatterns) {
    const m = raw.match(p);
    if (m) {
      if (m[2] && monthMap[m[2].toLowerCase().slice(0, 3)]) {
        let y = m[3]; if (y.length === 2) y = `20${y}`;
        date = `${y}-${monthMap[m[2].toLowerCase().slice(0, 3)]}-${m[1].padStart(2, "0")}`;
      } else {
        const d = m[1].padStart(2, "0");
        const mon = m[2].padStart(2, "0");
        let y = m[3]; if (y.length === 2) y = `20${y}`;
        date = parseInt(mon) <= 12 ? `${y}-${mon}-${d}` : `${y}-${d}-${mon}`;
      }
      break;
    }
  }

  // --- Time ---
  const timeMatch = raw.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
  let time: string | undefined;
  if (timeMatch) {
    let h = parseInt(timeMatch[1]);
    if (timeMatch[4]?.toUpperCase() === "PM" && h < 12) h += 12;
    if (timeMatch[4]?.toUpperCase() === "AM" && h === 12) h = 0;
    time = `${String(h).padStart(2, "0")}:${timeMatch[2]}`;
  }

  // --- Available balance ---
  let balance: number | undefined;
  const balMatch = raw.match(/(?:Avl|Available|Avail|Bal|Balance)\s*(?:Bal|Balance)?\s*(?:is\s*)?(?:INR|Rs\.?|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (balMatch) balance = parseFloat(balMatch[1].replace(/,/g, ""));

  // --- UPI Reference ---
  const upiRefMatch = raw.match(/(?:UPI\s*Ref|UPI\s*ref\.?|Ref\s*No\.?|Txn\s*ID)\s*:?\s*(\d{8,12})/i);
  const upiRef = upiRefMatch ? upiRefMatch[1] : undefined;

  // --- Is UPI ---
  const isUPI = /UPI|upi|IMPS|GooglePay|PhonePe|Paytm|BHIM/i.test(raw);

  // --- Confidence ---
  let confidence = 40;
  if (amount > 0) confidence += 25;
  if (merchant) confidence += 15;
  if (date) confidence += 10;
  if (bank !== "Unknown") confidence += 10;

  return {
    amount, type, bank, accountLast4, merchant, date, time,
    balance, upiRef, cardType, cardLast4, isUPI, raw,
    confidence: Math.min(98, confidence),
  };
}

/**
 * Parse multiple SMS messages at once (e.g., bulk paste).
 * Splits on common delimiters and parses each.
 */
export function parseBulkSMS(text: string): ParsedSMS[] {
  // Split on double newlines or message boundaries
  const messages = text
    .split(/\n{2,}|\r\n{2,}|---+|===+/)
    .map((m) => m.trim())
    .filter((m) => m.length > 15);

  return messages
    .map(parseSMS)
    .filter((r): r is ParsedSMS => r !== null);
}
