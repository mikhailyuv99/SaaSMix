"use client";

import { createContext, useCallback, useContext, useState } from "react";

type SubscriptionContextValue = {
  isPro: boolean;
  setIsPro: (v: boolean) => void;
  openManageSubscription: (() => void) | null;
  setOpenManageSubscription: (fn: (() => void) | null) => void;
};

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [isPro, setIsPro] = useState(false);
  const [openManageSubscription, setOpenManageSubscriptionState] = useState<(() => void) | null>(null);

  const setOpenManageSubscription = useCallback((fn: (() => void) | null) => {
    setOpenManageSubscriptionState(() => fn);
  }, []);

  return (
    <SubscriptionContext.Provider value={{ isPro, setIsPro, openManageSubscription, setOpenManageSubscription }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error("useSubscription must be used within SubscriptionProvider");
  return ctx;
}
