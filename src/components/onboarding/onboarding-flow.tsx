"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Sparkles, Upload, Shield } from "lucide-react";
import { updatePreferences } from "@/lib/hooks/use-preferences";
import { loadDemoData } from "@/lib/demo-data";

interface OnboardingFlowProps {
  onComplete: () => void;
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleStart = async (withDemo: boolean) => {
    setLoading(true);
    if (withDemo) await loadDemoData();
    await updatePreferences({ onboardingComplete: true });
    setLoading(false);
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background px-6">
      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div
            key="welcome"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-sm w-full text-center"
          >
            <div className="mb-8 animate-float">
              <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-3xl hero-gradient shadow-xl">
                <span className="text-6xl font-extrabold text-white">₹</span>
              </div>
            </div>

            <h1 className="text-3xl font-extrabold text-text-primary tracking-tight">
              Paisa
            </h1>
            <p className="mt-2 text-base text-text-secondary leading-relaxed">
              Your money, organized automatically
            </p>

            <div className="mt-10 space-y-8">
              {[
                { icon: "📅", text: "Calendar-first financial tracking" },
                { icon: "🧠", text: "Type naturally — we understand" },
                { icon: "🔒", text: "100% local. Your data never leaves your device" },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.15 }}
                  className="flex items-center gap-3 text-left"
                >
                  <span className="text-2xl shrink-0">{item.icon}</span>
                  <span className="text-sm text-text-secondary">{item.text}</span>
                </motion.div>
              ))}
            </div>

            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              onClick={() => setStep(1)}
              className="mt-10 w-full flex items-center justify-center gap-2 rounded-2xl bg-accent py-4 text-base font-bold text-white hover:bg-accent-hover transition-colors active:scale-[0.98]"
            >
              Get Started <ArrowRight size={18} />
            </motion.button>
          </motion.div>
        )}

        {step === 1 && (
          <motion.div
            key="choose"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-sm w-full text-center"
          >
            <h2 className="text-2xl font-extrabold text-text-primary">
              How do you want to start?
            </h2>
            <p className="mt-2 text-sm text-text-secondary">
              You can always change this later
            </p>

            <div className="mt-8 space-y-3">
              <button
                onClick={() => handleStart(false)}
                disabled={loading}
                className="w-full card-elevated p-5 text-left hover:bg-surface-hover transition-colors active:scale-[0.98] disabled:opacity-50"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-light shrink-0">
                    <Sparkles size={22} className="text-accent" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-text-primary">Start fresh</h3>
                    <p className="text-xs text-text-tertiary mt-0.5">
                      Add your first transaction with the + button
                    </p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => handleStart(true)}
                disabled={loading}
                className="w-full card-elevated p-5 text-left hover:bg-surface-hover transition-colors active:scale-[0.98] disabled:opacity-50"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-investment-light shrink-0">
                    <Upload size={22} className="text-investment" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-text-primary">Explore with demo data</h3>
                    <p className="text-xs text-text-tertiary mt-0.5">
                      Load 3 months of realistic sample transactions
                    </p>
                  </div>
                </div>
              </button>
            </div>

            {loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-6 flex items-center justify-center gap-2"
              >
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                <span className="text-sm text-text-secondary">Setting up...</span>
              </motion.div>
            )}

            <div className="mt-8 flex items-center justify-center gap-2 text-xs text-text-tertiary">
              <Shield size={12} />
              <span>Everything stays on your device</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
