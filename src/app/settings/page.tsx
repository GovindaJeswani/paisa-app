"use client";

import { useState } from "react";
import {
  Sun,
  Moon,
  Monitor,
  Database,
  Trash2,
  Download,
  Upload,
  Sparkles,
  Info,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/providers/theme-provider";
import { usePreferences, updatePreferences } from "@/lib/hooks/use-preferences";
import { loadDemoData, clearDemoData } from "@/lib/demo-data";
import { db } from "@/lib/db";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const prefs = usePreferences();
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleLoadDemo = async () => {
    setIsLoading("demo");
    try {
      await loadDemoData();
    } finally {
      setIsLoading(null);
    }
  };

  const handleClearDemo = async () => {
    setIsLoading("clear-demo");
    try {
      await clearDemoData();
    } finally {
      setIsLoading(null);
    }
  };

  const handleClearAll = async () => {
    if (!confirm("This will delete all your data. Are you sure?")) return;
    setIsLoading("clear-all");
    try {
      await db.transactions.clear();
      await db.accounts.clear();
      await db.persons.clear();
      await db.groups.clear();
      await db.splits.clear();
      await db.budgets.clear();
      await db.goals.clear();
      await db.recurringTransactions.clear();
      await db.financialEvents.clear();
      await db.investments.clear();
      await db.merchantMappings.clear();
      await db.transactionChanges.clear();
      await updatePreferences({
        demoMode: false,
        onboardingComplete: false,
      });
    } finally {
      setIsLoading(null);
    }
  };

  const handleExportJSON = async () => {
    setIsLoading("export");
    try {
      const data = {
        transactions: await db.transactions.toArray(),
        accounts: await db.accounts.toArray(),
        categories: await db.categories.toArray(),
        persons: await db.persons.toArray(),
        groups: await db.groups.toArray(),
        splits: await db.splits.toArray(),
        budgets: await db.budgets.toArray(),
        goals: await db.goals.toArray(),
        recurringTransactions: await db.recurringTransactions.toArray(),
        financialEvents: await db.financialEvents.toArray(),
        investments: await db.investments.toArray(),
        merchantMappings: await db.merchantMappings.toArray(),
        preferences: await db.userPreferences.toArray(),
        exportedAt: new Date().toISOString(),
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `paisa-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsLoading(null);
    }
  };

  const handleImportJSON = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setIsLoading("import");
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (data.transactions) await db.transactions.bulkPut(data.transactions);
        if (data.accounts) await db.accounts.bulkPut(data.accounts);
        if (data.persons) await db.persons.bulkPut(data.persons);
        if (data.groups) await db.groups.bulkPut(data.groups);
        if (data.splits) await db.splits.bulkPut(data.splits);
        if (data.budgets) await db.budgets.bulkPut(data.budgets);
        if (data.goals) await db.goals.bulkPut(data.goals);
        if (data.recurringTransactions)
          await db.recurringTransactions.bulkPut(data.recurringTransactions);
        if (data.merchantMappings)
          await db.merchantMappings.bulkPut(data.merchantMappings);
        alert("Data imported successfully!");
      } catch {
        alert("Failed to import data. Please check the file format.");
      } finally {
        setIsLoading(null);
      }
    };
    input.click();
  };

  return (
    <div className="space-y-6 pb-4">
      <h1 className="text-xl font-bold text-text-primary">Settings</h1>

      {/* Theme */}
      <SettingsSection title="Appearance">
        <div className="flex gap-2">
          {(
            [
              { value: "light", icon: Sun, label: "Light" },
              { value: "dark", icon: Moon, label: "Dark" },
              { value: "system", icon: Monitor, label: "System" },
            ] as const
          ).map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1.5 rounded-xl border p-3 transition-all",
                  theme === opt.value
                    ? "border-accent bg-accent-light text-accent"
                    : "border-border-light bg-surface text-text-secondary hover:bg-surface-secondary"
                )}
              >
                <Icon size={18} />
                <span className="text-xs font-medium">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </SettingsSection>

      {/* Demo data */}
      <SettingsSection title="Demo Data">
        <p className="text-xs text-text-tertiary mb-3">
          Load realistic sample data to explore all features. Demo data is
          clearly marked and can be removed anytime.
        </p>
        <div className="flex gap-2">
          {prefs?.demoMode ? (
            <button
              onClick={handleClearDemo}
              disabled={isLoading === "clear-demo"}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-expense/20 bg-expense-light px-4 py-2.5 text-sm font-medium text-expense transition-all hover:bg-expense/10 disabled:opacity-50"
            >
              <Trash2 size={14} />
              {isLoading === "clear-demo" ? "Removing..." : "Remove Demo Data"}
            </button>
          ) : (
            <button
              onClick={handleLoadDemo}
              disabled={isLoading === "demo"}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-accent-hover disabled:opacity-50"
            >
              <Sparkles size={14} />
              {isLoading === "demo" ? "Loading..." : "Load Demo Data"}
            </button>
          )}
        </div>
      </SettingsSection>

      {/* Data management */}
      <SettingsSection title="Data">
        <div className="space-y-2">
          <button
            onClick={handleExportJSON}
            disabled={isLoading === "export"}
            className="flex w-full items-center gap-3 rounded-xl border border-border-light bg-surface p-3 text-sm font-medium text-text-primary hover:bg-surface-hover transition-colors disabled:opacity-50"
          >
            <Download size={16} className="text-text-secondary" />
            {isLoading === "export" ? "Exporting..." : "Export as JSON"}
          </button>
          <button
            onClick={handleImportJSON}
            disabled={isLoading === "import"}
            className="flex w-full items-center gap-3 rounded-xl border border-border-light bg-surface p-3 text-sm font-medium text-text-primary hover:bg-surface-hover transition-colors disabled:opacity-50"
          >
            <Upload size={16} className="text-text-secondary" />
            {isLoading === "import" ? "Importing..." : "Import from JSON"}
          </button>
          <button
            onClick={handleClearAll}
            disabled={isLoading === "clear-all"}
            className="flex w-full items-center gap-3 rounded-xl border border-expense/20 p-3 text-sm font-medium text-expense hover:bg-expense-light transition-colors disabled:opacity-50"
          >
            <Trash2 size={16} />
            {isLoading === "clear-all" ? "Clearing..." : "Clear All Data"}
          </button>
        </div>
      </SettingsSection>

      {/* Privacy */}
      <SettingsSection title="Privacy">
        <div className="rounded-xl border border-border-light bg-surface p-4">
          <div className="flex items-start gap-3">
            <Shield size={18} className="text-accent mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-text-primary">
                Your data stays on your device
              </p>
              <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                Paisa stores all your financial data locally in your browser.
                Nothing is sent to any server. No account required. No tracking.
              </p>
            </div>
          </div>
        </div>
      </SettingsSection>

      {/* Capabilities */}
      <SettingsSection title="What Works">
        <div className="space-y-1.5">
          {[
            { status: true, label: "Add transactions via natural language" },
            { status: true, label: "Paste bank SMS to import transactions" },
            { status: true, label: "Upload CSV bank statements" },
            { status: true, label: "Scan receipts with OCR (Tesseract.js)" },
            { status: true, label: "Calendar with financial indicators" },
            { status: true, label: "Ask Paisa — financial questions" },
            { status: true, label: "Budgets, Goals, Splits, Lending" },
            { status: true, label: "Export as CSV, JSON, or printable statement" },
            { status: true, label: "Install as app (PWA)" },
            { status: true, label: "Works offline after first load" },
            { status: true, label: "Dark / Light theme" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2 text-xs">
              <span className="text-income">✓</span>
              <span className="text-text-secondary">{item.label}</span>
            </div>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title="Requires Native Android App">
        <div className="rounded-xl border border-warning/20 bg-warning-light p-3">
          <p className="text-xs text-text-secondary leading-relaxed">
            These features need a native Android app (not possible in a browser PWA):
          </p>
          <div className="space-y-1.5 mt-2">
            {[
              "Automatic SMS reading in background",
              "Gmail auto-import via OAuth",
              "Push notifications",
              "Google Drive backup sync",
              "Background bank statement detection",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2 text-xs">
                <span className="text-warning">○</span>
                <span className="text-text-tertiary">{item}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-text-tertiary mt-2">
            The architecture is ready — these can be added when a native Android wrapper is built.
          </p>
        </div>
      </SettingsSection>

      {/* About */}
      <SettingsSection title="About">
        <div className="flex items-center gap-3 rounded-xl border border-border-light bg-surface p-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-white font-bold">
            ₹
          </div>
          <div>
            <p className="text-sm font-bold text-text-primary">Paisa</p>
            <p className="text-xs text-text-tertiary">
              v2.0.0 · Local-first personal finance
            </p>
          </div>
        </div>
      </SettingsSection>
    </div>
  );
}

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2.5">
        {title}
      </h3>
      {children}
    </div>
  );
}
