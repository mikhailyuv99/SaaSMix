"use client";

import { useState, useEffect } from "react";

export function WhiteScreenUntilReady({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);
  return (
    <div
      className={`min-h-screen flex flex-col transition-opacity duration-200 ${ready ? "opacity-100" : "opacity-0"}`}
      aria-hidden={!ready}
    >
      {children}
    </div>
  );
}
