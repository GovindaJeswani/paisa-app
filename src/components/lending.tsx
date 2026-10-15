"use client";

import { useState, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, X, ChevronRight, HandCoins, ArrowUpRight, ArrowDownLeft, Check } from "lucide-react";
import { db, type Loan, type LoanRepayment, type LoanType, type LoanStatus } from "@/lib/db";
import { cn, formatMoney, toDateStr, friendlyDate } from "@/lib/utils";

// ════════════════════════════════════════════════════════
// LENDING HOME SECTION (compact for dashboard)
// ════════════════════════════════════════════════════════

export function LendingHomeSummary() {
  const loans = useLiveQuery(() => db.loans.toArray()) ?? [];
  const [expanded, setExpanded] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const activeLoans = loans.filter((l) => l.status !== "settled");
  const totalLent = activeLoans.filter((l) => l.type === "lent").reduce((s, l) => s + l.outstandingAmount, 0);
  const totalBorrowed = activeLoans.filter((l) => l.type === "borrowed").reduce((s, l) => s + l.outstandingAmount, 0);

  // Group by person
  const people = useMemo(() => {
    const map = new Map<string, { lent: number; borrowed: number; loans: Loan[] }>();
    for (const loan of activeLoans) {
      const p = map.get(loan.personName) || { lent: 0, borrowed: 0, loans: [] };
      if (loan.type === "lent") p.lent += loan.outstandingAmount;
      else p.borrowed += loan.outstandingAmount;
      p.loans.push(loan);
      map.set(loan.personName, p);
    }
    return Array.from(map.entries()).sort((a, b) => (Math.abs(b[1].lent - b[1].borrowed)) - (Math.abs(a[1].lent - a[1].borrowed)));
  }, [activeLoans]);

  if (activeLoans.length === 0 && !expanded) return null;

  return (
    <div className="mt-3">
      <button onClick={() => setExpanded(!expanded)} className="flex items-center justify-between w-full mb-2">
        <div className="flex items-center gap-1.5">
          <ChevronRight size={12} className={cn("text-text3 transition-transform", expanded && "rotate-90")} />
          <HandCoins size={13} className="text-text3" />
          <span className="text-xs font-bold text-text3 uppercase tracking-wider">Lending</span>
          {activeLoans.length > 0 && (
            <span className="text-[9px] font-bold text-accent bg-accent-bg px-1.5 py-0.5 rounded-full">{activeLoans.length}</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[10px] font-bold tabular-nums">
          {totalLent > 0 && <span className="text-green">↑{formatMoney(totalLent)}</span>}
          {totalBorrowed > 0 && <span className="text-red">↓{formatMoney(totalBorrowed)}</span>}
        </div>
      </button>

      {expanded && (
        <div className="space-y-1.5 anim-fade">
          <button onClick={() => setShowAdd(true)}
            className="w-full flex items-center gap-2 rounded-xl border border-dashed border-accent/30 bg-accent-bg/50 p-2.5 text-left hover:bg-accent-bg transition-colors">
            <Plus size={14} className="text-accent" />
            <span className="text-[11px] font-bold text-accent">Record lending or borrowing</span>
          </button>

          {people.map(([name, data]) => (
            <PersonLoanRow key={name} name={name} data={data} />
          ))}

          {activeLoans.length === 0 && (
            <p className="text-[10px] text-text3 text-center py-3">No outstanding loans. All settled! 🎉</p>
          )}
        </div>
      )}

      {showAdd && <AddLoanSheet onClose={() => setShowAdd(false)} existingPeople={people.map(([n]) => n)} />}
    </div>
  );
}

function PersonLoanRow({ name, data }: { name: string; data: { lent: number; borrowed: number; loans: Loan[] } }) {
  const [showDetails, setShowDetails] = useState(false);
  const [showRepay, setShowRepay] = useState<string | null>(null);
  const [repayAmt, setRepayAmt] = useState("");
  const repayments = useLiveQuery(() => db.loanRepayments.toArray()) ?? [];

  const netBalance = data.lent - data.borrowed; // positive = they owe me

  const handleRepay = async (loanId: string) => {
    const amt = parseFloat(repayAmt);
    if (!amt || amt <= 0) return;

    const loan = data.loans.find((l) => l.id === loanId);
    if (!loan) return;

    const newOutstanding = Math.max(0, loan.outstandingAmount - amt);
    const newStatus: LoanStatus = newOutstanding <= 0 ? "settled" : "partially_repaid";

    await db.loanRepayments.add({
      id: `repay_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      loanId,
      amount: amt,
      date: toDateStr(new Date()),
      createdAt: new Date().toISOString(),
    });

    await db.loans.update(loanId, { outstandingAmount: newOutstanding, status: newStatus });
    setShowRepay(null);
    setRepayAmt("");
  };

  return (
    <div className="rounded-xl border border-border bg-surface">
      <div className="flex items-center gap-3 p-2.5 cursor-pointer" onClick={() => setShowDetails(!showDetails)}>
        <div className={cn("h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold",
          netBalance > 0 ? "bg-green-bg text-green" : netBalance < 0 ? "bg-red-bg text-red" : "bg-surface2 text-text3")}>
          {name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-text">{name}</p>
          <p className="text-[10px] text-text3">
            {netBalance > 0 ? "owes you" : netBalance < 0 ? "you owe" : "settled"} · {data.loans.length} {data.loans.length === 1 ? "entry" : "entries"}
          </p>
        </div>
        <span className={cn("text-[13px] font-bold tabular-nums", netBalance > 0 ? "text-green" : netBalance < 0 ? "text-red" : "text-text3")}>
          {netBalance !== 0 ? `${netBalance > 0 ? "+" : "−"}${formatMoney(Math.abs(netBalance))}` : "Settled"}
        </span>
      </div>

      {showDetails && (
        <div className="px-2.5 pb-2.5 space-y-1.5 anim-fade border-t border-border pt-2">
          {data.loans.map((loan) => {
            const loanRepays = repayments.filter((r) => r.loanId === loan.id);
            return (
              <div key={loan.id} className="rounded-lg bg-surface2 p-2.5">
                <div className="flex items-center gap-2">
                  {loan.type === "lent" ? <ArrowUpRight size={12} className="text-green" /> : <ArrowDownLeft size={12} className="text-red" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-text truncate">
                      {loan.type === "lent" ? "You lent" : "You borrowed"} {formatMoney(loan.originalAmount)}
                    </p>
                    <p className="text-[9px] text-text3">{loan.description} · {friendlyDate(loan.date)}</p>
                    {loan.expectedRepayDate && (
                      <p className="text-[9px] text-orange">Expected by {friendlyDate(loan.expectedRepayDate)}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className={cn("text-[11px] font-bold tabular-nums", loan.outstandingAmount > 0 ? (loan.type === "lent" ? "text-green" : "text-red") : "text-text3")}>
                      {formatMoney(loan.outstandingAmount)}
                    </span>
                    {loan.outstandingAmount < loan.originalAmount && (
                      <p className="text-[8px] text-text3">of {formatMoney(loan.originalAmount)}</p>
                    )}
                  </div>
                </div>

                {/* Repayment history */}
                {loanRepays.length > 0 && (
                  <div className="mt-1.5 space-y-0.5">
                    {loanRepays.map((r) => (
                      <div key={r.id} className="flex justify-between text-[9px] text-text3">
                        <span>↩ Repaid {friendlyDate(r.date)}</span>
                        <span className="font-bold tabular-nums">{formatMoney(r.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Repay button */}
                {loan.outstandingAmount > 0 && (
                  showRepay === loan.id ? (
                    <div className="mt-2 flex gap-1.5">
                      <div className="relative flex-1">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-text3">₹</span>
                        <input type="number" value={repayAmt} onChange={(e) => setRepayAmt(e.target.value)}
                          placeholder={String(loan.outstandingAmount)} autoFocus
                          className="w-full rounded-lg border border-border bg-surface pl-5 pr-2 py-1.5 text-xs font-bold text-text outline-none focus:border-accent tabular-nums" />
                      </div>
                      <button onClick={() => handleRepay(loan.id)} className="rounded-lg bg-green px-3 py-1.5 text-[10px] font-bold text-white">Record</button>
                      <button onClick={() => { setShowRepay(null); setRepayAmt(""); }} className="text-[10px] text-text3">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setShowRepay(loan.id)} className="mt-1.5 w-full rounded-lg bg-accent-bg py-1.5 text-[10px] font-bold text-accent">
                      Record Repayment
                    </button>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════
// ADD LOAN SHEET
// ════════════════════════════════════════════════════════

function AddLoanSheet({ onClose, existingPeople }: { onClose: () => void; existingPeople: string[] }) {
  const [type, setType] = useState<LoanType>("lent");
  const [person, setPerson] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    const amt = parseFloat(amount);
    if (!person.trim() || !amt || amt <= 0) return;

    await db.loans.add({
      id: `loan_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      personName: person.trim(),
      type,
      originalAmount: amt,
      outstandingAmount: amt,
      description: description.trim() || `${type === "lent" ? "Lent to" : "Borrowed from"} ${person.trim()}`,
      date: toDateStr(new Date()),
      expectedRepayDate: expectedDate || undefined,
      status: "outstanding",
      notes: notes || undefined,
      createdAt: new Date().toISOString(),
    });

    setSaved(true);
    setTimeout(onClose, 600);
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-surface shadow-xl anim-up max-h-[85vh] overflow-y-auto">
        <div className="flex justify-center py-2"><div className="h-1 w-10 rounded-full bg-border" /></div>
        <div className="px-5 pb-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-text">{saved ? "Saved ✓" : "Record Loan"}</h2>
            <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-surface2"><X size={18} className="text-text2" /></button>
          </div>

          {saved ? (
            <div className="flex flex-col items-center py-8 anim-fade">
              <div className="h-16 w-16 rounded-full bg-green-bg flex items-center justify-center"><Check size={28} className="text-green" /></div>
              <p className="text-sm text-text2 mt-3">Loan recorded!</p>
            </div>
          ) : (
            <>
              {/* Type toggle */}
              <div className="flex rounded-xl border border-border overflow-hidden">
                <button onClick={() => setType("lent")} className={cn("flex-1 py-2.5 text-sm font-bold flex items-center justify-center gap-1.5 transition-colors", type === "lent" ? "bg-green-bg text-green" : "text-text3")}>
                  <ArrowUpRight size={14} /> I Lent
                </button>
                <button onClick={() => setType("borrowed")} className={cn("flex-1 py-2.5 text-sm font-bold flex items-center justify-center gap-1.5 transition-colors", type === "borrowed" ? "bg-red-bg text-red" : "text-text3")}>
                  <ArrowDownLeft size={14} /> I Borrowed
                </button>
              </div>

              <div>
                <label className="text-[10px] font-bold text-text3 uppercase tracking-wider mb-1 block">Person</label>
                <input type="text" value={person} onChange={(e) => setPerson(e.target.value)}
                  placeholder={type === "lent" ? "Who did you lend to?" : "Who did you borrow from?"} list="person-list" autoFocus
                  className="w-full rounded-xl border border-border bg-surface2 px-4 py-3 text-sm text-text outline-none focus:border-accent" />
                <datalist id="person-list">
                  {existingPeople.map((p) => <option key={p} value={p} />)}
                </datalist>
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

              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="What for? (dinner, emergency, etc.)"
                className="w-full rounded-xl border border-border bg-surface2 px-4 py-2.5 text-sm text-text outline-none focus:border-accent" />

              <div>
                <label className="text-[10px] font-bold text-text3 uppercase tracking-wider mb-1 block">Expected repayment date (optional)</label>
                <input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface2 px-4 py-2.5 text-sm text-text outline-none focus:border-accent" />
              </div>

              <button onClick={handleSave} disabled={!person.trim() || !amount || !(parseFloat(amount) > 0)}
                className={cn("w-full rounded-xl py-3.5 text-sm font-bold text-white disabled:opacity-40 active:scale-[0.98] transition-all",
                  type === "lent" ? "bg-green hover:bg-green/90" : "bg-red hover:bg-red/90")}>
                {type === "lent" ? `Record ₹${amount || "0"} lent to ${person || "..."}` : `Record ₹${amount || "0"} borrowed from ${person || "..."}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
