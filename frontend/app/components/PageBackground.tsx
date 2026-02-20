"use client";

export function PageBackground() {
  return (
    <div className="bg-fade-in fixed inset-0 z-0 pointer-events-none overflow-hidden bg-black" aria-hidden>
      <div
        className="absolute inset-0 origin-center scale-[1.08] blur-[6px]"
        style={{ overflow: "hidden" }}
        aria-hidden
      >
        <picture
          className="absolute inset-0 block h-full w-full"
          style={{ margin: 0 }}
        >
          <source srcSet="/background-1280.avif 1280w, /background-1920.avif 1920w" type="image/avif" sizes="100vw" />
          <source srcSet="/background-1280.webp 1280w, /background-1920.webp 1920w" type="image/webp" sizes="100vw" />
          <img
            src="/background.png"
            alt=""
            className="block h-full w-full object-cover object-center"
            style={{ minHeight: "100%", minWidth: "100%" }}
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
