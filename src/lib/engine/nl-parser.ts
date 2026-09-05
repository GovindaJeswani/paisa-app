import { format, subDays, addDays, parse, isValid } from "date-fns";
import type { ParsedTransaction, TransactionType } from "../types";
import { categorizeByKeywords, categorizeMerchant } from "./categorizer";

// --- Amount extraction ---

const AMOUNT_PATTERNS = [
  /(?:₹|rs\.?|inr)\s*(\d[\d,]*(?:\.\d{1,2})?)/i,
  /(\d[\d,]*(?:\.\d{1,2})?)\s*(?:₹|rs\.?|inr|rupees?)/i,
  /(?:spent|paid|received|got|earned|lent|borrowed|saved|invested|gave)\s+(\d[\d,]*(?:\.\d{1,2})?)/i,
  /(\d[\d,]*(?:\.\d{1,2})?)\s+(?:spent|paid|for|on|to|from)/i,
  /(\d{2,}[\d,]*(?:\.\d{1,2})?)/,
];

function extractAmount(text: string): number | undefined {
  for (const pattern of AMOUNT_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const cleaned = match[1].replace(/,/g, "");
      const num = parseFloat(cleaned);
      if (num > 0 && num < 100000000) return num;
    }
  }
  return undefined;
}

// --- Date extraction ---

const DATE_KEYWORDS: Record<string, (now: Date) => Date> = {
  today: (now) => now,
  yesterday: (now) => subDays(now, 1),
  "day before yesterday": (now) => subDays(now, 2),
  "day before": (now) => subDays(now, 2),
  tomorrow: (now) => addDays(now, 1),
  "last week": (now) => subDays(now, 7),
};

function extractDate(text: string): string | undefined {
  const now = new Date();
  const lower = text.toLowerCase();

  // Keyword dates
  for (const [keyword, fn] of Object.entries(DATE_KEYWORDS)) {
    if (lower.includes(keyword)) {
      return format(fn(now), "yyyy-MM-dd");
    }
  }

  // "on 5th", "on 15 sept", "on sept 5"
  const dayMonth =
    lower.match(/on\s+(\d{1,2})(?:st|nd|rd|th)?\s*(?:of\s+)?(\w+)?/i) ||
    lower.match(/(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*/i);

  if (dayMonth) {
    const day = parseInt(dayMonth[1]);
    const monthStr = dayMonth[2];
    let date: Date;

    if (monthStr) {
      const monthMap: Record<string, number> = {
        jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
        jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
      };
      const monthNum = monthMap[monthStr.substring(0, 3).toLowerCase()];
      if (monthNum !== undefined) {
        date = new Date(now.getFullYear(), monthNum, day);
      } else {
        date = new Date(now.getFullYear(), now.getMonth(), day);
      }
    } else {
      date = new Date(now.getFullYear(), now.getMonth(), day);
    }

    if (isValid(date)) {
      return format(date, "yyyy-MM-dd");
    }
  }

  return format(now, "yyyy-MM-dd");
}

// --- Type detection ---

const TYPE_PATTERNS: { pattern: RegExp; type: TransactionType }[] = [
  { pattern: /\b(?:received|got|earned|salary|income|credited|allowance|cashback|refund)\b/i, type: "income" },
  { pattern: /\b(?:lent|lend|gave.+money)\b/i, type: "lend" },
  { pattern: /\b(?:borrowed|borrow|took.+money)\b/i, type: "borrow" },
  { pattern: /\b(?:repaid|repay|paid\s+back|returned)\b/i, type: "repayment" },
  { pattern: /\b(?:transfer|transferred|moved|sent.+to.+account)\b/i, type: "transfer" },
  { pattern: /\b(?:saved|save|saving)\b/i, type: "saving" },
  { pattern: /\b(?:invested|invest|sip|mutual\s+fund)\b/i, type: "investment" },
  { pattern: /\b(?:spent|paid|bought|purchased|expense|ordered)\b/i, type: "expense" },
];

function detectType(text: string): TransactionType {
  for (const { pattern, type } of TYPE_PATTERNS) {
    if (pattern.test(text)) return type;
  }
  return "expense"; // default
}

// --- Person extraction ---

const PERSON_PATTERNS = [
  /(?:with|from|to|for|owes?\s+me|owe\s+)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/,
  /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:owes?\s+me|paid|lent|borrowed|gave)/,
  /(?:lent|borrowed|gave|paid)\s+(?:to\s+)?([A-Z][a-z]+)/,
  /(?:from|to)\s+([A-Z][a-z]+)/,
];

function extractPerson(text: string): string | undefined {
  // Exclude known non-person words
  const excludeWords = new Set([
    "Spent", "Paid", "Received", "Got", "Food", "Shopping", "Transport",
    "Cash", "UPI", "Card", "Net", "The", "For", "Today", "Yesterday",
    "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
    "January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December",
    "Swiggy", "Zomato", "Amazon", "Flipkart", "Netflix", "Uber", "Ola",
    "HDFC", "SBI", "ICICI", "Axis", "Kotak",
  ]);

  for (const pattern of PERSON_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const name = match[1].trim();
      if (!excludeWords.has(name) && name.length > 1) {
        return name;
      }
    }
  }
  return undefined;
}

// --- Account extraction ---

const ACCOUNT_KEYWORDS: Record<string, string> = {
  hdfc: "HDFC",
  sbi: "SBI",
  icici: "ICICI",
  axis: "Axis",
  kotak: "Kotak",
  bob: "BOB",
  pnb: "PNB",
  "yes bank": "Yes Bank",
  paytm: "Paytm",
  phonepe: "PhonePe",
  gpay: "GPay",
  "google pay": "GPay",
  cash: "Cash",
  "credit card": "Credit Card",
  "debit card": "Debit Card",
  upi: "UPI",
};

function extractAccount(text: string): string | undefined {
  const lower = text.toLowerCase();
  for (const [keyword, name] of Object.entries(ACCOUNT_KEYWORDS)) {
    if (lower.includes(keyword)) return name;
  }
  return undefined;
}

// --- Merchant extraction ---

function extractMerchant(text: string): string | undefined {
  // "at [Merchant]", "on [Merchant]", "from [Merchant]", "to [Merchant]"
  const patterns = [
    /(?:at|on|from|to)\s+([A-Z][a-zA-Z']+(?:\s+[A-Z][a-zA-Z']+)*)/,
    /(?:at|on|from)\s+(\w+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const merchant = match[1].trim();
      const skipWords = new Set(["the", "my", "a", "an", "some", "that", "this"]);
      if (!skipWords.has(merchant.toLowerCase()) && merchant.length > 1) {
        return merchant;
      }
    }
  }
  return undefined;
}

// --- Main parser ---

export async function parseNaturalLanguage(input: string): Promise<ParsedTransaction> {
  const text = input.trim();
  let confidence = 30; // base confidence

  const amount = extractAmount(text);
  if (amount) confidence += 30;

  const type = detectType(text);
  if (type !== "expense") confidence += 5; // type was explicitly detected

  const date = extractDate(text);
  const personName = extractPerson(text);
  const accountName = extractAccount(text);
  const merchant = extractMerchant(text);

  // Category from merchant
  let categoryId: string | undefined;
  let subcategory: string | undefined;

  if (merchant) {
    const merchantCat = await categorizeMerchant(merchant);
    if (merchantCat) {
      categoryId = merchantCat.categoryId;
      subcategory = merchantCat.subcategory;
      confidence = Math.max(confidence, merchantCat.confidence);
    }
  }

  // Category from keywords if not found via merchant
  if (!categoryId) {
    const keywordCat = await categorizeByKeywords(text);
    if (keywordCat) {
      categoryId = keywordCat.categoryId;
      confidence = Math.max(confidence, keywordCat.confidence);
    }
  }

  // Build note from remaining text
  const note = text.length <= 60 ? text : undefined;

  return {
    amount,
    type,
    categoryId,
    subcategory,
    merchant,
    personName,
    accountName,
    date,
    note,
    confidence: Math.min(95, confidence),
    rawInput: text,
  };
}
