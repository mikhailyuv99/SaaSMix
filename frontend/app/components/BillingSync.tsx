"use client";

import { useEffect, useCallback } from "react";
import { useAuth } from "../context";
import { useSubscription } from "../context/SubscriptionContext";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("saas_mix_token");
  const h: Record<string, string> = {};
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

/** Fetches billing/me when user is logged in so Header shows "Gérer mon abonnement" vs "Choisir un plan" on landing too. */
export function BillingSync() {
  const { user } = useAuth();
  const { setIsPro } = useSubscription();

  const fetchBilling = useCallback(async () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("saas_mix_token") : null;
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/billing/me`, { headers: getAuthHeaders() });
      if (res.status === 401) return;
      const data = await res.json().catch(() => ({}));
      setIsPro(Boolean(data.isPro));
    } catch (_) {}
  }, [setIsPro]);

  useEffect(() => {
    if (user?.id) fetchBilling();
  }, [user?.id, fetchBilling]);

  return null;
}
