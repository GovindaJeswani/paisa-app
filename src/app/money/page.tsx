"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CreditCard,
  PiggyBank,
  Target,
  Users,
  Repeat,
  TrendingUp,
  ChevronRight,
  Wallet,
  Scissors,
  LineChart,
  Plane,
  Bot,
  Download,
  Upload,
  Settings,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { useAccounts } from "@/lib/hooks/use-accounts";
import { useGoals } from "@/lib/hooks/use-goals";
import { useBudgets } from "@/lib/hooks/use-budgets";
import { usePersons } from "@/lib/hooks/use-persons";

export default function MoneyPage() {
  const accounts = useAccounts();
  const goals = useGoals();
  const budgets = useBudgets();
  const persons = usePersons();

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const totalOwed = persons.filter((p) => p.netBalance > 0).reduce((s, p) => s + p.netBalance, 0);
  const totalOwe = persons.filter((p) => p.netBalance < 0).reduce((s, p) => s + Math.abs(p.netBalance), 0);

  return (
    <div className="space-y-6 pb-4">
      <div>
        <h1 className="text-xl font-bold text-text-primary">Money</h1>
        <p className="text-xs text-text-tertiary mt-0.5">
          Your financial overview
        </p>
      </div>

      {/* Net balance */}
      <div className="rounded-xl border border-border-light bg-surface p-4">
        <p className="text-[10px] font-medium text-text-tertiary uppercase tracking-wider">
          Total Balance
        </p>
        <p className="mt-1 text-2xl font-bold text-text-primary tabular-nums">
          {formatCurrency(totalBalance)}
        </p>
        <p className="text-xs text-text-tertiary mt-0.5">
          Across {accounts.length} account{accounts.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Accounts */}
      <Section
        title="Accounts"
        icon={<CreditCard size={14} />}
        href="/accounts"
        emptyText="Add accounts when you're ready"
        hasItems={accounts.length > 0}
      >
        <div className="space-y-1.5">
          {accounts.map((acc) => (
            <div
              key={acc.id}
              className="flex items-center gap-3 rounded-xl border border-border-light bg-surface p-3"
            >
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg text-base"
                style={{ backgroundColor: `${acc.color || "#6366F1"}18` }}
              >
                {acc.icon || "🏦"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">
                  {acc.name}
                </p>
                <p className="text-[10px] text-text-tertiary capitalize">
                  {acc.type.replace("_", " ")}
                  {acc.bank ? ` · ${acc.bank}` : ""}
                </p>
              </div>
              <span
                className={cn(
                  "text-sm font-bold tabular-nums",
                  acc.balance >= 0 ? "text-text-primary" : "text-expense"
                )}
              >
                {formatCurrency(acc.balance)}
              </span>
            </div>
          ))}
        </div>
      </Section>

      {/* Goals */}
      <Section
        title="Goals"
        icon={<Target size={14} />}
        href="/goals"
        emptyText="Give your money a destination"
        emptyAction="Create a goal"
        hasItems={goals.length > 0}
      >
        <div className="space-y-2">
          {goals.map((goal) => {
            const pct =
              goal.targetAmount > 0
                ? (goal.currentAmount / goal.targetAmount) * 100
                : 0;
            return (
              <div
                key={goal.id}
                className="rounded-xl border border-border-light bg-surface p-3"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-text-primary">
                    {goal.icon || "🎯"} {goal.name}
                  </span>
                  <span className="text-xs font-semibold text-accent tabular-nums">
                    {Math.round(pct)}%
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-surface-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-text-tertiary tabular-nums">
                    {formatCurrency(goal.currentAmount)}
                  </span>
                  <span className="text-[10px] text-text-tertiary tabular-nums">
                    {formatCurrency(goal.targetAmount)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* People */}
      {persons.length > 0 && (
        <Section
          title="People"
          icon={<Users size={14} />}
          href="/people"
          hasItems={true}
        >
          <div className="space-y-1.5">
            {persons.map((person) => (
              <div
                key={person.id}
                className="flex items-center gap-3 rounded-xl border border-border-light bg-surface p-3"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-light text-sm font-bold text-accent">
                  {person.name.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-text-primary">
                    {person.name}
                  </p>
                </div>
                <span
                  className={cn(
                    "text-sm font-semibold tabular-nums",
                    person.netBalance > 0
                      ? "text-income"
                      : person.netBalance < 0
                      ? "text-expense"
                      : "text-text-tertiary"
                  )}
                >
                  {person.netBalance > 0
                    ? `+${formatCurrency(person.netBalance)}`
                    : person.netBalance < 0
                    ? `−${formatCurrency(Math.abs(person.netBalance))}`
                    : "Settled"}
                </span>
              </div>
            ))}
            {(totalOwed > 0 || totalOwe > 0) && (
              <div className="flex items-center gap-4 px-1 mt-2">
                {totalOwed > 0 && (
                  <span className="text-xs text-income font-medium">
                    Owed to you: {formatCurrency(totalOwed)}
                  </span>
                )}
                {totalOwe > 0 && (
                  <span className="text-xs text-expense font-medium">
                    You owe: {formatCurrency(totalOwe)}
                  </span>
                )}
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-2">
        <QuickLink href="/budgets" icon={<PiggyBank size={18} />} label="Budgets" count={budgets.length} />
        <QuickLink href="/recurring" icon={<Repeat size={18} />} label="Recurring" />
        <QuickLink href="/investments" icon={<TrendingUp size={18} />} label="Investments" />
        <QuickLink href="/splits" icon={<Scissors size={18} />} label="Split Expenses" />
        <QuickLink href="/net-worth" icon={<LineChart size={18} />} label="Net Worth" />
        <QuickLink href="/trips" icon={<Plane size={18} />} label="Trips & Events" />
        <QuickLink href="/ask" icon={<Bot size={18} />} label="Ask Paisa" />
        <QuickLink href="/export" icon={<Download size={18} />} label="Export" />
        <QuickLink href="/import" icon={<Upload size={18} />} label="Import" />
        <QuickLink href="/settings" icon={<Settings size={18} />} label="Settings" />
      </div>
    </div>
  );
}

function Section({
  title,
  icon,
  href,
  children,
  emptyText,
  emptyAction,
  hasItems,
}: {
  title: string;
  icon: React.ReactNode;
  href: string;
  children: React.ReactNode;
  emptyText?: string;
  emptyAction?: string;
  hasItems: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5">
          <span className="text-text-tertiary">{icon}</span>
          <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
            {title}
          </h3>
        </div>
        <Link
          href={href}
          className="text-xs text-accent font-medium flex items-center gap-0.5"
        >
          See all <ChevronRight size={12} />
        </Link>
      </div>
      {hasItems ? (
        children
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-surface-secondary/50 p-6 text-center">
          <p className="text-sm text-text-tertiary">{emptyText}</p>
          {emptyAction && (
            <Link
              href={href}
              className="mt-2 inline-block text-xs font-medium text-accent"
            >
              {emptyAction}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function QuickLink({
  href,
  icon,
  label,
  count,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  count?: number;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl border border-border-light bg-surface p-3.5 hover:bg-surface-hover transition-colors"
    >
      <span className="text-text-secondary">{icon}</span>
      <div className="flex-1">
        <p className="text-sm font-medium text-text-primary">{label}</p>
        {count !== undefined && count > 0 && (
          <p className="text-[10px] text-text-tertiary">
            {count} active
          </p>
        )}
      </div>
      <ChevronRight size={14} className="text-text-tertiary" />
    </Link>
  );
}
