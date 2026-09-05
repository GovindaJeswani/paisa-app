"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Download, FileJson, FileSpreadsheet, FileText, Calendar } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { db } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { calculateMonthSummary } from "@/lib/engine/calculator";

export default function ExportPage() {
  const [dateRange, setDateRange] = useState({ start: format(startOfMonth(new Date()), "yyyy-MM-dd"), end: format(endOfMonth(new Date()), "yyyy-MM-dd") });
  const [exporting, setExporting] = useState<string | null>(null);

  const handleExportJSON = useCallback(async () => {
    setExporting("json");
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
        investments: await db.investments.toArray(),
        merchantMappings: await db.merchantMappings.toArray(),
        exportedAt: new Date().toISOString(),
        version: "1.0.0",
      };
      downloadFile(`paisa-backup-${format(new Date(), "yyyy-MM-dd")}.json`, JSON.stringify(data, null, 2), "application/json");
    } finally { setExporting(null); }
  }, []);

  const handleExportCSV = useCallback(async () => {
    setExporting("csv");
    try {
      const txns = await db.transactions.where("date").between(dateRange.start, dateRange.end, true, true).toArray();
      const categories = await db.categories.toArray();
      const catMap = new Map(categories.map((c) => [c.id, c.name]));

      const headers = ["Date", "Time", "Type", "Amount", "Category", "Merchant", "Note", "Account", "Person"];
      const rows = txns.map((t) => [
        t.date, t.time || "", t.type, String(t.amount),
        catMap.get(t.categoryId) || t.categoryId, t.merchant || "", t.note || "",
        t.accountId || "", t.personId || "",
      ]);

      const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))].join("\n");
      downloadFile(`paisa-transactions-${dateRange.start}-to-${dateRange.end}.csv`, csv, "text/csv");
    } finally { setExporting(null); }
  }, [dateRange]);

  const handleExportStatement = useCallback(async () => {
    setExporting("pdf");
    try {
      const txns = await db.transactions.where("date").between(dateRange.start, dateRange.end, true, true).toArray();
      const categories = await db.categories.toArray();
      const catMap = new Map(categories.map((c) => [c.id, c]));
      const summary = calculateMonthSummary(txns);
      const accounts = await db.accounts.toArray();
      const goals = await db.goals.filter((g) => g.isActive).toArray();

      // Generate printable HTML statement
      const html = generateStatementHTML(txns, summary, catMap, accounts, goals, dateRange);
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, "_blank");
      if (win) {
        win.onload = () => { setTimeout(() => win.print(), 500); };
      }
      URL.revokeObjectURL(url);
    } finally { setExporting(null); }
  }, [dateRange]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-4">
      <h1 className="text-xl font-bold text-text-primary">Export & Reports</h1>

      {/* Date range */}
      <div className="card-elevated p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calendar size={14} className="text-accent" />
          <h3 className="text-sm font-bold text-text-primary">Date Range</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-semibold text-text-tertiary uppercase mb-1 block">From</label>
            <input type="date" value={dateRange.start} onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent text-text-primary" />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-text-tertiary uppercase mb-1 block">To</label>
            <input type="date" value={dateRange.end} onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent text-text-primary" />
          </div>
        </div>
        <div className="flex gap-1.5 mt-3">
          {[
            { label: "This month", start: format(startOfMonth(new Date()), "yyyy-MM-dd"), end: format(endOfMonth(new Date()), "yyyy-MM-dd") },
            { label: "Last month", start: format(startOfMonth(subMonths(new Date(), 1)), "yyyy-MM-dd"), end: format(endOfMonth(subMonths(new Date(), 1)), "yyyy-MM-dd") },
            { label: "Last 3 months", start: format(startOfMonth(subMonths(new Date(), 2)), "yyyy-MM-dd"), end: format(endOfMonth(new Date()), "yyyy-MM-dd") },
          ].map((preset) => (
            <button key={preset.label} onClick={() => setDateRange({ start: preset.start, end: preset.end })}
              className="rounded-full border border-border-light px-2.5 py-1 text-[10px] font-semibold text-text-secondary hover:bg-surface-secondary transition-colors">
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Export options */}
      <div className="space-y-2.5">
        <ExportOption
          icon={<FileSpreadsheet size={20} className="text-income" />}
          title="CSV Export"
          description="Download transactions as a spreadsheet"
          onClick={handleExportCSV}
          loading={exporting === "csv"}
        />
        <ExportOption
          icon={<FileText size={20} className="text-accent" />}
          title="Financial Statement"
          description="Generate a printable monthly report with charts"
          onClick={handleExportStatement}
          loading={exporting === "pdf"}
        />
        <ExportOption
          icon={<FileJson size={20} className="text-investment" />}
          title="Full JSON Backup"
          description="Export everything — transactions, accounts, goals, budgets"
          onClick={handleExportJSON}
          loading={exporting === "json"}
        />
      </div>
    </motion.div>
  );
}

function ExportOption({ icon, title, description, onClick, loading }: {
  icon: React.ReactNode; title: string; description: string; onClick: () => void; loading: boolean;
}) {
  return (
    <button onClick={onClick} disabled={loading}
      className="w-full card-elevated p-4 flex items-center gap-4 text-left hover:bg-surface-hover transition-colors disabled:opacity-50">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-secondary shrink-0">{icon}</div>
      <div className="flex-1">
        <h3 className="text-sm font-bold text-text-primary">{title}</h3>
        <p className="text-[11px] text-text-tertiary mt-0.5">{description}</p>
      </div>
      <Download size={16} className="text-text-tertiary shrink-0" />
    </button>
  );
}

function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

function generateStatementHTML(
  txns: { date: string; type: string; amount: number; merchant?: string; note?: string; categoryId: string }[],
  summary: { totalIncome: number; totalExpense: number; totalSaving: number; totalInvestment: number; topCategories: { categoryId: string; amount: number }[] },
  catMap: Map<string, { name: string; icon: string; color: string }>,
  accounts: { name: string; balance: number }[],
  goals: { name: string; currentAmount: number; targetAmount: number }[],
  dateRange: { start: string; end: string }
): string {
  const topCats = summary.topCategories.slice(0, 8).map((c) => {
    const cat = catMap.get(c.categoryId);
    return `<tr><td style="padding:6px 12px">${cat?.icon || ""} ${cat?.name || c.categoryId}</td><td style="padding:6px 12px;text-align:right;font-weight:700">₹${c.amount.toLocaleString("en-IN")}</td></tr>`;
  }).join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Paisa Statement</title>
<style>body{font-family:system-ui,-apple-system,sans-serif;max-width:700px;margin:40px auto;color:#1a1a2e;padding:20px}
h1{font-size:22px;margin-bottom:4px}h2{font-size:16px;margin:24px 0 8px;border-bottom:1px solid #eee;padding-bottom:6px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0}
.card{padding:16px;border-radius:12px;border:1px solid #eee}
.card h3{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:4px}
.card .value{font-size:24px;font-weight:800}
.green{color:#10b981}.red{color:#ef4444}.blue{color:#6366f1}
table{width:100%;border-collapse:collapse;margin:8px 0}
th,td{text-align:left;padding:8px 12px;border-bottom:1px solid #f1f1f1;font-size:13px}
th{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#888}
@media print{body{margin:20px}}</style></head><body>
<div style="display:flex;align-items:center;gap:10px;margin-bottom:20px">
<div style="width:36px;height:36px;border-radius:8px;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;color:white;font-weight:800;font-size:18px">₹</div>
<div><h1 style="margin:0">Paisa Financial Statement</h1>
<p style="color:#888;font-size:13px;margin:0">${dateRange.start} to ${dateRange.end}</p></div></div>
<div class="grid">
<div class="card"><h3>Income</h3><div class="value green">₹${summary.totalIncome.toLocaleString("en-IN")}</div></div>
<div class="card"><h3>Expenses</h3><div class="value red">₹${summary.totalExpense.toLocaleString("en-IN")}</div></div>
<div class="card"><h3>Saved</h3><div class="value blue">₹${summary.totalSaving.toLocaleString("en-IN")}</div></div>
<div class="card"><h3>Invested</h3><div class="value" style="color:#f59e0b">₹${summary.totalInvestment.toLocaleString("en-IN")}</div></div>
</div>
<h2>Top Categories</h2><table><thead><tr><th>Category</th><th style="text-align:right">Amount</th></tr></thead><tbody>${topCats}</tbody></table>
<h2>All Transactions (${txns.length})</h2><table><thead><tr><th>Date</th><th>Type</th><th>Description</th><th style="text-align:right">Amount</th></tr></thead><tbody>
${txns.sort((a, b) => a.date.localeCompare(b.date)).map((t) => {
  const cat = catMap.get(t.categoryId);
  return `<tr><td>${t.date}</td><td>${t.type}</td><td>${t.merchant || t.note || cat?.name || ""}</td><td style="text-align:right;font-weight:600;color:${t.type === "income" ? "#10b981" : "#ef4444"}">₹${t.amount.toLocaleString("en-IN")}</td></tr>`;
}).join("")}
</tbody></table>
<p style="color:#aaa;font-size:11px;margin-top:32px;text-align:center">Generated by Paisa · ${new Date().toLocaleDateString("en-IN")}</p>
</body></html>`;
}
