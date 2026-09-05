"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Trash2, TrendingUp, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { db } from "@/lib/db";
import { cn, formatCurrency, generateId } from "@/lib/utils";
import { useLiveQuery } from "dexie-react-hooks";
import type { Investment, InvestmentType } from "@/lib/types";

const TYPES: { value: InvestmentType; label: string; icon: string }[] = [
  { value: "sip", label: "SIP", icon: "📊" },
  { value: "mutual_fund", label: "Mutual Fund", icon: "📈" },
  { value: "fd", label: "Fixed Deposit", icon: "🏦" },
  { value: "stock", label: "Stocks", icon: "📉" },
  { value: "gold", label: "Gold", icon: "🪙" },
  { value: "ppf", label: "PPF", icon: "🔒" },
  { value: "nps", label: "NPS", icon: "🏛️" },
  { value: "other", label: "Other", icon: "💼" },
];

export default function InvestmentsPage() {
  const investments = useLiveQuery(() => db.investments.filter((i) => i.isActive).toArray()) ?? [];
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", type: "sip" as InvestmentType, amount: "", frequency: "monthly" });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const totalInvested = investments.reduce((s, i) => s + i.amount, 0);

  const handleSave = useCallback(async () => {
    if (!form.name.trim() || !form.amount) return;
    const inv: Investment = {
      id: generateId(), name: form.name.trim(), type: form.type,
      amount: parseFloat(form.amount) || 0,
      frequency: form.type === "sip" ? "monthly" : undefined,
      startDate: format(new Date(), "yyyy-MM-dd"), isActive: true,
      createdAt: new Date().toISOString(),
    };
    await db.investments.add(inv);
    setForm({ name: "", type: "sip", amount: "", frequency: "monthly" });
    setShowForm(false);
  }, [form]);

  const handleDelete = async (id: string) => {
    await db.investments.update(id, { isActive: false });
    setDeleteId(null);
  };

  if (investments.length === 0 && !showForm) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center py-16 text-center">
        <div className="mb-5 animate-float">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl hero-gradient shadow-lg"><span className="text-4xl">📈</span></div>
        </div>
        <h2 className="text-lg font-extrabold text-text-primary">Track your investments</h2>
        <p className="mt-2 max-w-[260px] text-sm text-text-secondary leading-relaxed">SIPs, mutual funds, FDs, stocks — see your wealth grow.</p>
        <button onClick={() => setShowForm(true)} className="mt-6 flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-text-inverse hover:bg-accent-hover transition-colors">
          <Plus size={16} /> Add Investment
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-text-primary">Investments</h1>
        <button onClick={() => setShowForm(!showForm)} className={cn("flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors", showForm ? "bg-expense-light text-expense" : "bg-accent-light text-accent")}>
          {showForm ? <><X size={14} />Cancel</> : <><Plus size={14} />Add</>}
        </button>
      </div>

      {/* Total hero */}
      <div className="investment-gradient rounded-2xl p-4 text-white relative overflow-hidden">
        <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-white/10" />
        <p className="text-xs text-white/70">Total invested</p>
        <p className="text-2xl font-extrabold tabular-nums mt-0.5">{formatCurrency(totalInvested)}</p>
        <p className="text-[10px] text-white/50 mt-1">{investments.length} investment{investments.length !== 1 ? "s" : ""}</p>
      </div>

      {/* Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="card-elevated p-4 space-y-3">
              <input type="text" placeholder="Name (e.g. Axis Bluechip SIP)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent" />
              <div>
                <label className="text-xs font-semibold text-text-secondary mb-1.5 block">Type</label>
                <div className="flex flex-wrap gap-1.5">
                  {TYPES.map((t) => (
                    <button key={t.value} onClick={() => setForm({ ...form, type: t.value })} className={cn("rounded-full px-2.5 py-1 text-xs font-medium border flex items-center gap-1 transition-all", form.type === t.value ? "border-accent bg-accent-light text-accent" : "border-border-light text-text-secondary")}>
                      {t.icon} {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-text-tertiary font-semibold">₹</span>
                <input type="number" placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="w-full rounded-xl border border-border bg-surface pl-7 pr-3.5 py-2.5 text-sm outline-none focus:border-accent tabular-nums" />
              </div>
              <button onClick={handleSave} disabled={!form.name.trim() || !form.amount} className="w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-text-inverse disabled:opacity-50">Add Investment</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* List */}
      <div className="space-y-2 stagger-children">
        {investments.map((inv) => {
          const typeInfo = TYPES.find((t) => t.value === inv.type);
          return (
            <div key={inv.id} className="card-elevated p-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-investment-light text-xl shrink-0">{typeInfo?.icon || "💼"}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-text-primary truncate">{inv.name}</h4>
                    <span className="text-sm font-extrabold text-text-primary tabular-nums">{formatCurrency(inv.amount)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-semibold text-text-tertiary uppercase">{typeInfo?.label}</span>
                    {inv.frequency && <span className="text-[10px] text-text-tertiary">· {inv.frequency}</span>}
                  </div>
                </div>
                {deleteId === inv.id ? (
                  <div className="flex gap-1">
                    <button onClick={() => setDeleteId(null)} className="text-[10px] font-semibold text-text-secondary bg-surface-secondary px-2 py-1 rounded-lg">Keep</button>
                    <button onClick={() => handleDelete(inv.id)} className="text-[10px] font-semibold text-expense bg-expense-light px-2 py-1 rounded-lg">Delete</button>
                  </div>
                ) : (
                  <button onClick={() => setDeleteId(inv.id)} className="text-text-tertiary hover:text-expense p-1"><Trash2 size={14} /></button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
