"use client";

import { useState, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, X, ChevronRight, Users, Check } from "lucide-react";
import { db, getCategoryName, getCategoryEmoji, type FriendSplit } from "@/lib/db";
import { cn, formatMoney, toDateStr } from "@/lib/utils";

// ════════════════════════════════════════════════════════
// FRIEND SPLIT SECTION — collapsible, multi-friend, GPay-style
// ════════════════════════════════════════════════════════

export function FriendSplitSection() {
  const splits = useLiveQuery(() => db.splits.toArray()) ?? [];
  const [expanded, setExpanded] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const allFriendNames = useMemo(() => {
    const names = new Set<string>();
    for (const s of splits) names.add(s.friendName);
    return Array.from(names);
  }, [splits]);

  const activeSplits = splits.filter((s) => !s.settled);
  const settledSplits = splits.filter((s) => s.settled);

  const friendBalances = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of activeSplits) map.set(s.friendName, (map.get(s.friendName) || 0) + s.amount);
    return Array.from(map.entries()).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  }, [activeSplits]);

  const totalOwed = friendBalances.filter(([, v]) => v > 0).reduce((s, [, v]) => s + v, 0);
  const totalOwe = friendBalances.filter(([, v]) => v < 0).reduce((s, [, v]) => s + Math.abs(v), 0);

  return (
    <div className="mt-3">
      <button onClick={() => setExpanded(!expanded)} className="flex items-center justify-between w-full mb-2">
        <div className="flex items-center gap-1.5">
          <ChevronRight size={12} className={cn("text-text3 transition-transform", expanded && "rotate-90")} />
          <Users size={13} className="text-text3" />
          <span className="text-xs font-bold text-text3 uppercase tracking-wider">Friends</span>
          {activeSplits.length > 0 && (
            <span className="text-[9px] font-bold text-accent bg-accent-bg px-1.5 py-0.5 rounded-full">{activeSplits.length}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {totalOwed > 0 && <span className="text-[10px] font-bold text-green">+{formatMoney(totalOwed)}</span>}
          {totalOwe > 0 && <span className="text-[10px] font-bold text-red">−{formatMoney(totalOwe)}</span>}
        </div>
      </button>

      {expanded && (
        <div className="space-y-2 anim-fade">
          <button onClick={() => setShowAdd(true)}
            className="w-full flex items-center gap-2 rounded-xl border border-dashed border-accent/30 bg-accent-bg/50 p-2.5 text-left hover:bg-accent-bg transition-colors">
            <Plus size={14} className="text-accent" />
            <span className="text-[11px] font-bold text-accent">Split a bill</span>
          </button>

          {friendBalances.map(([name, balance]) => (
            <FriendRow key={name} name={name} balance={balance} splits={activeSplits.filter((s) => s.friendName === name)} />
          ))}

          {friendBalances.length > 0 && (
            <button onClick={() => {
              const lines = friendBalances.map(([n, b]) => `${n}: ${b > 0 ? `owes you ₹${Math.abs(b)}` : `you owe ₹${Math.abs(b)}`}`);
              window.open(`https://wa.me/?text=${encodeURIComponent(`💰 Split Summary\n\n${lines.join("\n")}\n\n— via Paisa`)}`, "_blank");
            }} className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-green/20 bg-green-bg py-2 text-[11px] font-bold text-green">
              📤 Share on WhatsApp
            </button>
          )}

          {settledSplits.length > 0 && (
            <details className="text-[10px]">
              <summary className="text-text3 cursor-pointer font-semibold">Settled ({settledSplits.length})</summary>
              <div className="mt-1 space-y-1">
                {settledSplits.slice(0, 5).map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-lg bg-surface2 p-2 opacity-60">
                    <span className="text-text3">{s.friendName} · {s.description}</span>
                    <span className="text-text3 tabular-nums">{formatMoney(Math.abs(s.amount))}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {showAdd && <MultiSplitSheet onClose={() => setShowAdd(false)} friendSuggestions={allFriendNames} />}
    </div>
  );
}

function FriendRow({ name, balance, splits }: { name: string; balance: number; splits: FriendSplit[] }) {
  const [showDetails, setShowDetails] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editAmt, setEditAmt] = useState("");

  return (
    <div className="rounded-xl border border-border bg-surface">
      <div className="flex items-center gap-3 p-2.5 cursor-pointer" onClick={() => setShowDetails(!showDetails)}>
        <div className={cn("h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold",
          balance > 0 ? "bg-green-bg text-green" : "bg-red-bg text-red")}>
          {name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1">
          <p className="text-[12px] font-semibold text-text">{name}</p>
          <p className="text-[10px] text-text3">{balance > 0 ? "owes you" : "you owe"} · {splits.length} split{splits.length !== 1 ? "s" : ""}</p>
        </div>
        <span className={cn("text-[13px] font-bold tabular-nums", balance > 0 ? "text-green" : "text-red")}>
          {balance > 0 ? "+" : "−"}{formatMoney(Math.abs(balance))}
        </span>
      </div>

      {showDetails && (
        <div className="px-2.5 pb-2.5 space-y-1 anim-fade border-t border-border pt-2">
          {splits.map((s) => (
            <div key={s.id} className="flex items-center gap-2 rounded-lg bg-surface2 p-2">
              {editId === s.id ? (
                <div className="flex-1 flex gap-1.5">
                  <input type="number" value={editAmt} onChange={(e) => setEditAmt(e.target.value)}
                    className="w-20 rounded border border-border bg-surface px-2 py-1 text-xs font-bold outline-none focus:border-accent tabular-nums" />
                  <button onClick={async () => {
                    const amt = parseFloat(editAmt);
                    if (amt) await db.splits.update(s.id, { amount: s.amount > 0 ? amt : -amt });
                    setEditId(null);
                  }} className="text-[10px] font-bold text-accent">Save</button>
                  <button onClick={() => setEditId(null)} className="text-[10px] text-text3">Cancel</button>
                </div>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-text truncate">{s.description}</p>
                    <p className="text-[9px] text-text3">{s.date}</p>
                  </div>
                  <span className={cn("text-[11px] font-bold tabular-nums", s.amount > 0 ? "text-green" : "text-red")}>
                    {s.amount > 0 ? "+" : "−"}{formatMoney(Math.abs(s.amount))}
                  </span>
                  <button onClick={() => { setEditId(s.id); setEditAmt(String(Math.abs(s.amount))); }}
                    className="text-[9px] text-text3 hover:text-accent">✏️</button>
                  <button onClick={async () => await db.splits.delete(s.id)}
                    className="text-[9px] text-text3 hover:text-red">🗑️</button>
                </>
              )}
            </div>
          ))}
          <button onClick={async () => {
            for (const s of splits) await db.splits.update(s.id, { settled: true });
          }} className="w-full rounded-lg bg-green-bg py-1.5 text-[10px] font-bold text-green mt-1">
            ✓ Settle all with {name}
          </button>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════
// MULTI-FRIEND SPLIT SHEET — GPay style
// ════════════════════════════════════════════════════════

function MultiSplitSheet({ onClose, friendSuggestions }: { onClose: () => void; friendSuggestions: string[] }) {
  const [totalAmount, setTotalAmount] = useState("");
  const [description, setDescription] = useState("");
  const [friends, setFriends] = useState<string[]>([""]);
  const [includeMe, setIncludeMe] = useState(true);
  const [whoPaid, setWhoPaid] = useState<"me" | number>("me");
  const [splitMode, setSplitMode] = useState<"equal" | "custom">("equal");
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});

  const totalPeople = friends.filter((f) => f.trim()).length + (includeMe ? 1 : 0);
  const perPerson = totalPeople > 0 ? Math.round(parseFloat(totalAmount) / totalPeople) : 0;

  const handleSave = async () => {
    const total = parseFloat(totalAmount);
    if (!total || totalPeople < 2) return;
    const validFriends = friends.filter((f) => f.trim());
    const dateStr = toDateStr(new Date());
    const now = new Date();

    if (whoPaid === "me") {
      for (const friend of validFriends) {
        const amt = splitMode === "custom" ? (parseFloat(customAmounts[friend]) || perPerson) : perPerson;
        await db.splits.add({
          id: `split_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
          friendName: friend.trim(), amount: amt,
          description: description || `Split ₹${total}`,
          date: dateStr, settled: false, createdAt: now.toISOString(),
        });
      }
    } else {
      const payer = validFriends[whoPaid as number];
      if (payer) {
        const myShare = splitMode === "custom" ? (parseFloat(customAmounts["me"]) || perPerson) : perPerson;
        await db.splits.add({
          id: `split_${Date.now()}_me`,
          friendName: payer.trim(), amount: -myShare,
          description: description || `Split ₹${total}`,
          date: dateStr, settled: false, createdAt: now.toISOString(),
        });
      }
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-surface shadow-xl anim-up max-h-[85vh] overflow-y-auto">
        <div className="flex justify-center py-2"><div className="h-1 w-10 rounded-full bg-border" /></div>
        <div className="px-5 pb-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-text">Split a bill</h2>
            <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-surface2"><X size={18} className="text-text2" /></button>
          </div>

          <div>
            <label className="text-[10px] font-bold text-text3 uppercase tracking-wider mb-1 block">Total bill</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-text3 font-bold">₹</span>
              <input type="number" inputMode="decimal" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)}
                placeholder="0" autoFocus
                className="w-full rounded-xl border border-border bg-surface2 pl-9 pr-4 py-3.5 text-xl font-extrabold text-text tabular-nums outline-none focus:border-accent" />
            </div>
          </div>

          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="What for? (dinner, trip, etc.)"
            className="w-full rounded-xl border border-border bg-surface2 px-4 py-2.5 text-sm text-text outline-none focus:border-accent" />

          <div>
            <label className="text-[10px] font-bold text-text3 uppercase tracking-wider mb-1.5 block">Split between</label>

            <div className="flex items-center gap-2 mb-2">
              <button onClick={() => setIncludeMe(!includeMe)}
                className={cn("h-5 w-5 rounded-md border flex items-center justify-center",
                  includeMe ? "border-accent bg-accent text-white" : "border-border")}>
                {includeMe && <Check size={12} />}
              </button>
              <span className="text-sm font-semibold text-text flex-1">You</span>
              {whoPaid === "me" ? (
                <span className="text-[9px] font-bold text-accent bg-accent-bg px-1.5 py-0.5 rounded-full">Paid</span>
              ) : (
                <button onClick={() => setWhoPaid("me")} className="text-[9px] text-text3 hover:text-accent">I paid</button>
              )}
            </div>

            {friends.map((f, i) => (
              <div key={i} className="flex items-center gap-2 mb-2">
                <div className="h-5 w-5 rounded-md bg-accent-bg flex items-center justify-center">
                  <Users size={10} className="text-accent" />
                </div>
                <div className="flex-1">
                  <input type="text" value={f}
                    onChange={(e) => { const nf = [...friends]; nf[i] = e.target.value; setFriends(nf); }}
                    placeholder="Friend's name" list={`fs-${i}`}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text outline-none focus:border-accent" />
                  <datalist id={`fs-${i}`}>
                    {friendSuggestions.filter((s) => !friends.includes(s)).map((s) => <option key={s} value={s} />)}
                  </datalist>
                </div>
                {whoPaid === i ? (
                  <span className="text-[9px] font-bold text-accent bg-accent-bg px-1.5 py-0.5 rounded-full">Paid</span>
                ) : f.trim() ? (
                  <button onClick={() => setWhoPaid(i)} className="text-[9px] text-text3 hover:text-accent">They paid</button>
                ) : null}
                {friends.length > 1 && (
                  <button onClick={() => setFriends(friends.filter((_, idx) => idx !== i))} className="text-text3"><X size={14} /></button>
                )}
              </div>
            ))}

            <button onClick={() => setFriends([...friends, ""])} className="flex items-center gap-1.5 text-[11px] font-bold text-accent mt-1">
              <Plus size={12} /> Add friend
            </button>
          </div>

          {/* Split mode */}
          <div className="flex gap-2">
            <button onClick={() => setSplitMode("equal")}
              className={cn("flex-1 rounded-xl py-2.5 text-xs font-bold border transition-all",
                splitMode === "equal" ? "border-accent bg-accent-bg text-accent" : "border-border text-text3")}>
              Equal split
            </button>
            <button onClick={() => setSplitMode("custom")}
              className={cn("flex-1 rounded-xl py-2.5 text-xs font-bold border transition-all",
                splitMode === "custom" ? "border-accent bg-accent-bg text-accent" : "border-border text-text3")}>
              Custom amounts
            </button>
          </div>

          {/* Custom amounts input */}
          {splitMode === "custom" && parseFloat(totalAmount) > 0 && (
            <div className="rounded-xl bg-surface2 p-3 space-y-2">
              <p className="text-[10px] font-bold text-text3 uppercase">Enter each person's share</p>
              {includeMe && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-text flex-1">You</span>
                  <div className="relative w-24">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-text3">₹</span>
                    <input type="number" value={customAmounts["me"] || ""} onChange={(e) => setCustomAmounts({ ...customAmounts, me: e.target.value })}
                      placeholder={String(perPerson)}
                      className="w-full rounded-lg border border-border bg-surface pl-5 pr-2 py-1.5 text-xs font-bold text-text outline-none focus:border-accent tabular-nums" />
                  </div>
                </div>
              )}
              {friends.filter((f) => f.trim()).map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-sm text-text flex-1">{f}</span>
                  <div className="relative w-24">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-text3">₹</span>
                    <input type="number" value={customAmounts[f] || ""} onChange={(e) => setCustomAmounts({ ...customAmounts, [f]: e.target.value })}
                      placeholder={String(perPerson)}
                      className="w-full rounded-lg border border-border bg-surface pl-5 pr-2 py-1.5 text-xs font-bold text-text outline-none focus:border-accent tabular-nums" />
                  </div>
                </div>
              ))}
              {(() => {
                const customTotal = Object.values(customAmounts).reduce((s, v) => s + (parseFloat(v) || 0), 0);
                const diff = parseFloat(totalAmount) - customTotal;
                return diff !== 0 && customTotal > 0 ? (
                  <p className={cn("text-[10px] font-bold", Math.abs(diff) < 1 ? "text-green" : "text-red")}>
                    {diff > 0 ? `₹${Math.round(diff)} unassigned` : `₹${Math.round(Math.abs(diff))} over`}
                  </p>
                ) : null;
              })()}
            </div>
          )}

          {parseFloat(totalAmount) > 0 && totalPeople >= 2 && (
            <div className="rounded-xl bg-surface2 p-3">
              <p className="text-[10px] font-bold text-text3 uppercase mb-1.5">Split preview</p>
              {includeMe && (
                <div className="flex justify-between text-[12px] mb-0.5">
                  <span className="text-text">You</span>
                  <span className="font-bold text-text tabular-nums">{formatMoney(perPerson)}</span>
                </div>
              )}
              {friends.filter((f) => f.trim()).map((f, i) => (
                <div key={i} className="flex justify-between text-[12px] mb-0.5">
                  <span className="text-text">{f}</span>
                  <span className="font-bold text-text tabular-nums">{formatMoney(perPerson)}</span>
                </div>
              ))}
              <div className="border-t border-border pt-1 mt-1 flex justify-between text-[12px]">
                <span className="font-bold text-text">Total</span>
                <span className="font-bold text-text tabular-nums">{formatMoney(perPerson * totalPeople)}</span>
              </div>
            </div>
          )}

          <button onClick={handleSave}
            disabled={!totalAmount || parseFloat(totalAmount) <= 0 || totalPeople < 2 || !friends.some((f) => f.trim())}
            className="w-full rounded-xl bg-accent py-3.5 text-sm font-bold text-white disabled:opacity-40 active:scale-[0.98]">
            Split {totalPeople >= 2 && perPerson > 0 ? `₹${perPerson} each` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
