"use client";

import { usePathname } from "next/navigation";

export function LandingTheme({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === "/";
  return (
    <div className={isLanding ? "landing-text-shadow" : ""}>
      {children}
    </div>
  );
}
