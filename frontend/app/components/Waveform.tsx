"use client";

import { useCallback, useEffect, useMemo, useRef, memo } from "react";

export const WAVEFORM_POINTS = 200;

export function computeWaveformPeaks(buffer: AudioBuffer, numPoints: number): number[] {
  const data = buffer.length > 0 ? buffer.getChannelData(0) : new Float32Array(0);
  const blockSize = Math.floor(data.length / numPoints) || 1;
  const peaks: number[] = [];
  for (let i = 0; i < numPoints; i++) {
    const start = i * blockSize;
    let max = 0;
    for (let j = 0; j < blockSize && start + j < data.length; j++) {
      const v = Math.abs(data[start + j]);
      if (v > max) max = v;
    }
    peaks.push(max);
  }
  return peaks;
}

export const Waveform = memo(function Waveform({
  peaks,
  duration,
  currentTime,
  onSeek,
  className = "",
}: {
  peaks: number[];
  duration: number;
  currentTime?: number;
  onSeek: (time: number) => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  if (!peaks.length || duration <= 0) return null;
  const maxPeak = useMemo(() => Math.max(...peaks, 0.01), [peaks]);
  const playheadPercent = currentTime != null ? (currentTime / duration) * 100 : 0;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const dpr = typeof window !== "undefined" ? Math.min(2, window.devicePixelRatio || 1) : 1;
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    canvas.width = w;
    canvas.height = h;
    ctx.clearRect(0, 0, w, h);
    const cx = h / 2;
    const n = peaks.length;
    const barW = Math.max(1, w / n);
    ctx.fillStyle = "rgba(105, 163, 255, 0.35)";
    for (let i = 0; i < n; i++) {
      const halfH = (peaks[i]! / maxPeak) * (cx - 1);
      const x = (i / (n - 1 || 1)) * w;
      ctx.fillRect(Math.max(0, Math.floor(x - barW / 2)), Math.floor(cx - halfH), Math.ceil(barW) + 1, Math.ceil(halfH * 2));
    }
  }, [peaks, maxPeak]);

  useEffect(() => {
    draw();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [draw]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const fraction = Math.max(0, Math.min(1, x / rect.width));
    onSeek(fraction * duration);
  };

  return (
    <div
      ref={containerRef}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          const el = containerRef.current;
          if (el) {
            const rect = el.getBoundingClientRect();
            onSeek(0.5 * duration);
          }
        }
      }}
      className={`relative h-12 w-full cursor-pointer rounded-lg border border-white/[0.06] overflow-hidden transition-opacity hover:opacity-90 ${className}`}
      style={{ backgroundColor: "rgba(105,163,255,0.03)" }}
      title="Cliquer pour aller à ce moment"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full rounded-lg"
        style={{ backgroundColor: "transparent" }}
        width={0}
        height={0}
        aria-hidden
      />
      {currentTime != null && (
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white/60 pointer-events-none transition-[left] duration-75 ease-linear"
          style={{ left: `${playheadPercent}%` }}
        />
      )}
    </div>
  );
});
