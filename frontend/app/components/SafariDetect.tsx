"use client";

import { useEffect } from "react";

/** Adds safari-webkit (all Safari), safari-webkit-old (Safari / iOS < 18 only), safari-ios-old (iOS 17 and under only) to html.
 * Safari 18 / iOS 18+: unchanged — two-layer trick in CSS.
 * Safari 15–17 / iOS 17 and under: modals too transparent → safari-webkit-old + safari-ios-old get stronger opacity. */
export function SafariDetect() {
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const u = navigator.userAgent;
    const isSafari =
      navigator.vendor?.includes("Apple") ||
      (u.includes("Safari") && !u.includes("Chrome") && !u.includes("CriOS"));
    if (isSafari) {
      document.documentElement.classList.add("safari-webkit");
      const m = u.match(/Version\/(\d+)/);
      const ver = m ? parseInt(m[1], 10) : 0;
      const isIOS = /iPhone|iPad|iPod/.test(u);
      const isOldSafari = (ver > 0 && ver < 18) || (isIOS && (ver < 18 || ver === 0));
      if (isOldSafari) {
        document.documentElement.classList.add("safari-webkit-old");
        if (isIOS) document.documentElement.classList.add("safari-ios-old");
      }
    }
  }, []);
  return null;
}
