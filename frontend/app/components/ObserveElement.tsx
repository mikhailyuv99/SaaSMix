"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface ObserveElementProps {
  children: ReactNode;
  className?: string;
  rootMargin?: string;
}

export function ObserveElement({ children, className = "", rootMargin = "0px 0px -5% 0px" }: ObserveElementProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setInView(true);
      },
      { threshold: 0.15, rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return (
    <div ref={ref} className={`observe-step ${inView ? "in-view" : ""} ${className}`}>
      {children}
    </div>
  );
}
