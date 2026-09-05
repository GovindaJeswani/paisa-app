/**
 * PAISA V2 — Transaction Intelligence Pipeline
 *
 * CAPTURE → UNDERSTAND → REMEMBER → ANALYZE → ADVISE
 *
 * This is the brain. Every transaction flows through this pipeline:
 *
 * RAW INPUT → PARSE → NORMALIZE → MERCHANT DETECT → CATEGORY INFER →
 * ACCOUNT INFER → PERSON/TRIP DETECT → DUPLICATE CHECK → CONFIDENCE SCORE →
 * SAVE or ASK ONE QUESTION
 *
 * The system learns from every correction and becomes less annoying over time.
 */

import { format } from "date-fns";
import { db } from "../db";
import type {
  Transaction, TransactionType, ImportSource, ParsedTransaction,
  MerchantMapping, Account, Person, FinancialEvent,
} from "../types";
import { generateId } from "../utils";
import { parseNaturalLanguage } from "./nl-parser";
import { categorizeMerchant, categorizeByKeywords, learnFromCorrection } from "./categorizer";
import { findDuplicates, type DuplicateCandidate } from "./duplicate-detector";
import { parseSMS, type ParsedSMS } from "./sms-parser";

// ─── Pipeline Result ───

export type PipelineAction =
  | { type: "auto_save"; transaction: Transaction } // High confidence — saved automatically
  | { type: "confirm"; draft: TransactionDraft; question?: string } // Medium — ask ONE question
  | { type: "review"; draft: TransactionDraft; issues: string[] } // Low — needs review
  | { type: "duplicate"; draft: TransactionDraft; existing: Transaction }; // Duplicate detected

export interface TransactionDraft {
  amount: number;
  type: TransactionType;
  categoryId: string;
  subcategory?: string;
  accountId?: string;
  personId?: string;
  eventId?: string;
  merchant?: string;
  note?: string;
  date: string;
  time?: string;
  importSource: ImportSource;
  confidence: number;
  rawInput: string;
  // What the system inferred (for transparency)
  inferences: Inference[];
}

export interface Inference {
  field: string;
  value: string;
  source: "merchant_map" | "user_learned" | "keyword" | "pattern" | "history" | "default";
  confidence: number;
}

// ─── The Pipeline ───

export async function processInput(
  rawInput: string,
  source: ImportSource = "natural_language"
): Promise<PipelineAction> {
  // Step 1: Parse the raw input
  const parsed = await parseRawInput(rawInput, source);

  // Step 2: Normalize and enrich
  const draft = await enrichDraft(parsed, rawInput, source);

  // Step 3: Check for duplicates
  const duplicates = await findDuplicates(
    draft.amount, draft.date, draft.merchant, draft.accountId
  );
  if (duplicates.length > 0 && duplicates[0].similarity >= 75) {
    return { type: "duplicate", draft, existing: duplicates[0].existing };
  }

  // Step 4: Decide action based on confidence
  if (draft.confidence >= 80) {
    // High confidence — auto save
    const txn = await saveDraft(draft);
    return { type: "auto_save", transaction: txn };
  } else if (draft.confidence >= 50) {
    // Medium — confirm with ONE question
    const question = generateSmartQuestion(draft);
    return { type: "confirm", draft, question };
  } else {
    // Low — needs review
    const issues: string[] = [];
    if (!draft.amount || draft.amount <= 0) issues.push("Amount not detected");
    if (draft.categoryId === "cat_other") issues.push("Category unknown");
    return { type: "review", draft, issues };
  }
}

// Process SMS text input
export async function processSMS(smsText: string): Promise<PipelineAction[]> {
  const parsed = parseSMS(smsText);
  if (!parsed) return [];

  const rawInput = smsText;
  const draft = await enrichFromSMS(parsed, rawInput);

  const duplicates = await findDuplicates(draft.amount, draft.date, draft.merchant, draft.accountId);
  if (duplicates.length > 0 && duplicates[0].similarity >= 75) {
    return [{ type: "duplicate", draft, existing: duplicates[0].existing }];
  }

  if (draft.confidence >= 75) {
    const txn = await saveDraft(draft);
    return [{ type: "auto_save", transaction: txn }];
  }

  return [{ type: "confirm", draft, question: generateSmartQuestion(draft) }];
}

// ─── Internal: Parse raw input ───

async function parseRawInput(input: string, source: ImportSource): Promise<ParsedTransaction> {
  // Try SMS parser first for SMS-looking text
  if (source === "sms" || /(?:debited|credited|INR|Rs\.)\s/i.test(input)) {
    const sms = parseSMS(input);
    if (sms) {
      return {
        amount: sms.amount,
        type: sms.type === "credit" ? "income" : "expense",
        merchant: sms.merchant,
        date: sms.date || format(new Date(), "yyyy-MM-dd"),
        confidence: sms.confidence,
        rawInput: input,
      };
    }
  }

  // Fall back to NL parser
  return parseNaturalLanguage(input);
}

// ─── Internal: Enrich a draft with intelligence ───

async function enrichDraft(
  parsed: ParsedTransaction,
  rawInput: string,
  source: ImportSource
): Promise<TransactionDraft> {
  const inferences: Inference[] = [];
  let confidence = parsed.confidence || 30;

  // --- Amount ---
  const amount = parsed.amount || 0;
  if (amount > 0) confidence += 10;

  // --- Type ---
  const type = parsed.type || "expense";

  // --- Category (layered inference) ---
  let categoryId = "cat_other";
  let subcategory: string | undefined;

  // Layer 1: Merchant-based (user-learned has priority inside categorizeMerchant)
  if (parsed.merchant) {
    const mc = await categorizeMerchant(parsed.merchant);
    if (mc) {
      categoryId = mc.categoryId;
      subcategory = mc.subcategory;
      confidence = Math.max(confidence, mc.confidence);
      inferences.push({
        field: "category", value: categoryId,
        source: mc.confidence > 85 ? "user_learned" : "merchant_map",
        confidence: mc.confidence,
      });
    }
  }

  // Layer 2: Keyword-based (if merchant didn't match)
  if (categoryId === "cat_other") {
    const kc = await categorizeByKeywords(rawInput);
    if (kc) {
      categoryId = kc.categoryId;
      confidence = Math.max(confidence, kc.confidence);
      inferences.push({ field: "category", value: categoryId, source: "keyword", confidence: kc.confidence });
    }
  }

  // Layer 3: Category from parsed data
  if (categoryId === "cat_other" && parsed.categoryId) {
    categoryId = parsed.categoryId;
  }

  // --- Account inference ---
  let accountId: string | undefined;

  // Check if user has mentioned an account name
  if (parsed.accountName) {
    const accounts = await db.accounts.filter((a) => a.isActive).toArray();
    const match = accounts.find((a) =>
      a.name.toLowerCase().includes(parsed.accountName!.toLowerCase()) ||
      a.bank?.toLowerCase().includes(parsed.accountName!.toLowerCase())
    );
    if (match) {
      accountId = match.id;
      inferences.push({ field: "account", value: match.name, source: "pattern", confidence: 85 });
    }
  }

  // If no account matched, check if the user has a default
  if (!accountId) {
    const prefs = await db.userPreferences.get("default");
    if (prefs?.defaultAccountId) {
      accountId = prefs.defaultAccountId;
      inferences.push({ field: "account", value: accountId, source: "default", confidence: 50 });
    } else {
      // Use most-used account for this category
      const recentTxns = await db.transactions
        .where("categoryId").equals(categoryId)
        .reverse().limit(20).toArray();
      const accountCounts = new Map<string, number>();
      for (const t of recentTxns) {
        if (t.accountId) accountCounts.set(t.accountId, (accountCounts.get(t.accountId) || 0) + 1);
      }
      if (accountCounts.size > 0) {
        const topAccount = [...accountCounts.entries()].sort((a, b) => b[1] - a[1])[0];
        if (topAccount[1] >= 3) { // Only if used 3+ times
          accountId = topAccount[0];
          inferences.push({ field: "account", value: accountId, source: "history", confidence: 60 });
        }
      }
    }
  }

  // --- Person detection ---
  let personId: string | undefined;
  if (parsed.personName) {
    const persons = await db.persons.toArray();
    const match = persons.find((p) => p.name.toLowerCase() === parsed.personName!.toLowerCase());
    if (match) {
      personId = match.id;
      inferences.push({ field: "person", value: match.name, source: "pattern", confidence: 90 });
    }
  }

  // --- Event/Trip detection ---
  let eventId: string | undefined;
  const date = parsed.date || format(new Date(), "yyyy-MM-dd");
  const events = await db.financialEvents.toArray();
  const matchingEvent = events.find((e) => date >= e.startDate && date <= e.endDate);
  if (matchingEvent) {
    eventId = matchingEvent.id;
    inferences.push({ field: "event", value: matchingEvent.name, source: "pattern", confidence: 70 });
  }

  // --- Final confidence ---
  if (amount > 0 && categoryId !== "cat_other") confidence = Math.max(confidence, 75);
  if (amount > 0 && categoryId !== "cat_other" && parsed.merchant) confidence = Math.max(confidence, 85);
  confidence = Math.min(98, confidence);

  return {
    amount, type, categoryId, subcategory, accountId, personId, eventId,
    merchant: parsed.merchant, note: parsed.note, date,
    time: format(new Date(), "HH:mm"),
    importSource: source, confidence, rawInput, inferences,
  };
}

// ─── Internal: Enrich from SMS ───

async function enrichFromSMS(sms: ParsedSMS, rawInput: string): Promise<TransactionDraft> {
  const inferences: Inference[] = [];
  let confidence = sms.confidence;

  // Category from merchant
  let categoryId = "cat_other";
  let subcategory: string | undefined;
  if (sms.merchant) {
    const mc = await categorizeMerchant(sms.merchant);
    if (mc) {
      categoryId = mc.categoryId;
      subcategory = mc.subcategory;
      inferences.push({ field: "category", value: categoryId, source: "merchant_map", confidence: mc.confidence });
    }
  }

  // Account from bank name
  let accountId: string | undefined;
  if (sms.bank) {
    const accounts = await db.accounts.filter((a) => a.isActive).toArray();
    const match = accounts.find((a) =>
      a.bank?.toLowerCase().includes(sms.bank!.toLowerCase()) ||
      a.name.toLowerCase().includes(sms.bank!.toLowerCase())
    );
    if (match) {
      accountId = match.id;
      inferences.push({ field: "account", value: match.name, source: "pattern", confidence: 90 });
    }
  }

  // Card type account matching
  if (!accountId && sms.cardLast4) {
    const accounts = await db.accounts.filter((a) => a.isActive && a.type === "credit_card").toArray();
    // Try to match by last 4 digits in account name
    const match = accounts.find((a) => a.name.includes(sms.cardLast4!));
    if (match) {
      accountId = match.id;
      inferences.push({ field: "account", value: match.name, source: "pattern", confidence: 85 });
    }
  }

  const date = sms.date || format(new Date(), "yyyy-MM-dd");

  return {
    amount: sms.amount,
    type: sms.type === "credit" ? "income" : "expense",
    categoryId, subcategory, accountId,
    merchant: sms.merchant,
    note: sms.upiRef ? `UPI Ref: ${sms.upiRef}` : undefined,
    date, time: sms.time,
    importSource: "sms", confidence, rawInput, inferences,
  };
}

// ─── Smart Question Generator ───

function generateSmartQuestion(draft: TransactionDraft): string {
  // Only ask about the MOST IMPORTANT missing/uncertain field

  if (!draft.amount || draft.amount <= 0) {
    return "How much was this?";
  }

  if (draft.categoryId === "cat_other" && draft.merchant) {
    return `What was ${draft.merchant} for?`;
  }

  if (draft.categoryId === "cat_other") {
    return `What was ₹${draft.amount.toLocaleString("en-IN")} for?`;
  }

  // If we have everything but low confidence on category
  const catInference = draft.inferences.find((i) => i.field === "category");
  if (catInference && catInference.confidence < 70) {
    return "Looks right?";
  }

  return "Looks right?";
}

// ─── Save Draft to DB ───

export async function saveDraft(draft: TransactionDraft): Promise<Transaction> {
  const now = new Date().toISOString();
  const transaction: Transaction = {
    id: generateId(),
    amount: draft.amount,
    type: draft.type,
    categoryId: draft.categoryId,
    subcategory: draft.subcategory,
    accountId: draft.accountId,
    personId: draft.personId,
    eventId: draft.eventId,
    merchant: draft.merchant,
    note: draft.note,
    date: draft.date,
    time: draft.time || format(new Date(), "HH:mm"),
    importSource: draft.importSource,
    confidence: draft.confidence,
    confirmed: draft.confidence >= 80,
    rawInput: draft.rawInput,
    tags: [],
    attachments: [],
    isRecurring: false,
    createdAt: now,
    updatedAt: now,
  };

  await db.transactions.put(transaction);

  // Side effects
  if (draft.accountId) await recomputeAccountBalance(draft.accountId);
  if (draft.personId && (draft.type === "lend" || draft.type === "borrow")) {
    await recomputePersonBalance(draft.personId);
  }
  if (draft.merchant && draft.categoryId) {
    await learnFromCorrection(draft.merchant, draft.categoryId, draft.subcategory);
  }

  // Trigger progressive learning checks (non-blocking)
  checkProgressiveSuggestions().catch(() => {});

  return transaction;
}

// ─── Recompute helpers ───

async function recomputeAccountBalance(accountId: string): Promise<void> {
  const account = await db.accounts.get(accountId);
  if (!account) return;
  const txns = await db.transactions.where("accountId").equals(accountId).toArray();
  let balance = 0;
  for (const t of txns) {
    if (t.type === "income") balance += t.amount;
    else if (["expense", "saving", "investment", "lend"].includes(t.type)) balance -= t.amount;
    else if (["repayment", "borrow"].includes(t.type)) balance += t.amount;
  }
  const incoming = await db.transactions.where("toAccountId").equals(accountId).toArray();
  for (const t of incoming) balance += t.amount;
  await db.accounts.update(accountId, { balance });
}

async function recomputePersonBalance(personId: string): Promise<void> {
  const person = await db.persons.get(personId);
  if (!person) return;
  const txns = await db.transactions.where("personId").equals(personId).toArray();
  let netBalance = 0;
  for (const t of txns) {
    if (t.type === "lend") netBalance += t.amount;
    if (t.type === "borrow") netBalance -= t.amount;
    if (t.type === "repayment") netBalance -= t.amount;
    if (t.type === "settlement") netBalance = 0;
  }
  await db.persons.update(personId, { netBalance });
}

// ─── Progressive Learning / Suggestions ───

export interface SmartSuggestion {
  id: string;
  type: "add_account" | "add_recurring" | "suggest_budget" | "detect_salary" | "create_goal";
  title: string;
  body: string;
  action: string;
  data?: Record<string, unknown>;
}

export async function checkProgressiveSuggestions(): Promise<SmartSuggestion[]> {
  const suggestions: SmartSuggestion[] = [];
  const txnCount = await db.transactions.count();
  if (txnCount < 5) return suggestions; // Not enough data yet

  const allTxns = await db.transactions.toArray();
  const accounts = await db.accounts.filter((a) => a.isActive).toArray();
  const budgets = await db.budgets.filter((b) => b.isActive).toArray();
  const goals = await db.goals.filter((g) => g.isActive).toArray();
  const recurring = await db.recurringTransactions.toArray();

  // 1. Suggest adding an account if a bank name appears 5+ times
  if (accounts.length === 0) {
    const bankCounts = new Map<string, number>();
    for (const t of allTxns) {
      const text = (t.rawInput || t.merchant || "").toLowerCase();
      for (const bank of ["hdfc", "sbi", "icici", "axis", "kotak"]) {
        if (text.includes(bank)) bankCounts.set(bank.toUpperCase(), (bankCounts.get(bank.toUpperCase()) || 0) + 1);
      }
    }
    for (const [bank, count] of bankCounts) {
      if (count >= 5) {
        suggestions.push({
          id: `suggest_account_${bank}`, type: "add_account",
          title: `Add ${bank} as an account?`,
          body: `Most of your transactions mention ${bank}. Adding it helps track per-account spending.`,
          action: `Add ${bank}`, data: { bank },
        });
        break; // Only one account suggestion at a time
      }
    }
  }

  // 2. Detect salary if a large credit appears monthly
  const incomes = allTxns.filter((t) => t.type === "income" && t.amount >= 20000).sort((a, b) => b.amount - a.amount);
  if (incomes.length >= 2) {
    const amounts = incomes.map((t) => t.amount);
    const mostCommon = amounts[0];
    const similar = incomes.filter((t) => Math.abs(t.amount - mostCommon) < mostCommon * 0.1);
    if (similar.length >= 2 && !recurring.some((r) => r.type === "income" && r.name.toLowerCase().includes("salary"))) {
      suggestions.push({
        id: "detect_salary", type: "detect_salary",
        title: "Is this your salary?",
        body: `₹${mostCommon.toLocaleString("en-IN")} appears to arrive regularly. Track it as salary?`,
        action: "Yes, track salary", data: { amount: mostCommon },
      });
    }
  }

  // 3. Suggest budgets after enough spending data
  if (budgets.length === 0 && txnCount >= 15) {
    const catTotals = new Map<string, number>();
    const expenses = allTxns.filter((t) => t.type === "expense");
    for (const t of expenses) catTotals.set(t.categoryId, (catTotals.get(t.categoryId) || 0) + t.amount);
    const topCat = [...catTotals.entries()].sort((a, b) => b[1] - a[1])[0];
    if (topCat) {
      const cat = await db.categories.get(topCat[0]);
      if (cat) {
        const monthlyAvg = Math.round(topCat[1] / Math.max(1, Math.ceil(txnCount / 30)));
        suggestions.push({
          id: "suggest_budget", type: "suggest_budget",
          title: `Set a ${cat.name} budget?`,
          body: `You spend about ₹${monthlyAvg.toLocaleString("en-IN")}/month on ${cat.name.toLowerCase()}.`,
          action: `Use ₹${monthlyAvg.toLocaleString("en-IN")}`,
          data: { categoryId: cat.id, amount: monthlyAvg },
        });
      }
    }
  }

  // 4. Suggest savings goal if user saves regularly
  if (goals.length === 0) {
    const savingTxns = allTxns.filter((t) => t.type === "saving");
    if (savingTxns.length >= 3) {
      const totalSaved = savingTxns.reduce((s, t) => s + t.amount, 0);
      suggestions.push({
        id: "suggest_goal", type: "create_goal",
        title: "Create a savings goal?",
        body: `You've been saving consistently (₹${totalSaved.toLocaleString("en-IN")} so far). Give it a destination.`,
        action: "Create goal",
      });
    }
  }

  // 5. Detect recurring patterns
  if (txnCount >= 20) {
    const merchantCounts = new Map<string, { count: number; amount: number; dates: string[] }>();
    for (const t of allTxns) {
      if (!t.merchant || t.type !== "expense") continue;
      const key = t.merchant.toLowerCase();
      const existing = merchantCounts.get(key) || { count: 0, amount: 0, dates: [] };
      existing.count++;
      existing.amount += t.amount;
      existing.dates.push(t.date);
      merchantCounts.set(key, existing);
    }

    for (const [merchant, data] of merchantCounts) {
      if (data.count >= 3) {
        // Check if amounts are similar (subscription pattern)
        const avgAmount = data.amount / data.count;
        const isConsistent = allTxns
          .filter((t) => t.merchant?.toLowerCase() === merchant && t.type === "expense")
          .every((t) => Math.abs(t.amount - avgAmount) < avgAmount * 0.15);

        if (isConsistent && !recurring.some((r) => r.name.toLowerCase().includes(merchant))) {
          suggestions.push({
            id: `suggest_recurring_${merchant}`, type: "add_recurring",
            title: `${merchant.charAt(0).toUpperCase() + merchant.slice(1)} looks recurring`,
            body: `₹${Math.round(avgAmount).toLocaleString("en-IN")} appears ${data.count} times. Track as a subscription?`,
            action: "Add recurring", data: { merchant, amount: Math.round(avgAmount) },
          });
          break; // One at a time
        }
      }
    }
  }

  return suggestions;
}

// ─── Insights Engine ───

export interface SmartInsight {
  id: string;
  icon: string;
  text: string;
  severity: "positive" | "negative" | "warning" | "info";
}

export async function generateInsights(): Promise<SmartInsight[]> {
  const insights: SmartInsight[] = [];
  const now = new Date();
  const thisMonthStart = format(new Date(now.getFullYear(), now.getMonth(), 1), "yyyy-MM-dd");
  const thisMonthEnd = format(new Date(now.getFullYear(), now.getMonth() + 1, 0), "yyyy-MM-dd");
  const lastMonthStart = format(new Date(now.getFullYear(), now.getMonth() - 1, 1), "yyyy-MM-dd");
  const lastMonthEnd = format(new Date(now.getFullYear(), now.getMonth(), 0), "yyyy-MM-dd");

  const thisTxns = await db.transactions.where("date").between(thisMonthStart, thisMonthEnd, true, true).toArray();
  const lastTxns = await db.transactions.where("date").between(lastMonthStart, lastMonthEnd, true, true).toArray();

  const thisExpense = thisTxns.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const lastExpense = lastTxns.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const thisIncome = thisTxns.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const thisSaved = thisTxns.filter((t) => t.type === "saving" || t.type === "investment").reduce((s, t) => s + t.amount, 0);

  // Spending pace
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const expectedPace = lastExpense > 0 ? (lastExpense / daysInMonth) * dayOfMonth : 0;

  if (lastExpense > 0) {
    const paceRatio = expectedPace > 0 ? thisExpense / expectedPace : 0;
    if (paceRatio < 0.85) {
      insights.push({
        id: "pace_good", icon: "📉",
        text: `You're spending ${Math.round((1 - paceRatio) * 100)}% less than your usual pace. Keep it up.`,
        severity: "positive",
      });
    } else if (paceRatio > 1.15) {
      insights.push({
        id: "pace_high", icon: "📈",
        text: `Spending is ${Math.round((paceRatio - 1) * 100)}% above your normal pace for this point in the month.`,
        severity: "warning",
      });
    }
  }

  // Savings rate
  if (thisIncome > 0) {
    const rate = Math.round((thisSaved / thisIncome) * 100);
    if (rate >= 20) {
      insights.push({ id: "savings_good", icon: "🎯", text: `Saving ${rate}% of income — above the recommended 20%.`, severity: "positive" });
    } else if (rate > 0 && rate < 10) {
      insights.push({ id: "savings_low", icon: "⚡", text: `Only saving ${rate}% of income this month. Consider increasing it.`, severity: "warning" });
    }
  }

  // Category comparison
  const thisCats = new Map<string, number>();
  const lastCats = new Map<string, number>();
  thisTxns.filter((t) => t.type === "expense").forEach((t) => thisCats.set(t.categoryId, (thisCats.get(t.categoryId) || 0) + t.amount));
  lastTxns.filter((t) => t.type === "expense").forEach((t) => lastCats.set(t.categoryId, (lastCats.get(t.categoryId) || 0) + t.amount));

  let biggestIncrease = { catId: "", increase: 0 };
  for (const [catId, amount] of thisCats) {
    const lastAmount = lastCats.get(catId) || 0;
    if (lastAmount > 0) {
      const increase = ((amount - lastAmount) / lastAmount) * 100;
      if (increase > biggestIncrease.increase && increase > 20) {
        biggestIncrease = { catId, increase };
      }
    }
  }
  if (biggestIncrease.catId) {
    const cat = await db.categories.get(biggestIncrease.catId);
    if (cat) {
      insights.push({
        id: "cat_increase", icon: cat.icon,
        text: `${cat.name} spending increased ${Math.round(biggestIncrease.increase)}% compared to last month.`,
        severity: "warning",
      });
    }
  }

  // Weekend spending
  const weekendExpense = thisTxns
    .filter((t) => { const d = new Date(t.date).getDay(); return (d === 0 || d === 6) && t.type === "expense"; })
    .reduce((s, t) => s + t.amount, 0);
  if (thisExpense > 0 && weekendExpense > 0) {
    const weekendPct = Math.round((weekendExpense / thisExpense) * 100);
    if (weekendPct > 40) {
      insights.push({ id: "weekend_high", icon: "🗓️", text: `${weekendPct}% of spending happens on weekends.`, severity: "info" });
    }
  }

  // Forecast
  if (dayOfMonth >= 5 && thisExpense > 0) {
    const projectedMonthly = Math.round((thisExpense / dayOfMonth) * daysInMonth);
    insights.push({
      id: "forecast", icon: "🔮",
      text: `At current pace, you'll spend about ₹${projectedMonthly.toLocaleString("en-IN")} this month.`,
      severity: projectedMonthly > lastExpense * 1.1 ? "warning" : "info",
    });
  }

  return insights;
}
