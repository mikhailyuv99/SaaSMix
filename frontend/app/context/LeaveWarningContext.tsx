"use client";

import { createContext, useCallback, useContext, useState } from "react";

type LeaveWarningContextValue = {
  hasUnsavedTracks: boolean;
  setHasUnsavedTracks: (v: boolean) => void;
  showLeaveModal: boolean;
  setShowLeaveModal: (v: boolean) => void;
};

const LeaveWarningContext = createContext<LeaveWarningContextValue | null>(null);

export function LeaveWarningProvider({ children }: { children: React.ReactNode }) {
  const [hasUnsavedTracks, setHasUnsavedTracks] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  return (
    <LeaveWarningContext.Provider
      value={{
        hasUnsavedTracks,
        setHasUnsavedTracks,
        showLeaveModal,
        setShowLeaveModal,
      }}
    >
      {children}
    </LeaveWarningContext.Provider>
  );
}

export function useLeaveWarning() {
  const ctx = useContext(LeaveWarningContext);
  if (!ctx) throw new Error("useLeaveWarning must be used within LeaveWarningProvider");
  return ctx;
}
