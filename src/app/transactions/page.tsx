"use client";

import { useState, useMemo } from "react";
import { Search, Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTransactions } from "@/lib/hooks/use-transactions";
import { useCategories } from "@/lib/hooks/use-categories";
import { TransactionGroup } from "@/components/transactions/transaction-card";
import type { Transaction } from "@/lib/types";

export default function TransactionsPage() {
  const allTransactions = useTransactions();
  const categories = useCategories();
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let result = allTransactions;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.merchant?.toLowerCase().includes(q) ||
          t.note?.toLowerCase().includes(q) ||
          t.categoryId.toLowerCase().includes(q) ||
          String(t.amount).includes(q)
      );
    }

    if (filterCategory) {
      result = result.filter((t) => t.categoryId === filterCategory);
    }

    if (filterType) {
      result = result.filter((t) => t.type === filterType);
    }

    return result;
  }, [allTransactions, search, filterCategory, filterType]);

  // Group by date
  const grouped = useMemo(() => {
    const groups = new Map<string, Transaction[]>();
    for (const t of filtered) {
      const existing = groups.get(t.date) || [];
      existing.push(t);
      groups.set(t.date, existing);
    }
    return Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const hasFilters = search || filterCategory || filterType;

  return (
    <div className="space-y-4 pb-4">
      <h1 className="text-xl font-bold text-text-primary">Transactions</h1>

      {/* Search */}
      <div className="relative">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search transactions..."
          className="w-full rounded-xl border border-border bg-surface-secondary pl-9 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2"
          >
            <X size={14} className="text-text-tertiary" />
          </button>
        )}
      </div>

      {/* Filter chips */}
      <div className="flex gap-1.5 overflow-x-auto hide-scrollbar pb-1">
        {[
          { value: null, label: "All" },
          { value: "expense", label: "Expenses" },
          { value: "income", label: "Income" },
          { value: "transfer", label: "Transfers" },
          { value: "saving", label: "Savings" },
          { value: "investment", label: "Investments" },
          { value: "lend", label: "Lent" },
          { value: "borrow", label: "Borrowed" },
        ].map((opt) => (
          <button
            key={opt.value ?? "all"}
            onClick={() => setFilterType(opt.value)}
            className={cn(
              "whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
              filterType === opt.value
                ? "border-accent bg-accent-light text-accent"
                : "border-border-light bg-surface text-text-secondary hover:bg-surface-secondary"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Results */}
      {grouped.length === 0 ? (
        <div className="py-16 text-center">
          <span className="text-3xl mb-2 block">
            {hasFilters ? "🔍" : "📝"}
          </span>
          <p className="text-sm text-text-tertiary">
            {hasFilters
              ? "No transactions match your search"
              : "Your financial timeline starts here"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {grouped.map(([date, txns]) => (
            <TransactionGroup key={date} date={date} transactions={txns} />
          ))}
        </div>
      )}
    </div>
  );
}
