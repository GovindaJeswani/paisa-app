"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check, X, Pencil, ArrowDown, ArrowUp, Loader2, MessageSquare,
  ArrowRightLeft, PiggyBank, TrendingUp, HandCoins, User, FileText, Tag,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { processInput, saveDraft, type PipelineAction, type TransactionDraft } from "@/lib/engine/intelligence";
import { useCategories, useCategoryMap } from "@/lib/hooks/use-categories";
import { useAccounts } from "@/lib/hooks/use-accounts";
import { usePersons } from "@/lib/hooks/use-persons";
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

function SharePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const text = searchParams.get("text") || searchParams.get("title") || "";

  const [action, setAction] = useState<PipelineAction | null>(null);
  const [processing, setProcessing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // Edit fields
  const [editAmount, setEditAmount] = useState("");
  const [editType, setEditType] = useState<TransactionType>("expense");
  const [editNote, setEditNote] = useState("");
  const [editMerchant, setEditMerchant] = useState("");
  const [editPersonName, setEditPersonName] = useState("");

  const categories = useCategories("expense");
  const allCategories = useCategories();
  const categoryMap = useCategoryMap();
  const accounts = useAccounts();
  const persons = usePersons();

  // Auto-process the shared text on mount
  useEffect(() => {
    if (text) {
      setProcessing(true);
      processInput(text, "sms").then((result) => {
        setAction(result);
        if (result.type === "auto_save") {
          setSaved(true);
        }
        const d = result.type !== "auto_save" ? result.draft : null;
        if (d) {
          setEditAmount(String(d.amount));
          setEditType(d.type);
          setEditMerchant(d.merchant || "");
          setEditNote(d.note || "");
        }
      }).finally(() => setProcessing(false));
    }
  }, [text]);

  const handleSave = useCallback(async () => {
    if (!action || action.type === "auto_save") return;
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
      if (editPersonName.trim()) {
        const existing = persons.find((p) => p.name.toLowerCase() === editPersonName.trim().toLowerCase());
        if (existing) {
          draft.personId = existing.id;
        } else {
          const newPerson = { id: generateId(), name: editPersonName.trim(), netBalance: 0, createdAt: new Date().toISOString() };
          await db.persons.add(newPerson);
          draft.personId = newPerson.id;
        }
      }

      await saveDraft(draft);
      setSaved(true);
    } finally {
      setProcessing(false);
    }
  }, [action, editAmount, editType, editMerchant, editNote, editPersonName, persons]);

  const draft = action && action.type !== "auto_save" ? action.draft : null;
  const category = draft?.categoryId ? categoryMap.get(draft.categoryId) : null;

  // No shared text
  if (!text) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <MessageSquare size={32} className="text-text-tertiary mb-3" />
        <h2 className="text-lg font-bold text-text-primary">Share to Paisa</h2>
        <p className="text-sm text-text-secondary mt-1 max-w-xs">
          Share a bank SMS from your messages app to automatically import it as a transaction.
        </p>
        <button onClick={() => router.push("/")} className="mt-6 rounded-xl bg-accent px-6 py-2.5 text-sm font-bold text-white">
          Go to Home
        </button>
      </div>
    );
  }

  // Saved
  if (saved) {
    return (
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-income-light mb-4">
          <Check size={40} className="text-income" />
        </div>
        <h2 className="text-xl font-extrabold text-text-primary">Transaction Saved!</h2>
        <p className="text-sm text-text-tertiary mt-1">
          {action?.type === "auto_save" ? "Auto-detected and saved" : "Added to your timeline"}
        </p>
        <div className="flex gap-3 mt-6">
          <button onClick={() => router.push("/")} className="rounded-xl bg-accent px-6 py-2.5 text-sm font-bold text-white">
            Go to Home
          </button>
          <button onClick={() => router.push("/calendar")} className="rounded-xl border border-border px-6 py-2.5 text-sm font-semibold text-text-secondary">
            Calendar
          </button>
        </div>
      </motion.div>
    );
  }

  // Processing
  if (processing && !draft) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 size={32} className="text-accent animate-spin mb-3" />
        <p className="text-sm text-text-secondary">Reading message...</p>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-text-primary">Shared Transaction</h1>
        <button onClick={() => router.push("/")} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface-secondary">
          <X size={16} className="text-text-secondary" />
        </button>
      </div>

      {/* Original message */}
      <div className="rounded-xl bg-surface-secondary p-3">
        <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-1">Original message</p>
        <p className="text-xs text-text-secondary font-mono leading-relaxed">{text}</p>
      </div>

      {draft && (
        <>
          {/* Amount — large editable */}
          <div className="text-center py-2">
            <div className="flex items-center justify-center gap-1">
              <span className="text-lg text-text-tertiary">₹</span>
              <input type="number" value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                className="text-4xl font-extrabold text-text-primary tabular-nums bg-transparent text-center outline-none w-48 focus:text-accent transition-colors"
              />
            </div>
            {category && (
              <p className="text-sm text-text-secondary mt-1">{category.icon} {category.name}</p>
            )}
          </div>

          {/* Type selector */}
          <div className="flex flex-wrap gap-1.5">
            {TYPE_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              return (
                <button key={opt.type} onClick={() => setEditType(opt.type)}
                  className={cn("flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold border transition-all",
                    editType === opt.type ? "bg-accent-light border-accent text-accent" : "border-border-light text-text-secondary"
                  )}>
                  <Icon size={12} /> {opt.label}
                </button>
              );
            })}
          </div>

          {/* Custom fields */}
          <div className="space-y-3">
            {/* Merchant */}
            <div>
              <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-1 block flex items-center gap-1">
                <Tag size={10} /> Merchant / Description
              </label>
              <input type="text" value={editMerchant}
                onChange={(e) => setEditMerchant(e.target.value)}
                placeholder="e.g. Swiggy, Uber, Amazon, Rent"
                className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent transition-colors"
              />
            </div>

            {/* Note */}
            <div>
              <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-1 block flex items-center gap-1">
                <FileText size={10} /> Note (optional)
              </label>
              <input type="text" value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder="e.g. Dinner with friends, Office cab"
                className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent transition-colors"
              />
            </div>

            {/* Person */}
            <div>
              <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-1 block flex items-center gap-1">
                <User size={10} /> Person (optional)
              </label>
              <input type="text" value={editPersonName}
                onChange={(e) => setEditPersonName(e.target.value)}
                placeholder="e.g. OP, Priya, Amit"
                className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent transition-colors"
                list="person-suggestions"
              />
              <datalist id="person-suggestions">
                {persons.map((p) => <option key={p.id} value={p.name} />)}
              </datalist>
            </div>

            {/* Category — emoji grid + custom text */}
            <div>
              <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-1.5 block">Category</label>
              <div className="grid grid-cols-5 gap-1.5 max-h-28 overflow-y-auto">
                {allCategories.map((cat) => (
                  <button key={cat.id} onClick={() => { draft.categoryId = cat.id; setAction({ ...action! }); }}
                    className={cn("flex flex-col items-center gap-0.5 rounded-xl border p-1.5 transition-all text-center",
                      draft.categoryId === cat.id ? "border-accent bg-accent-light" : "border-border-light hover:bg-surface-secondary"
                    )}>
                    <span className="text-sm">{cat.icon}</span>
                    <span className="text-[8px] font-medium text-text-secondary leading-tight truncate w-full">{cat.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Account */}
            {accounts.length > 0 && (
              <div>
                <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-1 block">Account</label>
                <div className="flex flex-wrap gap-1.5">
                  <button onClick={() => { draft.accountId = undefined; setAction({ ...action! }); }}
                    className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium border transition-all",
                      !draft.accountId ? "border-accent bg-accent-light text-accent" : "border-border-light text-text-secondary"
                    )}>None</button>
                  {accounts.map((acc) => (
                    <button key={acc.id} onClick={() => { draft.accountId = acc.id; setAction({ ...action! }); }}
                      className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium border transition-all flex items-center gap-1",
                        draft.accountId === acc.id ? "border-accent bg-accent-light text-accent" : "border-border-light text-text-secondary"
                      )}>
                      {acc.icon} {acc.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Save button */}
          <button onClick={handleSave} disabled={processing || !editAmount || parseFloat(editAmount) <= 0}
            className="w-full rounded-xl bg-accent py-3.5 text-sm font-bold text-white disabled:opacity-40 hover:bg-accent-hover transition-colors active:scale-[0.98]">
            {processing ? "Saving..." : "Save Transaction"}
          </button>
        </>
      )}
    </motion.div>
  );
}

export default function SharePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="text-accent animate-spin" />
      </div>
    }>
      <SharePageContent />
    </Suspense>
  );
}
