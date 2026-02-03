"use client";

import { useMemo } from "react";

const STAR_COLORS = [
  "rgba(255, 255, 255, 0.85)",
  "rgba(255, 248, 252, 0.8)",
  "rgba(248, 252, 255, 0.8)",
] as const;

function generateDots() {
  const dots: { top: number; left: number; color: string; size: number; duration: number; delay: number }[] = [];
  for (let i = 0; i < 75; i++) {
    dots.push({
      top: Math.random() * 100,
      left: Math.random() * 100,
      color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
      size: 1.5 + Math.random() * 1.5,
      duration: 3.5 + Math.random() * 4,
      delay: Math.random() * 8,
    });
  }
  return dots;
}

export function StarryCeiling() {
  const dots = useMemo(() => generateDots(), []);

  return (
    <div
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
      aria-hidden
    >
      {dots.map((d, i) => (
        <span
          key={i}
          className="starry-dot"
          style={{
            top: `${d.top}%`,
            left: `${d.left}%`,
            width: `${d.size}px`,
            height: `${d.size}px`,
            backgroundColor: d.color,
            boxShadow: `0 0 ${d.size * 4}px ${d.size * 2}px ${d.color.replace(/[\d.]+\)$/, "0.15)")}`,
            ["--star-duration" as string]: `${d.duration}s`,
            ["--star-delay" as string]: `-${d.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
