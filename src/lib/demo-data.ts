import { format, subDays, subMonths, addDays } from "date-fns";
import { db } from "./db";
import { generateId } from "./utils";
import type {
  Transaction,
  Account,
  Goal,
  Budget,
  RecurringTransaction,
  Person,
  Group,
  Split,
} from "./types";

const today = new Date();

function randomTime(): string {
  const h = Math.floor(Math.random() * 14) + 7; // 7am–9pm
  const m = Math.floor(Math.random() * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function dateStr(daysAgo: number): string {
  return format(subDays(today, daysAgo), "yyyy-MM-dd");
}

// --- Demo Accounts ---
const DEMO_ACCOUNTS: Account[] = [
  {
    id: "acc_hdfc",
    name: "HDFC Savings",
    type: "savings",
    bank: "HDFC",
    icon: "🏦",
    color: "#004B87",
    balance: 85000,
    isDefault: true,
    isActive: true,
    createdAt: subMonths(today, 6).toISOString(),
  },
  {
    id: "acc_sbi",
    name: "SBI Savings",
    type: "savings",
    bank: "SBI",
    icon: "🏦",
    color: "#0066B3",
    balance: 42000,
    isActive: true,
    createdAt: subMonths(today, 6).toISOString(),
  },
  {
    id: "acc_hdfc_cc",
    name: "HDFC Regalia",
    type: "credit_card",
    bank: "HDFC",
    icon: "💳",
    color: "#004B87",
    balance: -18420,
    creditLimit: 200000,
    isActive: true,
    createdAt: subMonths(today, 6).toISOString(),
  },
  {
    id: "acc_cash",
    name: "Cash",
    type: "cash",
    icon: "💵",
    color: "#22C55E",
    balance: 3500,
    isActive: true,
    createdAt: subMonths(today, 6).toISOString(),
  },
  {
    id: "acc_paytm",
    name: "Paytm Wallet",
    type: "wallet",
    icon: "📱",
    color: "#00BAF2",
    balance: 1200,
    isActive: true,
    createdAt: subMonths(today, 6).toISOString(),
  },
];

// --- Demo Persons ---
const DEMO_PERSONS: Person[] = [
  { id: "per_op", name: "OP", netBalance: 1250, createdAt: subMonths(today, 3).toISOString() },
  { id: "per_priya", name: "Priya", netBalance: -500, createdAt: subMonths(today, 2).toISOString() },
  { id: "per_amit", name: "Amit", netBalance: 2000, createdAt: subMonths(today, 4).toISOString() },
  { id: "per_neha", name: "Neha", netBalance: 0, createdAt: subMonths(today, 1).toISOString() },
];

// --- Demo Goals ---
const DEMO_GOALS: Goal[] = [
  {
    id: "goal_emergency",
    name: "Emergency Fund",
    icon: "🛡️",
    color: "#10B981",
    targetAmount: 100000,
    currentAmount: 68000,
    deadline: format(addDays(today, 180), "yyyy-MM-dd"),
    monthlyContribution: 10000,
    isCompleted: false,
    isActive: true,
    createdAt: subMonths(today, 6).toISOString(),
  },
  {
    id: "goal_laptop",
    name: "New Laptop",
    icon: "💻",
    color: "#6366F1",
    targetAmount: 80000,
    currentAmount: 35000,
    deadline: format(addDays(today, 120), "yyyy-MM-dd"),
    monthlyContribution: 12000,
    isCompleted: false,
    isActive: true,
    createdAt: subMonths(today, 3).toISOString(),
  },
  {
    id: "goal_trip",
    name: "Goa Trip",
    icon: "🏖️",
    color: "#F59E0B",
    targetAmount: 30000,
    currentAmount: 22000,
    deadline: format(addDays(today, 45), "yyyy-MM-dd"),
    monthlyContribution: 5000,
    isCompleted: false,
    isActive: true,
    createdAt: subMonths(today, 2).toISOString(),
  },
];

// --- Demo Budgets ---
const DEMO_BUDGETS: Budget[] = [
  { id: "bud_food", name: "Food", categoryId: "cat_food", amount: 8000, period: "monthly", isActive: true, createdAt: subMonths(today, 3).toISOString() },
  { id: "bud_transport", name: "Transport", categoryId: "cat_transport", amount: 4000, period: "monthly", isActive: true, createdAt: subMonths(today, 3).toISOString() },
  { id: "bud_shopping", name: "Shopping", categoryId: "cat_shopping", amount: 6000, period: "monthly", isActive: true, createdAt: subMonths(today, 3).toISOString() },
  { id: "bud_ent", name: "Entertainment", categoryId: "cat_entertainment", amount: 3000, period: "monthly", isActive: true, createdAt: subMonths(today, 3).toISOString() },
  { id: "bud_overall", name: "Monthly Total", amount: 45000, period: "monthly", isActive: true, createdAt: subMonths(today, 3).toISOString() },
];

// --- Demo Recurring ---
const DEMO_RECURRING: RecurringTransaction[] = [
  { id: "rec_rent", name: "Rent", amount: 15000, type: "expense", categoryId: "cat_rent", accountId: "acc_hdfc", frequency: "monthly", startDate: dateStr(90), nextDueDate: dateStr(-10), isPaused: false, autoDetected: false, createdAt: subMonths(today, 3).toISOString() },
  { id: "rec_netflix", name: "Netflix", amount: 649, type: "expense", categoryId: "cat_subscriptions", accountId: "acc_hdfc_cc", frequency: "monthly", startDate: dateStr(90), nextDueDate: dateStr(-5), isPaused: false, autoDetected: true, createdAt: subMonths(today, 3).toISOString() },
  { id: "rec_spotify", name: "Spotify", amount: 119, type: "expense", categoryId: "cat_subscriptions", accountId: "acc_hdfc_cc", frequency: "monthly", startDate: dateStr(90), nextDueDate: dateStr(-8), isPaused: false, autoDetected: true, createdAt: subMonths(today, 3).toISOString() },
  { id: "rec_sip", name: "SIP - Axis Bluechip", amount: 5000, type: "investment", categoryId: "cat_investments", accountId: "acc_hdfc", frequency: "monthly", startDate: dateStr(180), nextDueDate: dateStr(-10), isPaused: false, autoDetected: false, createdAt: subMonths(today, 6).toISOString() },
  { id: "rec_salary", name: "Salary", amount: 85000, type: "income", categoryId: "cat_salary", accountId: "acc_hdfc", frequency: "monthly", startDate: dateStr(180), nextDueDate: dateStr(-1), isPaused: false, autoDetected: false, createdAt: subMonths(today, 6).toISOString() },
];

// --- Generate 3 months of demo transactions ---
function generateDemoTransactions(): Transaction[] {
  const txns: Transaction[] = [];
  let idCounter = 1;

  const addTxn = (
    daysAgo: number,
    amount: number,
    type: Transaction["type"],
    categoryId: string,
    merchant?: string,
    accountId?: string,
    note?: string,
    personId?: string
  ) => {
    txns.push({
      id: `demo_txn_${idCounter++}`,
      amount,
      type,
      categoryId,
      merchant,
      accountId: accountId || "acc_hdfc",
      note,
      personId,
      date: dateStr(daysAgo),
      time: randomTime(),
      importSource: "demo",
      confidence: 95,
      confirmed: true,
      createdAt: subDays(today, daysAgo).toISOString(),
      updatedAt: subDays(today, daysAgo).toISOString(),
    });
  };

  // Generate for 90 days (3 months)
  for (let month = 0; month < 3; month++) {
    const baseDay = month * 30;

    // Salary (1st of each month)
    addTxn(baseDay + 28, 85000, "income", "cat_salary", undefined, "acc_hdfc", "Monthly salary");

    // Rent (5th of each month)
    addTxn(baseDay + 25, 15000, "expense", "cat_rent", undefined, "acc_hdfc", "Monthly rent");

    // SIP (10th of each month)
    addTxn(baseDay + 20, 5000, "investment", "cat_investments", undefined, "acc_hdfc", "SIP - Axis Bluechip");

    // Savings contribution
    addTxn(baseDay + 20, 10000, "saving", "cat_savings", undefined, "acc_hdfc", "Emergency fund");

    // Subscriptions
    addTxn(baseDay + 15, 649, "expense", "cat_subscriptions", "Netflix", "acc_hdfc_cc", "Netflix subscription");
    addTxn(baseDay + 15, 119, "expense", "cat_subscriptions", "Spotify", "acc_hdfc_cc", "Spotify Premium");
    addTxn(baseDay + 18, 299, "expense", "cat_subscriptions", "YouTube Premium", "acc_hdfc_cc");

    // Daily food expenses (scattered)
    for (let d = 0; d < 25; d++) {
      const day = baseDay + d;
      if (Math.random() > 0.3) {
        // Swiggy/Zomato
        const merchant = Math.random() > 0.5 ? "Swiggy" : "Zomato";
        addTxn(day, Math.floor(Math.random() * 400) + 150, "expense", "cat_food", merchant, "acc_hdfc_cc");
      }
      if (Math.random() > 0.6) {
        // Coffee
        addTxn(day, Math.floor(Math.random() * 100) + 80, "expense", "cat_food", "Starbucks", "acc_hdfc_cc", "Morning coffee");
      }
      if (Math.random() > 0.7) {
        // Groceries
        addTxn(day, Math.floor(Math.random() * 800) + 200, "expense", "cat_groceries", Math.random() > 0.5 ? "Blinkit" : "BigBasket", "acc_hdfc");
      }
    }

    // Transport (Uber/Ola scattered)
    for (let d = 0; d < 20; d++) {
      if (Math.random() > 0.55) {
        const day = baseDay + d;
        addTxn(day, Math.floor(Math.random() * 300) + 100, "expense", "cat_transport", Math.random() > 0.5 ? "Uber" : "Ola", "acc_paytm");
      }
    }

    // Shopping (a few per month)
    addTxn(baseDay + 5, Math.floor(Math.random() * 3000) + 1000, "expense", "cat_shopping", "Amazon", "acc_hdfc_cc");
    addTxn(baseDay + 12, Math.floor(Math.random() * 2000) + 500, "expense", "cat_shopping", "Flipkart", "acc_hdfc_cc");
    if (Math.random() > 0.5) {
      addTxn(baseDay + 19, Math.floor(Math.random() * 4000) + 800, "expense", "cat_shopping", "Myntra", "acc_hdfc_cc");
    }

    // Bills
    addTxn(baseDay + 10, 599, "expense", "cat_bills", "Airtel", "acc_hdfc", "Mobile recharge");
    addTxn(baseDay + 12, 1200, "expense", "cat_utilities", "Electricity", "acc_hdfc", "Electricity bill");
    if (Math.random() > 0.5) {
      addTxn(baseDay + 14, 800, "expense", "cat_utilities", undefined, "acc_hdfc", "Water bill");
    }

    // Entertainment
    addTxn(baseDay + 8, Math.floor(Math.random() * 600) + 300, "expense", "cat_entertainment", undefined, "acc_hdfc_cc", "Movie tickets");
    if (Math.random() > 0.5) {
      addTxn(baseDay + 22, Math.floor(Math.random() * 1000) + 500, "expense", "cat_entertainment", undefined, "acc_cash");
    }

    // Fuel
    addTxn(baseDay + 7, Math.floor(Math.random() * 1000) + 500, "expense", "cat_fuel", "Indian Oil", "acc_hdfc", "Petrol");
    addTxn(baseDay + 21, Math.floor(Math.random() * 1000) + 500, "expense", "cat_fuel", "HP", "acc_hdfc", "Petrol");

    // Lending/borrowing
    if (month === 0) {
      addTxn(baseDay + 3, 2000, "lend", "cat_other", undefined, "acc_hdfc", "Lent to OP", "per_op");
      addTxn(baseDay + 10, 750, "repayment", "cat_other", undefined, "acc_hdfc", "OP partial repayment", "per_op");
    }
    if (month === 1) {
      addTxn(baseDay + 6, 500, "borrow", "cat_other", undefined, "acc_cash", "Borrowed from Priya", "per_priya");
      addTxn(baseDay + 15, 2000, "lend", "cat_other", undefined, "acc_hdfc", "Lent to Amit", "per_amit");
    }

    // Cashback/Refunds
    if (Math.random() > 0.5) {
      addTxn(baseDay + 16, Math.floor(Math.random() * 300) + 50, "income", "cat_cashback", undefined, "acc_hdfc_cc", "Amazon cashback");
    }
  }

  return txns;
}

export async function loadDemoData(): Promise<void> {
  // Clear existing demo data
  await clearDemoData();

  // Load accounts
  await db.accounts.bulkPut(DEMO_ACCOUNTS);

  // Load persons
  await db.persons.bulkPut(DEMO_PERSONS);

  // Load goals
  await db.goals.bulkPut(DEMO_GOALS);

  // Load budgets
  await db.budgets.bulkPut(DEMO_BUDGETS);

  // Load recurring
  await db.recurringTransactions.bulkPut(DEMO_RECURRING);

  // Load transactions
  const transactions = generateDemoTransactions();
  await db.transactions.bulkPut(transactions);

  // Mark demo mode active
  await db.userPreferences.update("default", {
    demoMode: true,
    onboardingComplete: true,
    monthlyIncome: 85000,
    updatedAt: new Date().toISOString(),
  });
}

export async function clearDemoData(): Promise<void> {
  // Delete only demo transactions
  const demoTxns = await db.transactions
    .filter((t) => t.importSource === "demo")
    .primaryKeys();
  await db.transactions.bulkDelete(demoTxns);

  // Delete demo accounts, persons, goals, budgets, recurring
  const demoAccountIds = DEMO_ACCOUNTS.map((a) => a.id);
  const demoPersonIds = DEMO_PERSONS.map((p) => p.id);
  const demoGoalIds = DEMO_GOALS.map((g) => g.id);
  const demoBudgetIds = DEMO_BUDGETS.map((b) => b.id);
  const demoRecurringIds = DEMO_RECURRING.map((r) => r.id);

  await db.accounts.bulkDelete(demoAccountIds);
  await db.persons.bulkDelete(demoPersonIds);
  await db.goals.bulkDelete(demoGoalIds);
  await db.budgets.bulkDelete(demoBudgetIds);
  await db.recurringTransactions.bulkDelete(demoRecurringIds);

  await db.userPreferences.update("default", {
    demoMode: false,
    updatedAt: new Date().toISOString(),
  });
}
