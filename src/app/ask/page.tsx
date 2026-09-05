"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, User, Sparkles } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { executeQuery, type QueryResult } from "@/lib/engine/query-engine";
import { TransactionCard } from "@/components/transactions/transaction-card";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  result?: QueryResult;
}

const SUGGESTIONS = [
  "How much did I spend on food this month?",
  "Who owes me money?",
  "What's my biggest expense?",
  "Am I within my food budget?",
  "How much did I save?",
  "Can I afford ₹15,000?",
  "Compare this month with last month",
  "What are my subscriptions?",
  "How much do I spend on weekends?",
  "What's safe to spend today?",
  "Show my goal progress",
  "What did I spend this week?",
];

export default function AskPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSend = useCallback(async (text?: string) => {
    const query = (text || input).trim();
    if (!query) return;

    const userMsg: Message = { id: `u_${Date.now()}`, role: "user", text: query };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const result = await executeQuery(query);
      const assistantMsg: Message = { id: `a_${Date.now()}`, role: "assistant", text: result.answer, result };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [...prev, { id: `e_${Date.now()}`, role: "assistant", text: "Sorry, I couldn't understand that. Try asking differently." }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center gap-2 px-1 pb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg hero-gradient">
          <Bot size={16} className="text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-text-primary">Ask Paisa</h1>
          <p className="text-[10px] text-text-tertiary">Ask anything about your money</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-4">
        {messages.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="py-8">
            <div className="text-center mb-6">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl hero-gradient mb-3">
                <Sparkles size={28} className="text-white" />
              </div>
              <p className="text-sm text-text-secondary">Ask me about your finances</p>
            </div>
            <div className="flex flex-wrap justify-center gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => handleSend(s)}
                  className="rounded-full border border-border-light px-3 py-1.5 text-[11px] text-text-secondary hover:bg-surface-secondary hover:border-accent/30 transition-all">
                  {s}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn("flex gap-2.5", msg.role === "user" ? "justify-end" : "")}
            >
              {msg.role === "assistant" && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg hero-gradient mt-0.5">
                  <Bot size={13} className="text-white" />
                </div>
              )}

              <div className={cn(
                "max-w-[85%] rounded-2xl px-3.5 py-2.5",
                msg.role === "user" ? "bg-accent text-white rounded-br-md" : "bg-surface border border-border-light rounded-bl-md"
              )}>
                <p className={cn("text-[13px] leading-relaxed", msg.role === "user" ? "text-white" : "text-text-primary")}>
                  {msg.text}
                </p>

                {/* Data cards */}
                {msg.result?.data && msg.result.data.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {msg.result.data.map((d, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg bg-surface-secondary p-2">
                        <span className="text-[11px] text-text-secondary">{d.label}</span>
                        <span className="text-[11px] font-bold text-text-primary tabular-nums">{d.value}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Transaction previews */}
                {msg.result?.transactions && msg.result.transactions.length > 0 && (
                  <div className="mt-2 border-t border-border-light pt-2">
                    <p className="text-[10px] text-text-tertiary mb-1">Top transactions:</p>
                    {msg.result.transactions.slice(0, 3).map((t) => (
                      <TransactionCard key={t.id} transaction={t} compact />
                    ))}
                  </div>
                )}

                {/* Follow-up suggestions */}
                {msg.result?.followUp && msg.result.followUp.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {msg.result.followUp.map((f) => (
                      <button key={f} onClick={() => handleSend(f)}
                        className="rounded-full border border-border-light bg-surface px-2 py-0.5 text-[10px] text-text-secondary hover:bg-surface-secondary transition-colors">
                        {f}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {msg.role === "user" && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-light mt-0.5">
                  <User size={13} className="text-accent" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {loading && (
          <div className="flex gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg hero-gradient">
              <Bot size={13} className="text-white" />
            </div>
            <div className="rounded-2xl bg-surface border border-border-light rounded-bl-md px-4 py-3">
              <div className="flex gap-1">
                <div className="h-1.5 w-1.5 rounded-full bg-text-tertiary animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="h-1.5 w-1.5 rounded-full bg-text-tertiary animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="h-1.5 w-1.5 rounded-full bg-text-tertiary animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border-light pt-3 pb-1">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
            placeholder="Ask about your money..."
            className="flex-1 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all"
          />
          <button onClick={() => handleSend()} disabled={!input.trim() || loading}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-white disabled:opacity-40 hover:bg-accent-hover transition-colors shrink-0">
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
