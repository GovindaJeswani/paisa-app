"use client";

import { useState, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, X, ChevronRight, TrendingUp, Rocket, BarChart3, PiggyBank, Check, RefreshCw, Lock, Gem } from "lucide-react";
import { db, type Investment, type InvestmentType, type IPOStatus } from "@/lib/db";
import { cn, formatMoney, toDateStr, friendlyDate } from "@/lib/utils";

const TYPE_CONFIG: Record<InvestmentType, { label: string; icon: typeof TrendingUp; color: string }> = {
  sip: { label: "SIP", icon: RefreshCw, color: "text-green" },
  mutual_fund: { label: "Mutual Fund", icon: BarChart3, color: "text-accent" },
  stock: { label: "Stock", icon: TrendingUp, color: "text-blue-500" },
  ipo: { label: "IPO", icon: Rocket, color: "text-orange" },
  fd: { label: "FD", icon: Lock, color: "text-purple-500" },
  rd: { label: "RD", icon: PiggyBank, color: "text-pink-500" },
  gold: { label: "Gold", icon: Gem, color: "text-yellow-500" },
  other: { label: "Other", icon: BarChart3, color: "text-text3" },
};

const IPO_STATUS_LABELS: Record<IPOStatus, { label: string; cls: string }> = {
  planned: { label: "Planned", cls: "bg-surface2 text-text3" },
  applied: { label: "Applied", cls: "bg-accent-bg text-accent" },
  amount_blocked: { label: "Blocked", cls: "bg-orange-bg text-orange" },
  allotted: { label: "Allotted ✓", cls: "bg-green-bg text-green" },
  partially_allotted: { label: "Partial", cls: "bg-orange-bg text-orange" },
  not_allotted: { label: "Not Allotted", cls: "bg-red-bg text-red" },
  refund_pending: { label: "Refund Pending", cls: "bg-orange-bg text-orange" },
  refunded: { label: "Refunded", cls: "bg-surface2 text-text3" },
  listed: { label: "Listed", cls: "bg-green-bg text-green" },
  cancelled: { label: "Cancelled", cls: "bg-surface2 text-text3" },
};

// ════════════════════════════════════════════════════════
// INVESTMENT TRACKING SHEET (full page bottom sheet)
// ════════════════════════════════════════════════════════

export function InvestmentSheet({ onClose }: { onClose: () => void }) {
  const investments = useLiveQuery(() => db.investments.orderBy("date").reverse().toArray()) ?? [];
  const [showAdd, setShowAdd] = useState(false);
  const [addType, setAddType] = useState<InvestmentType | null>(null);

  const totalInvested = investments.reduce((s, i) => s + i.amount, 0);
  const byType = useMemo(() => {
    const m = new Map<string, { count: number; amount: number }>();
    investments.forEach((i) => {
      const e = m.get(i.type) || { count: 0, amount: 0 };
      e.count++; e.amount += i.amount;
      m.set(i.type, e);
    });
    return m;
  }, [investments]);

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-surface shadow-xl anim-up max-h-[92vh] overflow-y-auto">
        <div className="flex justify-center py-2"><div className="h-1 w-10 rounded-full bg-border" /></div>
        <div className="px-5 pb-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-text">Investments</h2>
            <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-surface2"><X size={18} className="text-text2" /></button>
          </div>

          {/* Summary */}
          <div className="rounded-xl bg-green-bg border border-green/20 p-4">
            <p className="text-[10px] font-bold text-green uppercase">Total Invested</p>
            <p className="text-2xl font-extrabold text-green tabular-nums">{formatMoney(totalInvested)}</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {Array.from(byType.entries()).map(([type, data]) => {
                const conf = TYPE_CONFIG[type as InvestmentType];
                if (!conf) return null;
                return (
                  <span key={type} className="text-[10px] font-bold text-green/70 bg-green/10 px-2 py-0.5 rounded-full">
                    {conf.label}: {data.count} · {formatMoney(data.amount)}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Add buttons */}
          <div className="grid grid-cols-4 gap-2">
            {(Object.entries(TYPE_CONFIG) as [InvestmentType, typeof TYPE_CONFIG[InvestmentType]][]).map(([k, v]) => {
              const Ic = v.icon;
              return (
                <button key={k} onClick={() => { setAddType(k); setShowAdd(true); }}
                  className="flex flex-col items-center gap-1 rounded-xl border border-border p-2.5 hover:bg-accent-bg hover:border-accent transition-all">
                  <Ic size={18} className={v.color} />
                  <span className="text-[9px] font-semibold text-text2">{v.label}</span>
                </button>
              );
            })}
          </div>

          {/* Investment list */}
          {investments.length === 0 ? (
            <div className="text-center py-6">
              <TrendingUp size={28} className="text-text3 mx-auto mb-2" />
              <p className="text-sm text-text3">No investments recorded yet</p>
              <p className="text-[10px] text-text3 mt-1">Tap a type above to add your first investment</p>
            </div>
          ) : (
            <div className="space-y-2">
              {investments.map((inv) => {
                const conf = TYPE_CONFIG[inv.type] || TYPE_CONFIG.other;
                const Ic = conf.icon;
                return (
                  <div key={inv.id} className="rounded-xl border border-border bg-surface p-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-accent-bg flex items-center justify-center shrink-0">
                        <Ic size={18} className={conf.color} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-text truncate">{inv.name}</p>
                        <p className="text-[10px] text-text3">
                          {conf.label} · {friendlyDate(inv.date)}
                          {inv.quantity ? ` · ${inv.quantity} qty` : ""}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[13px] font-bold text-text tabular-nums">{formatMoney(inv.amount)}</span>
                        {inv.type === "ipo" && inv.ipoStatus && (
                          <div className={cn("text-[8px] font-bold px-1.5 py-0.5 rounded-full mt-0.5 text-center",
                            IPO_STATUS_LABELS[inv.ipoStatus]?.cls || "bg-surface2 text-text3")}>
                            {IPO_STATUS_LABELS[inv.ipoStatus]?.label || inv.ipoStatus}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* IPO extra details */}
                    {inv.type === "ipo" && (
                      <div className="mt-2 flex flex-wrap gap-1.5 text-[9px]">
                        {inv.amountBlocked != null && <span className="bg-orange-bg text-orange px-1.5 py-0.5 rounded">Blocked: {formatMoney(inv.amountBlocked)}</span>}
                        {inv.amountAllotted != null && <span className="bg-green-bg text-green px-1.5 py-0.5 rounded">Allotted: {formatMoney(inv.amountAllotted)}</span>}
                        {inv.refundAmount != null && <span className="bg-surface2 text-text3 px-1.5 py-0.5 rounded">Refund: {formatMoney(inv.refundAmount)}</span>}
                        {/* Status change buttons */}
                        {inv.ipoStatus && !["refunded", "listed", "cancelled"].includes(inv.ipoStatus) && (
                          <select
                            value={inv.ipoStatus}
                            onChange={async (e) => { await db.investments.update(inv.id, { ipoStatus: e.target.value as IPOStatus }); }}
                            className="bg-surface border border-border rounded px-1 py-0.5 text-[9px] text-text outline-none"
                          >
                            {Object.entries(IPO_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                          </select>
                        )}
                      </div>
                    )}
                    {inv.notes && <p className="text-[10px] text-text3 mt-1.5">{inv.notes}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showAdd && addType && <AddInvestmentSheet type={addType} onClose={() => { setShowAdd(false); setAddType(null); }} />}
    </div>
  );
}

// ════════════════════════════════════════════════════════
// ADD INVESTMENT SHEET
// ════════════════════════════════════════════════════════

function AddInvestmentSheet({ type, onClose }: { type: InvestmentType; onClose: () => void }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(toDateStr(new Date()));
  const [notes, setNotes] = useState("");
  // Stock fields
  const [symbol, setSymbol] = useState("");
  const [quantity, setQuantity] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  // IPO fields
  const [ipoStatus, setIpoStatus] = useState<IPOStatus>("applied");
  const [saved, setSaved] = useState(false);

  const conf = TYPE_CONFIG[type];
  const Ic = conf.icon;

  const handleSave = async () => {
    const amt = parseFloat(amount);
    if (!name.trim() || !amt || amt <= 0) return;

    const inv: Investment = {
      id: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type,
      name: name.trim(),
      amount: amt,
      date,
      status: type === "ipo" ? ipoStatus : "active",
      notes: notes || undefined,
      createdAt: new Date().toISOString(),
    };

    if (type === "stock") {
      inv.symbol = symbol || undefined;
      inv.quantity = parseFloat(quantity) || undefined;
      inv.buyPrice = parseFloat(buyPrice) || undefined;
    }

    if (type === "ipo") {
      inv.ipoStatus = ipoStatus;
      inv.amountBlocked = amt;
    }

    await db.investments.add(inv);
    setSaved(true);
    setTimeout(onClose, 600);
  };

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-surface shadow-xl anim-up max-h-[85vh] overflow-y-auto">
        <div className="flex justify-center py-2"><div className="h-1 w-10 rounded-full bg-border" /></div>
        <div className="px-5 pb-8 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-accent-bg flex items-center justify-center"><Ic size={18} className={conf.color} /></div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-text">{saved ? "Saved ✓" : `Add ${conf.label}`}</h2>
            </div>
            <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-surface2"><X size={18} className="text-text2" /></button>
          </div>

          {saved ? (
            <div className="flex flex-col items-center py-8 anim-fade">
              <div className="h-16 w-16 rounded-full bg-green-bg flex items-center justify-center"><Check size={28} className="text-green" /></div>
              <p className="text-sm text-text2 mt-3">{conf.label} recorded!</p>
            </div>
          ) : (
            <>
              <div>
                <label className="text-[10px] font-bold text-text3 uppercase tracking-wider mb-1 block">
                  {type === "ipo" ? "IPO Name" : type === "stock" ? "Stock / Company" : type === "sip" ? "Fund Name" : "Name"}
                </label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} autoFocus
                  placeholder={type === "ipo" ? "e.g. Swiggy IPO" : type === "stock" ? "e.g. Reliance Industries" : type === "sip" ? "e.g. Axis Bluechip Fund" : "Name"}
                  className="w-full rounded-xl border border-border bg-surface2 px-4 py-3 text-sm text-text outline-none focus:border-accent" />
              </div>

              <div>
                <label className="text-[10px] font-bold text-text3 uppercase tracking-wider mb-1 block">
                  {type === "ipo" ? "Amount Applied" : "Amount Invested"}
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-text3 font-bold">₹</span>
                  <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-xl border border-border bg-surface2 pl-9 pr-4 py-3 text-xl font-extrabold text-text tabular-nums outline-none focus:border-accent" />
                </div>
              </div>

              {/* Stock specific */}
              {type === "stock" && (
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-text3 uppercase mb-1 block">Symbol</label>
                    <input type="text" value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="RELIANCE"
                      className="w-full rounded-xl border border-border bg-surface2 px-3 py-2.5 text-sm text-text outline-none focus:border-accent" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-text3 uppercase mb-1 block">Qty</label>
                    <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0"
                      className="w-full rounded-xl border border-border bg-surface2 px-3 py-2.5 text-sm text-text outline-none focus:border-accent tabular-nums" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-text3 uppercase mb-1 block">Buy Price</label>
                    <input type="number" value={buyPrice} onChange={(e) => setBuyPrice(e.target.value)} placeholder="0"
                      className="w-full rounded-xl border border-border bg-surface2 px-3 py-2.5 text-sm text-text outline-none focus:border-accent tabular-nums" />
                  </div>
                </div>
              )}

              {/* IPO status */}
              {type === "ipo" && (
                <div>
                  <label className="text-[10px] font-bold text-text3 uppercase tracking-wider mb-1.5 block">Application Status</label>
                  <div className="flex flex-wrap gap-1.5">
                    {(["planned", "applied", "amount_blocked", "allotted", "not_allotted", "refund_pending", "refunded"] as IPOStatus[]).map((s) => (
                      <button key={s} onClick={() => setIpoStatus(s)}
                        className={cn("rounded-full px-2.5 py-1.5 text-[10px] font-semibold border transition-all",
                          ipoStatus === s ? IPO_STATUS_LABELS[s].cls + " border-transparent" : "border-border text-text3")}>
                        {IPO_STATUS_LABELS[s].label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold text-text3 uppercase tracking-wider mb-1 block">Date</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface2 px-4 py-2.5 text-sm text-text outline-none focus:border-accent" />
              </div>

              <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes (optional)"
                className="w-full rounded-xl border border-border bg-surface2 px-4 py-2.5 text-sm text-text outline-none focus:border-accent" />

              <button onClick={handleSave} disabled={!name.trim() || !amount || !(parseFloat(amount) > 0)}
                className="w-full rounded-xl bg-green py-3.5 text-sm font-bold text-white disabled:opacity-40 active:scale-[0.98] transition-all">
                Record {conf.label}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
