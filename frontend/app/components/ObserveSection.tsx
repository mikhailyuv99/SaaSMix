"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface ObserveSectionProps {
  children: ReactNode;
  className?: string;
  rootMargin?: string;
}

export function ObserveSection({ children, className = "", rootMargin = "0px 0px -8% 0px" }: ObserveSectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setInView(true);
      },
      { threshold: 0.1, rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return (
    <div
      ref={ref}
      className={`observe-section ${inView ? "in-view" : ""} ${className}`}
    >
      {children}
    </div>
  );
}
