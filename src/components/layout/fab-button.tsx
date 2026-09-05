"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { QuickAddSheet } from "@/components/transactions/quick-add-sheet";

export function FABButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <motion.button
        onClick={() => setIsOpen(true)}
        whileTap={{ scale: 0.9 }}
        whileHover={{ scale: 1.05 }}
        className={cn(
          "fixed z-50 flex h-14 w-14 items-center justify-center rounded-full",
          "bg-fab-bg text-fab-text transition-all animate-pulse-glow",
          "md:bottom-8 md:right-8",
          "bottom-[76px] right-5"
        )}
        style={{ boxShadow: `0 6px 24px var(--fab-shadow)` }}
        aria-label="Add transaction"
      >
        <Plus size={26} strokeWidth={2.5} />
      </motion.button>
      <QuickAddSheet isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
