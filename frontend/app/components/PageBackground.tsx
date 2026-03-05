"use client";

export function PageBackground() {
  return (
    <div className="bg-fade-in fixed inset-0 z-0 pointer-events-none overflow-hidden bg-[#14151c]" aria-hidden>
      <div
        className="absolute inset-0 origin-center scale-[1.08]"
        style={{ overflow: "hidden" }}
        aria-hidden
      >
        <picture className="absolute inset-0 block h-full w-full" style={{ margin: 0 }}>
          <source srcSet="/background-new.avif" type="image/avif" />
          <source srcSet="/background-new.webp" type="image/webp" />
          <img
            src="/background-new.png"
            alt=""
            className="block h-full w-full object-cover object-center blur-[24px]"
            style={{ minHeight: "100%", minWidth: "100%" }}
            fetchPriority="high"
          />
        </picture>
      </div>
      <div
        className="absolute inset-0"
        style={{ backgroundColor: "rgba(20, 21, 28, 0.45)" }}
      />
    </div>
  );
}
