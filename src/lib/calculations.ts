/**
 * calculations.ts — Centralized financial calculation rules.
 *
 * RULES (single source of truth):
 * 1. Ordinary purchases = expense
 * 2. Income = income
 * 3. Transfers between own accounts ≠ expense or income
 * 4. Savings contributions = tracked separately
 * 5. Investment contributions = tracked separately
 * 6. Credit card bill payment ≠ double-counted expense
 * 7. Lending money ≠ expense (it's a receivable)
 * 8. Borrowing money ≠ income (it's a payable)
 * 9. Loan repayment received ≠ income
 * 10. Refund of a blocked IPO amount ≠ income
 */

import type { Expense } from "./db";
import type { TransactionClassification } from "./categories";

// ============================================================
// CLASSIFICATION
// ============================================================

/** Classify a transaction for financial reporting. */
export function classifyTransaction(expense: Expense): TransactionClassification {
  // Check explicit classification if set (v5+ field)
  const expAny = expense as Expense & { classification?: string; parentCategory?: string; subcategory?: string };
  if (expAny.classification) {
    return expAny.classification as TransactionClassification;
  }

  if (expense.type === "income") return "income";

  // Detect special categories from category string
  const catLower = expense.category.toLowerCase();
  const descLower = expense.description.toLowerCase();

  // Credit card bill
  if (catLower.includes("credit card") || descLower.includes("credit card bill") || descLower.includes("cc bill")) {
    return "credit_card_bill";
  }

  // EMI / Loan
  if (catLower.includes("emi") || catLower.includes("loan")) {
    return "loan_emi";
  }

  // Investment / Savings
  if (catLower.includes("sip") || catLower.includes("mutual fund") || catLower.includes("stock") ||
      catLower.includes("investment") || catLower.includes("ipo") || catLower.includes("fd") ||
      catLower.includes("gold") || catLower.includes("ppf") || catLower.includes("nps")) {
    return "investment";
  }

  if (catLower.includes("savings") || catLower.includes("emergency fund")) {
    return "savings";
  }

  // Transfer detection
  if (descLower.includes("transfer to self") || descLower.includes("self transfer") ||
      descLower.includes("own account")) {
    return "transfer";
  }

  return "expense";
}

// ============================================================
// AGGREGATION
// ============================================================

export interface FinancialSummary {
  totalExpenses: number;        // Ordinary expenses only
  totalIncome: number;          // Real income only
  totalInvestments: number;     // SIP, stocks, FD, etc.
  totalSavings: number;         // Savings contributions
  totalTransfers: number;       // Between own accounts (excluded from totals)
  totalCreditCardBills: number; // CC bills (excluded from expenses to avoid double-count)
  totalLoanEMIs: number;       // Loan EMIs
  netCashFlow: number;          // Income - Expenses - Investments - Savings
  transactionCount: number;
}

/** Calculate financial summary from a set of expenses. */
export function calculateSummary(expenses: Expense[]): FinancialSummary {
  let totalExpenses = 0;
  let totalIncome = 0;
  let totalInvestments = 0;
  let totalSavings = 0;
  let totalTransfers = 0;
  let totalCreditCardBills = 0;
  let totalLoanEMIs = 0;

  for (const exp of expenses) {
    const cls = classifyTransaction(exp);

    switch (cls) {
      case "income":
        totalIncome += exp.amount;
        break;
      case "expense":
        totalExpenses += exp.amount;
        break;
      case "investment":
        totalInvestments += exp.amount;
        break;
      case "savings":
        totalSavings += exp.amount;
        break;
      case "transfer":
        totalTransfers += exp.amount;
        break;
      case "credit_card_bill":
        totalCreditCardBills += exp.amount;
        break;
      case "loan_emi":
        totalLoanEMIs += exp.amount;
        break;
      case "lending":
      case "borrowing":
        // Not counted as expense or income
        break;
    }
  }

  return {
    totalExpenses,
    totalIncome,
    totalInvestments,
    totalSavings,
    totalTransfers,
    totalCreditCardBills,
    totalLoanEMIs,
    netCashFlow: totalIncome - totalExpenses - totalInvestments - totalSavings - totalLoanEMIs,
    transactionCount: expenses.length,
  };
}

/** Group expenses by parent category, aggregating subcategories. */
export function groupByParentCategory(expenses: Expense[]): Map<string, { total: number; count: number; subcategories: Map<string, { total: number; count: number }> }> {
  // Import dynamically to avoid circular deps
  const { resolveLegacyCategory, getCategoryById, CATEGORY_REGISTRY } = require("./categories");

  const groups = new Map<string, { total: number; count: number; subcategories: Map<string, { total: number; count: number }> }>();

  for (const exp of expenses) {
    if (exp.type !== "expense") continue;

    // Resolve category
    const expAny = exp as Expense & { parentCategory?: string; subcategory?: string };
    let parentId = expAny.parentCategory;
    if (!parentId) {
      parentId = resolveLegacyCategory(exp.category);
    }

    const parentCat = getCategoryById(parentId);
    const parentName = parentCat?.name || "Other";

    if (!groups.has(parentName)) {
      groups.set(parentName, { total: 0, count: 0, subcategories: new Map() });
    }

    const group = groups.get(parentName)!;
    group.total += exp.amount;
    group.count++;

    // Subcategory
    const subName = expAny.subcategory || exp.category;
    const subMap = group.subcategories;
    if (!subMap.has(subName)) {
      subMap.set(subName, { total: 0, count: 0 });
    }
    const subGroup = subMap.get(subName)!;
    subGroup.total += exp.amount;
    subGroup.count++;
  }

  return groups;
}

/** Calculate week-over-week or month-over-month comparison. */
export function calculateComparison(
  current: Expense[],
  previous: Expense[]
): { currentTotal: number; previousTotal: number; change: number; changePercent: number | null } {
  const currentTotal = current.filter((e) => e.type === "expense").reduce((s, e) => s + e.amount, 0);
  const previousTotal = previous.filter((e) => e.type === "expense").reduce((s, e) => s + e.amount, 0);
  const change = currentTotal - previousTotal;
  const changePercent = previousTotal > 0 ? ((change / previousTotal) * 100) : null;

  return { currentTotal, previousTotal, change, changePercent };
}

/** Get the highest-spending day from a set of expenses. */
export function getHighestSpendingDay(expenses: Expense[]): { date: string; amount: number } | null {
  const dayMap = new Map<string, number>();
  for (const exp of expenses) {
    if (exp.type !== "expense") continue;
    dayMap.set(exp.date, (dayMap.get(exp.date) || 0) + exp.amount);
  }

  let maxDate = "";
  let maxAmount = 0;
  for (const [date, amount] of dayMap) {
    if (amount > maxAmount) {
      maxDate = date;
      maxAmount = amount;
    }
  }

  return maxDate ? { date: maxDate, amount: maxAmount } : null;
}
