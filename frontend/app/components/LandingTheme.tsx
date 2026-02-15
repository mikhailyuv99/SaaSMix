"use client";

import { usePathname } from "next/navigation";
import { AuthProvider, LeaveWarningProvider } from "../context";

export function LandingTheme({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === "/";
  return (
    <AuthProvider>
      <LeaveWarningProvider>
        <div className={isLanding ? "landing-text-shadow" : ""}>
          {children}
        </div>
      </LeaveWarningProvider>
    </AuthProvider>
  );
}
