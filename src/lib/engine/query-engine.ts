/**
 * Production Financial Query Engine.
 * Understands natural language questions about user's financial data.
 * No LLM required — uses intent detection, entity extraction, and DB queries.
 */

import {
  format, startOfMonth, endOfMonth, subMonths, startOfWeek, endOfWeek,
  startOfYear, endOfYear, subWeeks, subDays, isValid, parse,
} from "date-fns";
import { db } from "../db";
import { formatCurrency } from "../utils";
import type { Transaction, Category } from "../types";

export interface QueryResult {
  answer: string;
  data?: { label: string; value: string }[];
  transactions?: Transaction[];
  followUp?: string[];
}

// ─── Intent Detection ───

type Intent =
  | "SPENDING_TOTAL" | "SPENDING_BY_CATEGORY" | "INCOME_TOTAL" | "SAVINGS_TOTAL"
  | "INVESTMENT_TOTAL" | "WHO_OWES_ME" | "WHO_I_OWE" | "DEBT_SUMMARY"
  | "RECURRING_LIST" | "BIGGEST_EXPENSE" | "SMALLEST_EXPENSE" | "BUDGET_STATUS"
  | "GOAL_STATUS" | "BALANCE" | "NET_WORTH" | "CAN_AFFORD" | "SUMMARY"
  | "AVERAGE_SPENDING" | "COMPARE_MONTHS" | "SPENDING_TREND" | "CATEGORY_LIST"
  | "TRANSACTION_COUNT" | "MERCHANT_SPENDING" | "ACCOUNT_SPENDING"
  | "DAILY_SPENDING" | "WEEKEND_SPENDING" | "SAFE_TO_SPEND" | "LIST_TRANSACTIONS"
  | "HELP";

const INTENT_RULES: { patterns: RegExp[]; intent: Intent }[] = [
  { patterns: [/who\s+owes?\s+me/i, /money\s+owed\s+to\s+me/i, /people\s+owe/i], intent: "WHO_OWES_ME" },
  { patterns: [/who\s+do\s+i\s+owe/i, /whom?\s+do\s+i\s+owe/i, /i\s+owe/i], intent: "WHO_I_OWE" },
  { patterns: [/how\s+much.*(?:owe|lent|borrow|debt)/i], intent: "DEBT_SUMMARY" },
  { patterns: [/(?:what|show|list).*(?:subscription|recurring)/i, /my\s+subscriptions/i], intent: "RECURRING_LIST" },
  { patterns: [/biggest|largest|highest|most\s+expensive|top\s+expense/i], intent: "BIGGEST_EXPENSE" },
  { patterns: [/smallest|lowest|cheapest|least\s+expensive/i], intent: "SMALLEST_EXPENSE" },
  { patterns: [/compare|versus|vs\.?\s/i, /difference\s+between/i], intent: "COMPARE_MONTHS" },
  { patterns: [/budget/i], intent: "BUDGET_STATUS" },
  { patterns: [/goal/i], intent: "GOAL_STATUS" },
  { patterns: [/net\s*worth/i], intent: "NET_WORTH" },
  { patterns: [/balance|how\s+much\s+(?:do\s+i\s+)?have/i], intent: "BALANCE" },
  { patterns: [/can\s+i\s+(?:afford|buy|spend)/i, /do\s+i\s+have\s+enough/i], intent: "CAN_AFFORD" },
  { patterns: [/safe\s+to\s+spend/i], intent: "SAFE_TO_SPEND" },
  { patterns: [/average|avg/i], intent: "AVERAGE_SPENDING" },
  { patterns: [/trend|pattern|changing|increasing|decreasing/i], intent: "SPENDING_TREND" },
  { patterns: [/weekend/i], intent: "WEEKEND_SPENDING" },
  { patterns: [/daily|per\s+day/i], intent: "DAILY_SPENDING" },
  { patterns: [/how\s+many\s+transaction/i, /transaction\s+count/i], intent: "TRANSACTION_COUNT" },
  { patterns: [/what.*categor/i, /list.*categor/i, /show.*categor/i], intent: "CATEGORY_LIST" },
  { patterns: [/how\s+much.*(?:save|saved|saving)/i], intent: "SAVINGS_TOTAL" },
  { patterns: [/how\s+much.*(?:invest|invested)/i], intent: "INVESTMENT_TOTAL" },
  { patterns: [/how\s+much.*(?:earn|income|salary|receive|got\s+paid)/i], intent: "INCOME_TOTAL" },
  { patterns: [/how\s+much.*(?:spend|spent|expense|cost)/i], intent: "SPENDING_TOTAL" },
  { patterns: [/(?:summary|overview|report|what\s+happened)/i], intent: "SUMMARY" },
  { patterns: [/show|list|all\s+transaction/i], intent: "LIST_TRANSACTIONS" },
  { patterns: [/help|what\s+can\s+you|how\s+to|what\s+should/i], intent: "HELP" },
];

// ─── Entity Extraction ───

const CATEGORY_KEYWORDS: Record<string, string> = {
  food: "cat_food", eating: "cat_food", restaurant: "cat_food", dinner: "cat_food",
  lunch: "cat_food", breakfast: "cat_food", coffee: "cat_food", snack: "cat_food",
  groceries: "cat_groceries", grocery: "cat_groceries", vegetable: "cat_groceries",
  transport: "cat_transport", cab: "cat_transport", uber: "cat_transport", ola: "cat_transport",
  auto: "cat_transport", metro: "cat_transport", bus: "cat_transport",
  shopping: "cat_shopping", clothes: "cat_shopping", amazon: "cat_shopping", flipkart: "cat_shopping",
  bills: "cat_bills", recharge: "cat_bills", phone: "cat_bills",
  rent: "cat_rent", utilities: "cat_utilities", electricity: "cat_utilities",
  entertainment: "cat_entertainment", movie: "cat_entertainment", netflix: "cat_entertainment",
  health: "cat_healthcare", medical: "cat_healthcare", doctor: "cat_healthcare",
  education: "cat_education", college: "cat_education", course: "cat_education",
  subscription: "cat_subscriptions", fuel: "cat_fuel", petrol: "cat_fuel",
  travel: "cat_travel", trip: "cat_travel", flight: "cat_travel",
  gift: "cat_gifts", insurance: "cat_insurance", emi: "cat_emi",
  personal: "cat_personal", investment: "cat_investments", saving: "cat_savings",
};

const MERCHANT_NAMES = [
  "swiggy", "zomato", "amazon", "flipkart", "uber", "ola", "netflix",
  "spotify", "bigbasket", "blinkit", "zepto", "myntra", "airtel", "jio",
  "starbucks", "dominos", "mcdonalds", "rapido", "dunzo", "phonepe",
  "paytm", "gpay", "cred",
];

function extractPeriod(text: string): { start: string; end: string; label: string } {
  const now = new Date();
  const lower = text.toLowerCase();

  if (/today/i.test(lower)) {
    const d = format(now, "yyyy-MM-dd");
    return { start: d, end: d, label: "today" };
  }
  if (/yesterday/i.test(lower)) {
    const d = format(subDays(now, 1), "yyyy-MM-dd");
    return { start: d, end: d, label: "yesterday" };
  }
  if (/this\s+week/i.test(lower)) {
    return { start: format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"), end: format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"), label: "this week" };
  }
  if (/last\s+week/i.test(lower)) {
    const lw = subWeeks(now, 1);
    return { start: format(startOfWeek(lw, { weekStartsOn: 1 }), "yyyy-MM-dd"), end: format(endOfWeek(lw, { weekStartsOn: 1 }), "yyyy-MM-dd"), label: "last week" };
  }
  if (/last\s+month|previous\s+month/i.test(lower)) {
    const pm = subMonths(now, 1);
    return { start: format(startOfMonth(pm), "yyyy-MM-dd"), end: format(endOfMonth(pm), "yyyy-MM-dd"), label: format(pm, "MMMM") };
  }
  if (/this\s+year/i.test(lower)) {
    return { start: format(startOfYear(now), "yyyy-MM-dd"), end: format(endOfYear(now), "yyyy-MM-dd"), label: "this year" };
  }
  if (/last\s+(\d+)\s+days/i.test(lower)) {
    const m = lower.match(/last\s+(\d+)\s+days/i);
    const days = parseInt(m![1]);
    return { start: format(subDays(now, days), "yyyy-MM-dd"), end: format(now, "yyyy-MM-dd"), label: `last ${days} days` };
  }

  // Named months
  const months = ["january","february","march","april","may","june","july","august","september","october","november","december"];
  for (let i = 0; i < months.length; i++) {
    if (lower.includes(months[i]) || lower.includes(months[i].slice(0, 3))) {
      const date = new Date(now.getFullYear(), i, 1);
      return { start: format(startOfMonth(date), "yyyy-MM-dd"), end: format(endOfMonth(date), "yyyy-MM-dd"), label: months[i] };
    }
  }

  // Default: current month
  return { start: format(startOfMonth(now), "yyyy-MM-dd"), end: format(endOfMonth(now), "yyyy-MM-dd"), label: format(now, "MMMM") };
}

function extractCategory(text: string): string | null {
  const lower = text.toLowerCase();
  for (const [keyword, catId] of Object.entries(CATEGORY_KEYWORDS)) {
    if (lower.includes(keyword)) return catId;
  }
  return null;
}

function extractMerchant(text: string): string | null {
  const lower = text.toLowerCase();
  return MERCHANT_NAMES.find((m) => lower.includes(m)) || null;
}

function extractAmount(text: string): number | null {
  const match = text.match(/(?:₹|rs\.?|inr)?\s*(\d[\d,]*(?:\.\d{1,2})?)/i);
  return match ? parseFloat(match[1].replace(/,/g, "")) : null;
}

function extractPerson(text: string): string | null {
  const patterns = [
    /(?:with|to|from)\s+([A-Z][a-z]+)/,
    /([A-Z][a-z]+)\s+(?:owes?|paid|lent)/,
  ];
  const skip = new Set(["How", "What", "When", "Where", "Which", "Show", "List", "Tell", "Did", "Does", "Can", "Will"]);
  for (const p of patterns) {
    const m = text.match(p);
    if (m && !skip.has(m[1])) return m[1];
  }
  return null;
}

function detectIntent(text: string): Intent {
  for (const rule of INTENT_RULES) {
    if (rule.patterns.some((p) => p.test(text))) return rule.intent;
  }
  // If there's a category keyword, it's probably a spending query
  if (extractCategory(text)) return "SPENDING_BY_CATEGORY";
  if (extractMerchant(text)) return "MERCHANT_SPENDING";
  return "SPENDING_TOTAL";
}

// ─── Query Execution ───

export async function executeQuery(text: string): Promise<QueryResult> {
  const intent = detectIntent(text);
  const period = extractPeriod(text);
  const category = extractCategory(text);
  const merchant = extractMerchant(text);
  const personName = extractPerson(text);
  const amount = extractAmount(text);

  const txns = await db.transactions.where("date").between(period.start, period.end, true, true).toArray();
  const categories = await db.categories.toArray();
  const catMap = new Map(categories.map((c) => [c.id, c]));

  const getCatName = (id: string) => catMap.get(id)?.name || id;

  switch (intent) {
    case "HELP":
      return {
        answer: "I can answer questions about your finances. Try asking about spending, income, savings, budgets, goals, who owes you, subscriptions, or comparing months.",
        followUp: ["How much did I spend this month?", "Who owes me money?", "What are my subscriptions?", "Compare this month with last month", "Am I within my food budget?"],
      };

    case "SPENDING_TOTAL":
    case "SPENDING_BY_CATEGORY": {
      let filtered = txns.filter((t) => t.type === "expense");
      let label = "total";

      if (category) {
        filtered = filtered.filter((t) => t.categoryId === category);
        label = getCatName(category).toLowerCase();
      }
      if (merchant) {
        filtered = filtered.filter((t) => t.merchant?.toLowerCase().includes(merchant));
        label = merchant;
      }
      if (personName) {
        const person = (await db.persons.toArray()).find((p) => p.name.toLowerCase() === personName.toLowerCase());
        if (person) { filtered = filtered.filter((t) => t.personId === person.id); label = `with ${person.name}`; }
      }

      const total = filtered.reduce((s, t) => s + t.amount, 0);
      const count = filtered.length;

      // Category breakdown if no specific category
      const breakdown: { label: string; value: string }[] = [];
      if (!category && !merchant) {
        const catTotals = new Map<string, number>();
        filtered.forEach((t) => catTotals.set(t.categoryId, (catTotals.get(t.categoryId) || 0) + t.amount));
        Array.from(catTotals.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .forEach(([id, amt]) => {
            const cat = catMap.get(id);
            breakdown.push({ label: `${cat?.icon || ""} ${cat?.name || id}`, value: formatCurrency(amt) });
          });
      }

      return {
        answer: total > 0
          ? `You spent ${formatCurrency(total)} on ${label} in ${period.label} across ${count} transactions.`
          : `No spending on ${label} found in ${period.label}.`,
        data: breakdown.length > 0 ? [{ label: "Total", value: formatCurrency(total) }, ...breakdown] : [{ label: "Total", value: formatCurrency(total) }, { label: "Transactions", value: String(count) }],
        transactions: filtered.sort((a, b) => b.amount - a.amount).slice(0, 5),
        followUp: category ? undefined : ["Break it down by category", "What's my biggest expense?", "Compare with last month"],
      };
    }

    case "MERCHANT_SPENDING": {
      const filtered = txns.filter((t) => t.merchant?.toLowerCase().includes(merchant || ""));
      const total = filtered.reduce((s, t) => s + t.amount, 0);
      return {
        answer: `You spent ${formatCurrency(total)} at ${merchant} in ${period.label} (${filtered.length} transactions).`,
        data: [{ label: `${merchant} total`, value: formatCurrency(total) }],
        transactions: filtered.sort((a, b) => b.amount - a.amount).slice(0, 5),
      };
    }

    case "INCOME_TOTAL": {
      const income = txns.filter((t) => t.type === "income");
      const total = income.reduce((s, t) => s + t.amount, 0);
      return {
        answer: total > 0 ? `Your income in ${period.label} is ${formatCurrency(total)} from ${income.length} sources.` : `No income recorded in ${period.label}.`,
        data: income.slice(0, 5).map((t) => ({ label: t.merchant || t.note || getCatName(t.categoryId), value: formatCurrency(t.amount) })),
      };
    }

    case "SAVINGS_TOTAL": {
      const saved = txns.filter((t) => t.type === "saving").reduce((s, t) => s + t.amount, 0);
      const invested = txns.filter((t) => t.type === "investment").reduce((s, t) => s + t.amount, 0);
      const income = txns.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
      const rate = income > 0 ? Math.round(((saved + invested) / income) * 100) : 0;
      return {
        answer: `You saved ${formatCurrency(saved)} and invested ${formatCurrency(invested)} in ${period.label}${income > 0 ? ` — that's ${rate}% of your income.` : "."}`,
        data: [{ label: "Saved", value: formatCurrency(saved) }, { label: "Invested", value: formatCurrency(invested) }, { label: "Savings rate", value: `${rate}%` }],
      };
    }

    case "INVESTMENT_TOTAL": {
      const total = txns.filter((t) => t.type === "investment").reduce((s, t) => s + t.amount, 0);
      return { answer: `You invested ${formatCurrency(total)} in ${period.label}.` };
    }

    case "WHO_OWES_ME": {
      const persons = await db.persons.filter((p) => p.netBalance > 0).toArray();
      if (persons.length === 0) return { answer: "No one owes you money right now. 🎉" };
      const total = persons.reduce((s, p) => s + p.netBalance, 0);
      return {
        answer: `${persons.length} ${persons.length === 1 ? "person owes" : "people owe"} you a total of ${formatCurrency(total)}.`,
        data: persons.sort((a, b) => b.netBalance - a.netBalance).map((p) => ({ label: p.name, value: `+${formatCurrency(p.netBalance)}` })),
        followUp: ["Who do I owe?", "What's the total debt?"],
      };
    }

    case "WHO_I_OWE": {
      const persons = await db.persons.filter((p) => p.netBalance < 0).toArray();
      if (persons.length === 0) return { answer: "You don't owe anyone money. ✓" };
      const total = persons.reduce((s, p) => s + Math.abs(p.netBalance), 0);
      return {
        answer: `You owe ${formatCurrency(total)} to ${persons.length} ${persons.length === 1 ? "person" : "people"}.`,
        data: persons.map((p) => ({ label: p.name, value: `−${formatCurrency(Math.abs(p.netBalance))}` })),
      };
    }

    case "DEBT_SUMMARY": {
      const persons = await db.persons.toArray();
      const owed = persons.filter((p) => p.netBalance > 0).reduce((s, p) => s + p.netBalance, 0);
      const owe = persons.filter((p) => p.netBalance < 0).reduce((s, p) => s + Math.abs(p.netBalance), 0);
      return {
        answer: `People owe you ${formatCurrency(owed)}. You owe ${formatCurrency(owe)}. Net: ${owed >= owe ? "+" : "−"}${formatCurrency(Math.abs(owed - owe))}.`,
        data: [{ label: "Owed to you", value: `+${formatCurrency(owed)}` }, { label: "You owe", value: `−${formatCurrency(owe)}` }, { label: "Net", value: formatCurrency(owed - owe) }],
      };
    }

    case "RECURRING_LIST": {
      const rec = await db.recurringTransactions.filter((r) => !r.isPaused).toArray();
      const monthly = rec.reduce((s, r) => {
        if (r.frequency === "monthly") return s + r.amount;
        if (r.frequency === "weekly") return s + r.amount * 4;
        if (r.frequency === "yearly") return s + r.amount / 12;
        return s + r.amount;
      }, 0);
      return {
        answer: rec.length > 0
          ? `You have ${rec.length} active recurring payments totaling ~${formatCurrency(monthly)}/month.`
          : "You don't have any active recurring payments tracked.",
        data: rec.sort((a, b) => b.amount - a.amount).map((r) => ({ label: r.name, value: `${formatCurrency(r.amount)}/${r.frequency}` })),
      };
    }

    case "BIGGEST_EXPENSE": {
      const expenses = txns.filter((t) => t.type === "expense").sort((a, b) => b.amount - a.amount);
      if (expenses.length === 0) return { answer: `No expenses in ${period.label}.` };
      const top = expenses[0];
      return {
        answer: `Your biggest expense in ${period.label} was ${formatCurrency(top.amount)}${top.merchant ? ` at ${top.merchant}` : ""} on ${top.date} (${getCatName(top.categoryId)}).`,
        data: expenses.slice(0, 5).map((t) => ({ label: t.merchant || t.note || getCatName(t.categoryId), value: formatCurrency(t.amount) })),
        transactions: expenses.slice(0, 5),
      };
    }

    case "BUDGET_STATUS": {
      const budgets = await db.budgets.filter((b) => b.isActive).toArray();
      if (budgets.length === 0) return { answer: "You haven't set up any budgets yet. Go to Budgets to create one.", followUp: ["How much did I spend this month?"] };
      const data = budgets.map((b) => {
        const spent = txns.filter((t) => t.type === "expense" && (!b.categoryId || t.categoryId === b.categoryId)).reduce((s, t) => s + t.amount, 0);
        const pct = Math.round((spent / b.amount) * 100);
        const status = pct >= 100 ? "⚠️ Over!" : pct >= 80 ? "⚡ Almost" : "✅ OK";
        return { label: `${status} ${b.name}`, value: `${formatCurrency(spent)} / ${formatCurrency(b.amount)} (${pct}%)` };
      });
      return { answer: `You have ${budgets.length} active budgets.`, data };
    }

    case "GOAL_STATUS": {
      const goals = await db.goals.filter((g) => g.isActive).toArray();
      if (goals.length === 0) return { answer: "You haven't set up any savings goals yet.", followUp: ["How much did I save?"] };
      return {
        answer: `You have ${goals.length} active goals.`,
        data: goals.map((g) => {
          const pct = Math.round((g.currentAmount / g.targetAmount) * 100);
          return { label: `${g.icon || "🎯"} ${g.name}`, value: `${pct}% (${formatCurrency(g.currentAmount)} / ${formatCurrency(g.targetAmount)})` };
        }),
      };
    }

    case "BALANCE":
    case "NET_WORTH": {
      const accounts = await db.accounts.filter((a) => a.isActive).toArray();
      const total = accounts.reduce((s, a) => s + a.balance, 0);
      return {
        answer: `Your total balance across ${accounts.length} accounts is ${formatCurrency(total)}.`,
        data: accounts.map((a) => ({ label: `${a.icon || "🏦"} ${a.name}`, value: formatCurrency(a.balance) })),
        followUp: ["How much did I spend this month?", "What's my savings rate?"],
      };
    }

    case "CAN_AFFORD": {
      if (!amount) return { answer: "Tell me the amount — e.g., 'Can I afford ₹15,000?'" };
      const income = txns.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
      const expense = txns.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
      const available = income - expense;
      const after = available - amount;
      return {
        answer: after >= 0
          ? `Yes — you have ${formatCurrency(available)} available this month. After ${formatCurrency(amount)}, you'd have ${formatCurrency(after)} left.`
          : `It would be tight. You have ${formatCurrency(available)} available, but ${formatCurrency(amount)} would put you ${formatCurrency(Math.abs(after))} over.`,
        data: [{ label: "Available", value: formatCurrency(available) }, { label: "After purchase", value: formatCurrency(after) }],
      };
    }

    case "SAFE_TO_SPEND": {
      const now = new Date();
      const daysLeft = Math.max(1, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate() + 1);
      const income = txns.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
      const expense = txns.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
      const saving = txns.filter((t) => t.type === "saving" || t.type === "investment").reduce((s, t) => s + t.amount, 0);
      const safe = Math.max(0, Math.round((income - expense - saving) / daysLeft));
      return {
        answer: `You can safely spend about ${formatCurrency(safe)} per day for the rest of the month (${daysLeft} days left).`,
        data: [{ label: "Safe daily spend", value: formatCurrency(safe) }, { label: "Days remaining", value: String(daysLeft) }],
      };
    }

    case "AVERAGE_SPENDING": {
      const expenses = txns.filter((t) => t.type === "expense");
      const uniqueDays = new Set(expenses.map((t) => t.date)).size;
      const total = expenses.reduce((s, t) => s + t.amount, 0);
      const avg = uniqueDays > 0 ? Math.round(total / uniqueDays) : 0;
      return {
        answer: `Your average daily spending in ${period.label} is ${formatCurrency(avg)} (${formatCurrency(total)} over ${uniqueDays} days).`,
        data: [{ label: "Average/day", value: formatCurrency(avg) }, { label: "Total", value: formatCurrency(total) }, { label: "Active days", value: String(uniqueDays) }],
      };
    }

    case "COMPARE_MONTHS": {
      const now = new Date();
      const cm = { start: format(startOfMonth(now), "yyyy-MM-dd"), end: format(endOfMonth(now), "yyyy-MM-dd") };
      const pm = subMonths(now, 1);
      const pmRange = { start: format(startOfMonth(pm), "yyyy-MM-dd"), end: format(endOfMonth(pm), "yyyy-MM-dd") };
      const prevTxns = await db.transactions.where("date").between(pmRange.start, pmRange.end, true, true).toArray();

      const curExp = txns.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
      const prevExp = prevTxns.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
      const curInc = txns.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
      const prevInc = prevTxns.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
      const change = prevExp > 0 ? Math.round(((curExp - prevExp) / prevExp) * 100) : 0;

      return {
        answer: `${format(now, "MMMM")}: ${formatCurrency(curExp)} spent vs ${format(pm, "MMMM")}: ${formatCurrency(prevExp)}. ${change > 0 ? `That's ${change}% more.` : change < 0 ? `That's ${Math.abs(change)}% less — nice!` : "About the same."}`,
        data: [
          { label: `${format(now, "MMM")} expenses`, value: formatCurrency(curExp) },
          { label: `${format(pm, "MMM")} expenses`, value: formatCurrency(prevExp) },
          { label: "Change", value: `${change > 0 ? "+" : ""}${change}%` },
          { label: `${format(now, "MMM")} income`, value: formatCurrency(curInc) },
          { label: `${format(pm, "MMM")} income`, value: formatCurrency(prevInc) },
        ],
      };
    }

    case "WEEKEND_SPENDING": {
      const weekendTxns = txns.filter((t) => {
        const day = new Date(t.date).getDay();
        return (day === 0 || day === 6) && t.type === "expense";
      });
      const total = weekendTxns.reduce((s, t) => s + t.amount, 0);
      const allExpense = txns.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
      const pct = allExpense > 0 ? Math.round((total / allExpense) * 100) : 0;
      return {
        answer: `You spent ${formatCurrency(total)} on weekends in ${period.label} — that's ${pct}% of your total spending.`,
        data: [{ label: "Weekend spending", value: formatCurrency(total) }, { label: "% of total", value: `${pct}%` }],
        transactions: weekendTxns.sort((a, b) => b.amount - a.amount).slice(0, 5),
      };
    }

    case "SUMMARY": {
      const income = txns.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
      const expense = txns.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
      const saving = txns.filter((t) => t.type === "saving").reduce((s, t) => s + t.amount, 0);
      const invest = txns.filter((t) => t.type === "investment").reduce((s, t) => s + t.amount, 0);
      const net = income - expense - saving - invest;
      return {
        answer: `Here's your ${period.label} summary: earned ${formatCurrency(income)}, spent ${formatCurrency(expense)}, saved ${formatCurrency(saving)}, invested ${formatCurrency(invest)}. Net: ${formatCurrency(net)}.`,
        data: [
          { label: "💰 Income", value: formatCurrency(income) },
          { label: "💸 Expenses", value: formatCurrency(expense) },
          { label: "🏦 Saved", value: formatCurrency(saving) },
          { label: "📈 Invested", value: formatCurrency(invest) },
          { label: "📊 Net", value: formatCurrency(net) },
        ],
        followUp: ["Break down by category", "What's my biggest expense?", "Compare with last month"],
      };
    }

    case "TRANSACTION_COUNT": {
      return { answer: `You have ${txns.length} transactions in ${period.label}.` };
    }

    case "CATEGORY_LIST": {
      const catTotals = new Map<string, number>();
      txns.filter((t) => t.type === "expense").forEach((t) => catTotals.set(t.categoryId, (catTotals.get(t.categoryId) || 0) + t.amount));
      const sorted = Array.from(catTotals.entries()).sort((a, b) => b[1] - a[1]);
      return {
        answer: `Your spending is spread across ${sorted.length} categories in ${period.label}.`,
        data: sorted.slice(0, 10).map(([id, amt]) => {
          const cat = catMap.get(id);
          return { label: `${cat?.icon || ""} ${cat?.name || id}`, value: formatCurrency(amt) };
        }),
      };
    }

    case "LIST_TRANSACTIONS": {
      let filtered = txns;
      if (category) filtered = filtered.filter((t) => t.categoryId === category);
      if (merchant) filtered = filtered.filter((t) => t.merchant?.toLowerCase().includes(merchant));
      return {
        answer: `Showing ${filtered.length} transactions from ${period.label}.`,
        transactions: filtered.sort((a, b) => b.date.localeCompare(a.date) || (b.time || "").localeCompare(a.time || "")).slice(0, 10),
      };
    }

    default:
      return {
        answer: "I'm not sure what you're asking. Try something like 'How much did I spend on food?' or 'Who owes me money?'",
        followUp: ["How much did I spend this month?", "Who owes me?", "What's my balance?", "Show my budgets"],
      };
  }
}
