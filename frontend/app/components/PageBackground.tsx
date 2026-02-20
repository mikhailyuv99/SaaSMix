"use client";

export function PageBackground() {
  return (
    <div className="bg-fade-in fixed inset-0 z-0 pointer-events-none overflow-hidden bg-black" aria-hidden>
      <div
        className="absolute inset-0 origin-center scale-[1.08] blur-[6px]"
        aria-hidden
      >
        <picture className="absolute inset-0 block h-full w-full">
          <source srcSet="/background.avif" type="image/avif" />
          <source srcSet="/background.webp" type="image/webp" />
          <img
            src="/background.png"
            alt=""
            className="h-full w-full object-cover object-center"
            fetchPriority="high"
          />
        </picture>
      </div>
      <div
        className="absolute inset-0"
        style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
      />
    </div>
  );
}
