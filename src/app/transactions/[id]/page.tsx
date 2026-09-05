"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Trash2, Save, Clock, CreditCard, Tag, FileText, History } from "lucide-react";
import { format } from "date-fns";
import { db } from "@/lib/db";
import { cn, formatCurrency, generateId } from "@/lib/utils";
import { updateTransaction, deleteTransaction } from "@/lib/engine/transaction-service";
import { useCategories } from "@/lib/hooks/use-categories";
import { useAccounts } from "@/lib/hooks/use-accounts";
import { useLiveQuery } from "dexie-react-hooks";
import type { Transaction, TransactionType, TransactionChange } from "@/lib/types";

const TYPES: { value: TransactionType; label: string }[] = [
  { value: "expense", label: "Expense" }, { value: "income", label: "Income" },
  { value: "transfer", label: "Transfer" }, { value: "saving", label: "Saving" },
  { value: "investment", label: "Investment" }, { value: "lend", label: "Lend" },
  { value: "borrow", label: "Borrow" },
];

export default function TransactionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const transaction = useLiveQuery(() => db.transactions.get(id), [id]);
  const categories = useCategories();
  const accounts = useAccounts();
  const changes = useLiveQuery(() => db.transactionChanges.where("transactionId").equals(id).reverse().sortBy("timestamp"), [id]) ?? [];

  const [form, setForm] = useState<Partial<Transaction>>({});
  const [showDelete, setShowDelete] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (transaction) setForm({ ...transaction });
  }, [transaction]);

  const handleSave = useCallback(async () => {
    if (!form.id) return;
    setSaving(true);
    await updateTransaction(form.id, {
      amount: form.amount, type: form.type, categoryId: form.categoryId,
      accountId: form.accountId, merchant: form.merchant, note: form.note,
      date: form.date, time: form.time,
    });
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }, [form]);

  const handleDelete = useCallback(async () => {
    if (!id) return;
    await deleteTransaction(id);
    router.push("/transactions");
  }, [id, router]);

  if (!transaction) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <span className="text-3xl">🔍</span>
          <p className="text-sm text-text-tertiary mt-2">Transaction not found</p>
          <button onClick={() => router.back()} className="mt-3 text-xs text-accent font-semibold">Go back</button>
        </div>
      </div>
    );
  }

  const category = categories.find((c) => c.id === form.categoryId);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm font-semibold text-text-secondary hover:text-text-primary transition-colors">
          <ArrowLeft size={16} /> Back
        </button>
        <div className="flex items-center gap-2">
          {saved && <span className="text-xs text-income font-semibold animate-fade-in">Saved ✓</span>}
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-accent-hover disabled:opacity-50 transition-colors">
            <Save size={13} /> {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {/* Amount hero */}
      <div className="text-center py-2">
        <div className="flex items-center justify-center gap-1">
          <span className="text-lg text-text-tertiary">₹</span>
          <input
            type="number" value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
            className="text-4xl font-extrabold text-text-primary tabular-nums bg-transparent text-center outline-none w-48 focus:text-accent transition-colors"
          />
        </div>
        {category && (
          <p className="text-sm text-text-secondary mt-1">{category.icon} {category.name}</p>
        )}
      </div>

      {/* Type selector */}
      <div>
        <label className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-1.5 block">Type</label>
        <div className="flex flex-wrap gap-1.5">
          {TYPES.map((t) => (
            <button key={t.value} onClick={() => setForm({ ...form, type: t.value })}
              className={cn("rounded-full px-3 py-1.5 text-xs font-semibold border transition-all",
                form.type === t.value ? "border-accent bg-accent-light text-accent" : "border-border-light text-text-secondary hover:bg-surface-secondary"
              )}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Category picker */}
      <div>
        <label className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-1.5 block flex items-center gap-1"><Tag size={11} /> Category</label>
        <div className="grid grid-cols-4 gap-1.5 max-h-48 overflow-y-auto">
          {categories.filter((c) => c.type === (form.type === "income" ? "income" : "expense") || c.type === "both").map((cat) => (
            <button key={cat.id} onClick={() => setForm({ ...form, categoryId: cat.id })}
              className={cn("flex flex-col items-center gap-0.5 rounded-xl border p-2 transition-all text-center",
                form.categoryId === cat.id ? "border-accent bg-accent-light" : "border-border-light hover:bg-surface-secondary"
              )}>
              <span className="text-base">{cat.icon}</span>
              <span className="text-[9px] font-medium text-text-secondary leading-tight">{cat.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Account */}
      {accounts.length > 0 && (
        <div>
          <label className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-1.5 block flex items-center gap-1"><CreditCard size={11} /> Account</label>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setForm({ ...form, accountId: undefined })}
              className={cn("rounded-full px-3 py-1.5 text-xs font-medium border transition-all",
                !form.accountId ? "border-accent bg-accent-light text-accent" : "border-border-light text-text-secondary"
              )}>
              None
            </button>
            {accounts.map((acc) => (
              <button key={acc.id} onClick={() => setForm({ ...form, accountId: acc.id })}
                className={cn("rounded-full px-3 py-1.5 text-xs font-medium border transition-all flex items-center gap-1",
                  form.accountId === acc.id ? "border-accent bg-accent-light text-accent" : "border-border-light text-text-secondary"
                )}>
                {acc.icon} {acc.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Details */}
      <div className="space-y-3">
        <div>
          <label className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-1 block">Merchant</label>
          <input type="text" value={form.merchant || ""} onChange={(e) => setForm({ ...form, merchant: e.target.value })}
            placeholder="e.g. Swiggy, Amazon" className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent transition-colors" />
        </div>
        <div>
          <label className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-1 block flex items-center gap-1"><FileText size={11} /> Note</label>
          <input type="text" value={form.note || ""} onChange={(e) => setForm({ ...form, note: e.target.value })}
            placeholder="What was this for?" className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent transition-colors" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-1 block">Date</label>
            <input type="date" value={form.date || ""} onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent text-text-primary" />
          </div>
          <div>
            <label className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-1 block flex items-center gap-1"><Clock size={11} /> Time</label>
            <input type="time" value={form.time || ""} onChange={(e) => setForm({ ...form, time: e.target.value })}
              className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent text-text-primary" />
          </div>
        </div>
      </div>

      {/* Audit trail */}
      {changes.length > 0 && (
        <div>
          <button onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1.5 text-xs font-semibold text-text-tertiary hover:text-text-secondary transition-colors">
            <History size={12} /> {showHistory ? "Hide" : "Show"} edit history ({changes.length})
          </button>
          {showHistory && (
            <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto">
              {changes.map((c) => (
                <div key={c.id} className="flex items-center gap-2 text-[10px] text-text-tertiary">
                  <span className="font-mono">{format(new Date(c.timestamp), "d MMM HH:mm")}</span>
                  <span className="font-semibold text-text-secondary">{c.field}</span>
                  <span>{c.oldValue || "—"} → {c.newValue}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Meta */}
      <div className="rounded-xl bg-surface-secondary p-3 text-[10px] text-text-tertiary space-y-0.5">
        <p>Source: {transaction.importSource} · Confidence: {transaction.confidence}%</p>
        <p>Created: {format(new Date(transaction.createdAt), "d MMM yyyy, HH:mm")}</p>
        {transaction.updatedAt !== transaction.createdAt && <p>Updated: {format(new Date(transaction.updatedAt), "d MMM yyyy, HH:mm")}</p>}
      </div>

      {/* Delete */}
      <div className="pt-2">
        {showDelete ? (
          <div className="flex gap-2">
            <button onClick={() => setShowDelete(false)} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-text-secondary">Cancel</button>
            <button onClick={handleDelete} className="flex-1 rounded-xl bg-expense py-2.5 text-sm font-semibold text-white">Delete Forever</button>
          </div>
        ) : (
          <button onClick={() => setShowDelete(true)} className="w-full flex items-center justify-center gap-2 rounded-xl border border-expense/20 py-2.5 text-sm font-semibold text-expense hover:bg-expense-light transition-colors">
            <Trash2 size={14} /> Delete Transaction
          </button>
        )}
      </div>
    </motion.div>
  );
}
