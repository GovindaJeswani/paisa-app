"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Trash2, ArrowUpRight, ArrowDownLeft, HandCoins, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { db } from "@/lib/db";
import { cn, formatCurrency, generateId } from "@/lib/utils";
import { usePersons } from "@/lib/hooks/use-persons";
import { useTransactions } from "@/lib/hooks/use-transactions";
import { createTransaction } from "@/lib/engine/transaction-service";
import type { Person } from "@/lib/types";

export default function PeoplePage() {
  const persons = usePersons();
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [actionPerson, setActionPerson] = useState<string | null>(null);
  const [actionType, setActionType] = useState<"lend" | "borrow" | "settle">("lend");
  const [actionAmount, setActionAmount] = useState("");
  const [actionNote, setActionNote] = useState("");

  const totalOwed = persons.filter((p) => p.netBalance > 0).reduce((s, p) => s + p.netBalance, 0);
  const totalOwe = persons.filter((p) => p.netBalance < 0).reduce((s, p) => s + Math.abs(p.netBalance), 0);

  const handleAddPerson = useCallback(async () => {
    if (!formName.trim()) return;
    const person: Person = {
      id: generateId(), name: formName.trim(), netBalance: 0, createdAt: new Date().toISOString(),
    };
    await db.persons.add(person);
    setFormName(""); setShowForm(false);
  }, [formName]);

  const handleAction = useCallback(async () => {
    if (!actionPerson || !actionAmount) return;
    const amount = parseFloat(actionAmount) || 0;
    if (amount <= 0) return;

    if (actionType === "settle") {
      await db.persons.update(actionPerson, { netBalance: 0 });
    } else {
      await createTransaction({
        amount, type: actionType, categoryId: "cat_other",
        personId: actionPerson, note: actionNote || `${actionType === "lend" ? "Lent" : "Borrowed"} money`,
        importSource: "manual", confidence: 100, confirmed: true,
      });
      // Update person balance
      const person = await db.persons.get(actionPerson);
      if (person) {
        const newBalance = actionType === "lend" ? person.netBalance + amount : person.netBalance - amount;
        await db.persons.update(actionPerson, { netBalance: newBalance });
      }
    }
    setActionPerson(null); setActionAmount(""); setActionNote("");
  }, [actionPerson, actionAmount, actionType, actionNote]);

  const handleDelete = async (id: string) => {
    await db.persons.delete(id);
    setDeleteId(null);
  };

  if (persons.length === 0 && !showForm) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center py-16 text-center">
        <div className="mb-5 animate-float">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl hero-gradient shadow-lg"><span className="text-4xl">👥</span></div>
        </div>
        <h2 className="text-lg font-extrabold text-text-primary">Track who owes what</h2>
        <p className="mt-2 max-w-[260px] text-sm text-text-secondary leading-relaxed">Lend, borrow, and settle up. Never forget who owes you money.</p>
        <button onClick={() => setShowForm(true)} className="mt-6 flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-text-inverse hover:bg-accent-hover transition-colors">
          <Plus size={16} /> Add Someone
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-text-primary">People</h1>
        <button onClick={() => setShowForm(!showForm)} className={cn("flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors", showForm ? "bg-expense-light text-expense" : "bg-accent-light text-accent")}>
          {showForm ? <><X size={14} />Cancel</> : <><Plus size={14} />Add Person</>}
        </button>
      </div>

      {/* Summary */}
      {(totalOwed > 0 || totalOwe > 0) && (
        <div className="grid grid-cols-2 gap-2.5">
          <div className="card-elevated p-3">
            <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">Owed to you</p>
            <p className="text-lg font-extrabold text-income tabular-nums mt-0.5">+{formatCurrency(totalOwed)}</p>
          </div>
          <div className="card-elevated p-3">
            <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">You owe</p>
            <p className="text-lg font-extrabold text-expense tabular-nums mt-0.5">−{formatCurrency(totalOwe)}</p>
          </div>
        </div>
      )}

      {/* Add person form */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="card-elevated p-4 flex gap-2">
              <input type="text" placeholder="Name" value={formName} onChange={(e) => setFormName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddPerson()} className="flex-1 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent" autoFocus />
              <button onClick={handleAddPerson} disabled={!formName.trim()} className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Add</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Person cards */}
      <div className="space-y-3 stagger-children">
        {persons.map((person) => {
          const isPositive = person.netBalance > 0;
          const isNeutral = person.netBalance === 0;
          const isActioning = actionPerson === person.id;

          return (
            <div key={person.id} className="card-elevated p-4">
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className={cn("flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold shrink-0", isPositive ? "bg-income-light text-income" : isNeutral ? "bg-surface-secondary text-text-tertiary" : "bg-expense-light text-expense")}>
                  {person.name.charAt(0).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-text-primary">{person.name}</h3>
                  <p className={cn("text-lg font-extrabold tabular-nums", isPositive ? "text-income" : isNeutral ? "text-text-tertiary" : "text-expense")}>
                    {isPositive ? `+${formatCurrency(person.netBalance)}` : isNeutral ? "Settled ✓" : `−${formatCurrency(Math.abs(person.netBalance))}`}
                  </p>
                  {!isNeutral && (
                    <p className="text-[10px] text-text-tertiary mt-0.5">
                      {isPositive ? "owes you" : "you owe"}
                    </p>
                  )}
                </div>

                {/* Delete */}
                {deleteId === person.id ? (
                  <div className="flex gap-1">
                    <button onClick={() => setDeleteId(null)} className="text-[10px] font-semibold text-text-secondary bg-surface-secondary px-2 py-1 rounded-lg">Keep</button>
                    <button onClick={() => handleDelete(person.id)} className="text-[10px] font-semibold text-expense bg-expense-light px-2 py-1 rounded-lg">Delete</button>
                  </div>
                ) : (
                  <button onClick={() => setDeleteId(person.id)} className="text-text-tertiary hover:text-expense p-1"><Trash2 size={14} /></button>
                )}
              </div>

              {/* Action buttons */}
              {!isActioning && (
                <div className="flex gap-2 mt-3">
                  <button onClick={() => { setActionPerson(person.id); setActionType("lend"); }} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-border-light py-2 text-xs font-semibold text-text-secondary hover:bg-surface-secondary transition-colors">
                    <ArrowUpRight size={13} /> Lend
                  </button>
                  <button onClick={() => { setActionPerson(person.id); setActionType("borrow"); }} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-border-light py-2 text-xs font-semibold text-text-secondary hover:bg-surface-secondary transition-colors">
                    <ArrowDownLeft size={13} /> Borrow
                  </button>
                  {!isNeutral && (
                    <button onClick={() => { setActionPerson(person.id); setActionType("settle"); }} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-income/30 py-2 text-xs font-semibold text-income hover:bg-income-light transition-colors">
                      <CheckCircle2 size={13} /> Settle
                    </button>
                  )}
                </div>
              )}

              {/* Action form */}
              <AnimatePresence>
                {isActioning && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="mt-3 p-3 rounded-xl bg-surface-secondary space-y-2">
                      <p className="text-xs font-bold text-text-primary capitalize">{actionType === "settle" ? "Settle up" : actionType} {actionType !== "settle" ? "money" : ""}</p>
                      {actionType !== "settle" && (
                        <>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-text-tertiary">₹</span>
                            <input type="number" placeholder="Amount" value={actionAmount} onChange={(e) => setActionAmount(e.target.value)} className="w-full rounded-lg border border-border bg-surface pl-6 pr-2 py-2 text-sm outline-none focus:border-accent tabular-nums" autoFocus />
                          </div>
                          <input type="text" placeholder="Note (optional)" value={actionNote} onChange={(e) => setActionNote(e.target.value)} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs outline-none focus:border-accent" />
                        </>
                      )}
                      <div className="flex gap-2">
                        <button onClick={handleAction} disabled={actionType !== "settle" && !actionAmount} className="flex-1 rounded-lg bg-accent py-2 text-xs font-semibold text-white disabled:opacity-50">
                          {actionType === "settle" ? "Mark Settled" : "Confirm"}
                        </button>
                        <button onClick={() => { setActionPerson(null); setActionAmount(""); setActionNote(""); }} className="rounded-lg bg-surface px-3 py-2 text-xs text-text-secondary border border-border">Cancel</button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
