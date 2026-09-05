"use client";

import { useState, useEffect } from "react";
import { usePreferences } from "@/lib/hooks/use-preferences";
import { HomeDashboard } from "@/components/home/home-dashboard";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { NotificationCenter } from "@/components/notifications/notification-center";

export default function HomePage() {
  const prefs = usePreferences();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (prefs !== undefined) {
      setShowOnboarding(!prefs.onboardingComplete);
      setReady(true);
    }
  }, [prefs]);

  if (!ready) return null;

  if (showOnboarding) {
    return <OnboardingFlow onComplete={() => setShowOnboarding(false)} />;
  }

  return (
    <div>
      {/* Notification bell in header area */}
      <div className="flex items-center justify-end mb-1 -mt-1">
        <NotificationCenter />
      </div>
      <HomeDashboard />
    </div>
  );
}
