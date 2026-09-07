"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, ArrowDown, ArrowUp, ArrowRightLeft, PiggyBank, TrendingUp,
  HandCoins, Check, Pencil, AlertTriangle, Copy,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { processInput, saveDraft, type PipelineAction, type TransactionDraft } from "@/lib/engine/intelligence";
import { useCategories, useCategoryMap } from "@/lib/hooks/use-categories";
import { usePersons } from "@/lib/hooks/use-persons";
import { useAccounts } from "@/lib/hooks/use-accounts";
import { db } from "@/lib/db";
import { generateId } from "@/lib/utils";
import type { TransactionType } from "@/lib/types";

const TYPE_OPTIONS: { type: TransactionType; label: string; icon: typeof ArrowDown }[] = [
  { type: "expense", label: "Expense", icon: ArrowDown },
  { type: "income", label: "Income", icon: ArrowUp },
  { type: "transfer", label: "Transfer", icon: ArrowRightLeft },
  { type: "saving", label: "Saving", icon: PiggyBank },
  { type: "investment", label: "Invest", icon: TrendingUp },
  { type: "lend", label: "Lend", icon: HandCoins },
];

interface QuickAddSheetProps { isOpen: boolean; onClose: () => void; }

export function QuickAddSheet({ isOpen, onClose }: QuickAddSheetProps) {
  const [input, setInput] = useState("");
  const [action, setAction] = useState<PipelineAction | null>(null);
  const [processing, setProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editType, setEditType] = useState<TransactionType>("expense");
  const [editAmount, setEditAmount] = useState("");
  const [editMerchant, setEditMerchant] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editPerson, setEditPerson] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const categoryMap = useCategoryMap();
  const categories = useCategories("expense");
  const allCategories = useCategories();
  const persons = usePersons();
  const accounts = useAccounts();

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setInput(""); setAction(null); setShowSuccess(false); setEditMode(false); setEditMerchant(""); setEditNote(""); setEditPerson("");
    }
  }, [isOpen]);

  const handleProcess = useCallback(async () => {
    if (!input.trim()) return;
    setProcessing(true);
    try {
      const result = await processInput(input);
      setAction(result);
      if (result.type === "auto_save") {
        // Auto-saved! Show success briefly
        setShowSuccess(true);
        setTimeout(() => onClose(), 900);
      } else if (result.type === "confirm" || result.type === "review") {
        setEditAmount(String(result.draft.amount));
        setEditType(result.draft.type);
        setEditMerchant(result.draft.merchant || "");
        setEditNote(result.draft.note || "");
      }
    } finally {
      setProcessing(false);
    }
  }, [input, onClose]);

  const handleConfirm = useCallback(async () => {
    if (!action || (action.type !== "confirm" && action.type !== "review" && action.type !== "duplicate")) return;
    setProcessing(true);
    try {
      const draft: TransactionDraft = {
        ...action.draft,
        amount: parseFloat(editAmount) || action.draft.amount,
        type: editType,
        merchant: editMerchant || action.draft.merchant,
        note: editNote || action.draft.note,
      };
      // Handle person
      if (editPerson.trim()) {
        const existing = persons.find((p) => p.name.toLowerCase() === editPerson.trim().toLowerCase());
        if (existing) {
          draft.personId = existing.id;
        } else {
          const newPerson = { id: generateId(), name: editPerson.trim(), netBalance: 0, createdAt: new Date().toISOString() };
          await db.persons.add(newPerson);
          draft.personId = newPerson.id;
        }
      }
      await saveDraft(draft);
      setShowSuccess(true);
      setTimeout(() => onClose(), 800);
    } finally {
      setProcessing(false);
    }
  }, [action, editAmount, editType, editMerchant, editNote, editPerson, persons, onClose]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !action) { e.preventDefault(); handleProcess(); }
    else if (e.key === "Enter" && action && action.type !== "auto_save") { e.preventDefault(); handleConfirm(); }
    else if (e.key === "Escape") onClose();
  };

  const draft = action && action.type !== "auto_save" ? action.draft : null;
  const category = draft?.categoryId ? categoryMap.get(draft.categoryId) : null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={onClose} />

          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 350 }}
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-surface shadow-xl max-h-[85vh] overflow-y-auto"
          >
            <div className="flex justify-center py-2"><div className="h-1 w-10 rounded-full bg-border" /></div>

            <div className="px-5 pb-8">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-text-primary">
                  {showSuccess ? "Done ✓" : action?.type === "auto_save" ? "Saved!" : "What happened?"}
                </h2>
                <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface-secondary transition-colors">
                  <X size={18} className="text-text-secondary" />
                </button>
              </div>

              {/* Success */}
              {showSuccess && (
                <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center gap-2 py-6">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-income-light">
                    <Check size={28} className="text-income" />
                  </div>
                  <p className="text-sm text-text-secondary">Transaction saved</p>
                  {action?.type === "auto_save" && (
                    <p className="text-[10px] text-text-tertiary">Auto-detected and saved — no input needed</p>
                  )}
                </motion.div>
              )}

              {!showSuccess && (
                <>
                  {/* Input */}
                  <input ref={inputRef} type="text" value={input}
                    onChange={(e) => { setInput(e.target.value); setAction(null); }}
                    onKeyDown={handleKeyDown}
                    placeholder='Type naturally: "Spent 450 on dinner" or paste bank SMS'
                    className="w-full rounded-xl border border-border bg-surface-secondary px-4 py-3.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all"
                  />

                  {/* Parsed result — confirm */}
                  {draft && action && !editMode && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-xl border border-border bg-surface-secondary p-4">
                      {/* Question from intelligence */}
                      {action.type === "confirm" && (action as { question?: string }).question && (
                        <p className="text-xs font-semibold text-accent mb-2">
                          {(action as { question?: string }).question}
                        </p>
                      )}
                      {action.type === "duplicate" && (
                        <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-warning">
                          <Copy size={12} /> Possible duplicate detected
                        </div>
                      )}
                      {action.type === "review" && (
                        <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-warning">
                          <AlertTriangle size={12} /> I need a little help with this one
                        </div>
                      )}

                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <span className="text-2xl font-extrabold text-text-primary tabular-nums">
                            {formatCurrency(parseFloat(editAmount) || draft.amount)}
                          </span>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                            {category && (
                              <span className="flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 font-medium text-text-secondary">
                                {category.icon} {category.name}
                              </span>
                            )}
                            {draft.merchant && <span className="rounded-full bg-surface px-2 py-0.5 text-text-secondary">{draft.merchant}</span>}
                            {draft.personId && <span className="rounded-full bg-surface px-2 py-0.5 text-text-secondary">👤</span>}
                            {draft.accountId && <span className="rounded-full bg-surface px-2 py-0.5 text-text-secondary">🏦</span>}
                            {draft.eventId && <span className="rounded-full bg-surface px-2 py-0.5 text-text-secondary">✈️</span>}
                          </div>
                          {/* Show what was inferred */}
                          {draft.inferences.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {draft.inferences.map((inf, i) => (
                                <span key={i} className="text-[9px] text-text-tertiary bg-surface rounded px-1.5 py-0.5">
                                  {inf.field}: {inf.source === "user_learned" ? "learned" : inf.source}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <button onClick={() => setEditMode(true)} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface transition-colors">
                          <Pencil size={14} className="text-text-tertiary" />
                        </button>
                      </div>

                      <div className="mt-4 flex gap-2">
                        <button onClick={handleConfirm} disabled={processing}
                          className="flex-1 rounded-xl bg-accent py-3 text-sm font-bold text-white transition-all hover:bg-accent-hover active:scale-[0.98] disabled:opacity-50">
                          {processing ? "Saving..." : action.type === "duplicate" ? "Save Anyway" : "Save"}
                        </button>
                        <button onClick={() => { setAction(null); setInput(""); inputRef.current?.focus(); }}
                          className="rounded-xl border border-border px-4 py-3 text-sm font-medium text-text-secondary hover:bg-surface transition-colors">
                          Clear
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* Edit mode — full custom fields */}
                  {draft && action && editMode && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 space-y-3 max-h-[55vh] overflow-y-auto">
                      {/* Amount */}
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary font-bold">₹</span>
                        <input type="number" value={editAmount} onChange={(e) => setEditAmount(e.target.value)}
                          className="w-full rounded-xl border border-border bg-surface pl-7 pr-3.5 py-3 text-lg font-extrabold text-text-primary focus:border-accent focus:outline-none tabular-nums" />
                      </div>

                      {/* Type */}
                      <div className="flex flex-wrap gap-1.5">
                        {TYPE_OPTIONS.map((opt) => {
                          const Icon = opt.icon;
                          return (
                            <button key={opt.type} onClick={() => setEditType(opt.type)}
                              className={cn("flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold border transition-all",
                                editType === opt.type ? "bg-accent-light border-accent text-accent" : "border-border-light text-text-secondary"
                              )}>
                              <Icon size={12} /> {opt.label}
                            </button>
                          );
                        })}
                      </div>

                      {/* Merchant / Description — custom text input */}
                      <div>
                        <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-1 block">Merchant / Description</label>
                        <input type="text" value={editMerchant} onChange={(e) => setEditMerchant(e.target.value)}
                          placeholder="e.g. Swiggy, Uber, Amazon, Rent payment"
                          className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent" />
                      </div>

                      {/* Note — custom text input */}
                      <div>
                        <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-1 block">Note (optional)</label>
                        <input type="text" value={editNote} onChange={(e) => setEditNote(e.target.value)}
                          placeholder="e.g. Dinner with friends, Office cab"
                          className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent" />
                      </div>

                      {/* Person — text input with suggestions */}
                      <div>
                        <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-1 block">Person (optional)</label>
                        <input type="text" value={editPerson} onChange={(e) => setEditPerson(e.target.value)}
                          placeholder="e.g. OP, Priya, Amit"
                          list="quick-add-persons"
                          className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent" />
                        <datalist id="quick-add-persons">
                          {persons.map((p) => <option key={p.id} value={p.name} />)}
                        </datalist>
                      </div>

                      {/* Account */}
                      {accounts.length > 0 && (
                        <div>
                          <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-1 block">Account</label>
                          <div className="flex flex-wrap gap-1.5">
                            <button onClick={() => { draft.accountId = undefined; setAction({...action}); }}
                              className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium border transition-all",
                                !draft.accountId ? "border-accent bg-accent-light text-accent" : "border-border-light text-text-secondary"
                              )}>None</button>
                            {accounts.map((acc) => (
                              <button key={acc.id} onClick={() => { draft.accountId = acc.id; setAction({...action}); }}
                                className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium border transition-all flex items-center gap-1",
                                  draft.accountId === acc.id ? "border-accent bg-accent-light text-accent" : "border-border-light text-text-secondary"
                                )}>
                                {acc.icon} {acc.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Category grid */}
                      <div>
                        <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-1.5 block">Category</label>
                        <div className="grid grid-cols-5 gap-1.5 max-h-32 overflow-y-auto">
                          {allCategories.map((cat) => (
                            <button key={cat.id} onClick={() => { if (draft) { draft.categoryId = cat.id; setEditMode(false); } }}
                              className={cn("flex flex-col items-center gap-0.5 rounded-xl border p-1.5 transition-all text-center",
                                draft.categoryId === cat.id ? "border-accent bg-accent-light" : "border-border-light hover:bg-surface-secondary"
                              )}>
                              <span className="text-sm">{cat.icon}</span>
                              <span className="text-[8px] font-medium text-text-secondary leading-tight truncate w-full">{cat.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <button onClick={() => setEditMode(false)} className="w-full rounded-xl bg-accent py-2.5 text-sm font-bold text-white">Done</button>
                    </motion.div>
                  )}

                  {/* Parse button */}
                  {!action && input.trim() && (
                    <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={handleProcess} disabled={processing}
                      className="mt-4 w-full rounded-xl bg-accent py-3 text-sm font-bold text-white transition-all hover:bg-accent-hover active:scale-[0.98] disabled:opacity-50">
                      {processing ? "Understanding..." : "Add"}
                    </motion.button>
                  )}

                  {/* Examples */}
                  {!action && !input && (
                    <div className="mt-4">
                      <p className="text-xs font-semibold text-text-tertiary mb-2">Try saying</p>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          "Spent 300 on lunch",
                          "Salary 85000",
                          "Paid rent 15000",
                          "Coffee 120",
                          "Lent OP 2000",
                          "INR 420 debited from HDFC at Swiggy",
                        ].map((example) => (
                          <button key={example} onClick={() => { setInput(example); setAction(null); }}
                            className="rounded-full border border-border-light px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-secondary transition-colors">
                            {example}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="h-[env(safe-area-inset-bottom)]" />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
