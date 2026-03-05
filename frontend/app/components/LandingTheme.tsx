"use client";

import { usePathname } from "next/navigation";
import { AuthProvider, LeaveWarningProvider, SubscriptionProvider } from "../context";
import { AuthModal } from "./AuthModal";
import { BillingSync } from "./BillingSync";

export function LandingTheme({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === "/";
  return (
    <AuthProvider>
      <LeaveWarningProvider>
        <SubscriptionProvider>
          <AuthModal />
          <BillingSync />
          <div className={isLanding ? "landing-text-shadow" : ""}>
            {children}
          </div>
        </SubscriptionProvider>
      </LeaveWarningProvider>
    </AuthProvider>
  );
}
