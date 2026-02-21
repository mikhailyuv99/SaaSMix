"use client";

import { useEffect } from "react";

/** Adds safari-webkit (all Safari), safari-webkit-old (Safari < 18 or any iOS), safari-ios-old (iOS only) to html.
 * Safari 18: rgba + backdrop-filter = opaque white → two-layer trick in CSS.
 * Safari 15–17 / iOS: modals too transparent → safari-webkit-old + safari-ios-old (iOS) get stronger opacity in CSS. */
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
      if ((ver > 0 && ver < 18) || isIOS) {
        document.documentElement.classList.add("safari-webkit-old");
        if (isIOS) document.documentElement.classList.add("safari-ios-old");
      }
    }
  }, []);
  return null;
}
