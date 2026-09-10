"use client";

import { useState, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Download, X, ChevronLeft, ChevronRight } from "lucide-react";
import { db, getCategoryEmoji, getCategoryName, normalizeCategoryForChart, PAYMENT_MODES, type Expense } from "@/lib/db";
import { cn, formatMoney, toDateStr } from "@/lib/utils";

export function ReportSheet({ onClose }: { onClose: () => void }) {
  const [monthOffset, setMonthOffset] = useState(0); // 0 = current, -1 = last, etc.
  const now = new Date();
  const reportDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const y = reportDate.getFullYear();
  const m = reportDate.getMonth();
  const ms = `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const me = `${y}-${String(m + 1).padStart(2, "0")}-31`;
  const monthName = reportDate.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  // Previous month for comparison
  const prevDate = new Date(y, m - 1, 1);
  const prevMs = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}-01`;
  const prevMe = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}-31`;

  const expenses = useLiveQuery(() => db.expenses.where("date").between(ms, me, true, true).toArray(), [ms]) ?? [];
  const prevExpenses = useLiveQuery(() => db.expenses.where("date").between(prevMs, prevMe, true, true).toArray(), [prevMs]) ?? [];

  const totalSpent = expenses.filter((e) => e.type === "expense").reduce((s, e) => s + e.amount, 0);
  const totalIncome = expenses.filter((e) => e.type === "income").reduce((s, e) => s + e.amount, 0);
  const prevSpent = prevExpenses.filter((e) => e.type === "expense").reduce((s, e) => s + e.amount, 0);
  const expenseCount = expenses.filter((e) => e.type === "expense").length;

  // Category breakdown
  const catBreakdown = useMemo(() => {
    const map = new Map<string, { amount: number; emoji: string; count: number }>();
    for (const e of expenses.filter((e) => e.type === "expense")) {
      const name = normalizeCategoryForChart(e.category);
      const ex = map.get(name) || { amount: 0, emoji: getCategoryEmoji(e.category), count: 0 };
      ex.amount += e.amount; ex.count++;
      map.set(name, ex);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].amount - a[1].amount);
  }, [expenses]);

  // Payment mode breakdown
  const paymentBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenses.filter((e) => e.type === "expense")) {
      const mode = e.paymentMode || "upi";
      map.set(mode, (map.get(mode) || 0) + e.amount);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  // Daily spending
  const dailyData = useMemo(() => {
    const map = new Map<number, number>();
    for (const e of expenses.filter((e) => e.type === "expense")) {
      const day = parseInt(e.date.split("-")[2]);
      map.set(day, (map.get(day) || 0) + e.amount);
    }
    return map;
  }, [expenses]);

  // Top 5 biggest
  const topExpenses = useMemo(() =>
    [...expenses.filter((e) => e.type === "expense")].sort((a, b) => b.amount - a.amount).slice(0, 5)
  , [expenses]);

  // Friend splits
  const splits = useLiveQuery(() => db.splits.toArray()) ?? [];
  const activeSplits = splits.filter((s) => !s.settled);

  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const avgDaily = expenseCount > 0 ? Math.round(totalSpent / Math.min(now.getDate(), daysInMonth)) : 0;
  const vsLast = prevSpent > 0 ? Math.round(((totalSpent - prevSpent) / prevSpent) * 100) : 0;

  // Download as HTML (printable)
  const handleDownload = () => {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Paisa Report — ${monthName}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,-apple-system,sans-serif;max-width:600px;margin:40px auto;padding:20px;color:#1a1a2e}
h1{font-size:20px;margin-bottom:2px}h2{font-size:14px;margin:20px 0 8px;border-bottom:1px solid #eee;padding-bottom:4px;color:#666}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0}
.card{padding:12px;border-radius:10px;border:1px solid #eee}
.card h3{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#999;margin-bottom:2px}
.card .v{font-size:20px;font-weight:800}
.g{color:#059669}.r{color:#dc2626}.b{color:#6366f1}
table{width:100%;border-collapse:collapse;font-size:12px}
th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #f0f0f0}
th{font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:#999}
.bar{height:6px;border-radius:3px;background:#e5e7eb;margin-top:4px}
.bar-fill{height:100%;border-radius:3px;background:#6366f1}
@media print{body{margin:10px}}</style></head><body>
<div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
<div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;color:white;font-weight:800;font-size:16px">₹</div>
<div><h1>Monthly Report</h1><p style="color:#999;font-size:12px">${monthName}</p></div></div>
<div class="grid">
<div class="card"><h3>Total Spent</h3><div class="v r">₹${totalSpent.toLocaleString("en-IN")}</div></div>
<div class="card"><h3>Income</h3><div class="v g">₹${totalIncome.toLocaleString("en-IN")}</div></div>
<div class="card"><h3>Balance</h3><div class="v b">₹${(totalIncome - totalSpent).toLocaleString("en-IN")}</div></div>
<div class="card"><h3>Avg/Day</h3><div class="v">₹${avgDaily.toLocaleString("en-IN")}</div></div>
</div>
<h2>Category Breakdown</h2>
<table><thead><tr><th>Category</th><th style="text-align:right">Amount</th><th style="text-align:right">%</th></tr></thead><tbody>
${catBreakdown.map(([name, { amount, emoji }]) => {
  const pct = totalSpent > 0 ? Math.round((amount / totalSpent) * 100) : 0;
  return `<tr><td>${emoji} ${name}</td><td style="text-align:right;font-weight:700">₹${amount.toLocaleString("en-IN")}</td><td style="text-align:right">${pct}%</td></tr>`;
}).join("")}
</tbody></table>
<h2>Top 5 Expenses</h2>
<table><thead><tr><th>Date</th><th>Description</th><th style="text-align:right">Amount</th></tr></thead><tbody>
${topExpenses.map((e) => `<tr><td>${e.date}</td><td>${e.description}</td><td style="text-align:right;font-weight:700">₹${e.amount.toLocaleString("en-IN")}</td></tr>`).join("")}
</tbody></table>
<h2>Payment Modes</h2>
<table><thead><tr><th>Mode</th><th style="text-align:right">Amount</th></tr></thead><tbody>
${paymentBreakdown.map(([mode, amount]) => {
  const info = PAYMENT_MODES.find((p) => p.value === mode);
  return `<tr><td>${info?.emoji || ""} ${info?.label || mode}</td><td style="text-align:right;font-weight:700">₹${amount.toLocaleString("en-IN")}</td></tr>`;
}).join("")}
</tbody></table>
${prevSpent > 0 ? `<h2>vs Previous Month</h2><p style="font-size:13px">Previous: ₹${prevSpent.toLocaleString("en-IN")} → This: ₹${totalSpent.toLocaleString("en-IN")} (${vsLast > 0 ? "+" : ""}${vsLast}%)</p>` : ""}
<p style="color:#ccc;font-size:10px;text-align:center;margin-top:24px">Generated by Paisa · ${new Date().toLocaleDateString("en-IN")}</p>
</body></html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (win) setTimeout(() => win.print(), 500);
    URL.revokeObjectURL(url);
  };

  // Download CSV
  const handleCSV = () => {
    const rows = expenses.map((e) =>
      `${e.date},${e.time},"${e.description}","${getCategoryName(e.category)}",${e.amount},${e.type},${e.paymentMode || "upi"},"${e.location || ""}"`
    );
    const csv = "Date,Time,Description,Category,Amount,Type,Payment,Location\n" + rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `paisa-${monthName.replace(/\s/g, "-")}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-surface shadow-xl anim-up max-h-[90vh] overflow-y-auto">
        <div className="flex justify-center py-2"><div className="h-1 w-10 rounded-full bg-border" /></div>
        <div className="px-5 pb-8 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-text">Monthly Report</h2>
            <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-surface2"><X size={18} className="text-text2" /></button>
          </div>

          {/* Month selector */}
          <div className="flex items-center justify-between">
            <button onClick={() => setMonthOffset((o) => o - 1)} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-surface2">
              <ChevronLeft size={16} className="text-text2" />
            </button>
            <span className="text-sm font-bold text-text">{monthName}</span>
            <button onClick={() => setMonthOffset((o) => Math.min(0, o + 1))} disabled={monthOffset >= 0}
              className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-surface2 disabled:opacity-30">
              <ChevronRight size={16} className="text-text2" />
            </button>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-border bg-surface p-3">
              <p className="text-[9px] font-bold text-text3 uppercase">Spent</p>
              <p className="text-lg font-extrabold text-red tabular-nums">{formatMoney(totalSpent)}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-3">
              <p className="text-[9px] font-bold text-text3 uppercase">Income</p>
              <p className="text-lg font-extrabold text-green tabular-nums">{formatMoney(totalIncome)}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-3">
              <p className="text-[9px] font-bold text-text3 uppercase">Balance</p>
              <p className={cn("text-lg font-extrabold tabular-nums", totalIncome - totalSpent >= 0 ? "text-green" : "text-red")}>
                {formatMoney(totalIncome - totalSpent)}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-3">
              <p className="text-[9px] font-bold text-text3 uppercase">Avg/Day</p>
              <p className="text-lg font-extrabold text-text tabular-nums">{formatMoney(avgDaily)}</p>
            </div>
          </div>

          {/* vs Last month */}
          {prevSpent > 0 && (
            <div className={cn("rounded-xl p-3 text-center", vsLast <= 0 ? "bg-green-bg" : "bg-red-bg")}>
              <p className={cn("text-sm font-bold", vsLast <= 0 ? "text-green" : "text-red")}>
                {vsLast <= 0 ? `${Math.abs(vsLast)}% less` : `${vsLast}% more`} than last month
              </p>
              <p className="text-[10px] text-text3 mt-0.5">
                Previous: {formatMoney(prevSpent)}
              </p>
            </div>
          )}

          {/* Category breakdown */}
          {catBreakdown.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-text3 uppercase tracking-wider mb-2">By Category</h3>
              <div className="space-y-2">
                {catBreakdown.map(([name, { amount, emoji, count }]) => {
                  const pct = totalSpent > 0 ? Math.round((amount / totalSpent) * 100) : 0;
                  return (
                    <div key={name} className="flex items-center gap-3">
                      <span className="text-base w-6 text-center">{emoji}</span>
                      <div className="flex-1">
                        <div className="flex justify-between text-[11px] mb-0.5">
                          <span className="font-semibold text-text">{name} <span className="text-text3">({count})</span></span>
                          <span className="font-bold text-text tabular-nums">{formatMoney(amount)} · {pct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-surface2 overflow-hidden">
                          <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Payment modes */}
          {paymentBreakdown.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-text3 uppercase tracking-wider mb-2">Payment Modes</h3>
              <div className="flex gap-2">
                {paymentBreakdown.map(([mode, amount]) => {
                  const info = PAYMENT_MODES.find((p) => p.value === mode);
                  const pct = totalSpent > 0 ? Math.round((amount / totalSpent) * 100) : 0;
                  return (
                    <div key={mode} className="flex-1 rounded-xl border border-border bg-surface p-2.5 text-center">
                      <span className="text-lg">{info?.emoji || "📱"}</span>
                      <p className="text-xs font-bold text-text tabular-nums mt-0.5">{formatMoney(amount)}</p>
                      <p className="text-[9px] text-text3">{info?.label || mode} · {pct}%</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Top expenses */}
          {topExpenses.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-text3 uppercase tracking-wider mb-2">Biggest Expenses</h3>
              <div className="space-y-1">
                {topExpenses.map((e, i) => (
                  <div key={e.id} className="flex items-center gap-2 rounded-lg bg-surface2 p-2">
                    <span className="text-[10px] font-bold text-text3 w-4">{i + 1}</span>
                    <span className="text-sm">{getCategoryEmoji(e.category)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-text truncate">{e.description}</p>
                      <p className="text-[9px] text-text3">{e.date}</p>
                    </div>
                    <span className="text-[12px] font-bold text-red tabular-nums">{formatMoney(e.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Download buttons */}
          <div className="flex gap-2">
            <button onClick={handleDownload}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-accent py-3 text-sm font-bold text-white">
              <Download size={14} /> Print / PDF
            </button>
            <button onClick={handleCSV}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-border py-3 text-sm font-bold text-text2">
              <Download size={14} /> CSV
            </button>
          </div>

          <p className="text-[9px] text-text3 text-center">{expenseCount} expenses · {expenses.filter((e) => e.type === "income").length} income entries</p>
        </div>
      </div>
    </div>
  );
}
