"use client";

import { useState, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, X, ChevronRight, ChevronDown, Check, RefreshCw, Home, Zap, CreditCard, TrendingUp, Calendar, Shield, Repeat } from "lucide-react";
import { db, type Commitment, type CommitmentOccurrence, type OccurrenceStatus, type CommitmentType, type CommitmentFrequency } from "@/lib/db";
import { cn, formatMoney, toDateStr, friendlyDate } from "@/lib/utils";
import { CategoryIcon } from "@/components/ui/category-icon";
import { CATEGORY_REGISTRY } from "@/lib/categories";

const TYPE_CONFIG: Record<CommitmentType, { label: string; icon: typeof Home; color: string }> = {
  rent: { label: "Rent", icon: Home, color: "text-accent" },
  bill: { label: "Bill", icon: Zap, color: "text-orange" },
  subscription: { label: "Subscription", icon: Repeat, color: "text-purple-500" },
  emi: { label: "EMI", icon: CreditCard, color: "text-red" },
  sip: { label: "SIP", icon: TrendingUp, color: "text-green" },
  insurance: { label: "Insurance", icon: Shield, color: "text-blue-500" },
  other: { label: "Other", icon: Calendar, color: "text-text3" },
};

const FREQ_LABELS: Record<CommitmentFrequency, string> = {
  weekly: "Weekly", monthly: "Monthly", bimonthly: "Every 2 months",
  quarterly: "Quarterly", halfyearly: "Half-yearly", yearly: "Yearly", custom: "Custom",
};

const STATUS_CONFIG: Record<OccurrenceStatus, { label: string; badgeClass: string }> = {
  upcoming: { label: "Upcoming", badgeClass: "bg-accent-bg text-accent" },
  due_soon: { label: "Due Soon", badgeClass: "bg-orange-bg text-orange" },
  paid: { label: "Paid", badgeClass: "bg-green-bg text-green" },
  overdue: { label: "Overdue", badgeClass: "bg-red-bg text-red" },
  skipped: { label: "Skipped", badgeClass: "bg-surface2 text-text3" },
  paused: { label: "Paused", badgeClass: "bg-surface2 text-text3" },
};

// ════════════════════════════════════════════════════════
// COMMITMENT HOME SECTION (compact for dashboard)
// ════════════════════════════════════════════════════════

export function CommitmentHomeSummary() {
  const commitments = useLiveQuery(() => db.commitments.where("isActive").equals(1).toArray()) ?? [];
  const occurrences = useLiveQuery(() => db.occurrences.toArray()) ?? [];
  const [showFull, setShowFull] = useState(false);

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // Get/generate this month's occurrences
  const monthOccurrences = useMemo(() => {
    return occurrences.filter((o) => o.dueDate.startsWith(currentMonth));
  }, [occurrences, currentMonth]);

  const totalExpected = commitments.reduce((s, c) => s + c.amount, 0);
  const totalPaid = monthOccurrences.filter((o) => o.status === "paid").reduce((s, o) => s + (o.paidAmount || 0), 0);
  const totalRemaining = totalExpected - totalPaid;

  const upcoming = monthOccurrences.filter((o) => o.status === "upcoming" || o.status === "due_soon");
  const overdue = monthOccurrences.filter((o) => o.status === "overdue");

  if (commitments.length === 0) return null;

  return (
    <div className="mt-3">
      <button onClick={() => setShowFull(!showFull)} className="flex items-center justify-between w-full mb-2">
        <div className="flex items-center gap-1.5">
          <ChevronRight size={12} className={cn("text-text3 transition-transform", showFull && "rotate-90")} />
          <Repeat size={13} className="text-text3" />
          <span className="text-xs font-bold text-text3 uppercase tracking-wider">Commitments</span>
          {(upcoming.length + overdue.length) > 0 && (
            <span className="text-[9px] font-bold text-orange bg-orange-bg px-1.5 py-0.5 rounded-full">{upcoming.length + overdue.length}</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[10px] font-bold tabular-nums">
          <span className="text-green">{formatMoney(totalPaid)}</span>
          <span className="text-text3">/</span>
          <span className="text-text">{formatMoney(totalExpected)}</span>
        </div>
      </button>

      {showFull && (
        <div className="space-y-1.5 anim-fade">
          {/* Progress bar */}
          <div className="rounded-xl border border-border bg-surface p-2.5">
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-text3">Monthly Commitments</span>
              <span className="font-bold text-text tabular-nums">{formatMoney(totalPaid)} / {formatMoney(totalExpected)}</span>
            </div>
            <div className="h-2 rounded-full bg-surface2 overflow-hidden">
              <div className="h-full rounded-full bg-green transition-all" style={{ width: `${totalExpected > 0 ? Math.min(100, (totalPaid / totalExpected) * 100) : 0}%` }} />
            </div>
            {totalRemaining > 0 && <p className="text-[9px] text-text3 mt-1">{formatMoney(totalRemaining)} remaining</p>}
          </div>

          {/* Overdue */}
          {overdue.map((o) => {
            const c = commitments.find((cc) => cc.id === o.commitmentId);
            if (!c) return null;
            const Ic = TYPE_CONFIG[c.type]?.icon || Calendar;
            return (
              <div key={o.id} className="flex items-center gap-2.5 rounded-xl border border-red/20 bg-red-bg p-2.5">
                <Ic size={14} className="text-red shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-text truncate">{c.name}</p>
                  <p className="text-[9px] text-red">Overdue · Due {friendlyDate(o.dueDate)}</p>
                </div>
                <span className="text-[11px] font-bold text-red tabular-nums">{formatMoney(c.amount)}</span>
                <button onClick={async () => {
                  await db.occurrences.update(o.id, { status: "paid", paidDate: toDateStr(new Date()), paidAmount: c.amount });
                }} className="text-[9px] font-bold text-green bg-green-bg px-2 py-1 rounded-lg">Pay</button>
              </div>
            );
          })}

          {/* Upcoming */}
          {upcoming.slice(0, 4).map((o) => {
            const c = commitments.find((cc) => cc.id === o.commitmentId);
            if (!c) return null;
            const Ic = TYPE_CONFIG[c.type]?.icon || Calendar;
            return (
              <div key={o.id} className="flex items-center gap-2.5 rounded-xl border border-border bg-surface p-2.5">
                <Ic size={14} className={cn("shrink-0", TYPE_CONFIG[c.type]?.color || "text-text3")} />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-text truncate">{c.name}</p>
                  <p className="text-[9px] text-text3">{FREQ_LABELS[c.frequency]} · Due {friendlyDate(o.dueDate)}</p>
                </div>
                <span className="text-[11px] font-bold text-text tabular-nums">{formatMoney(c.amount)}</span>
                <button onClick={async () => {
                  await db.occurrences.update(o.id, { status: "paid", paidDate: toDateStr(new Date()), paidAmount: c.amount });
                }} className="text-[9px] font-bold text-accent bg-accent-bg px-2 py-1 rounded-lg">Pay</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════
// ADD COMMITMENT SHEET
// ════════════════════════════════════════════════════════

export function AddCommitmentSheet({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<CommitmentType>("bill");
  const [frequency, setFrequency] = useState<CommitmentFrequency>("monthly");
  const [dueDay, setDueDay] = useState("1");
  const [dueWindowEnd, setDueWindowEnd] = useState("5");
  const [categoryId, setCategoryId] = useState("housing");
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    const amt = parseFloat(amount);
    if (!name.trim() || !amt || amt <= 0) return;

    const now = new Date();
    const id = `commit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    await db.commitments.add({
      id,
      name: name.trim(),
      amount: amt,
      categoryId,
      type,
      frequency,
      startDate: toDateStr(now),
      dueDay: parseInt(dueDay) || 1,
      dueWindowStart: parseInt(dueDay) || 1,
      dueWindowEnd: parseInt(dueWindowEnd) || parseInt(dueDay) || 5,
      notes: notes || undefined,
      isActive: true,
      createdAt: now.toISOString(),
    });

    // Generate first occurrence for current month
    const occDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(parseInt(dueDay) || 1).padStart(2, "0")}`;
    const isPast = new Date(occDate + "T00:00:00") < now;

    await db.occurrences.add({
      id: `occ_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      commitmentId: id,
      dueDate: occDate,
      status: isPast ? "overdue" : "upcoming",
      createdAt: now.toISOString(),
    });

    // Also generate next month
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, parseInt(dueDay) || 1);
    await db.occurrences.add({
      id: `occ_${Date.now() + 1}_${Math.random().toString(36).slice(2, 6)}`,
      commitmentId: id,
      dueDate: toDateStr(nextMonth),
      status: "upcoming",
      createdAt: now.toISOString(),
    });

    setSaved(true);
    setTimeout(onClose, 600);
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-surface shadow-xl anim-up max-h-[90vh] overflow-y-auto">
        <div className="flex justify-center py-2"><div className="h-1 w-10 rounded-full bg-border" /></div>
        <div className="px-5 pb-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-text">{saved ? "Saved ✓" : "Add Commitment"}</h2>
            <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-surface2"><X size={18} className="text-text2" /></button>
          </div>

          {saved ? (
            <div className="flex flex-col items-center py-8 anim-fade">
              <div className="h-16 w-16 rounded-full bg-green-bg flex items-center justify-center"><Check size={28} className="text-green" /></div>
              <p className="text-sm text-text2 mt-3">Commitment added!</p>
            </div>
          ) : (
            <>
              {/* Type pills */}
              <div>
                <label className="text-[10px] font-bold text-text3 uppercase tracking-wider mb-1.5 block">Type</label>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.entries(TYPE_CONFIG) as [CommitmentType, typeof TYPE_CONFIG[CommitmentType]][]).map(([k, v]) => {
                    const Ic = v.icon;
                    return (
                      <button key={k} onClick={() => setType(k)}
                        className={cn("flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-semibold border transition-all",
                          type === k ? "border-accent bg-accent-bg text-accent" : "border-border text-text3")}>
                        <Ic size={12} /> {v.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-text3 uppercase tracking-wider mb-1 block">Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. House Rent, Netflix, SIP"
                  className="w-full rounded-xl border border-border bg-surface2 px-4 py-3 text-sm text-text outline-none focus:border-accent" />
              </div>

              <div>
                <label className="text-[10px] font-bold text-text3 uppercase tracking-wider mb-1 block">Amount</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-text3 font-bold">₹</span>
                  <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-xl border border-border bg-surface2 pl-9 pr-4 py-3 text-xl font-extrabold text-text tabular-nums outline-none focus:border-accent" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-text3 uppercase tracking-wider mb-1 block">Frequency</label>
                  <select value={frequency} onChange={(e) => setFrequency(e.target.value as CommitmentFrequency)}
                    className="w-full rounded-xl border border-border bg-surface2 px-3 py-2.5 text-sm text-text outline-none focus:border-accent">
                    {Object.entries(FREQ_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-text3 uppercase tracking-wider mb-1 block">Due Day</label>
                  <input type="number" value={dueDay} onChange={(e) => setDueDay(e.target.value)} min={1} max={31}
                    className="w-full rounded-xl border border-border bg-surface2 px-3 py-2.5 text-sm text-text outline-none focus:border-accent tabular-nums" />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-text3 uppercase tracking-wider mb-1 block">Payment Window (end day)</label>
                <input type="number" value={dueWindowEnd} onChange={(e) => setDueWindowEnd(e.target.value)} min={1} max={31}
                  placeholder="e.g. 5"
                  className="w-full rounded-xl border border-border bg-surface2 px-3 py-2.5 text-sm text-text outline-none focus:border-accent tabular-nums" />
                <p className="text-[9px] text-text3 mt-1">Payment usually between day {dueDay} and day {dueWindowEnd} of each month</p>
              </div>

              <div>
                <label className="text-[10px] font-bold text-text3 uppercase tracking-wider mb-1 block">Notes (optional)</label>
                <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any notes..."
                  className="w-full rounded-xl border border-border bg-surface2 px-4 py-2.5 text-sm text-text outline-none focus:border-accent" />
              </div>

              <button onClick={handleSave} disabled={!name.trim() || !amount || !(parseFloat(amount) > 0)}
                className="w-full rounded-xl bg-accent py-3.5 text-sm font-bold text-white disabled:opacity-40 active:scale-[0.98] transition-all">
                Add Commitment
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
