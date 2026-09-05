import { format } from "date-fns";
import { db } from "../db";
import type {
  Transaction,
  TransactionType,
  ImportSource,
  ParsedTransaction,
  TransactionChange,
} from "../types";
import { generateId } from "../utils";
import { learnFromCorrection } from "./categorizer";
import { findDuplicates } from "./duplicate-detector";

export interface CreateTransactionInput {
  amount: number;
  type: TransactionType;
  categoryId: string;
  subcategory?: string;
  accountId?: string;
  toAccountId?: string;
  personId?: string;
  groupId?: string;
  eventId?: string;
  merchant?: string;
  note?: string;
  date?: string;
  time?: string;
  paymentMethod?: Transaction["paymentMethod"];
  tags?: string[];
  importSource?: ImportSource;
  confidence?: number;
  confirmed?: boolean;
  rawInput?: string;
  isRecurring?: boolean;
  recurringId?: string;
}

export async function createTransaction(
  input: CreateTransactionInput
): Promise<Transaction> {
  const now = new Date().toISOString();
  const transaction: Transaction = {
    id: generateId(),
    amount: input.amount,
    type: input.type,
    categoryId: input.categoryId,
    subcategory: input.subcategory,
    accountId: input.accountId,
    toAccountId: input.toAccountId,
    personId: input.personId,
    groupId: input.groupId,
    eventId: input.eventId,
    merchant: input.merchant,
    note: input.note,
    date: input.date || format(new Date(), "yyyy-MM-dd"),
    time: input.time || format(new Date(), "HH:mm"),
    paymentMethod: input.paymentMethod,
    tags: input.tags || [],
    attachments: [],
    isRecurring: input.isRecurring || false,
    recurringId: input.recurringId,
    importSource: input.importSource || "manual",
    confidence: input.confidence || 100,
    confirmed: input.confirmed ?? true,
    rawInput: input.rawInput,
    createdAt: now,
    updatedAt: now,
  };

  await db.transactions.put(transaction);

  // Update account balance
  if (input.accountId) {
    await updateAccountBalance(input.accountId);
  }
  if (input.toAccountId) {
    await updateAccountBalance(input.toAccountId);
  }

  // Update person balance for lend/borrow
  if (input.personId && (input.type === "lend" || input.type === "borrow" || input.type === "repayment")) {
    await updatePersonBalance(input.personId);
  }

  // Update goal progress for savings
  if (input.type === "saving" && input.note) {
    // Goals are linked by note/tag, updated in goal service
  }

  // Learn from merchant categorization
  if (input.merchant && input.categoryId) {
    await learnFromCorrection(input.merchant, input.categoryId, input.subcategory);
  }

  return transaction;
}

export async function createTransactionFromNL(
  parsed: ParsedTransaction,
  overrides?: Partial<CreateTransactionInput>
): Promise<Transaction> {
  const defaultCategoryId = parsed.categoryId || "cat_other";

  return createTransaction({
    amount: parsed.amount || 0,
    type: parsed.type || "expense",
    categoryId: defaultCategoryId,
    subcategory: parsed.subcategory,
    merchant: parsed.merchant,
    note: parsed.note,
    date: parsed.date,
    importSource: "natural_language",
    confidence: parsed.confidence,
    confirmed: parsed.confidence >= 80,
    rawInput: parsed.rawInput,
    ...overrides,
  });
}

export async function updateTransaction(
  id: string,
  updates: Partial<Transaction>
): Promise<void> {
  const existing = await db.transactions.get(id);
  if (!existing) return;

  // Record changes for audit trail
  const changes: TransactionChange[] = [];
  const existingRecord = existing as unknown as Record<string, unknown>;
  for (const [key, newValue] of Object.entries(updates)) {
    const oldValue = existingRecord[key];
    if (oldValue !== newValue && key !== "updatedAt") {
      changes.push({
        id: generateId(),
        transactionId: id,
        field: key,
        oldValue: String(oldValue ?? ""),
        newValue: String(newValue ?? ""),
        changedBy: "user",
        timestamp: new Date().toISOString(),
      });
    }
  }

  if (changes.length > 0) {
    await db.transactionChanges.bulkPut(changes);
  }

  await db.transactions.update(id, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });

  // Learn from corrections
  if (updates.categoryId && existing.merchant) {
    await learnFromCorrection(
      existing.merchant,
      updates.categoryId,
      updates.subcategory || existing.subcategory
    );
  }
}

export async function deleteTransaction(id: string): Promise<void> {
  const existing = await db.transactions.get(id);
  if (!existing) return;

  await db.transactions.delete(id);

  // Rebalance
  if (existing.accountId) {
    await updateAccountBalance(existing.accountId);
  }
  if (existing.personId) {
    await updatePersonBalance(existing.personId);
  }
}

async function updateAccountBalance(accountId: string): Promise<void> {
  const account = await db.accounts.get(accountId);
  if (!account) return;

  const txns = await db.transactions
    .where("accountId")
    .equals(accountId)
    .toArray();

  let balance = 0;
  for (const t of txns) {
    if (t.type === "income") balance += t.amount;
    else if (t.type === "expense" || t.type === "saving" || t.type === "investment") {
      balance -= t.amount;
    }
  }

  // Also check transfers TO this account
  const incomingTransfers = await db.transactions
    .where("toAccountId")
    .equals(accountId)
    .toArray();
  for (const t of incomingTransfers) {
    balance += t.amount;
  }

  await db.accounts.update(accountId, { balance });
}

async function updatePersonBalance(personId: string): Promise<void> {
  const person = await db.persons.get(personId);
  if (!person) return;

  const txns = await db.transactions
    .where("personId")
    .equals(personId)
    .toArray();

  let netBalance = 0;
  for (const t of txns) {
    if (t.type === "lend") netBalance += t.amount; // they owe you
    if (t.type === "borrow") netBalance -= t.amount; // you owe them
    if (t.type === "repayment") {
      // Check original context to determine direction
      netBalance -= t.amount;
    }
    if (t.type === "settlement") netBalance = 0;
  }

  await db.persons.update(personId, { netBalance });
}

export async function checkForDuplicates(
  amount: number,
  date: string,
  merchant?: string,
  accountId?: string
) {
  return findDuplicates(amount, date, merchant, accountId);
}
