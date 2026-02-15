"use client";

import { useEffect, useRef } from "react";
import {
  HeroSection,
  TrustBullets,
  HowItWorks,
  VideoSection,
  BeforeAfterSection,
  FeaturesSection,
  PricingSection,
  FAQContactSection,
} from "./components/landing";

const INPUT_TYPES_FOR_TYPING = ["text", "search", "email", "url", "password", "number"];

export default function HomePage() {
  const demoPlaybackRef = useRef<{ playPause: () => void; getIsPlaying: () => boolean } | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      const target = document.activeElement as HTMLElement | null;
      const isTypingField =
        target &&
        (target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable === true ||
          (target.tagName === "INPUT" &&
            INPUT_TYPES_FOR_TYPING.includes((target as HTMLInputElement).type)));
      if (isTypingField) return;
      if (demoPlaybackRef.current) {
        e.preventDefault();
        e.stopPropagation();
        (document.activeElement as HTMLElement)?.blur();
        demoPlaybackRef.current.playPause();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  return (
    <main className="min-h-screen font-heading">
      <HeroSection />
      <TrustBullets />
      <HowItWorks />
      <VideoSection />
      <BeforeAfterSection
        registerDemoPlayback={(playPause, getIsPlaying) => {
          demoPlaybackRef.current = { playPause, getIsPlaying };
        }}
      />
      <FeaturesSection />
      <PricingSection />
      <FAQContactSection />
    </main>
  );
}
