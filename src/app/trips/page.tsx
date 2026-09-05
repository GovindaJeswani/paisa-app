"use client";

import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Trash2, MapPin, Calendar, Receipt } from "lucide-react";
import { format, differenceInDays, parseISO } from "date-fns";
import { db } from "@/lib/db";
import { cn, formatCurrency, generateId } from "@/lib/utils";
import { useLiveQuery } from "dexie-react-hooks";
import { useTransactions } from "@/lib/hooks/use-transactions";
import { useCategoryMap } from "@/lib/hooks/use-categories";
import type { FinancialEvent } from "@/lib/types";

export default function TripsPage() {
  const events = useLiveQuery(() => db.financialEvents.toArray()) ?? [];
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", startDate: format(new Date(), "yyyy-MM-dd"), endDate: "", budget: "" });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    if (!form.name.trim() || !form.startDate) return;
    const event: FinancialEvent = {
      id: generateId(), name: form.name.trim(), startDate: form.startDate,
      endDate: form.endDate || form.startDate,
      budget: form.budget ? parseFloat(form.budget) : undefined,
      createdAt: new Date().toISOString(),
    };
    await db.financialEvents.add(event);
    setForm({ name: "", startDate: format(new Date(), "yyyy-MM-dd"), endDate: "", budget: "" });
    setShowForm(false);
  }, [form]);

  const handleDelete = async (id: string) => {
    await db.financialEvents.delete(id);
    setDeleteId(null);
  };

  if (events.length === 0 && !showForm) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center py-16 text-center">
        <div className="mb-5 animate-float">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl hero-gradient shadow-lg"><span className="text-4xl">✈️</span></div>
        </div>
        <h2 className="text-lg font-extrabold text-text-primary">Track trip & event expenses</h2>
        <p className="mt-2 max-w-[260px] text-sm text-text-secondary leading-relaxed">Create financial events for trips, weddings, festivals. See total spending per event.</p>
        <button onClick={() => setShowForm(true)} className="mt-6 flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-text-inverse hover:bg-accent-hover transition-colors">
          <Plus size={16} /> Create Event
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-text-primary">Trips & Events</h1>
        <button onClick={() => setShowForm(!showForm)} className={cn("flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors", showForm ? "bg-expense-light text-expense" : "bg-accent-light text-accent")}>
          {showForm ? <><X size={14} />Cancel</> : <><Plus size={14} />New Event</>}
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="card-elevated p-4 space-y-3">
              <input type="text" placeholder="Event name (e.g. Goa Trip)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent" />
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[10px] font-semibold text-text-tertiary uppercase mb-1 block">Start</label>
                  <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent text-text-primary" /></div>
                <div><label className="text-[10px] font-semibold text-text-tertiary uppercase mb-1 block">End</label>
                  <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent text-text-primary" /></div>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-text-tertiary font-semibold">₹</span>
                <input type="number" placeholder="Budget (optional)" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })}
                  className="w-full rounded-xl border border-border bg-surface pl-7 pr-3.5 py-2.5 text-sm outline-none focus:border-accent tabular-nums" />
              </div>
              <button onClick={handleSave} disabled={!form.name.trim()} className="w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-text-inverse disabled:opacity-50">Create Event</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-3 stagger-children">
        {events.sort((a, b) => b.startDate.localeCompare(a.startDate)).map((event) => (
          <EventCard key={event.id} event={event}
            expanded={expandedId === event.id}
            onToggle={() => setExpandedId(expandedId === event.id ? null : event.id)}
            deleteId={deleteId} onRequestDelete={() => setDeleteId(event.id)}
            onCancelDelete={() => setDeleteId(null)} onDelete={() => handleDelete(event.id)} />
        ))}
      </div>
    </motion.div>
  );
}

function EventCard({ event, expanded, onToggle, deleteId, onRequestDelete, onCancelDelete, onDelete }: {
  event: FinancialEvent; expanded: boolean; onToggle: () => void;
  deleteId: string | null; onRequestDelete: () => void; onCancelDelete: () => void; onDelete: () => void;
}) {
  const txns = useTransactions(event.startDate, event.endDate);
  const categoryMap = useCategoryMap();
  const totalSpent = txns.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const days = differenceInDays(parseISO(event.endDate), parseISO(event.startDate)) + 1;

  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    txns.filter((t) => t.type === "expense").forEach((t) => map.set(t.categoryId, (map.get(t.categoryId) || 0) + t.amount));
    return Array.from(map.entries()).map(([id, amount]) => ({ category: categoryMap.get(id), amount })).filter((c) => c.category).sort((a, b) => b.amount - a.amount);
  }, [txns, categoryMap]);

  return (
    <div className="card-elevated p-4">
      <button onClick={onToggle} className="w-full text-left">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-light text-lg">✈️</div>
            <div>
              <h3 className="text-sm font-bold text-text-primary">{event.name}</h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Calendar size={10} className="text-text-tertiary" />
                <span className="text-[10px] text-text-tertiary">{format(parseISO(event.startDate), "d MMM")} – {format(parseISO(event.endDate), "d MMM yyyy")} · {days} days</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-extrabold text-expense tabular-nums">{formatCurrency(totalSpent)}</p>
            {event.budget && <p className="text-[10px] text-text-tertiary">of {formatCurrency(event.budget)}</p>}
          </div>
        </div>
      </button>

      {expanded && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-3 pt-3 border-t border-border-light">
          {categoryBreakdown.length > 0 ? (
            <div className="space-y-1.5 mb-3">
              {categoryBreakdown.map(({ category, amount }) => (
                <div key={category!.id} className="flex items-center justify-between text-xs">
                  <span className="text-text-secondary">{category!.icon} {category!.name}</span>
                  <span className="font-bold tabular-nums text-text-primary">{formatCurrency(amount)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-tertiary mb-3">No expenses recorded during this period</p>
          )}
          {deleteId === event.id ? (
            <div className="flex gap-2">
              <button onClick={onCancelDelete} className="flex-1 rounded-lg bg-surface-secondary py-1.5 text-xs font-semibold text-text-secondary">Keep</button>
              <button onClick={onDelete} className="flex-1 rounded-lg bg-expense-light py-1.5 text-xs font-semibold text-expense">Delete</button>
            </div>
          ) : (
            <button onClick={onRequestDelete} className="flex items-center gap-1 text-xs text-text-tertiary hover:text-expense"><Trash2 size={12} /> Delete event</button>
          )}
        </motion.div>
      )}
    </div>
  );
}
