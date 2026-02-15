"use client";

import { createContext, useCallback, useContext, useState } from "react";

export type LeaveIntent = "navigate" | "disconnect" | "load_project" | null;

type LeaveWarningContextValue = {
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (v: boolean) => void;
  showLeaveModal: boolean;
  setShowLeaveModal: (v: boolean) => void;
  leaveIntent: LeaveIntent;
  setLeaveIntent: (v: LeaveIntent) => void;
  leaveConfirmAction: (() => void) | null;
  setLeaveConfirmAction: (fn: (() => void) | null) => void;
};

const LeaveWarningContext = createContext<LeaveWarningContextValue | null>(null);

export function LeaveWarningProvider({ children }: { children: React.ReactNode }) {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveIntent, setLeaveIntent] = useState<LeaveIntent>(null);
  const [leaveConfirmAction, setLeaveConfirmActionState] = useState<(() => void) | null>(null);

  const setLeaveConfirmAction = useCallback((fn: (() => void) | null) => {
    setLeaveConfirmActionState(() => fn);
  }, []);

  return (
    <LeaveWarningContext.Provider
      value={{
        hasUnsavedChanges,
        setHasUnsavedChanges,
        showLeaveModal,
        setShowLeaveModal,
        leaveIntent,
        setLeaveIntent,
        leaveConfirmAction,
        setLeaveConfirmAction,
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
