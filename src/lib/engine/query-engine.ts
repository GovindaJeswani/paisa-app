import { format, startOfMonth, endOfMonth, subMonths, startOfWeek, endOfWeek, startOfYear, endOfYear } from "date-fns";
import { db } from "../db";
import { formatCurrency } from "../utils";
import type { Transaction } from "../types";

export interface QueryResult {
  answer: string;
  data?: { label: string; value: string }[];
  transactions?: Transaction[];
}

interface ParsedQuery {
  intent: string;
  category?: string;
  person?: string;
  account?: string;
  period?: { start: string; end: string };
  merchant?: string;
  amount?: number;
}

// Intent patterns
const INTENT_PATTERNS: { pattern: RegExp; intent: string }[] = [
  { pattern: /how much.*(spend|spent|expense)/i, intent: "SPENDING_TOTAL" },
  { pattern: /how much.*(earn|income|salary|receive)/i, intent: "INCOME_TOTAL" },
  { pattern: /how much.*(save|saved|saving)/i, intent: "SAVINGS_TOTAL" },
  { pattern: /how much.*(invest|invested)/i, intent: "INVESTMENT_TOTAL" },
  { pattern: /how much.*(owe|owes|lent|borrow)/i, intent: "DEBT_SUMMARY" },
  { pattern: /who owes me/i, intent: "WHO_OWES_ME" },
  { pattern: /who do i owe/i, intent: "WHO_I_OWE" },
  { pattern: /what.*(subscript|recurring)/i, intent: "RECURRING_LIST" },
  { pattern: /biggest|largest|highest|most expensive/i, intent: "BIGGEST_EXPENSE" },
  { pattern: /smallest|lowest|cheapest|least/i, intent: "SMALLEST_EXPENSE" },
  { pattern: /compare|versus|vs/i, intent: "COMPARE_MONTHS" },
  { pattern: /budget/i, intent: "BUDGET_STATUS" },
  { pattern: /goal/i, intent: "GOAL_STATUS" },
  { pattern: /balance|net worth/i, intent: "BALANCE" },
  { pattern: /can i afford|can i buy/i, intent: "CAN_AFFORD" },
  { pattern: /what happened|summary|overview/i, intent: "SUMMARY" },
  { pattern: /show.*(all|every)|list/i, intent: "LIST_TRANSACTIONS" },
  { pattern: /average|avg/i, intent: "AVERAGE_SPENDING" },
  { pattern: /total/i, intent: "SPENDING_TOTAL" },
];

// Category keywords
const CATEGORY_KEYWORDS: Record<string, string> = {
  food: "cat_food", groceries: "cat_groceries", transport: "cat_transport",
  shopping: "cat_shopping", bills: "cat_bills", rent: "cat_rent",
  utilities: "cat_utilities", entertainment: "cat_entertainment",
  healthcare: "cat_healthcare", education: "cat_education",
  subscriptions: "cat_subscriptions", fuel: "cat_fuel", travel: "cat_travel",
  personal: "cat_personal", gifts: "cat_gifts", insurance: "cat_insurance",
};

// Period parsing
function parsePeriod(text: string): { start: string; end: string } {
  const now = new Date();
  const lower = text.toLowerCase();

  if (lower.includes("this month") || lower.includes("current month")) {
    return { start: format(startOfMonth(now), "yyyy-MM-dd"), end: format(endOfMonth(now), "yyyy-MM-dd") };
  }
  if (lower.includes("last month") || lower.includes("previous month")) {
    const prev = subMonths(now, 1);
    return { start: format(startOfMonth(prev), "yyyy-MM-dd"), end: format(endOfMonth(prev), "yyyy-MM-dd") };
  }
  if (lower.includes("this week")) {
    return { start: format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"), end: format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd") };
  }
  if (lower.includes("this year") || lower.includes("current year")) {
    return { start: format(startOfYear(now), "yyyy-MM-dd"), end: format(endOfYear(now), "yyyy-MM-dd") };
  }
  if (lower.includes("today")) {
    const d = format(now, "yyyy-MM-dd");
    return { start: d, end: d };
  }
  if (lower.includes("yesterday")) {
    const d = format(new Date(now.getTime() - 86400000), "yyyy-MM-dd");
    return { start: d, end: d };
  }

  // Month names
  const months = ["january","february","march","april","may","june","july","august","september","october","november","december"];
  for (let i = 0; i < months.length; i++) {
    if (lower.includes(months[i]) || lower.includes(months[i].slice(0, 3))) {
      const year = now.getFullYear();
      const date = new Date(year, i, 1);
      return { start: format(startOfMonth(date), "yyyy-MM-dd"), end: format(endOfMonth(date), "yyyy-MM-dd") };
    }
  }

  // Default: this month
  return { start: format(startOfMonth(now), "yyyy-MM-dd"), end: format(endOfMonth(now), "yyyy-MM-dd") };
}

function parseQuery(text: string): ParsedQuery {
  const lower = text.toLowerCase();

  // Intent
  let intent = "SPENDING_TOTAL";
  for (const { pattern, intent: i } of INTENT_PATTERNS) {
    if (pattern.test(lower)) { intent = i; break; }
  }

  // Category
  let category: string | undefined;
  for (const [keyword, catId] of Object.entries(CATEGORY_KEYWORDS)) {
    if (lower.includes(keyword)) { category = catId; break; }
  }

  // Person
  const personMatch = lower.match(/(?:with|to|from|owes?)\s+([a-z]+)/i);
  const person = personMatch ? personMatch[1] : undefined;

  // Account
  const accountKeywords: Record<string, string> = { hdfc: "HDFC", sbi: "SBI", icici: "ICICI", cash: "Cash", credit: "Credit" };
  let account: string | undefined;
  for (const [kw, val] of Object.entries(accountKeywords)) {
    if (lower.includes(kw)) { account = val; break; }
  }

  // Merchant
  const merchants = ["swiggy","zomato","amazon","flipkart","uber","ola","netflix","spotify"];
  const merchant = merchants.find((m) => lower.includes(m));

  // Amount (for "can I afford")
  const amountMatch = lower.match(/(\d[\d,]*)/);
  const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, "")) : undefined;

  return { intent, category, person, account, period: parsePeriod(text), merchant, amount };
}

export async function executeQuery(text: string): Promise<QueryResult> {
  const q = parseQuery(text);
  const { start, end } = q.period!;

  const allTxns = await db.transactions.where("date").between(start, end, true, true).toArray();

  switch (q.intent) {
    case "SPENDING_TOTAL": {
      let txns = allTxns.filter((t) => t.type === "expense");
      if (q.category) txns = txns.filter((t) => t.categoryId === q.category);
      if (q.merchant) txns = txns.filter((t) => t.merchant?.toLowerCase().includes(q.merchant!));
      if (q.account) txns = txns.filter((t) => t.accountId?.includes(q.account!));
      const total = txns.reduce((s, t) => s + t.amount, 0);
      const catName = q.category ? (await db.categories.get(q.category))?.name : null;
      const label = q.merchant || catName || q.account || "total";
      return {
        answer: `You spent ${formatCurrency(total)} on ${label} (${txns.length} transactions).`,
        data: [{ label: "Total spent", value: formatCurrency(total) }, { label: "Transactions", value: String(txns.length) }],
        transactions: txns.slice(0, 10),
      };
    }

    case "INCOME_TOTAL": {
      const total = allTxns.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
      return { answer: `Your total income is ${formatCurrency(total)}.`, data: [{ label: "Total income", value: formatCurrency(total) }] };
    }

    case "SAVINGS_TOTAL": {
      const total = allTxns.filter((t) => t.type === "saving").reduce((s, t) => s + t.amount, 0);
      return { answer: `You saved ${formatCurrency(total)}.`, data: [{ label: "Total saved", value: formatCurrency(total) }] };
    }

    case "INVESTMENT_TOTAL": {
      const total = allTxns.filter((t) => t.type === "investment").reduce((s, t) => s + t.amount, 0);
      return { answer: `You invested ${formatCurrency(total)}.`, data: [{ label: "Total invested", value: formatCurrency(total) }] };
    }

    case "WHO_OWES_ME": {
      const persons = await db.persons.filter((p) => p.netBalance > 0).toArray();
      if (persons.length === 0) return { answer: "No one owes you money right now." };
      const total = persons.reduce((s, p) => s + p.netBalance, 0);
      return {
        answer: `${persons.length} people owe you a total of ${formatCurrency(total)}.`,
        data: persons.map((p) => ({ label: p.name, value: `+${formatCurrency(p.netBalance)}` })),
      };
    }

    case "WHO_I_OWE": {
      const persons = await db.persons.filter((p) => p.netBalance < 0).toArray();
      if (persons.length === 0) return { answer: "You don't owe anyone money." };
      const total = persons.reduce((s, p) => s + Math.abs(p.netBalance), 0);
      return {
        answer: `You owe ${formatCurrency(total)} to ${persons.length} people.`,
        data: persons.map((p) => ({ label: p.name, value: `−${formatCurrency(Math.abs(p.netBalance))}` })),
      };
    }

    case "DEBT_SUMMARY": {
      const persons = await db.persons.toArray();
      const owed = persons.filter((p) => p.netBalance > 0).reduce((s, p) => s + p.netBalance, 0);
      const owe = persons.filter((p) => p.netBalance < 0).reduce((s, p) => s + Math.abs(p.netBalance), 0);
      return {
        answer: `People owe you ${formatCurrency(owed)}. You owe ${formatCurrency(owe)}.`,
        data: [{ label: "Owed to you", value: formatCurrency(owed) }, { label: "You owe", value: formatCurrency(owe) }],
      };
    }

    case "RECURRING_LIST": {
      const recurring = await db.recurringTransactions.filter((r) => !r.isPaused).toArray();
      const total = recurring.reduce((s, r) => s + r.amount, 0);
      return {
        answer: `You have ${recurring.length} active recurring payments totaling ${formatCurrency(total)}/month.`,
        data: recurring.map((r) => ({ label: r.name, value: formatCurrency(r.amount) })),
      };
    }

    case "BIGGEST_EXPENSE": {
      const expenses = allTxns.filter((t) => t.type === "expense").sort((a, b) => b.amount - a.amount);
      if (expenses.length === 0) return { answer: "No expenses found for this period." };
      const top = expenses[0];
      return {
        answer: `Your biggest expense was ${formatCurrency(top.amount)} ${top.merchant ? `at ${top.merchant}` : ""} on ${top.date}.`,
        transactions: expenses.slice(0, 5),
      };
    }

    case "BUDGET_STATUS": {
      const budgets = await db.budgets.filter((b) => b.isActive).toArray();
      if (budgets.length === 0) return { answer: "You haven't set up any budgets yet." };
      const data = [];
      for (const b of budgets) {
        const spent = allTxns.filter((t) => t.type === "expense" && (!b.categoryId || t.categoryId === b.categoryId)).reduce((s, t) => s + t.amount, 0);
        data.push({ label: b.name, value: `${formatCurrency(spent)} / ${formatCurrency(b.amount)} (${Math.round((spent / b.amount) * 100)}%)` });
      }
      return { answer: `You have ${budgets.length} active budgets.`, data };
    }

    case "GOAL_STATUS": {
      const goals = await db.goals.filter((g) => g.isActive).toArray();
      if (goals.length === 0) return { answer: "You haven't set up any goals yet." };
      return {
        answer: `You have ${goals.length} active goals.`,
        data: goals.map((g) => ({ label: `${g.icon || "🎯"} ${g.name}`, value: `${formatCurrency(g.currentAmount)} / ${formatCurrency(g.targetAmount)} (${Math.round((g.currentAmount / g.targetAmount) * 100)}%)` })),
      };
    }

    case "BALANCE": {
      const accounts = await db.accounts.filter((a) => a.isActive).toArray();
      const total = accounts.reduce((s, a) => s + a.balance, 0);
      return {
        answer: `Your total balance across ${accounts.length} accounts is ${formatCurrency(total)}.`,
        data: accounts.map((a) => ({ label: `${a.icon || "🏦"} ${a.name}`, value: formatCurrency(a.balance) })),
      };
    }

    case "CAN_AFFORD": {
      if (!q.amount) return { answer: "Please mention the amount you want to check." };
      const income = allTxns.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
      const expense = allTxns.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
      const available = income - expense;
      const canAfford = available >= q.amount;
      return {
        answer: canAfford
          ? `Yes, you can. You have ${formatCurrency(available)} available this month, and ${formatCurrency(q.amount)} would leave you with ${formatCurrency(available - q.amount)}.`
          : `It would be tight. You have ${formatCurrency(available)} available, but ${formatCurrency(q.amount)} would put you ${formatCurrency(q.amount - available)} over.`,
        data: [{ label: "Available", value: formatCurrency(available) }, { label: "Item cost", value: formatCurrency(q.amount) }],
      };
    }

    case "AVERAGE_SPENDING": {
      const expenses = allTxns.filter((t) => t.type === "expense");
      const uniqueDays = new Set(expenses.map((t) => t.date)).size;
      const total = expenses.reduce((s, t) => s + t.amount, 0);
      const avg = uniqueDays > 0 ? total / uniqueDays : 0;
      return { answer: `Your average daily spending is ${formatCurrency(avg)} (${formatCurrency(total)} over ${uniqueDays} days).` };
    }

    case "SUMMARY": {
      const income = allTxns.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
      const expense = allTxns.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
      const saving = allTxns.filter((t) => t.type === "saving").reduce((s, t) => s + t.amount, 0);
      const investment = allTxns.filter((t) => t.type === "investment").reduce((s, t) => s + t.amount, 0);
      return {
        answer: `Income: ${formatCurrency(income)} · Expenses: ${formatCurrency(expense)} · Saved: ${formatCurrency(saving)} · Invested: ${formatCurrency(investment)} · Net: ${formatCurrency(income - expense - saving - investment)}.`,
        data: [
          { label: "Income", value: formatCurrency(income) },
          { label: "Expenses", value: formatCurrency(expense) },
          { label: "Saved", value: formatCurrency(saving) },
          { label: "Invested", value: formatCurrency(investment) },
        ],
      };
    }

    default: {
      let txns = allTxns.filter((t) => t.type === "expense");
      if (q.category) txns = txns.filter((t) => t.categoryId === q.category);
      const total = txns.reduce((s, t) => s + t.amount, 0);
      return { answer: `Total: ${formatCurrency(total)} across ${txns.length} transactions.`, transactions: txns.slice(0, 10) };
    }
  }
}
