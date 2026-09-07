/**
 * Native SMS Parser for Indian Banks
 * Same logic as web version, ported for React Native.
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
  cardLast4?: string;
  isUPI: boolean;
  raw: string;
  confidence: number;
  categoryGuess?: string;
}

const BANK_PATTERNS: { pattern: RegExp; bank: string }[] = [
  { pattern: /HDFCBK|HDFC\s*Bank/i, bank: "HDFC" },
  { pattern: /SBIBNK|SBI\b|State\s*Bank/i, bank: "SBI" },
  { pattern: /ICICIB|ICICI\s*Bank/i, bank: "ICICI" },
  { pattern: /AXISBK|Axis\s*Bank/i, bank: "Axis" },
  { pattern: /KOTAKB|Kotak/i, bank: "Kotak" },
  { pattern: /BOBTXN|BOB\b/i, bank: "BOB" },
  { pattern: /PNBSMS|PNB\b/i, bank: "PNB" },
  { pattern: /YESBK|Yes\s*Bank/i, bank: "Yes Bank" },
  { pattern: /IDBIBK|IDBI/i, bank: "IDBI" },
  { pattern: /CANBNK|Canara/i, bank: "Canara" },
  { pattern: /UNIONB|Union\s*Bank/i, bank: "Union" },
  { pattern: /INDBNK|IndusInd/i, bank: "IndusInd" },
  { pattern: /FEDBK|Federal/i, bank: "Federal" },
  { pattern: /PAYTM|Paytm/i, bank: "Paytm" },
  { pattern: /PhonePe/i, bank: "PhonePe" },
  { pattern: /GPay|Google\s*Pay/i, bank: "GPay" },
  { pattern: /CRED\b/i, bank: "CRED" },
  { pattern: /AMZN|Amazon\s*Pay/i, bank: "Amazon Pay" },
];

// Merchant → category mapping
const MERCHANT_CATEGORIES: Record<string, string> = {
  swiggy: "Food", zomato: "Food", "uber eats": "Food",
  uber: "Transport", ola: "Transport", rapido: "Transport",
  amazon: "Shopping", flipkart: "Shopping", myntra: "Shopping", meesho: "Shopping",
  netflix: "Subscriptions", spotify: "Subscriptions", hotstar: "Subscriptions",
  "youtube premium": "Subscriptions", "amazon prime": "Subscriptions",
  blinkit: "Groceries", zepto: "Groceries", bigbasket: "Groceries", instamart: "Groceries",
  airtel: "Bills", jio: "Bills", vi: "Bills",
  starbucks: "Food", dominos: "Food", mcdonalds: "Food", kfc: "Food",
  "indian oil": "Fuel", hp: "Fuel", bpcl: "Fuel",
  pharmeasy: "Healthcare", "1mg": "Healthcare", apollo: "Healthcare",
};

export function parseSMS(text: string): ParsedSMS | null {
  const raw = text.trim();
  if (!raw || raw.length < 15) return null;

  // Detect bank
  let bank = "Unknown";
  for (const { pattern, bank: b } of BANK_PATTERNS) {
    if (pattern.test(raw)) { bank = b; break; }
  }

  // Extract amount
  const amountPatterns = [
    /(?:INR|Rs\.?|₹)\s*([\d,]+(?:\.\d{1,2})?)/i,
    /([\d,]+(?:\.\d{1,2})?)\s*(?:INR|Rs\.?|₹)/i,
    /(?:debited|credited|spent|paid|received)\s*(?:INR|Rs\.?|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i,
  ];
  let amount = 0;
  for (const pattern of amountPatterns) {
    const match = raw.match(pattern);
    if (match) { amount = parseFloat(match[1].replace(/,/g, "")); if (amount > 0) break; }
  }
  if (amount <= 0) return null;

  // Debit or credit
  const isCredit = /credited|received|deposited|refund|cashback|salary|IMPS\s*CR|NEFT\s*CR/i.test(raw);
  const isDebit = /debited|spent|paid|withdrawn|purchase|deducted|sent|transferred/i.test(raw);
  const type: "debit" | "credit" = isCredit && !isDebit ? "credit" : "debit";

  // Account last 4
  const accMatch = raw.match(/(?:A\/c|Ac|Account)\s*(?:no\.?\s*)?(?:ending\s*)?(?:XX|xx|[*X]+)?(\d{4})/i) || raw.match(/[*Xx]+(\d{4})/);
  const accountLast4 = accMatch ? accMatch[1] : undefined;

  // Card
  const cardMatch = raw.match(/(?:Credit|Debit)\s*Card\s*(?:ending)?\s*(?:XX|[*X]+)?(\d{4})/i);
  const cardLast4 = cardMatch ? cardMatch[1] : undefined;

  // Merchant
  let merchant: string | undefined;
  const merchantPatterns = [
    /(?:at|to|from|for)\s+([A-Za-z][A-Za-z0-9\s&.'_-]{1,40})(?:\s+(?:on|via|thru|ref|UPI))/i,
    /(?:at|to)\s+([A-Za-z][A-Za-z0-9\s&.'_-]{1,30})/i,
    /(?:paid\s+to|sent\s+to)\s+([A-Za-z][A-Za-z0-9\s&.'_-]{1,30})/i,
  ];
  for (const p of merchantPatterns) {
    const m = raw.match(p);
    if (m) {
      const cleaned = m[1].trim().replace(/\s*(on|via|thru|ref|UPI|Avl|Bal).*$/i, "").trim();
      if (cleaned.length > 1 && cleaned.length < 50) { merchant = cleaned; break; }
    }
  }

  // Date
  let date: string | undefined;
  const dateMatch = raw.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (dateMatch) {
    let y = dateMatch[3]; if (y.length === 2) y = `20${y}`;
    date = `${y}-${dateMatch[2].padStart(2, "0")}-${dateMatch[1].padStart(2, "0")}`;
  }

  // Time
  const timeMatch = raw.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
  let time: string | undefined;
  if (timeMatch) {
    let h = parseInt(timeMatch[1]);
    if (timeMatch[4]?.toUpperCase() === "PM" && h < 12) h += 12;
    if (timeMatch[4]?.toUpperCase() === "AM" && h === 12) h = 0;
    time = `${String(h).padStart(2, "0")}:${timeMatch[2]}`;
  }

  // Balance
  let balance: number | undefined;
  const balMatch = raw.match(/(?:Avl|Available|Bal|Balance)\s*(?:Bal)?\s*(?:is\s*)?(?:INR|Rs\.?|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (balMatch) balance = parseFloat(balMatch[1].replace(/,/g, ""));

  // UPI ref
  const upiRefMatch = raw.match(/(?:UPI\s*Ref|Ref\s*No\.?)\s*:?\s*(\d{8,12})/i);
  const upiRef = upiRefMatch ? upiRefMatch[1] : undefined;
  const isUPI = /UPI|IMPS|GooglePay|PhonePe|Paytm|BHIM/i.test(raw);

  // Category guess from merchant
  let categoryGuess: string | undefined;
  if (merchant) {
    const lower = merchant.toLowerCase();
    for (const [key, cat] of Object.entries(MERCHANT_CATEGORIES)) {
      if (lower.includes(key)) { categoryGuess = cat; break; }
    }
  }

  // Confidence
  let confidence = 40;
  if (amount > 0) confidence += 25;
  if (merchant) confidence += 15;
  if (date) confidence += 10;
  if (bank !== "Unknown") confidence += 10;

  return { amount, type, bank, accountLast4, merchant, date, time, balance, upiRef, cardLast4, isUPI, raw, confidence: Math.min(98, confidence), categoryGuess };
}

/** Check if a message looks like a bank transaction SMS */
export function isBankSMS(text: string): boolean {
  if (!text || text.length < 20) return false;
  return /(?:debited|credited|INR|Rs\.?\s*\d|₹\s*\d|spent|received|withdrawn|deposited|paid|transferred)/i.test(text);
}
