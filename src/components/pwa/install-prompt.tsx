"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X, Share2 } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    setIsStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as Record<string, boolean>).standalone === true
    );
    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent));

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show banner after a delay so it doesn't feel aggressive
      const dismissed = localStorage.getItem("paisa-install-dismissed");
      if (!dismissed) {
        setTimeout(() => setShowBanner(true), 5000);
      }
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") setShowBanner(false);
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem("paisa-install-dismissed", "true");
  };

  // Don't show if already installed
  if (isStandalone) return null;

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed bottom-20 md:bottom-6 left-4 right-4 z-50 mx-auto max-w-sm"
        >
          <div className="glass-card rounded-2xl p-4 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl hero-gradient shrink-0">
                <span className="text-lg font-bold text-white">₹</span>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-text-primary">Install Paisa</h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  {isIOS
                    ? "Tap Share then 'Add to Home Screen'"
                    : "Add to your home screen for the best experience"
                  }
                </p>
              </div>
              <button onClick={handleDismiss} className="text-text-tertiary hover:text-text-secondary p-1">
                <X size={16} />
              </button>
            </div>
            {!isIOS && deferredPrompt && (
              <button
                onClick={handleInstall}
                className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-sm font-semibold text-white hover:bg-accent-hover transition-colors"
              >
                <Download size={16} /> Install App
              </button>
            )}
            {isIOS && (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-surface-secondary p-2.5">
                <Share2 size={14} className="text-accent shrink-0" />
                <p className="text-[11px] text-text-secondary">
                  Tap <span className="font-semibold">Share</span> → <span className="font-semibold">Add to Home Screen</span>
                </p>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
