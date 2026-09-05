"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Trash2, Pause, Play, CalendarCheck, ChevronDown } from "lucide-react";
import { format, parseISO, isBefore } from "date-fns";
import { db } from "@/lib/db";
import { cn, formatCurrency, generateId } from "@/lib/utils";
import { useLiveQuery } from "dexie-react-hooks";
import { useCategories } from "@/lib/hooks/use-categories";
import type { RecurringTransaction, RecurrenceFrequency } from "@/lib/types";

const FREQUENCIES: { value: RecurrenceFrequency; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Bi-weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
];

export default function RecurringPage() {
  const recurring = useLiveQuery(() => db.recurringTransactions.toArray()) ?? [];
  const categories = useCategories("expense");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", amount: "", categoryId: "", frequency: "monthly" as RecurrenceFrequency, nextDueDate: format(new Date(), "yyyy-MM-dd") });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const upcoming = recurring.filter((r) => !r.isPaused).sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate));
  const paused = recurring.filter((r) => r.isPaused);

  const handleSave = useCallback(async () => {
    if (!form.name.trim() || !form.amount) return;
    const rec: RecurringTransaction = {
      id: generateId(), name: form.name.trim(), amount: parseFloat(form.amount) || 0,
      type: "expense", categoryId: form.categoryId || "cat_other",
      frequency: form.frequency, startDate: format(new Date(), "yyyy-MM-dd"),
      nextDueDate: form.nextDueDate, isPaused: false, autoDetected: false,
      createdAt: new Date().toISOString(),
    };
    await db.recurringTransactions.add(rec);
    setForm({ name: "", amount: "", categoryId: "", frequency: "monthly", nextDueDate: format(new Date(), "yyyy-MM-dd") });
    setShowForm(false);
  }, [form]);

  const togglePause = async (id: string, currentPaused: boolean) => {
    await db.recurringTransactions.update(id, { isPaused: !currentPaused });
  };

  const handleDelete = async (id: string) => {
    await db.recurringTransactions.delete(id);
    setDeleteId(null);
  };

  const markPaid = async (id: string) => {
    const rec = await db.recurringTransactions.get(id);
    if (!rec) return;
    await db.recurringTransactions.update(id, { lastPaidDate: format(new Date(), "yyyy-MM-dd") });
  };

  const monthlyTotal = upcoming.reduce((s, r) => {
    if (r.frequency === "monthly") return s + r.amount;
    if (r.frequency === "weekly") return s + r.amount * 4;
    if (r.frequency === "biweekly") return s + r.amount * 2;
    if (r.frequency === "yearly") return s + r.amount / 12;
    if (r.frequency === "quarterly") return s + r.amount / 3;
    return s + r.amount * 30;
  }, 0);

  if (recurring.length === 0 && !showForm) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center py-16 text-center">
        <div className="mb-5 animate-float">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl hero-gradient shadow-lg"><span className="text-4xl">🔄</span></div>
        </div>
        <h2 className="text-lg font-extrabold text-text-primary">Track recurring payments</h2>
        <p className="mt-2 max-w-[260px] text-sm text-text-secondary leading-relaxed">Subscriptions, rent, SIPs, EMIs — know exactly what's coming.</p>
        <button onClick={() => setShowForm(true)} className="mt-6 flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-text-inverse hover:bg-accent-hover transition-colors">
          <Plus size={16} /> Add Recurring
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-text-primary">Recurring</h1>
        <button onClick={() => setShowForm(!showForm)} className={cn("flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors", showForm ? "bg-expense-light text-expense" : "bg-accent-light text-accent")}>
          {showForm ? <><X size={14} />Cancel</> : <><Plus size={14} />Add</>}
        </button>
      </div>

      {/* Monthly total */}
      <div className="hero-gradient rounded-2xl p-4 relative overflow-hidden">
        <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-white/10" />
        <p className="text-xs text-white/70">Monthly recurring</p>
        <p className="text-2xl font-extrabold text-white tabular-nums mt-0.5">{formatCurrency(monthlyTotal)}</p>
        <p className="text-[10px] text-white/50 mt-1">{upcoming.length} active payment{upcoming.length !== 1 ? "s" : ""}</p>
      </div>

      {/* Add form */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="card-elevated p-4 space-y-3">
              <input type="text" placeholder="Name (e.g. Netflix, Rent)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent" />
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-text-tertiary font-semibold">₹</span>
                <input type="number" placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="w-full rounded-xl border border-border bg-surface pl-7 pr-3.5 py-2.5 text-sm outline-none focus:border-accent tabular-nums" />
              </div>
              <div className="relative">
                <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value as RecurrenceFrequency })} className="w-full appearance-none rounded-xl border border-border bg-surface px-3.5 py-2.5 pr-9 text-sm outline-none focus:border-accent">
                  {FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
              </div>
              <input type="date" value={form.nextDueDate} onChange={(e) => setForm({ ...form, nextDueDate: e.target.value })} className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent text-text-primary" />
              <div>
                <label className="text-xs font-semibold text-text-secondary mb-1.5 block">Category</label>
                <div className="flex flex-wrap gap-1.5">
                  {categories.slice(0, 8).map((cat) => (
                    <button key={cat.id} onClick={() => setForm({ ...form, categoryId: cat.id })} className={cn("rounded-full px-2.5 py-1 text-xs font-medium border flex items-center gap-1 transition-all", form.categoryId === cat.id ? "border-accent bg-accent-light text-accent" : "border-border-light text-text-secondary")}>
                      {cat.icon} {cat.name}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={handleSave} disabled={!form.name.trim() || !form.amount} className="w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-text-inverse disabled:opacity-50">Add</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div>
          <h3 className="text-[13px] font-bold text-text-primary mb-2">Upcoming</h3>
          <div className="space-y-2 stagger-children">
            {upcoming.map((rec) => {
              const cat = categories.find((c) => c.id === rec.categoryId);
              const isOverdue = isBefore(parseISO(rec.nextDueDate), new Date());
              return (
                <div key={rec.id} className="card-elevated p-3.5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl text-base shrink-0" style={{ backgroundColor: `${cat?.color || "#6366F1"}18` }}>
                      {cat?.icon || "📄"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-text-primary truncate">{rec.name}</h4>
                        <span className="text-sm font-extrabold text-text-primary tabular-nums">{formatCurrency(rec.amount)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={cn("text-[10px] font-semibold rounded-full px-1.5 py-0.5", isOverdue ? "bg-expense-light text-expense" : "bg-surface-secondary text-text-tertiary")}>
                          {isOverdue ? "Overdue" : format(parseISO(rec.nextDueDate), "d MMM")}
                        </span>
                        <span className="text-[10px] text-text-tertiary capitalize">{rec.frequency}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1.5 mt-2.5">
                    <button onClick={() => markPaid(rec.id)} className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-income/30 py-1.5 text-[11px] font-semibold text-income hover:bg-income-light transition-colors">
                      <CalendarCheck size={12} /> Mark Paid
                    </button>
                    <button onClick={() => togglePause(rec.id, rec.isPaused)} className="rounded-lg border border-border-light px-3 py-1.5 text-[11px] font-semibold text-text-secondary hover:bg-surface-secondary transition-colors">
                      <Pause size={12} />
                    </button>
                    {deleteId === rec.id ? (
                      <div className="flex gap-1">
                        <button onClick={() => setDeleteId(null)} className="text-[10px] font-semibold text-text-secondary bg-surface-secondary px-2 py-1 rounded-lg">Keep</button>
                        <button onClick={() => handleDelete(rec.id)} className="text-[10px] font-semibold text-expense bg-expense-light px-2 py-1 rounded-lg">Delete</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteId(rec.id)} className="rounded-lg border border-border-light px-2 py-1.5 text-text-tertiary hover:text-expense transition-colors">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Paused */}
      {paused.length > 0 && (
        <div>
          <h3 className="text-[13px] font-bold text-text-tertiary mb-2">Paused</h3>
          <div className="space-y-2">
            {paused.map((rec) => (
              <div key={rec.id} className="card-elevated p-3 opacity-60">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-text-secondary">{rec.name}</h4>
                    <p className="text-xs text-text-tertiary tabular-nums">{formatCurrency(rec.amount)} · {rec.frequency}</p>
                  </div>
                  <button onClick={() => togglePause(rec.id, rec.isPaused)} className="flex items-center gap-1 rounded-lg bg-accent-light px-3 py-1.5 text-xs font-semibold text-accent">
                    <Play size={12} /> Resume
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
