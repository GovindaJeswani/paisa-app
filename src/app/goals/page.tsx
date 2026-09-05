"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Trash2, CalendarDays, TrendingUp } from "lucide-react";
import { format, differenceInMonths, addMonths } from "date-fns";
import { db } from "@/lib/db";
import { cn, formatCurrency, generateId, clampPercent } from "@/lib/utils";
import { useGoals } from "@/lib/hooks/use-goals";
import type { Goal } from "@/lib/types";

const GOAL_ICONS = ["🎯", "🛡️", "💻", "🏖️", "📱", "🎓", "🏠", "🚗", "💍", "✈️", "🎮", "👔"];
const GOAL_COLORS = ["#10B981", "#6366F1", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6", "#3B82F6"];

export default function GoalsPage() {
  const goals = useGoals();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", target: "", icon: "🎯", color: "#6366F1", deadline: "" });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [contributeId, setContributeId] = useState<string | null>(null);
  const [contributeAmount, setContributeAmount] = useState("");

  const handleSave = useCallback(async () => {
    if (!form.name.trim() || !form.target) return;
    const goal: Goal = {
      id: generateId(), name: form.name.trim(), icon: form.icon, color: form.color,
      targetAmount: parseFloat(form.target) || 0, currentAmount: 0,
      deadline: form.deadline || undefined, isCompleted: false, isActive: true,
      createdAt: new Date().toISOString(),
    };
    await db.goals.add(goal);
    setForm({ name: "", target: "", icon: "🎯", color: "#6366F1", deadline: "" });
    setShowForm(false);
  }, [form]);

  const handleContribute = useCallback(async () => {
    if (!contributeId || !contributeAmount) return;
    const goal = await db.goals.get(contributeId);
    if (!goal) return;
    const newAmount = goal.currentAmount + (parseFloat(contributeAmount) || 0);
    await db.goals.update(contributeId, {
      currentAmount: Math.min(newAmount, goal.targetAmount),
      isCompleted: newAmount >= goal.targetAmount,
    });
    setContributeId(null); setContributeAmount("");
  }, [contributeId, contributeAmount]);

  const handleDelete = async (id: string) => {
    await db.goals.update(id, { isActive: false });
    setDeleteId(null);
  };

  if (goals.length === 0 && !showForm) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center py-16 text-center">
        <div className="mb-5 animate-float">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl hero-gradient shadow-lg"><span className="text-4xl">🎯</span></div>
        </div>
        <h2 className="text-lg font-extrabold text-text-primary">Give your money a destination</h2>
        <p className="mt-2 max-w-[260px] text-sm text-text-secondary leading-relaxed">Set savings goals and track your progress visually.</p>
        <button onClick={() => setShowForm(true)} className="mt-6 flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-text-inverse hover:bg-accent-hover transition-colors tap-target">
          <Plus size={16} /> Create First Goal
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-text-primary">Goals</h1>
        <button onClick={() => setShowForm(!showForm)} className={cn("flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors", showForm ? "bg-expense-light text-expense" : "bg-accent-light text-accent")}>
          {showForm ? <><X size={14} />Cancel</> : <><Plus size={14} />New Goal</>}
        </button>
      </div>

      {/* Add form */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="card-elevated p-4 space-y-3">
              <input type="text" placeholder="Goal name (e.g. Emergency Fund)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent" />
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-text-tertiary font-semibold">₹</span>
                <input type="number" placeholder="Target amount" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} className="w-full rounded-xl border border-border bg-surface pl-7 pr-3.5 py-2.5 text-sm outline-none focus:border-accent tabular-nums" />
              </div>
              <input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent text-text-primary" />
              <div>
                <label className="text-xs font-semibold text-text-secondary mb-1.5 block">Icon</label>
                <div className="flex flex-wrap gap-2">
                  {GOAL_ICONS.map((icon) => (
                    <button key={icon} onClick={() => setForm({ ...form, icon })} className={cn("h-10 w-10 rounded-xl text-lg flex items-center justify-center transition-all", form.icon === icon ? "bg-accent-light ring-2 ring-accent" : "bg-surface-secondary")}>
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-text-secondary mb-1.5 block">Color</label>
                <div className="flex gap-2">
                  {GOAL_COLORS.map((color) => (
                    <button key={color} onClick={() => setForm({ ...form, color })} className={cn("h-7 w-7 rounded-full transition-all", form.color === color && "ring-2 ring-offset-2 ring-offset-surface")} style={{ backgroundColor: color }} />
                  ))}
                </div>
              </div>
              <button onClick={handleSave} disabled={!form.name.trim() || !form.target} className="w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-text-inverse disabled:opacity-50">
                Create Goal
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Goal cards */}
      <div className="space-y-3 stagger-children">
        {goals.map((goal) => {
          const pct = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
          const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
          const radius = 40; const circumference = 2 * Math.PI * radius;
          const offset = circumference - (clampPercent(pct) / 100) * circumference;

          // Projected completion
          let projectedDate = "";
          if (goal.deadline && goal.currentAmount > 0 && goal.currentAmount < goal.targetAmount) {
            const monthsElapsed = Math.max(1, differenceInMonths(new Date(), new Date(goal.createdAt)));
            const monthlyRate = goal.currentAmount / monthsElapsed;
            const monthsNeeded = monthlyRate > 0 ? remaining / monthlyRate : 0;
            projectedDate = format(addMonths(new Date(), Math.ceil(monthsNeeded)), "MMM yyyy");
          }

          return (
            <div key={goal.id} className="card-elevated p-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 rounded-t-xl" style={{ background: `linear-gradient(90deg, ${goal.color || "var(--accent)"} ${clampPercent(pct)}%, var(--surface-secondary) ${clampPercent(pct)}%)` }} />

              <div className="flex items-center gap-4 mt-1">
                {/* Progress ring */}
                <svg width="88" height="88" viewBox="0 0 88 88" className="shrink-0">
                  <circle cx="44" cy="44" r={radius} stroke="var(--surface-secondary)" strokeWidth="6" fill="none" />
                  <circle cx="44" cy="44" r={radius} stroke={goal.color || "var(--accent)"} strokeWidth="6" fill="none" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} className="progress-ring-circle" />
                  <text x="44" y="40" textAnchor="middle" fill="var(--text-primary)" fontSize="16" fontWeight="800">{Math.round(pct)}%</text>
                  <text x="44" y="54" textAnchor="middle" fill="var(--text-tertiary)" fontSize="9">{goal.isCompleted ? "Done!" : "saved"}</text>
                </svg>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-text-primary">{goal.icon} {goal.name}</h3>
                    {deleteId === goal.id ? (
                      <div className="flex gap-1">
                        <button onClick={() => setDeleteId(null)} className="text-[10px] font-semibold text-text-secondary bg-surface-secondary px-2 py-1 rounded-lg">Keep</button>
                        <button onClick={() => handleDelete(goal.id)} className="text-[10px] font-semibold text-expense bg-expense-light px-2 py-1 rounded-lg">Delete</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteId(goal.id)} className="text-text-tertiary hover:text-expense p-1"><Trash2 size={14} /></button>
                    )}
                  </div>

                  <div className="mt-1 flex items-center justify-between text-xs text-text-secondary">
                    <span className="tabular-nums">{formatCurrency(goal.currentAmount)}</span>
                    <span className="tabular-nums">{formatCurrency(goal.targetAmount)}</span>
                  </div>

                  {goal.deadline && (
                    <div className="flex items-center gap-1 mt-1.5 text-xs text-text-tertiary">
                      <CalendarDays size={11} />
                      <span>Deadline: {format(new Date(goal.deadline), "d MMM yyyy")}</span>
                    </div>
                  )}
                  {projectedDate && (
                    <div className="flex items-center gap-1 mt-0.5 text-xs text-text-tertiary">
                      <TrendingUp size={11} />
                      <span>On track for {projectedDate}</span>
                    </div>
                  )}

                  {/* Contribute button */}
                  {!goal.isCompleted && (
                    contributeId === goal.id ? (
                      <div className="flex gap-2 mt-2">
                        <div className="relative flex-1">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-text-tertiary">₹</span>
                          <input type="number" placeholder="0" value={contributeAmount} onChange={(e) => setContributeAmount(e.target.value)} className="w-full rounded-lg border border-border bg-surface pl-6 pr-2 py-1.5 text-xs outline-none focus:border-accent tabular-nums" autoFocus />
                        </div>
                        <button onClick={handleContribute} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white">Add</button>
                        <button onClick={() => { setContributeId(null); setContributeAmount(""); }} className="rounded-lg bg-surface-secondary px-2 py-1.5 text-xs text-text-secondary">✕</button>
                      </div>
                    ) : (
                      <button onClick={() => setContributeId(goal.id)} className="mt-2 text-xs font-semibold text-accent hover:underline">
                        + Add contribution
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
