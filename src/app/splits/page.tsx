"use client";

import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Users, Trash2, Check, Divide, Contact } from "lucide-react";
import { db } from "@/lib/db";
import { cn, formatCurrency, generateId } from "@/lib/utils";
import { usePersons } from "@/lib/hooks/use-persons";
import { useLiveQuery } from "dexie-react-hooks";
import { isContactPickerSupported, pickContacts } from "@/lib/engine/contacts";
import type { Group, Split, SplitShare, Person } from "@/lib/types";

export default function SplitsPage() {
  const persons = usePersons();
  const groups = useLiveQuery(() => db.groups.toArray()) ?? [];
  const splits = useLiveQuery(() => db.splits.toArray()) ?? [];
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [showSplitForm, setShowSplitForm] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [splitAmount, setSplitAmount] = useState("");
  const [splitDescription, setSplitDescription] = useState("");
  const [splitGroupId, setSplitGroupId] = useState<string | null>(null);
  const [splitPaidBy, setSplitPaidBy] = useState<string>("self");
  const [splitType, setSplitType] = useState<"equal" | "custom">("equal");
  const [customShares, setCustomShares] = useState<Record<string, string>>({});

  const handleCreateGroup = useCallback(async () => {
    if (!groupName.trim() || selectedMembers.length === 0) return;
    const group: Group = { id: generateId(), name: groupName.trim(), memberIds: [...selectedMembers, "self"], createdAt: new Date().toISOString() };
    await db.groups.add(group);
    setGroupName(""); setSelectedMembers([]); setShowGroupForm(false);
  }, [groupName, selectedMembers]);

  const handleCreateSplit = useCallback(async () => {
    if (!splitAmount || !splitGroupId) return;
    const amount = parseFloat(splitAmount) || 0;
    const group = groups.find((g) => g.id === splitGroupId);
    if (!group || amount <= 0) return;

    const memberCount = group.memberIds.length;
    const shares: SplitShare[] = group.memberIds.map((pid) => ({
      personId: pid,
      amount: splitType === "equal" ? Math.round((amount / memberCount) * 100) / 100 : parseFloat(customShares[pid] || "0"),
      isSettled: pid === splitPaidBy,
    }));

    const split: Split = {
      id: generateId(), transactionId: "", groupId: splitGroupId,
      paidByPersonId: splitPaidBy, totalAmount: amount, shares, isSettled: false,
      createdAt: new Date().toISOString(),
    };
    await db.splits.add(split);

    // Update person balances
    for (const share of shares) {
      if (share.personId === "self" || share.personId === splitPaidBy) continue;
      const person = await db.persons.get(share.personId);
      if (person) {
        const delta = splitPaidBy === "self" ? share.amount : -share.amount;
        await db.persons.update(share.personId, { netBalance: person.netBalance + delta });
      }
    }

    setSplitAmount(""); setSplitDescription(""); setSplitGroupId(null); setShowSplitForm(false); setCustomShares({});
  }, [splitAmount, splitGroupId, splitPaidBy, splitType, customShares, groups]);

  const handleSettleSplit = useCallback(async (splitId: string, personId: string) => {
    const split = await db.splits.get(splitId);
    if (!split) return;
    const updatedShares = split.shares.map((s) => s.personId === personId ? { ...s, isSettled: true } : s);
    const allSettled = updatedShares.every((s) => s.isSettled);
    await db.splits.update(splitId, { shares: updatedShares, isSettled: allSettled });
  }, []);

  const handleDeleteGroup = async (id: string) => { await db.groups.delete(id); };

  if (groups.length === 0 && persons.length === 0 && !showGroupForm) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center py-16 text-center">
        <div className="mb-5 animate-float">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl hero-gradient shadow-lg"><span className="text-4xl">✂️</span></div>
        </div>
        <h2 className="text-lg font-extrabold text-text-primary">Split expenses with friends</h2>
        <p className="mt-2 max-w-[260px] text-sm text-text-secondary leading-relaxed">Create groups, split bills equally or custom, and track who owes what.</p>
        <p className="mt-3 text-xs text-text-tertiary">Add people in the People tab first, then create a group here.</p>
        <button onClick={() => setShowGroupForm(true)} className="mt-4 flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-text-inverse hover:bg-accent-hover transition-colors">
          <Plus size={16} /> Create Group
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-text-primary">Splits</h1>
        <div className="flex gap-1.5">
          <button onClick={() => setShowGroupForm(!showGroupForm)} className={cn("flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors", showGroupForm ? "bg-expense-light text-expense" : "bg-accent-light text-accent")}>
            {showGroupForm ? <><X size={12} />Cancel</> : <><Users size={12} />New Group</>}
          </button>
          {groups.length > 0 && (
            <button onClick={() => setShowSplitForm(!showSplitForm)} className={cn("flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors", showSplitForm ? "bg-expense-light text-expense" : "bg-accent-light text-accent")}>
              {showSplitForm ? <><X size={12} />Cancel</> : <><Divide size={12} />Split Bill</>}
            </button>
          )}
        </div>
      </div>

      {/* Create group form */}
      <AnimatePresence>
        {showGroupForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="card-elevated p-4 space-y-3">
              <input type="text" placeholder="Group name (e.g. Goa Trip, Flatmates)" value={groupName} onChange={(e) => setGroupName(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent" />
              <div>
                <label className="text-xs font-semibold text-text-secondary mb-1.5 block">Members</label>
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-accent-light px-3 py-1.5 text-xs font-semibold text-accent">You ✓</span>
                  {persons.map((p) => (
                    <button key={p.id} onClick={() => setSelectedMembers((prev) => prev.includes(p.id) ? prev.filter((id) => id !== p.id) : [...prev, p.id])}
                      className={cn("rounded-full px-3 py-1.5 text-xs font-medium border transition-all",
                        selectedMembers.includes(p.id) ? "border-accent bg-accent-light text-accent" : "border-border-light text-text-secondary"
                      )}>
                      {p.name} {selectedMembers.includes(p.id) ? "✓" : ""}
                    </button>
                  ))}
                  {/* Contact Picker — works on Android Chrome */}
                  {isContactPickerSupported() && (
                    <button onClick={async () => {
                      try {
                        const contacts = await pickContacts(true);
                        for (const c of contacts) {
                          const existing = persons.find((p) => p.name.toLowerCase() === c.name.toLowerCase());
                          if (!existing) {
                            const newPerson: Person = { id: generateId(), name: c.name, phone: c.phone, email: c.email, netBalance: 0, createdAt: new Date().toISOString() };
                            await db.persons.add(newPerson);
                            setSelectedMembers((prev) => [...prev, newPerson.id]);
                          } else {
                            setSelectedMembers((prev) => prev.includes(existing.id) ? prev : [...prev, existing.id]);
                          }
                        }
                      } catch { /* user cancelled */ }
                    }}
                      className="rounded-full px-3 py-1.5 text-xs font-medium border border-dashed border-accent text-accent hover:bg-accent-light transition-all flex items-center gap-1">
                      <Contact size={12} /> From Contacts
                    </button>
                  )}
                </div>
                {persons.length === 0 && !isContactPickerSupported() && <p className="text-[10px] text-text-tertiary mt-1">Add people in the People tab first</p>}
              </div>
              <button onClick={handleCreateGroup} disabled={!groupName.trim() || selectedMembers.length === 0}
                className="w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-text-inverse disabled:opacity-50">Create Group</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create split form */}
      <AnimatePresence>
        {showSplitForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="card-elevated p-4 space-y-3">
              <h3 className="text-sm font-bold text-text-primary">Split a Bill</h3>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-text-tertiary font-semibold">₹</span>
                <input type="number" placeholder="Total amount" value={splitAmount} onChange={(e) => setSplitAmount(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface pl-7 pr-3.5 py-2.5 text-sm outline-none focus:border-accent tabular-nums" />
              </div>
              <input type="text" placeholder="What was this for?" value={splitDescription} onChange={(e) => setSplitDescription(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent" />
              <div>
                <label className="text-xs font-semibold text-text-secondary mb-1.5 block">Group</label>
                <div className="flex flex-wrap gap-1.5">
                  {groups.map((g) => (
                    <button key={g.id} onClick={() => setSplitGroupId(g.id)}
                      className={cn("rounded-full px-3 py-1.5 text-xs font-medium border transition-all",
                        splitGroupId === g.id ? "border-accent bg-accent-light text-accent" : "border-border-light text-text-secondary"
                      )}>
                      {g.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setSplitType("equal")} className={cn("flex-1 rounded-xl py-2 text-xs font-semibold border transition-all", splitType === "equal" ? "border-accent bg-accent-light text-accent" : "border-border-light text-text-secondary")}>Equal Split</button>
                <button onClick={() => setSplitType("custom")} className={cn("flex-1 rounded-xl py-2 text-xs font-semibold border transition-all", splitType === "custom" ? "border-accent bg-accent-light text-accent" : "border-border-light text-text-secondary")}>Custom</button>
              </div>
              {splitGroupId && splitType === "equal" && splitAmount && (
                <div className="rounded-xl bg-surface-secondary p-2.5">
                  {(() => {
                    const group = groups.find((g) => g.id === splitGroupId);
                    if (!group) return null;
                    const perPerson = (parseFloat(splitAmount) || 0) / group.memberIds.length;
                    return (
                      <div className="space-y-1">
                        {group.memberIds.map((pid) => (
                          <div key={pid} className="flex items-center justify-between text-xs">
                            <span className="text-text-secondary">{pid === "self" ? "You" : persons.find((p) => p.id === pid)?.name || pid}</span>
                            <span className="font-bold tabular-nums">{formatCurrency(perPerson)}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}
              <button onClick={handleCreateSplit} disabled={!splitAmount || !splitGroupId}
                className="w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-text-inverse disabled:opacity-50">Split It</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Groups list */}
      {groups.length > 0 && (
        <div>
          <h3 className="text-[13px] font-bold text-text-primary mb-2">Groups</h3>
          <div className="space-y-2 stagger-children">
            {groups.map((group) => {
              const groupSplits = splits.filter((s) => s.groupId === group.id);
              const totalAmount = groupSplits.reduce((s, sp) => s + sp.totalAmount, 0);
              return (
                <div key={group.id} className="card-elevated p-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-light"><Users size={16} className="text-accent" /></div>
                      <div>
                        <h4 className="text-sm font-bold text-text-primary">{group.name}</h4>
                        <p className="text-[10px] text-text-tertiary">{group.memberIds.length} members · {groupSplits.length} splits</p>
                      </div>
                    </div>
                    <button onClick={() => handleDeleteGroup(group.id)} className="text-text-tertiary hover:text-expense p-1"><Trash2 size={14} /></button>
                  </div>
                  {/* Splits in this group */}
                  {groupSplits.map((split) => (
                    <div key={split.id} className="mt-2 rounded-xl bg-surface-secondary p-2.5">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-text-primary">{formatCurrency(split.totalAmount)}</span>
                        <span className={cn("text-[10px] font-semibold rounded-full px-1.5 py-0.5", split.isSettled ? "bg-income-light text-income" : "bg-warning-light text-warning")}>
                          {split.isSettled ? "Settled" : "Pending"}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {split.shares.map((share) => {
                          const name = share.personId === "self" ? "You" : persons.find((p) => p.id === share.personId)?.name || "Unknown";
                          return (
                            <div key={share.personId} className="flex items-center justify-between text-[11px]">
                              <span className="text-text-secondary">{name}</span>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold tabular-nums">{formatCurrency(share.amount)}</span>
                                {share.isSettled ? (
                                  <span className="text-income"><Check size={12} /></span>
                                ) : (
                                  <button onClick={() => handleSettleSplit(split.id, share.personId)} className="text-[10px] font-semibold text-accent hover:underline">Settle</button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
}
