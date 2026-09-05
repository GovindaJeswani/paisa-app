import Dexie, { type Table } from "dexie";
import type {
  Transaction,
  TransactionChange,
  Account,
  Category,
  Person,
  Group,
  Split,
  Budget,
  Goal,
  RecurringTransaction,
  FinancialEvent,
  Investment,
  MerchantMapping,
  UserPreferences,
} from "./types";

export class PaisaDB extends Dexie {
  transactions!: Table<Transaction, string>;
  transactionChanges!: Table<TransactionChange, string>;
  accounts!: Table<Account, string>;
  categories!: Table<Category, string>;
  persons!: Table<Person, string>;
  groups!: Table<Group, string>;
  splits!: Table<Split, string>;
  budgets!: Table<Budget, string>;
  goals!: Table<Goal, string>;
  recurringTransactions!: Table<RecurringTransaction, string>;
  financialEvents!: Table<FinancialEvent, string>;
  investments!: Table<Investment, string>;
  merchantMappings!: Table<MerchantMapping, string>;
  userPreferences!: Table<UserPreferences, string>;

  constructor() {
    super("PaisaDB");

    this.version(1).stores({
      transactions:
        "id, type, categoryId, accountId, toAccountId, personId, groupId, eventId, merchant, date, importSource, confirmed, recurringId, createdAt",
      transactionChanges: "id, transactionId, timestamp",
      accounts: "id, type, isActive",
      categories: "id, parentId, type, isDefault, sortOrder",
      persons: "id, name",
      groups: "id",
      splits: "id, transactionId, groupId, isSettled",
      budgets: "id, categoryId, isActive",
      goals: "id, isCompleted, isActive",
      recurringTransactions: "id, nextDueDate, isPaused",
      financialEvents: "id, startDate, endDate",
      investments: "id, type, isActive",
      merchantMappings: "id, merchant, categoryId",
      userPreferences: "id",
    });
  }
}

export const db = new PaisaDB();

// --- Default categories ---

export const DEFAULT_CATEGORIES: Omit<Category, "id">[] = [
  { name: "Food", icon: "🍔", color: "#FF6B6B", type: "expense", isDefault: true, isActive: true, sortOrder: 1 },
  { name: "Groceries", icon: "🛒", color: "#51CF66", type: "expense", isDefault: true, isActive: true, sortOrder: 2 },
  { name: "Transport", icon: "🚗", color: "#339AF0", type: "expense", isDefault: true, isActive: true, sortOrder: 3 },
  { name: "Shopping", icon: "🛍️", color: "#CC5DE8", type: "expense", isDefault: true, isActive: true, sortOrder: 4 },
  { name: "Bills", icon: "📄", color: "#FF922B", type: "expense", isDefault: true, isActive: true, sortOrder: 5 },
  { name: "Rent", icon: "🏠", color: "#20C997", type: "expense", isDefault: true, isActive: true, sortOrder: 6 },
  { name: "Utilities", icon: "💡", color: "#FCC419", type: "expense", isDefault: true, isActive: true, sortOrder: 7 },
  { name: "Entertainment", icon: "🎬", color: "#845EF7", type: "expense", isDefault: true, isActive: true, sortOrder: 8 },
  { name: "Healthcare", icon: "🏥", color: "#F06595", type: "expense", isDefault: true, isActive: true, sortOrder: 9 },
  { name: "Education", icon: "📚", color: "#4DABF7", type: "expense", isDefault: true, isActive: true, sortOrder: 10 },
  { name: "Subscriptions", icon: "📱", color: "#9775FA", type: "expense", isDefault: true, isActive: true, sortOrder: 11 },
  { name: "Insurance", icon: "🛡️", color: "#748FFC", type: "expense", isDefault: true, isActive: true, sortOrder: 12 },
  { name: "EMI", icon: "🏦", color: "#E64980", type: "expense", isDefault: true, isActive: true, sortOrder: 13 },
  { name: "Personal", icon: "👤", color: "#63E6BE", type: "expense", isDefault: true, isActive: true, sortOrder: 14 },
  { name: "Fuel", icon: "⛽", color: "#FFA94D", type: "expense", isDefault: true, isActive: true, sortOrder: 15 },
  { name: "Gifts", icon: "🎁", color: "#F783AC", type: "expense", isDefault: true, isActive: true, sortOrder: 16 },
  { name: "Travel", icon: "✈️", color: "#3BC9DB", type: "expense", isDefault: true, isActive: true, sortOrder: 17 },
  { name: "Family", icon: "👨‍👩‍👧‍👦", color: "#FFB3BA", type: "expense", isDefault: true, isActive: true, sortOrder: 18 },
  { name: "Investments", icon: "📈", color: "#38D9A9", type: "expense", isDefault: true, isActive: true, sortOrder: 19 },
  { name: "Savings", icon: "🏦", color: "#69DB7C", type: "expense", isDefault: true, isActive: true, sortOrder: 20 },
  { name: "Other", icon: "📦", color: "#ADB5BD", type: "expense", isDefault: true, isActive: true, sortOrder: 21 },
  // Income categories
  { name: "Salary", icon: "💰", color: "#51CF66", type: "income", isDefault: true, isActive: true, sortOrder: 100 },
  { name: "Freelance", icon: "💻", color: "#339AF0", type: "income", isDefault: true, isActive: true, sortOrder: 101 },
  { name: "Allowance", icon: "🤝", color: "#FCC419", type: "income", isDefault: true, isActive: true, sortOrder: 102 },
  { name: "Cashback", icon: "💳", color: "#20C997", type: "income", isDefault: true, isActive: true, sortOrder: 103 },
  { name: "Refund", icon: "↩️", color: "#748FFC", type: "income", isDefault: true, isActive: true, sortOrder: 104 },
  { name: "Interest", icon: "🏦", color: "#845EF7", type: "income", isDefault: true, isActive: true, sortOrder: 105 },
  { name: "Gift Received", icon: "🎉", color: "#F783AC", type: "income", isDefault: true, isActive: true, sortOrder: 106 },
  { name: "Other Income", icon: "💵", color: "#ADB5BD", type: "income", isDefault: true, isActive: true, sortOrder: 107 },
];

// --- Initialize default data ---

export async function initializeDB(): Promise<void> {
  const prefs = await db.userPreferences.get("default");
  if (!prefs) {
    await db.userPreferences.put({
      id: "default",
      currency: "INR",
      theme: "system",
      onboardingComplete: false,
      demoMode: false,
      calendarStartDay: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  const categoryCount = await db.categories.count();
  if (categoryCount === 0) {
    const categories = DEFAULT_CATEGORIES.map((cat, i) => ({
      ...cat,
      id: `cat_${cat.name.toLowerCase().replace(/\s+/g, "_")}`,
    }));
    await db.categories.bulkPut(categories);
  }
}
