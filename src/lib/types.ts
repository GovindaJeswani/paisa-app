// ============================================================================
// PAISA — Core Type Definitions
// ============================================================================

// --- Transaction Types ---

export type TransactionType =
  | "expense"
  | "income"
  | "transfer"
  | "saving"
  | "investment"
  | "lend"
  | "borrow"
  | "repayment"
  | "settlement";

export type PaymentMethod =
  | "upi"
  | "credit_card"
  | "debit_card"
  | "cash"
  | "net_banking"
  | "wallet"
  | "cheque"
  | "auto_debit"
  | "other";

export type ImportSource =
  | "manual"
  | "natural_language"
  | "sms"
  | "email"
  | "csv"
  | "json"
  | "receipt"
  | "screenshot"
  | "demo";

export type ConfidenceLevel = "high" | "medium" | "low";

export interface Transaction {
  id: string;
  amount: number;
  type: TransactionType;
  categoryId: string;
  subcategory?: string;
  accountId?: string;
  toAccountId?: string; // for transfers
  personId?: string;
  groupId?: string;
  eventId?: string;
  merchant?: string;
  note?: string;
  date: string; // ISO date string
  time?: string; // HH:mm
  paymentMethod?: PaymentMethod;
  tags?: string[];
  attachments?: string[];
  isRecurring?: boolean;
  recurringId?: string;
  importSource: ImportSource;
  confidence: number; // 0–100
  confirmed: boolean;
  rawInput?: string;
  createdAt: string;
  updatedAt: string;
}

// --- Audit Trail ---

export interface TransactionChange {
  id: string;
  transactionId: string;
  field: string;
  oldValue: string;
  newValue: string;
  changedBy: "user" | "system";
  timestamp: string;
}

// --- Account Types ---

export type AccountType =
  | "savings"
  | "current"
  | "credit_card"
  | "wallet"
  | "cash"
  | "investment"
  | "loan"
  | "other";

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  bank?: string;
  icon?: string;
  color?: string;
  balance: number;
  creditLimit?: number;
  isDefault?: boolean;
  isActive: boolean;
  createdAt: string;
}

// --- Category Types ---

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  parentId?: string;
  type: "expense" | "income" | "both";
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
}

// --- Person & Social ---

export interface Person {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  avatar?: string;
  netBalance: number; // positive = they owe you, negative = you owe them
  createdAt: string;
}

export interface Group {
  id: string;
  name: string;
  icon?: string;
  memberIds: string[];
  createdAt: string;
}

export interface Split {
  id: string;
  transactionId: string;
  groupId?: string;
  paidByPersonId: string; // "self" for user
  totalAmount: number;
  shares: SplitShare[];
  isSettled: boolean;
  createdAt: string;
}

export interface SplitShare {
  personId: string; // "self" for user
  amount: number;
  isSettled: boolean;
}

// --- Budget ---

export interface Budget {
  id: string;
  name: string;
  categoryId?: string; // undefined = overall budget
  amount: number;
  period: "weekly" | "monthly" | "yearly" | "custom";
  startDate?: string;
  endDate?: string;
  isActive: boolean;
  createdAt: string;
}

// --- Goals ---

export interface Goal {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string;
  monthlyContribution?: number;
  isCompleted: boolean;
  isActive: boolean;
  createdAt: string;
}

// --- Recurring Transactions ---

export type RecurrenceFrequency =
  | "daily"
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly"
  | "yearly";

export interface RecurringTransaction {
  id: string;
  name: string;
  amount: number;
  type: TransactionType;
  categoryId: string;
  accountId?: string;
  merchant?: string;
  frequency: RecurrenceFrequency;
  startDate: string;
  nextDueDate: string;
  endDate?: string;
  isPaused: boolean;
  autoDetected: boolean;
  lastPaidDate?: string;
  createdAt: string;
}

// --- Financial Events (Trips, etc.) ---

export interface FinancialEvent {
  id: string;
  name: string;
  icon?: string;
  startDate: string;
  endDate: string;
  budget?: number;
  createdAt: string;
}

// --- Investments ---

export type InvestmentType =
  | "sip"
  | "mutual_fund"
  | "fd"
  | "stock"
  | "gold"
  | "ppf"
  | "nps"
  | "other";

export interface Investment {
  id: string;
  name: string;
  type: InvestmentType;
  amount: number;
  currentValue?: number;
  frequency?: RecurrenceFrequency;
  startDate: string;
  maturityDate?: string;
  isActive: boolean;
  createdAt: string;
}

// --- Merchant Learning ---

export interface MerchantMapping {
  id: string;
  merchant: string;
  categoryId: string;
  subcategory?: string;
  accountId?: string;
  confidence: number;
  timesUsed: number;
  lastUsed: string;
}

// --- User Preferences ---

export interface UserPreferences {
  id: string;
  monthlyIncome?: number;
  currency: string;
  theme: "light" | "dark" | "system";
  onboardingComplete: boolean;
  demoMode: boolean;
  defaultAccountId?: string;
  calendarStartDay: 0 | 1; // 0 = Sunday, 1 = Monday
  createdAt: string;
  updatedAt: string;
}

// --- Day Summary (computed) ---

export interface DaySummary {
  date: string;
  totalExpense: number;
  totalIncome: number;
  totalSaving: number;
  totalInvestment: number;
  transactionCount: number;
  categories: { categoryId: string; amount: number }[];
  hasBills: boolean;
  hasRecurring: boolean;
}

// --- NL Parse Result ---

export interface ParsedTransaction {
  amount?: number;
  type?: TransactionType;
  categoryId?: string;
  subcategory?: string;
  merchant?: string;
  personName?: string;
  accountName?: string;
  date?: string;
  note?: string;
  confidence: number;
  rawInput: string;
}

// --- Insight ---

export interface Insight {
  id: string;
  type: "spending" | "saving" | "budget" | "trend" | "suggestion" | "goal" | "recurring";
  title: string;
  description: string;
  severity: "info" | "warning" | "positive" | "negative";
  data?: Record<string, unknown>;
  date: string;
}
