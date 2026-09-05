"use client";

import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Trash2,
  X,
  ChevronDown,
  Wallet,
  Building2,
  AlertCircle,
} from "lucide-react";
import { db } from "@/lib/db";
import { cn, formatCurrency, generateId } from "@/lib/utils";
import { useAccounts } from "@/lib/hooks/use-accounts";
import type { Account, AccountType } from "@/lib/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: "savings", label: "Savings" },
  { value: "current", label: "Current" },
  { value: "credit_card", label: "Credit Card" },
  { value: "wallet", label: "Wallet" },
  { value: "cash", label: "Cash" },
  { value: "investment", label: "Investment" },
  { value: "loan", label: "Loan" },
  { value: "other", label: "Other" },
];

const PRESET_COLORS = [
  "#6366F1", // indigo
  "#10B981", // emerald
  "#F59E0B", // amber
  "#EF4444", // red
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#14B8A6", // teal
  "#F97316", // orange
  "#3B82F6", // blue
  "#84CC16", // lime
];

const ICON_OPTIONS = ["🏦", "💳", "💵", "📱", "🪙", "💰"];

const EASE_OUT = [0.4, 0, 0.2, 1] as const;

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: EASE_OUT },
  },
};

const formVariants = {
  hidden: { opacity: 0, height: 0, marginTop: 0 },
  visible: {
    opacity: 1,
    height: "auto",
    marginTop: 16,
    transition: { duration: 0.3, ease: EASE_OUT },
  },
  exit: {
    opacity: 0,
    height: 0,
    marginTop: 0,
    transition: { duration: 0.2, ease: EASE_OUT },
  },
};

// ---------------------------------------------------------------------------
// Form State
// ---------------------------------------------------------------------------

interface FormState {
  name: string;
  type: AccountType;
  bank: string;
  balance: string;
  color: string;
  icon: string;
}

const INITIAL_FORM: FormState = {
  name: "",
  type: "savings",
  bank: "",
  balance: "",
  color: PRESET_COLORS[0],
  icon: ICON_OPTIONS[0],
};

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function AccountsPage() {
  const accounts = useAccounts();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const totalBalance = useMemo(
    () => accounts.reduce((sum, a) => sum + a.balance, 0),
    [accounts],
  );

  // --- handlers ---

  const resetForm = useCallback(() => {
    setForm(INITIAL_FORM);
    setShowForm(false);
  }, []);

  const handleSave = useCallback(async () => {
    const trimmedName = form.name.trim();
    if (!trimmedName) return;

    const balance = parseFloat(form.balance) || 0;

    const account: Account = {
      id: generateId(),
      name: trimmedName,
      type: form.type,
      bank: form.bank.trim() || undefined,
      icon: form.icon,
      color: form.color,
      balance,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    await db.accounts.add(account);
    resetForm();
  }, [form, resetForm]);

  const handleDelete = useCallback(async (id: string) => {
    await db.accounts.update(id, { isActive: false });
    setConfirmDeleteId(null);
  }, []);

  const updateField = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  // --- render ---

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="space-y-5 pb-4"
    >
      {/* Header row */}
      <motion.div
        variants={fadeUp}
        className="flex items-center justify-between"
      >
        <h1 className="text-xl font-bold text-text-primary">Accounts</h1>
        {accounts.length > 0 && (
          <button
            type="button"
            onClick={() => setShowForm((prev) => !prev)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors tap-target",
              showForm
                ? "bg-expense-light text-expense"
                : "bg-accent-light text-accent",
            )}
          >
            {showForm ? <X size={14} /> : <Plus size={14} />}
            {showForm ? "Cancel" : "Add Account"}
          </button>
        )}
      </motion.div>

      {/* Total balance hero card */}
      {accounts.length > 0 && (
        <motion.div
          variants={fadeUp}
          className="hero-gradient rounded-2xl p-5 relative overflow-hidden"
        >
          <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-white/10" />
          <div className="absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-white/5" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-1">
              <Wallet size={16} className="text-white/70" />
              <p className="text-sm text-white/70">Net Worth</p>
            </div>
            <h2 className="text-3xl font-extrabold text-white tabular-nums tracking-tight animate-count-up">
              {formatCurrency(totalBalance)}
            </h2>
            <p className="mt-1 text-xs text-white/50">
              Across {accounts.length} account{accounts.length !== 1 ? "s" : ""}
            </p>
          </div>
        </motion.div>
      )}

      {/* Inline Add Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            variants={formVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="overflow-hidden"
          >
            <AccountForm
              form={form}
              updateField={updateField}
              onSave={handleSave}
              onCancel={resetForm}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Account list or empty state */}
      {accounts.length === 0 ? (
        <EmptyState onAdd={() => setShowForm(true)} />
      ) : (
        <motion.div variants={fadeUp} className="space-y-3">
          {accounts.map((account, index) => (
            <motion.div
              key={account.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.3,
                delay: index * 0.05,
                ease: EASE_OUT,
              }}
            >
              <AccountCard
                account={account}
                isConfirmingDelete={confirmDeleteId === account.id}
                onRequestDelete={() => setConfirmDeleteId(account.id)}
                onCancelDelete={() => setConfirmDeleteId(null)}
                onConfirmDelete={() => handleDelete(account.id)}
              />
            </motion.div>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Account Form
// ---------------------------------------------------------------------------

function AccountForm({
  form,
  updateField,
  onSave,
  onCancel,
}: {
  form: FormState;
  updateField: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const canSave = form.name.trim().length > 0;

  return (
    <div className="card-elevated p-4 space-y-4">
      <h3 className="text-sm font-bold text-text-primary">New Account</h3>

      {/* Name */}
      <div>
        <label className="text-xs font-semibold text-text-secondary mb-1 block">
          Account Name <span className="text-expense">*</span>
        </label>
        <input
          type="text"
          placeholder="e.g. HDFC Savings"
          value={form.name}
          onChange={(e) => updateField("name", e.target.value)}
          className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all"
        />
      </div>

      {/* Type */}
      <div>
        <label className="text-xs font-semibold text-text-secondary mb-1 block">
          Type
        </label>
        <div className="relative">
          <select
            value={form.type}
            onChange={(e) =>
              updateField("type", e.target.value as AccountType)
            }
            className="w-full appearance-none rounded-xl border border-border bg-surface px-3.5 py-2.5 pr-9 text-sm text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all"
          >
            {ACCOUNT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary"
          />
        </div>
      </div>

      {/* Bank (optional) */}
      <div>
        <label className="text-xs font-semibold text-text-secondary mb-1 block">
          Bank / Provider{" "}
          <span className="text-text-tertiary font-normal">(optional)</span>
        </label>
        <input
          type="text"
          placeholder="e.g. HDFC, SBI, Paytm"
          value={form.bank}
          onChange={(e) => updateField("bank", e.target.value)}
          className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all"
        />
      </div>

      {/* Balance */}
      <div>
        <label className="text-xs font-semibold text-text-secondary mb-1 block">
          {form.type === "credit_card" ? "Outstanding Amount" : "Current Balance"}
        </label>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-text-tertiary font-semibold">
            ₹
          </span>
          <input
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={form.balance}
            onChange={(e) => updateField("balance", e.target.value)}
            className="w-full rounded-xl border border-border bg-surface pl-7 pr-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all tabular-nums"
          />
        </div>
        {form.type === "credit_card" && (
          <p className="text-[10px] text-text-tertiary mt-1">
            Enter the amount you owe. It will be stored as a negative balance.
          </p>
        )}
      </div>

      {/* Icon picker */}
      <div>
        <label className="text-xs font-semibold text-text-secondary mb-1.5 block">
          Icon
        </label>
        <div className="flex gap-2 flex-wrap">
          {ICON_OPTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => updateField("icon", emoji)}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-xl text-lg transition-all",
                form.icon === emoji
                  ? "bg-accent-light ring-2 ring-accent scale-110"
                  : "bg-surface-secondary hover:bg-surface-hover",
              )}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Color picker */}
      <div>
        <label className="text-xs font-semibold text-text-secondary mb-1.5 block">
          Color
        </label>
        <div className="flex gap-2 flex-wrap">
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => updateField("color", color)}
              className={cn(
                "h-8 w-8 rounded-full transition-all",
                form.color === color
                  ? "ring-2 ring-offset-2 ring-offset-surface scale-110"
                  : "hover:scale-105",
              )}
              style={{
                backgroundColor: color,
                ...(form.color === color ? { ringColor: color } : {}),
              }}
            />
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-text-secondary hover:bg-surface-secondary transition-colors tap-target"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          className={cn(
            "flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors tap-target",
            canSave
              ? "bg-accent text-text-inverse hover:bg-accent-hover"
              : "bg-surface-secondary text-text-tertiary cursor-not-allowed",
          )}
        >
          Add Account
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Account Card
// ---------------------------------------------------------------------------

function AccountCard({
  account,
  isConfirmingDelete,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  account: Account;
  isConfirmingDelete: boolean;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}) {
  const isCreditCard = account.type === "credit_card";
  const displayBalance = isCreditCard ? -Math.abs(account.balance) : account.balance;
  const balanceLabel = isCreditCard ? "Outstanding" : "Balance";

  const typeLabel =
    ACCOUNT_TYPES.find((t) => t.value === account.type)?.label ?? account.type;

  return (
    <div className="card-elevated p-4 relative overflow-hidden">
      {/* Color accent strip */}
      <div
        className="absolute top-0 left-0 w-1 h-full rounded-l-xl"
        style={{ backgroundColor: account.color || "var(--accent)" }}
      />

      <div className="flex items-start gap-3 pl-2">
        {/* Icon */}
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl"
          style={{
            backgroundColor: `${account.color || "var(--accent)"}18`,
          }}
        >
          {account.icon || "🏦"}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-text-primary truncate">
              {account.name}
            </h3>
            <span className="shrink-0 rounded-full bg-surface-secondary px-2 py-0.5 text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">
              {typeLabel}
            </span>
          </div>

          {account.bank && (
            <div className="flex items-center gap-1 mt-0.5">
              <Building2 size={10} className="text-text-tertiary" />
              <span className="text-xs text-text-secondary">{account.bank}</span>
            </div>
          )}

          <div className="mt-2">
            <span className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">
              {balanceLabel}
            </span>
            <p
              className={cn(
                "text-lg font-extrabold tabular-nums tracking-tight",
                isCreditCard
                  ? "text-expense"
                  : displayBalance >= 0
                    ? "text-income"
                    : "text-expense",
              )}
            >
              {formatCurrency(displayBalance)}
            </p>
          </div>
        </div>

        {/* Delete */}
        <div className="shrink-0">
          <AnimatePresence mode="wait">
            {isConfirmingDelete ? (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center gap-1.5"
              >
                <button
                  type="button"
                  onClick={onCancelDelete}
                  className="rounded-lg bg-surface-secondary px-2.5 py-1.5 text-[11px] font-semibold text-text-secondary hover:bg-surface-hover transition-colors tap-target"
                >
                  Keep
                </button>
                <button
                  type="button"
                  onClick={onConfirmDelete}
                  className="rounded-lg bg-expense-light px-2.5 py-1.5 text-[11px] font-semibold text-expense hover:bg-expense/20 transition-colors tap-target"
                >
                  Delete
                </button>
              </motion.div>
            ) : (
              <motion.button
                key="trash"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                type="button"
                onClick={onRequestDelete}
                className="rounded-lg p-2 text-text-tertiary hover:text-expense hover:bg-expense-light transition-colors tap-target"
              >
                <Trash2 size={16} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Credit card warning */}
      {isCreditCard && account.balance > 0 && (
        <div className="flex items-center gap-1.5 mt-2.5 ml-2 pl-2 py-1.5 px-2 rounded-lg bg-warning-light">
          <AlertCircle size={12} className="text-warning shrink-0" />
          <span className="text-[10px] text-warning font-medium">
            Outstanding balance on this card
          </span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <div className="mb-5 animate-float">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl hero-gradient shadow-lg">
          <span className="text-4xl">🏦</span>
        </div>
      </div>
      <h2 className="text-lg font-extrabold text-text-primary">
        Add the accounts you actually use
      </h2>
      <p className="mt-2 max-w-[260px] text-sm text-text-secondary leading-relaxed">
        Track balances across your bank accounts, wallets, cards, and cash.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-6 flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-text-inverse hover:bg-accent-hover transition-colors tap-target animate-pulse-glow"
      >
        <Plus size={16} />
        Add Your First Account
      </button>

      <div className="mt-6 flex flex-wrap justify-center gap-1.5">
        {["Savings", "Credit Card", "Cash", "Wallet"].map((hint) => (
          <span
            key={hint}
            className="rounded-full border border-border-light px-3 py-1.5 text-xs text-text-secondary"
          >
            {hint}
          </span>
        ))}
      </div>
    </motion.div>
  );
}
