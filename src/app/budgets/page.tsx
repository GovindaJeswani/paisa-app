"use client";

import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Trash2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { db } from "@/lib/db";
import { cn, formatCurrency, generateId, clampPercent } from "@/lib/utils";
import { useBudgets } from "@/lib/hooks/use-budgets";
import { useCategories } from "@/lib/hooks/use-categories";
import { useTransactions } from "@/lib/hooks/use-transactions";
import type { Budget } from "@/lib/types";

export default function BudgetsPage() {
  const budgets = useBudgets();
  const categories = useCategories("expense");
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formCategoryId, setFormCategoryId] = useState<string | undefined>();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const now = new Date();
  const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");
  const monthTxns = useTransactions(monthStart, monthEnd);

  const budgetProgress = useMemo(() => {
    return budgets.map((b) => {
      const relevantTxns = b.categoryId
        ? monthTxns.filter((t) => t.type === "expense" && t.categoryId === b.categoryId)
        : monthTxns.filter((t) => t.type === "expense");
      const spent = relevantTxns.reduce((s, t) => s + t.amount, 0);
      const remaining = Math.max(0, b.amount - spent);
      const pct = b.amount > 0 ? (spent / b.amount) * 100 : 0;
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const dayOfMonth = now.getDate();
      const expectedPct = (dayOfMonth / daysInMonth) * 100;
      const isOverPace = pct > expectedPct + 10;
      return { budget: b, spent, remaining, pct, isOverPace };
    });
  }, [budgets, monthTxns, now]);

  const handleSave = useCallback(async () => {
    if (!formName.trim() || !formAmount) return;
    const budget: Budget = {
      id: generateId(),
      name: formName.trim(),
      categoryId: formCategoryId,
      amount: parseFloat(formAmount) || 0,
      period: "monthly",
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    await db.budgets.add(budget);
    setFormName(""); setFormAmount(""); setFormCategoryId(undefined); setShowForm(false);
  }, [formName, formAmount, formCategoryId]);

  const handleDelete = async (id: string) => {
    await db.budgets.update(id, { isActive: false });
    setDeleteId(null);
  };

  if (budgets.length === 0 && !showForm) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center py-16 text-center">
        <div className="mb-5 animate-float">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl hero-gradient shadow-lg"><span className="text-4xl">💰</span></div>
        </div>
        <h2 className="text-lg font-extrabold text-text-primary">Set spending limits</h2>
        <p className="mt-2 max-w-[260px] text-sm text-text-secondary leading-relaxed">Create budgets per category. We'll track your progress and alert you before you overspend.</p>
        <button onClick={() => setShowForm(true)} className="mt-6 flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-text-inverse hover:bg-accent-hover transition-colors tap-target">
          <Plus size={16} /> Create First Budget
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-text-primary">Budgets</h1>
        <button onClick={() => setShowForm(!showForm)} className={cn("flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors", showForm ? "bg-expense-light text-expense" : "bg-accent-light text-accent")}>
          {showForm ? <><X size={14} />Cancel</> : <><Plus size={14} />Add Budget</>}
        </button>
      </div>

      <p className="text-xs text-text-tertiary">{format(now, "MMMM yyyy")}</p>

      {/* Add form */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="card-elevated p-4 space-y-3">
              <input type="text" placeholder="Budget name (e.g. Food)" value={formName} onChange={(e) => setFormName(e.target.value)} className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent" />
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-text-tertiary font-semibold">₹</span>
                <input type="number" placeholder="Amount" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} className="w-full rounded-xl border border-border bg-surface pl-7 pr-3.5 py-2.5 text-sm outline-none focus:border-accent tabular-nums" />
              </div>
              <div>
                <label className="text-xs font-semibold text-text-secondary mb-1.5 block">Category (optional)</label>
                <div className="flex flex-wrap gap-1.5">
                  <button onClick={() => setFormCategoryId(undefined)} className={cn("rounded-full px-3 py-1.5 text-xs font-medium border transition-all", !formCategoryId ? "border-accent bg-accent-light text-accent" : "border-border-light text-text-secondary")}>
                    Overall
                  </button>
                  {categories.slice(0, 10).map((cat) => (
                    <button key={cat.id} onClick={() => setFormCategoryId(cat.id)} className={cn("rounded-full px-3 py-1.5 text-xs font-medium border transition-all flex items-center gap-1", formCategoryId === cat.id ? "border-accent bg-accent-light text-accent" : "border-border-light text-text-secondary")}>
                      {cat.icon} {cat.name}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={handleSave} disabled={!formName.trim() || !formAmount} className="w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-text-inverse disabled:opacity-50 hover:bg-accent-hover transition-colors">
                Create Budget
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Budget cards */}
      <div className="space-y-3 stagger-children">
        {budgetProgress.map(({ budget, spent, remaining, pct, isOverPace }) => {
          const cat = budget.categoryId ? categories.find((c) => c.id === budget.categoryId) : null;
          const radius = 32; const circumference = 2 * Math.PI * radius;
          const offset = circumference - (clampPercent(pct) / 100) * circumference;
          const isOver = pct >= 100;

          return (
            <div key={budget.id} className="card-elevated p-4">
              <div className="flex items-start gap-4">
                {/* Circular progress */}
                <svg width="76" height="76" viewBox="0 0 76 76" className="shrink-0">
                  <circle cx="38" cy="38" r={radius} stroke="var(--surface-secondary)" strokeWidth="6" fill="none" />
                  <circle cx="38" cy="38" r={radius} stroke={isOver ? "var(--expense)" : isOverPace ? "var(--warning)" : "var(--accent)"} strokeWidth="6" fill="none" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} className="progress-ring-circle" />
                  <text x="38" y="34" textAnchor="middle" fill="var(--text-primary)" fontSize="14" fontWeight="800">{Math.round(Math.min(pct, 999))}%</text>
                  <text x="38" y="47" textAnchor="middle" fill="var(--text-tertiary)" fontSize="9" fontWeight="500">used</text>
                </svg>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {cat && <span className="text-base">{cat.icon}</span>}
                      <h3 className="text-sm font-bold text-text-primary">{budget.name}</h3>
                    </div>
                    {deleteId === budget.id ? (
                      <div className="flex gap-1">
                        <button onClick={() => setDeleteId(null)} className="text-[10px] font-semibold text-text-secondary bg-surface-secondary px-2 py-1 rounded-lg">Keep</button>
                        <button onClick={() => handleDelete(budget.id)} className="text-[10px] font-semibold text-expense bg-expense-light px-2 py-1 rounded-lg">Delete</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteId(budget.id)} className="text-text-tertiary hover:text-expense p-1"><Trash2 size={14} /></button>
                    )}
                  </div>

                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-text-secondary">Spent: <span className="font-bold text-text-primary tabular-nums">{formatCurrency(spent)}</span></span>
                    <span className="text-text-secondary">of <span className="font-bold tabular-nums">{formatCurrency(budget.amount)}</span></span>
                  </div>

                  <div className="mt-1.5 text-xs">
                    {isOver ? (
                      <div className="flex items-center gap-1 text-expense"><AlertTriangle size={12} /> Over budget by {formatCurrency(spent - budget.amount)}</div>
                    ) : isOverPace ? (
                      <div className="flex items-center gap-1 text-warning"><AlertTriangle size={12} /> Spending faster than expected</div>
                    ) : (
                      <div className="flex items-center gap-1 text-income"><CheckCircle2 size={12} /> {formatCurrency(remaining)} remaining</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
