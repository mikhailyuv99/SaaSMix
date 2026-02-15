"use client";

import { usePathname } from "next/navigation";
import { AuthProvider, LeaveWarningProvider, SubscriptionProvider } from "../context";

export function LandingTheme({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === "/";
  return (
    <AuthProvider>
      <LeaveWarningProvider>
        <SubscriptionProvider>
          <div className={isLanding ? "landing-text-shadow" : ""}>
            {children}
          </div>
        </SubscriptionProvider>
      </LeaveWarningProvider>
    </AuthProvider>
  );
}
