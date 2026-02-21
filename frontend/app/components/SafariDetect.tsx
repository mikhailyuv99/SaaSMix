"use client";

import { useEffect } from "react";

/** Adds safari-webkit class to html when Safari/WebKit detected.
 * Safari 18 has a bug: rgba + backdrop-filter = opaque white.
 * We use this class to disable backdrop-filter in globals.css. */
export function SafariDetect() {
  useEffect(() => {
    const isSafari =
      typeof navigator !== "undefined" &&
      (navigator.vendor?.includes("Apple") ||
        (navigator.userAgent.includes("Safari") &&
          !navigator.userAgent.includes("Chrome") &&
          !navigator.userAgent.includes("CriOS")));
    if (isSafari) {
      document.documentElement.classList.add("safari-webkit");
    }
  }, []);
  return null;
}
