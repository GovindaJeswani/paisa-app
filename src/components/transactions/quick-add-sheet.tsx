"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ArrowDown,
  ArrowUp,
  ArrowRightLeft,
  PiggyBank,
  TrendingUp,
  HandCoins,
  Check,
  ChevronDown,
  Pencil,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { parseNaturalLanguage } from "@/lib/engine/nl-parser";
import { createTransactionFromNL } from "@/lib/engine/transaction-service";
import { useCategories } from "@/lib/hooks/use-categories";
import { useCategoryMap } from "@/lib/hooks/use-categories";
import type { ParsedTransaction, TransactionType } from "@/lib/types";

const TYPE_OPTIONS: { type: TransactionType; label: string; icon: typeof ArrowDown; color: string }[] = [
  { type: "expense", label: "Expense", icon: ArrowDown, color: "text-expense" },
  { type: "income", label: "Income", icon: ArrowUp, color: "text-income" },
  { type: "transfer", label: "Transfer", icon: ArrowRightLeft, color: "text-transfer" },
  { type: "saving", label: "Saving", icon: PiggyBank, color: "text-saving" },
  { type: "investment", label: "Investment", icon: TrendingUp, color: "text-investment" },
  { type: "lend", label: "Lend", icon: HandCoins, color: "text-warning" },
];

interface QuickAddSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function QuickAddSheet({ isOpen, onClose }: QuickAddSheetProps) {
  const [input, setInput] = useState("");
  const [parsed, setParsed] = useState<ParsedTransaction | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedType, setSelectedType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const categoryMap = useCategoryMap();
  const categories = useCategories("expense");

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setInput("");
      setParsed(null);
      setShowSuccess(false);
      setEditMode(false);
      setAmount("");
    }
  }, [isOpen]);

  const handleParse = useCallback(async () => {
    if (!input.trim()) return;
    setIsProcessing(true);
    try {
      const result = await parseNaturalLanguage(input);
      setParsed(result);
      if (result.type) setSelectedType(result.type);
      if (result.amount) setAmount(String(result.amount));
    } finally {
      setIsProcessing(false);
    }
  }, [input]);

  const handleSubmit = useCallback(async () => {
    if (!parsed) return;
    setIsProcessing(true);
    try {
      await createTransactionFromNL(parsed, {
        amount: Number(amount) || parsed.amount || 0,
        type: selectedType,
      });
      setShowSuccess(true);
      setTimeout(() => {
        onClose();
      }, 800);
    } finally {
      setIsProcessing(false);
    }
  }, [parsed, amount, selectedType, onClose]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !parsed) {
      e.preventDefault();
      handleParse();
    } else if (e.key === "Enter" && parsed) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  const category = parsed?.categoryId ? categoryMap.get(parsed.categoryId) : null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 350 }}
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-surface shadow-xl max-h-[85vh] overflow-y-auto"
          >
            {/* Handle */}
            <div className="flex justify-center py-2">
              <div className="h-1 w-10 rounded-full bg-border" />
            </div>

            <div className="px-5 pb-8">
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold text-text-primary">
                  {showSuccess ? "Added!" : "What happened?"}
                </h2>
                <button
                  onClick={onClose}
                  className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface-secondary transition-colors"
                >
                  <X size={18} className="text-text-secondary" />
                </button>
              </div>

              {/* Success state */}
              {showSuccess && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex flex-col items-center gap-3 py-8"
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-income-light">
                    <Check size={32} className="text-income" />
                  </div>
                  <p className="text-sm text-text-secondary">
                    Transaction saved
                  </p>
                </motion.div>
              )}

              {/* Input */}
              {!showSuccess && (
                <>
                  <div className="relative">
                    <input
                      ref={inputRef}
                      type="text"
                      value={input}
                      onChange={(e) => {
                        setInput(e.target.value);
                        setParsed(null);
                      }}
                      onKeyDown={handleKeyDown}
                      placeholder='e.g. "Spent 450 on dinner" or "Salary 85000"'
                      className="w-full rounded-xl border border-border bg-surface-secondary px-4 py-3.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all"
                    />
                  </div>

                  {/* Type selector pills */}
                  <div className="mt-4 flex gap-2 overflow-x-auto hide-scrollbar pb-1">
                    {TYPE_OPTIONS.map((opt) => {
                      const Icon = opt.icon;
                      const isSelected = selectedType === opt.type;
                      return (
                        <button
                          key={opt.type}
                          onClick={() => setSelectedType(opt.type)}
                          className={cn(
                            "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all border",
                            isSelected
                              ? "bg-accent-light border-accent text-accent"
                              : "border-border-light bg-surface text-text-secondary hover:bg-surface-secondary"
                          )}
                        >
                          <Icon size={13} />
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Parsed preview */}
                  {parsed && !editMode && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-5 rounded-xl border border-border bg-surface-secondary p-4"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold text-text-primary">
                              {formatCurrency(Number(amount) || parsed.amount || 0)}
                            </span>
                            {parsed.confidence < 80 && (
                              <span className="rounded-full bg-warning-light px-2 py-0.5 text-[10px] font-medium text-warning">
                                Looks right?
                              </span>
                            )}
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                            {category && (
                              <span className="flex items-center gap-1 rounded-full bg-surface px-2 py-1">
                                <span>{category.icon}</span>
                                {category.name}
                              </span>
                            )}
                            {parsed.merchant && (
                              <span className="rounded-full bg-surface px-2 py-1">
                                {parsed.merchant}
                              </span>
                            )}
                            {parsed.personName && (
                              <span className="rounded-full bg-surface px-2 py-1">
                                👤 {parsed.personName}
                              </span>
                            )}
                            {parsed.accountName && (
                              <span className="rounded-full bg-surface px-2 py-1">
                                🏦 {parsed.accountName}
                              </span>
                            )}
                            {parsed.date && (
                              <span className="rounded-full bg-surface px-2 py-1">
                                📅 {parsed.date}
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => setEditMode(true)}
                          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface transition-colors"
                        >
                          <Pencil size={14} className="text-text-tertiary" />
                        </button>
                      </div>

                      {/* Action buttons */}
                      <div className="mt-4 flex gap-2">
                        <button
                          onClick={handleSubmit}
                          disabled={isProcessing}
                          className="flex-1 rounded-xl bg-accent py-3 text-sm font-semibold text-white transition-all hover:bg-accent-hover active:scale-[0.98] disabled:opacity-50"
                        >
                          {isProcessing ? "Saving..." : "Save"}
                        </button>
                        <button
                          onClick={() => {
                            setParsed(null);
                            setInput("");
                            inputRef.current?.focus();
                          }}
                          className="rounded-xl border border-border px-4 py-3 text-sm font-medium text-text-secondary hover:bg-surface transition-colors"
                        >
                          Clear
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* Edit mode — category selection */}
                  {parsed && editMode && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-5"
                    >
                      {/* Amount edit */}
                      <div className="mb-4">
                        <label className="text-xs font-medium text-text-secondary mb-1 block">
                          Amount
                        </label>
                        <input
                          type="number"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          className="w-full rounded-xl border border-border bg-surface-secondary px-4 py-3 text-lg font-bold text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                        />
                      </div>

                      {/* Category grid */}
                      <div className="mb-4">
                        <label className="text-xs font-medium text-text-secondary mb-2 block">
                          Category
                        </label>
                        <div className="grid grid-cols-4 gap-2">
                          {categories.slice(0, 12).map((cat) => (
                            <button
                              key={cat.id}
                              onClick={() => {
                                if (parsed) {
                                  parsed.categoryId = cat.id;
                                  setEditMode(false);
                                }
                              }}
                              className={cn(
                                "flex flex-col items-center gap-1 rounded-xl border p-2.5 transition-all text-center",
                                parsed.categoryId === cat.id
                                  ? "border-accent bg-accent-light"
                                  : "border-border-light hover:bg-surface-secondary"
                              )}
                            >
                              <span className="text-lg">{cat.icon}</span>
                              <span className="text-[10px] font-medium text-text-secondary leading-tight">
                                {cat.name}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={() => setEditMode(false)}
                        className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-white"
                      >
                        Done
                      </button>
                    </motion.div>
                  )}

                  {/* Parse button — only when there's input but no parsed result */}
                  {!parsed && input.trim() && (
                    <motion.button
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      onClick={handleParse}
                      disabled={isProcessing}
                      className="mt-4 w-full rounded-xl bg-accent py-3 text-sm font-semibold text-white transition-all hover:bg-accent-hover active:scale-[0.98] disabled:opacity-50"
                    >
                      {isProcessing ? "Understanding..." : "Add"}
                    </motion.button>
                  )}

                  {/* Quick examples */}
                  {!parsed && !input && (
                    <div className="mt-5">
                      <p className="text-xs font-medium text-text-tertiary mb-2">
                        Try saying
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          "Spent 300 on lunch",
                          "Received salary 85000",
                          "Paid rent 15000",
                          "Coffee 120",
                          "Uber 250",
                          "Lent OP 2000",
                        ].map((example) => (
                          <button
                            key={example}
                            onClick={() => {
                              setInput(example);
                              setParsed(null);
                            }}
                            className="rounded-full border border-border-light px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-secondary transition-colors"
                          >
                            {example}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Bottom safe area */}
            <div className="h-[env(safe-area-inset-bottom)]" />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
